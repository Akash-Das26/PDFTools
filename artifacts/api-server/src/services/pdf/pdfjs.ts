import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import type { PDFParse as PDFParseClass } from "pdf-parse";
import { logger } from "../../lib/logger";

// Polyfill the browser globals pdfjs-dist expects to find on the global object.
//
// The canvas package (already a dependency of the image tools) supplies real
// implementations, and real ones are required: pdfjs's *renderer* builds content
// paths with `Path2D` and transforms them with `DOMMatrix`, so bare stubs are
// only enough for text extraction. With a stubbed `Path2D` any page that draws
// vector paths — which is every page produced by a word processor, including a
// PDF this API converted itself — dies in `moveTo is not a function`, breaking
// page-info thumbnails, PDF to JPG and OCR.
//
// This module must be imported before `pdf-parse` is required anywhere in the
// API server, because pdfjs-dist reads these globals at module load.
const pdfGlobals = globalThis as Record<string, unknown>;
if (pdfGlobals.DOMMatrix === undefined) pdfGlobals.DOMMatrix = DOMMatrix;
if (pdfGlobals.ImageData === undefined) pdfGlobals.ImageData = ImageData;
if (pdfGlobals.Path2D === undefined) pdfGlobals.Path2D = Path2D;

type PDFParseInstance = InstanceType<typeof PDFParseClass>;

type PDFParseConstructor = new (options: { data: Buffer }) => PDFParseInstance;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as { PDFParse: PDFParseConstructor };

export interface ExtractedText {
  text: string;
  pageCount: number;
  /** Text of each parsed page, in the order the pages were requested. */
  pages: Array<{ num: number; text: string }>;
}

export interface PdfPageSelection {
  /** 0-based page indices. Omit for the whole document. */
  indices?: number[];
}

function toPartial(indices: number[] | undefined): number[] | undefined {
  return indices?.map((index) => index + 1);
}

/**
 * Opens a pdf-parse session, always destroying the parser when the callback settles.
 *
 * Per-request isolation: every call gets a fresh parser whose pdfjs document is
 * destroyed before the promise settles, so poisoned parser state cannot leak
 * between requests. `destroy()` itself is guarded — on a malformed document the
 * underlying pdfjs teardown can reject too, and letting THAT escape the finally
 * would mask the caller's real error; it is logged instead. Any rejection that
 * still escapes pdfjs's internals (its `getDocument` fires fire-and-forget
 * cleanup promises on malformed input) lands in index.ts's process-level
 * `unhandledRejection` containment — see Open Item 17 in REVIEW.md.
 */
export async function withPdfParser<T>(
  buffer: Buffer,
  run: (parser: PDFParseInstance) => Promise<T>,
): Promise<T> {
  const parser = new PDFParse({ data: buffer });
  try {
    return await run(parser);
  } finally {
    try {
      await parser.destroy();
    } catch (destroyError) {
      logger.warn({ err: destroyError }, "pdf-parse destroy() rejected after a failed parse (contained)");
    }
  }
}

export async function extractPdfText(buffer: Buffer, selection: PdfPageSelection = {}): Promise<ExtractedText> {
  return withPdfParser(buffer, async (parser) => {
    const result = await parser.getText({ partial: toPartial(selection.indices) });
    return {
      text: result.text,
      pageCount: result.total,
      pages: result.pages.map((page) => ({ num: page.num, text: page.text })),
    };
  });
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  return withPdfParser(buffer, async (parser) => (await parser.getInfo()).total);
}

export interface RenderedPage {
  /** 1-based page number. */
  pageNumber: number;
  /** PNG encoded page render. */
  png: Buffer;
  width: number;
  height: number;
}

/**
 * Renders pages to PNG buffers. Rendering goes through pdfjs + @napi-rs/canvas
 * inside pdf-parse, which is why this lives next to the text helpers.
 */
export async function renderPdfPages(
  buffer: Buffer,
  options: { indices: number[]; width: number },
): Promise<RenderedPage[]> {
  return withPdfParser(buffer, async (parser) => {
    const result = await parser.getScreenshot({
      partial: options.indices.map((index) => index + 1),
      desiredWidth: options.width,
      imageBuffer: true,
      imageDataUrl: false,
    });

    return result.pages.map((page) => ({
      pageNumber: page.pageNumber,
      png: Buffer.from(page.data),
      width: page.width,
      height: page.height,
    }));
  });
}
