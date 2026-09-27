import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import type {
  ExcelToPdfOptionsInput,
  PptToPdfOptionsInput,
  WordToPdfOptionsInput,
} from "@workspace/api-zod";
import {
  ToolError,
  badRequest,
  baseName,
  failTool,
  requireUploadedFile,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * Word / PowerPoint / Excel → PDF through a headless LibreOffice.
 *
 * The three tools differ only in which document family comes in, so one service
 * covers them: write the upload to a temp directory, ask LibreOffice's PDF export
 * filter for a file, stream the result back. `soffice` is a system dependency
 * rather than an npm one, so it is located at call time and reported honestly
 * (503) when this host does not have it.
 */

const execFileAsync = promisify(execFile);

/** Overridable for tests and for hosts with a non-PATH install. */
const SOFFICE_BIN = process.env.SOFFICE_BIN?.trim() || "soffice";

/** LibreOffice is slow to start (~1-3s cold) but must never hang a request forever. */
const CONVERT_TIMEOUT_MS = 120_000;

type OfficeKind = "word" | "ppt" | "excel";

interface OfficeFormat {
  /** The family's PDF export filter — the PDF/A level rides along as filter data. */
  filter: string;
  /** Extensions the catalog's Configure panels accept, in the same order. */
  extensions: string[];
  /** Member that must exist inside an OOXML container (".docx"/".pptx"/".xlsx"). */
  ooxmlPart: string;
  /** How the file is named in error messages. */
  label: string;
}

const FORMATS: Record<OfficeKind, OfficeFormat> = {
  word: {
    filter: "writer_pdf_Export",
    extensions: [".doc", ".docx"],
    ooxmlPart: "word/document.xml",
    label: "Word document",
  },
  ppt: {
    filter: "impress_pdf_Export",
    extensions: [".ppt", ".pptx"],
    ooxmlPart: "ppt/presentation.xml",
    label: "PowerPoint presentation",
  },
  excel: {
    filter: "calc_pdf_Export",
    extensions: [".xls", ".xlsx"],
    ooxmlPart: "xl/workbook.xml",
    label: "Excel workbook",
  },
};

/** OOXML packages are ZIPs; the legacy binary formats are OLE compound files. */
const OOXML_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/**
 * LibreOffice's `SelectPdfVersion` filter option: 0 is plain PDF 1.7, 1/2/3 are
 * PDF/A-1b, -2b and -3b. Verified against the writer, calc and impress filters —
 * each writes a `pdfaid:part` XMP packet when a level is selected.
 */
const PDFA_LEVELS: Record<string, string | null> = {
  off: null,
  "1b": "1",
  "2b": "2",
  "3b": "3",
};

function extensionOf(name: string): string {
  const match = /\.[a-z0-9]{1,5}$/i.exec(name);
  return match ? match[0].toLowerCase() : "";
}

let sofficePath: string | null | undefined;

/**
 * Locates `soffice` once, preferring `SOFFICE_BIN`. Returns null when the host
 * has no LibreOffice, which the routes surface as an honest 503 instead of
 * failing the request with a generic 500.
 */
async function findSoffice(): Promise<string | null> {
  if (sofficePath !== undefined) return sofficePath;
  const found = await execFileAsync("which", [SOFFICE_BIN], { timeout: 5000 })
    .then((result) => result.stdout.trim())
    .catch(() => "");
  sofficePath = found || null;
  return sofficePath;
}

/**
 * Rejects files that are not what the tool claims to convert.
 *
 * The extension check alone is not enough: LibreOffice happily "converts" a
 * `.docx` full of plain text into a PDF containing that text and exits 0, so a
 * mislabelled or truncated file would silently produce a document the user never
 * asked for. The container is therefore sniffed first — a ZIP header plus the
 * family's main part for OOXML, the OLE header for the binary formats.
 */
function assertConvertible(file: Express.Multer.File, format: OfficeFormat): void {
  const extension = extensionOf(file.originalname);

  if (!format.extensions.includes(extension)) {
    throw badRequest(
      `This tool converts ${format.extensions.join(" and ")} files, and "${file.originalname}" is not one of them.`,
    );
  }

  if (extension === ".doc" || extension === ".ppt" || extension === ".xls") {
    if (!file.buffer.subarray(0, OLE_MAGIC.length).equals(OLE_MAGIC)) {
      throw unprocessable(
        `That file isn't a valid ${format.label} — the ${extension} header could not be read.`,
      );
    }
    return;
  }

  const isZip = file.buffer.subarray(0, OOXML_MAGIC.length).equals(OOXML_MAGIC);
  // The member name appears in the ZIP central directory, so a plain search is
  // enough to tell an empty/broken archive from a real document package.
  const hasMainPart = file.buffer.includes(Buffer.from(format.ooxmlPart, "latin1"));
  if (!isZip || !hasMainPart) {
    throw unprocessable(
      `That file isn't a valid ${format.label} — the document package inside it is missing or damaged.`,
    );
  }
}

/**
 * Builds the `--convert-to` argument.
 *
 * The value is `pdf:<family filter>[:<filter data>]` — the leading `pdf:` names
 * the output format and is not optional. Without it LibreOffice reads the filter
 * name as a file extension and aborts with "no export filter for input.writer_pdf_Export".
 */
function filterSpec(format: OfficeFormat, pdfa: string | undefined, fitToPage: boolean): string {
  const data: Record<string, { type: string; value: string }> = {};
  const level = PDFA_LEVELS[pdfa ?? "off"];
  if (level) data.SelectPdfVersion = { type: "long", value: level };
  // Calc only: scales each sheet so its used range fits a single page.
  if (fitToPage) data.SinglePageSheets = { type: "boolean", value: "true" };

  const filter = `pdf:${format.filter}`;
  return Object.keys(data).length > 0 ? `${filter}:${JSON.stringify(data)}` : filter;
}

/**
 * Runs the conversion in an isolated temp directory. Each request gets its own
 * `UserInstallation` profile because LibreOffice refuses to start twice on one
 * profile — that is what makes concurrent conversions safe.
 */
async function convert(file: Express.Multer.File, format: OfficeFormat, filter: string): Promise<Buffer> {
  const workdir = await mkdtemp(join(tmpdir(), "pdf-office-"));
  try {
    const inputName = `input${extensionOf(file.originalname)}`;
    const inputPath = join(workdir, inputName);
    const outDir = join(workdir, "out");
    await mkdir(outDir);
    await writeFile(inputPath, file.buffer);

    const binary = await findSoffice();
    if (!binary) {
      throw new ToolError(
        503,
        "Office conversion is unavailable on this server — LibreOffice (soffice) is not installed.",
      );
    }

    try {
      await execFileAsync(
        binary,
        [
          `-env:UserInstallation=file://${join(workdir, "profile")}`,
          "--headless",
          "--norestore",
          "--nolockcheck",
          "--nologo",
          "--nodefault",
          "--convert-to",
          filter,
          "--outdir",
          outDir,
          inputPath,
        ],
        { timeout: CONVERT_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024 },
      );
    } catch (err) {
      const failure = err as NodeJS.ErrnoException & { killed?: boolean };
      if (failure.code === "ENOENT") {
        throw new ToolError(
          503,
          "Office conversion is unavailable on this server — LibreOffice (soffice) is not installed.",
        );
      }
      if (failure.killed) {
        throw new ToolError(
          504,
          "The conversion took too long and was stopped. Try a smaller document.",
        );
      }
      throw err;
    }

    const produced = join(outDir, `${inputName.replace(/\.[a-z0-9]{1,5}$/i, "")}.pdf`);
    try {
      return await readFile(produced);
    } catch {
      // LibreOffice either failed to open the document or wrote nothing usable.
      throw unprocessable(
        `LibreOffice could not convert this ${format.label}. It may be password protected or damaged.`,
      );
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

async function officeToPdf(
  req: Request,
  res: Response,
  kind: OfficeKind,
  options: { pdfa?: string; fitToPage?: boolean },
  logLabel: string,
  fallback: string,
): Promise<void> {
  try {
    const format = FORMATS[kind];
    const file = requireUploadedFile(req, `A ${format.label} file is required`);
    assertConvertible(file, format);

    const pdf = await convert(file, format, filterSpec(format, options.pdfa, options.fitToPage ?? false));
    sendPdf(res, pdf, `${baseName(file.originalname, "document")}.pdf`);
  } catch (err) {
    failTool(req, res, err, logLabel, fallback);
  }
}

export async function wordToPdf(req: Request, res: Response, options: WordToPdfOptionsInput): Promise<void> {
  await officeToPdf(req, res, "word", options, "Word to PDF failed", "Failed to convert the Word document");
}

export async function pptToPdf(req: Request, res: Response, options: PptToPdfOptionsInput): Promise<void> {
  await officeToPdf(req, res, "ppt", options, "PowerPoint to PDF failed", "Failed to convert the presentation");
}

export async function excelToPdf(req: Request, res: Response, options: ExcelToPdfOptionsInput): Promise<void> {
  await officeToPdf(req, res, "excel", options, "Excel to PDF failed", "Failed to convert the spreadsheet");
}
