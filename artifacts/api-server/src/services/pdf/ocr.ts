import type { Request, Response } from "express";
import { mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { OcrPdfOptionsInput } from "@workspace/api-zod";
import { toMarkdown } from "./export-text";
import { getPdfPageCount, renderPdfPages, type RenderedPage } from "./pdfjs";
import {
  badRequest,
  baseName,
  failTool,
  loadPdf,
  parsePageSelection,
  requirePdfFile,
  sendBuffer,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * Rendered page width used for OCR. Tesseract wants roughly 300 DPI; ~2000px
 * across a letter page lands close to that without the memory cost of a larger
 * render (each page is held as a PNG in memory while it is recognised).
 */
const RENDER_WIDTH = 2000;

/** OCR is CPU heavy, so a single request processes a bounded number of pages. */
const MAX_OCR_PAGES = 50;

/** CJK recognition is markedly slower per page, so those scripts get a lower cap. */
const MAX_OCR_PAGES_CJK = 20;

/** Languages whose recognition pass is slow enough to warrant the lower page cap. */
const CJK_LANGUAGES = new Set<OcrPdfOptionsInput["language"]>(["chi_sim", "chi_tra", "jpn", "kor"]);

type OcrLanguage = OcrPdfOptionsInput["language"];

interface LangData {
  code: string;
  gzip: boolean;
  langPath: string;
}

/**
 * Language packs are read from `@tesseract.js-data/<code>` on disk, so only the
 * packs that ship with the server can be recognised. These are static requires
 * (rather than a template lookup) so the bundler can see each one; adding a
 * language means installing its data package, adding it here, and widening
 * `OCR_LANGUAGES` in `@workspace/api-zod` so the API rejects unknown codes.
 */
const LANG_DATA: Record<OcrLanguage, LangData> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  eng: require("@tesseract.js-data/eng") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  spa: require("@tesseract.js-data/spa") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  fra: require("@tesseract.js-data/fra") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  deu: require("@tesseract.js-data/deu") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ita: require("@tesseract.js-data/ita") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  por: require("@tesseract.js-data/por") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nld: require("@tesseract.js-data/nld") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  rus: require("@tesseract.js-data/rus") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  pol: require("@tesseract.js-data/pol") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  tur: require("@tesseract.js-data/tur") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ara: require("@tesseract.js-data/ara") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  hin: require("@tesseract.js-data/hin") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  heb: require("@tesseract.js-data/heb") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  chi_sim: require("@tesseract.js-data/chi_sim") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  chi_tra: require("@tesseract.js-data/chi_tra") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jpn: require("@tesseract.js-data/jpn") as LangData,
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  kor: require("@tesseract.js-data/kor") as LangData,
};

/** Decompressed traineddata lands here instead of the process working directory. */
const CACHE_DIR = path.join(os.tmpdir(), "pdftools-tessdata");

interface OcrResult {
  data: { text: string; pdf?: Uint8Array };
}

interface OcrWorker {
  recognize(
    image: Buffer,
    options?: Record<string, unknown>,
    output?: Record<string, unknown>,
  ): Promise<OcrResult>;
  setParameters(params: Record<string, string>): Promise<unknown>;
  terminate(): Promise<void>;
}

interface TesseractModule {
  createWorker(
    langs?: string,
    oem?: number,
    options?: Record<string, unknown>,
  ): Promise<OcrWorker>;
}

function loadTesseract(): TesseractModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("tesseract.js") as TesseractModule;
}

/**
 * One worker is created per language, lazily, and reused across requests:
 * spinning up the WASM core and loading traineddata takes a few hundred
 * milliseconds, so rebuilding it per request would dominate the runtime. A
 * failed creation clears that language's cache entry so the next request can
 * retry instead of being stuck with a rejected promise.
 */
const workers = new Map<OcrLanguage, Promise<OcrWorker>>();

function getWorker(language: OcrLanguage): Promise<OcrWorker> {
  let worker = workers.get(language);
  if (!worker) {
    const { createWorker } = loadTesseract();
    mkdirSync(CACHE_DIR, { recursive: true });
    const data = LANG_DATA[language];
    worker = createWorker(language, undefined, {
      langPath: data.langPath,
      cachePath: CACHE_DIR,
      gzip: data.gzip,
    }).catch((err: unknown) => {
      workers.delete(language);
      throw err;
    });
    workers.set(language, worker);
  }
  return worker;
}

function selectPages(
  raw: string | undefined,
  totalPages: number,
  language: OcrLanguage,
): number[] {
  const indices = parsePageSelection(raw, totalPages);
  const limit = CJK_LANGUAGES.has(language) ? MAX_OCR_PAGES_CJK : MAX_OCR_PAGES;
  if (indices.length > limit) {
    throw badRequest(
      `OCR is limited to ${limit} pages per request for this language — ${indices.length} were selected. Split the document first.`,
    );
  }
  return indices;
}

