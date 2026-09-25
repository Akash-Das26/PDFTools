import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import { sendPdf } from "./shared";

/**
 * Combines every uploaded PDF in upload order. Files that cannot be parsed are
 * skipped with a warning rather than failing the whole request.
 */
export async function mergePdfs(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length < 2) {
      res.status(400).json({ error: "At least 2 PDF files are required" });
      return;
    }

    const merged = await PDFDocument.create();

    for (const file of files) {
      try {
        const source = await PDFDocument.load(file.buffer);
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      } catch {
        req.log.warn({ filename: file.originalname }, "Skipping invalid PDF");
      }
    }

    sendPdf(res, Buffer.from(await merged.save()), "merged.pdf");
  } catch (err) {
    req.log.error({ err }, "Merge failed");
    res.status(500).json({ error: "Failed to merge PDFs" });
  }
}
