import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { extractPdfText } from "./pdfjs";

const execFileAsync = promisify(execFile);

export interface ExtractedDoc {
  text: string;
  pageCount: number;
  pages: Array<{ num: number; text: string }>;
}

let pdftotextPath: string | null | undefined;

/**
 * Locates `pdftotext` (poppler) once. Its bidi handling produces logical-order
 * text for right-to-left scripts, where pdf-parse returns each word with its
 * characters reversed, so it is preferred whenever it is on PATH.
 */
async function findPdftotext(): Promise<string | null> {
  if (pdftotextPath !== undefined) return pdftotextPath;
  const candidate = await execFileAsync("which", ["pdftotext"], { timeout: 5000 })
    .then((r) => r.stdout.trim())
    .catch(() => "");
  pdftotextPath = candidate || null;
  return pdftotextPath;
}

/** True when the text contains RTL script characters (Arabic, Hebrew, etc.). */
function hasRtl(text: string): boolean {
  return /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Per-page text via poppler. Poppler inserts its own page separator, so the
 * buffer is split on the `page N` markers it emits (with `-layout` the marker
 * still appears at the top of each page).
 */
async function extractWithPdftotext(buffer: Buffer, pdftotext: string): Promise<ExtractedDoc> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "compare-pdf-"));
  try {
    const pdfPath = path.join(dir, "input.pdf");
    await writeFile(pdfPath, buffer);

    const { stdout } = await execFileAsync(
      pdftotext,
      ["-enc", "UTF-8", "-layout", pdfPath, "-"],
      { maxBuffer: 64 * 1024 * 1024, timeout: 60000 },
    );

    // Pages are 1-based; page text keeps its trailing newline so splitting is stable.
    const chunks = stdout.split(/\f/g);
    const pages = chunks
      .map((chunk, index) => ({ num: index + 1, text: chunk.replace(/\n+$/, "") }))
      .filter((page) => page.num <= chunks.length && (page.text.trim().length > 0 || chunks.length === 1));

    const pageCount = pages.length;
    return { text: stdout, pageCount, pages };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Extracts per-page text for the Compare tool. pdf-parse is used for LTR
 * documents (no temp files, faster), while documents containing RTL script go
 * through poppler's `pdftotext`, which emits logical-order text instead of the
 * visually-reversed words pdf-parse produces for Arabic and Hebrew.
 *
 * When pdftotext is unavailable, extraction falls back to pdf-parse for every
 * document and RTL diffs degrade to the previously-garbled output — recorded
 * in `.agents/memory/pdf-tool-dependencies.md`.
 */
export async function extractDoc(buffer: Buffer): Promise<ExtractedDoc> {
  const quick = await extractPdfText(buffer);
  if (!hasRtl(quick.text)) return quick;

  const pdftotext = await findPdftotext();
  if (!pdftotext) return quick;

  try {
    return await extractWithPdftotext(buffer, pdftotext);
  } catch {
    // Corrupt edge cases can make poppler fail where pdf-parse succeeded;
    // a garbled diff still beats a failed request.
    return quick;
  }
}
