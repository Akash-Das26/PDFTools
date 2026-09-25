import type { Request, Response } from "express";
import { degrees } from "@cantoo/pdf-lib";
import type { RotatePdfOptionsInput } from "@workspace/api-zod";
import {
  failTool,
  loadPdf,
  parsePageSelection,
  requireUploadedFiles,
  sanitizeFileName,
  sendPdf,
  sendZip,
  type ZipEntry,
} from "./shared";

/**
 * Rotates every page or only the selected pages. A single upload is returned as
 * a PDF, multiple uploads come back as a ZIP — the same contract as before, now
 * with optional page targeting.
 */
export async function rotatePdf(req: Request, res: Response, options: RotatePdfOptionsInput): Promise<void> {
  try {
    const files = requireUploadedFiles(req);

    const rotateFile = async (buffer: Buffer): Promise<Buffer> => {
      const document = await loadPdf(buffer);
      const targetPages = parsePageSelection(options.pages, document.getPageCount());
      const pages = document.getPages();

      for (const index of targetPages) {
        const page = pages[index];
        if (!page) continue;
        const current = page.getRotation().angle;
        page.setRotation(degrees((((current + options.rotation) % 360) + 360) % 360));
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
