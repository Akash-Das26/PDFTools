import type { Request, Response } from "express";
import { degrees } from "@cantoo/pdf-lib";
import type { RotatePdfOptionsInput } from "@workspace/api-zod";
import {
  badRequest,
  failTool,
  loadPdf,
  parsePageSelection,
  requirePdfFiles,
  sanitizeFileName,
  sendPdf,
  sendZip,
  type ZipEntry,
} from "./shared";

/**
 * Rotates every page or only the selected pages. A single upload is returned as
 * a PDF, multiple uploads come back as a ZIP — the same contract as before, now
 * with optional page targeting.
 *
 * `rotations` ("1:90,3:270") is the per-page override the picker's rotate
 * arrows post: a page named there rotates by its own clockwise delta instead
 * of the shared `rotation`, which still governs every other page in the
 * `pages` selection (or the whole document when empty). The zod schema
 * validates pair shape, degree multiples and duplicate pages; the page
 * numbers are checked against the real document here, the same way `pages`
 * is.
 */
function parsePerPageRotations(raw: string | undefined): Map<number, number> {
  if (!raw || raw.trim() === "") return new Map();
  const map = new Map<number, number>();
  for (const pair of raw.split(",")) {
    const [pagePart, degreesPart] = pair.trim().split(":");
    const page = Number(pagePart);
    const delta = Number(degreesPart);
    if (!Number.isInteger(page) || page < 1) {
      throw badRequest(`Rotation page "${pagePart}" is not a positive page number`);
    }
    map.set(page, delta);
  }
  return map;
}

export async function rotatePdf(req: Request, res: Response, options: RotatePdfOptionsInput): Promise<void> {
  try {
    const files = requirePdfFiles(req);
    const perPage = parsePerPageRotations(options.rotations);

    const rotateFile = async (buffer: Buffer): Promise<Buffer> => {
      const document = await loadPdf(buffer);
      const targetPages = parsePageSelection(options.pages, document.getPageCount());
      const pages = document.getPages();

      // Same strictness as `pages`: an out-of-range rotation page is a client
      // error, not a silent no-op.
      for (const pageNumber of perPage.keys()) {
        if (pageNumber > document.getPageCount()) {
          const count = document.getPageCount();
          throw badRequest(`Page ${pageNumber} is out of range — this PDF has ${count} page${count === 1 ? "" : "s"}`);
        }
      }

      for (const index of targetPages) {
        const page = pages[index];
        if (!page) continue;
        const pageNumber = index + 1;
        const delta = perPage.get(pageNumber) ?? options.rotation;
        const current = page.getRotation().angle;
        page.setRotation(degrees((((current + delta) % 360) + 360) % 360));
      }

      return Buffer.from(await document.save());
    };

    if (files.length === 1) {
      sendPdf(res, await rotateFile(files[0]!.buffer), "rotated.pdf");
      return;
    }

    const entries: ZipEntry[] = [];
    for (const file of files) {
      entries.push({
        name: `rotated-${sanitizeFileName(file.originalname, "document.pdf")}`,
        data: await rotateFile(file.buffer),
      });
    }

    await sendZip(res, entries, "rotated.zip");
  } catch (err) {
    failTool(req, res, err, "Rotate failed", "Failed to rotate PDF");
  }
}
