import type { Request, Response } from "express";
import type { RedactPdfOptionsInput } from "@workspace/api-zod";
import {
  badRequest,
  baseName,
  failTool,
  requirePdfFile,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * Redact Sensitive Data — real content removal, not black rectangles over text.
 *
 * The service is mupdf (WASM): every search term is located as quads on each
 * page, a Redact annotation is placed over each hit, and `applyRedactions`
 * deletes the underlying text objects before the document is saved — the
 * strings are gone from the file, not merely painted over. mupdf is loaded
 * through a dynamic import: it is an ESM/WASM module with top-level await,
 * and the esbuild bundle keeps it external (like tesseract.js) so the wasm
 * blob is read from node_modules at runtime rather than inlined.
 *
 * The mupdf types below are structural on purpose: the package's own d.ts
 * models its class hierarchy in ways that do not survive the dynamic import
 * under `moduleResolution: bundler`, and every method used here is the probed,
 * documented API surface (search → quads → createAnnotation("Redact") →
 * setRect([x0,y0,x1,y1]) → applyRedactions(true) → saveToBuffer("compress")).
 * `mupdf.Rect` is a plain object namespace, not a constructor — plain number
 * arrays are what setRect takes.
 *
 * Matching is literal and case-insensitive (mupdf's "ignore-case" search
 * option — no regex, no patterns). All terms are annotated first, then
 * redactions are applied once per page, so overlapping terms cannot fight
 * over the same text. A term with zero hits is visible in the per-term
 * accounting; a run that removes nothing is a 422 rather than an unchanged
 * file.
 */

interface MupdfRedactionAnnotation {
  setRect(rect: number[]): void;
}

interface MupdfPage {
  /**
   * Returns hits — one per match, each hit an array of quads (a match that
   * spans a line break contributes several). One quad is
   * [x0,y0,x1,y0,x1,y1,x0,y1]. The only option mupdf's wasm accepts is the
   * string "ignore-case" (verified against the wasm: "IGNORECASE" and object
   * shapes are rejected with "Unused search arguments found").
   */
  search(term: string, options?: string): number[][][];
  createAnnotation(type: "Redact"): MupdfRedactionAnnotation;
  applyRedactions(blackBoxes: boolean): void;
}

interface MupdfDocument {
  countPages(): number;
  loadPage(index: number): MupdfPage;
  saveToBuffer(options: "compress" | "deflate" | "none"): { asUint8Array(): Uint8Array };
  destroy?(): void;
}

interface MupdfModule {
  PDFDocument: {
    openDocument(data: Buffer | Uint8Array, mime: "application/pdf"): MupdfDocument;
  };
}

let mupdfModule: MupdfModule | null = null;

/** mupdf's WASM build uses top-level await — import it lazily, once. */
async function getMupdf(): Promise<MupdfModule> {
  if (!mupdfModule) {
    mupdfModule = (await import("mupdf")) as unknown as MupdfModule;
  }
  return mupdfModule;
}

/** Parses the posted terms JSON array into clean search strings. */
function parseTerms(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest('"terms" is not valid JSON — send an array of strings');
  }
  if (!Array.isArray(parsed)) {
    throw badRequest('"terms" must be a JSON array of strings, e.g. ["Secret", "someone@example.com"]');
  }
  const terms = parsed
    .map((term): string => (typeof term === "string" ? term.trim() : ""))
    .filter((term) => term.length > 0);
  if (terms.length === 0) {
    throw badRequest("List at least one term to redact");
  }
  return terms;
}

export async function redactPdf(
  req: Request,
  res: Response,
  options: RedactPdfOptionsInput,
): Promise<void> {
  let out: Buffer;
  try {
    const file = requirePdfFile(req);
    const terms = parseTerms(options.terms);

    const mupdf = await getMupdf();
    const mdoc = mupdf.PDFDocument.openDocument(file.buffer, "application/pdf");

    let total = 0;
    const perTerm = new Map<string, number>(terms.map((term): [string, number] => [term, 0]));
    try {
      const pageCount = mdoc.countPages();
      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const page = mdoc.loadPage(pageIndex);
        let markedOnPage = 0;
        for (const term of terms) {
          // Iterate hits, then the quads inside each hit. Feeding setRect a
          // whole hit (or a mis-indexed quad) produces NaN coordinates, and a
          // NaN-rect redaction wipes the page's entire text — the failure the
          // first probe's `hits[0][0]` indexing silently avoided.
          for (const hit of page.search(term, "ignore-case")) {
            for (const quad of hit) {
              const xs = [quad[0], quad[2], quad[4], quad[6]];
              const ys = [quad[1], quad[3], quad[5], quad[7]];
              const annot = page.createAnnotation("Redact");
              annot.setRect([
                Math.min(...xs),
                Math.min(...ys),
                Math.max(...xs),
                Math.max(...ys),
              ]);
              markedOnPage += 1;
              perTerm.set(term, (perTerm.get(term) ?? 0) + 1);
            }
          }
        }
        // Applied once per page, after every term is marked — applyRedactions
        // deletes what is under each Redact annotation and paints the black box.
        if (markedOnPage > 0) {
          page.applyRedactions(true);
          total += markedOnPage;
        }
      }

      if (total === 0) {
        throw unprocessable(
          `None of the terms were found in the document: ${terms.map((t: string) => `"${t}"`).join(", ")}. ` +
            "Redaction matches exact text (case-insensitive) — check spelling, or extract the text first to see what the document contains.",
        );
      }

      out = Buffer.from(mdoc.saveToBuffer("compress").asUint8Array());
    } finally {
      // mupdf objects hold WASM memory; release the document eagerly.
      mdoc.destroy?.();
    }

    sendPdf(res, out, `${baseName(file.originalname, "document")}-redacted.pdf`);
    req.log.info({ terms: terms.length, redactions: total }, "pdf redacted");
  } catch (err) {
    failTool(req, res, err, "Redact failed", "Failed to redact the PDF");
  }
}