/**
 * Recognises the selected pages and downloads the text as `.txt` or Markdown.
 * Pages are rendered to images first, so scanned documents without a text layer
 * are handled the same as born-digital ones.
 */
async function exportRecognisedText(
  res: Response,
  file: Express.Multer.File,
  options: OcrPdfOptionsInput,
): Promise<void> {
  const totalPages = await getPdfPageCount(file.buffer);
  const indices = selectPages(options.pages, totalPages, options.language);
  const rendered = await renderPdfPages(file.buffer, { indices, width: RENDER_WIDTH });
  const worker = await getWorker(options.language);

  const pages: Array<{ num: number; text: string }> = [];
  for (const page of rendered) {
    const result = await worker.recognize(page.png, {}, { text: true });
    pages.push({ num: page.pageNumber, text: (result.data.text ?? "").trim() });
  }

  const withText = pages.filter((page) => page.text.length > 0);
  if (withText.length === 0) {
    throw unprocessable(
      "No text could be recognised. The scan may be too blurry or low resolution — try a clearer copy.",
    );
  }

  const name = baseName(file.originalname, "document");
  if (options.format === "md") {
    sendBuffer(res, Buffer.from(toMarkdown(name, withText, totalPages), "utf8"), {
      filename: `${name}.md`,
      contentType: "text/markdown; charset=utf-8",
    });
    return;
  }

  sendBuffer(res, Buffer.from(withText.map((page) => page.text).join("\n\n"), "utf8"), {
    filename: `${name}.txt`,
    contentType: "text/plain; charset=utf-8",
  });
}

/**
 * Recognises the pages and returns the document with an invisible text layer
 * added — the shared half of `mode=searchable-pdf` and of Scan to PDF's
 * "searchable" option, so both build the layer the same way.
 *
 * Tesseract renders a page image plus that layer, so each page is recognised
 * straight to a PDF and the pages are merged. Feeding Tesseract the original
 * page width (through `user_defined_dpi`) keeps the output at the same
 * dimensions as the source instead of the image resolution.
 *
 * The text layer is written by Tesseract itself, whose PDF renderer emits a
 * ToUnicode CMap for every recognised script. That is verified for the CJK
 * languages too, so no Unicode font needs to be embedded here — the extracted
 * text of a searchable CJK page matches the OCR output exactly.
 */
export async function makeSearchablePdf(
  buffer: Buffer,
  options: { language: OcrLanguage; pages?: string },
): Promise<Buffer> {
  const document = await loadPdf(buffer);
  const totalPages = document.getPageCount();
  const indices = selectPages(options.pages, totalPages, options.language);
  const pageSizes = document.getPages().map((page) => page.getSize());

  const rendered = await renderPdfPages(buffer, { indices, width: RENDER_WIDTH });
  const worker = await getWorker(options.language);
  const output = await PDFDocument.create();
  let recognised = 0;

  for (const page of rendered) {
    const dpi = dpiFor(page, pageSizes[page.pageNumber - 1]);
    await worker.setParameters({ user_defined_dpi: String(dpi) });

    const result = await worker.recognize(page.png, {}, { pdf: true });
    if (!result.data.pdf) {
      throw unprocessable("The OCR engine did not return a PDF for one of the pages. Try again.");
    }
    if (result.data.text.trim().length > 0) recognised += 1;

    const pageDoc = await PDFDocument.load(result.data.pdf);
    const [copied] = await output.copyPages(pageDoc, [0]);
    if (copied) output.addPage(copied);
  }

  if (recognised === 0) {
    throw unprocessable(
      "No text could be recognised, so there would be nothing to search. Try a clearer scan.",
    );
  }

  return Buffer.from(await output.save());
}

/**
 * Path used by `mode=searchable-pdf`: recognises the pages and returns the same
 * document with an invisible text layer added.
 */
async function exportSearchablePdf(
  res: Response,
  file: Express.Multer.File,
  options: OcrPdfOptionsInput,
): Promise<void> {
  const bytes = await makeSearchablePdf(file.buffer, {
    language: options.language,
    pages: options.pages,
  });
  sendPdf(res, bytes, `${baseName(file.originalname, "document")}-ocr.pdf`);
}

/** DPI that makes Tesseract's page match `size` (in points) at the render width. */
function dpiFor(page: RenderedPage, size: { width: number } | undefined): number {
  const targetWidth = size?.width ?? 0;
  const dpi = targetWidth > 0 ? Math.round((page.width * 72) / targetWidth) : 300;
  return Math.min(1200, Math.max(30, dpi));
}

export async function ocrPdf(req: Request, res: Response, options: OcrPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);

    if (options.mode === "searchable-pdf") {
      await exportSearchablePdf(res, file, options);
    } else {
      await exportRecognisedText(res, file, options);
    }

    req.log.info({ mode: options.mode, language: options.language }, "OCR complete");
  } catch (err) {
    failTool(req, res, err, "OCR failed", "Failed to recognise text in PDF");
  }
}
