import type { PDFParse as PDFParseClass } from "pdf-parse";

// Polyfill browser globals that pdfjs-dist requires even in Node.js text-extraction mode
// (DOMMatrix, ImageData, Path2D are not available in Node.js but pdfjs initialises them at module load).
// This module must be imported before `pdf-parse` is required anywhere in the API server.
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    a=1;b=0;c=0;d=1;e=0;f=0;
    m11=1;m12=0;m13=0;m14=0;
    m21=0;m22=1;m23=0;m24=0;
    m31=0;m32=0;m33=1;m34=0;
    m41=0;m42=0;m43=0;m44=1;
    is2D=true;isIdentity=true;
    constructor(_init?: unknown) {}
    multiply(_other?: unknown) { return this; }
    translate(_tx?: number, _ty?: number, _tz?: number) { return this; }
    scale(_sx?: number, _sy?: number, _sz?: number, _ox?: number, _oy?: number, _oz?: number) { return this; }
    rotate(_angle?: number) { return this; }
    rotateAxisAngle(_x?: number, _y?: number, _z?: number, _angle?: number) { return this; }
    skewX(_angle?: number) { return this; }
    skewY(_angle?: number) { return this; }
    flipX() { return this; }
    flipY() { return this; }
    inverse() { return this; }
    transformPoint(_point?: unknown) { return { x: 0, y: 0, z: 0, w: 1 }; }
    toFloat32Array() { return new Float32Array(16); }
    toFloat64Array() { return new Float64Array(16); }
    toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
  };
}
if (typeof (globalThis as Record<string, unknown>).ImageData === "undefined") {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(w: number, h: number) { this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); }
  };
}
if (typeof (globalThis as Record<string, unknown>).Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = class Path2D {};
}

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

/** Opens a pdf-parse session, always destroying the parser when the callback settles. */
export async function withPdfParser<T>(
  buffer: Buffer,
  run: (parser: PDFParseInstance) => Promise<T>,
): Promise<T> {
  const parser = new PDFParse({ data: buffer });
  try {
    return await run(parser);
  } finally {
    await parser.destroy();
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
