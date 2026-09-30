import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import { getPdfPageCount } from "./pdfjs";
import { loadPdfViaWorker } from "./parse-worker";
import { sendPdf } from "./shared";

/**
 * Combines every uploaded PDF in upload order. Files that cannot be parsed —
 * or that only pdf-lib's lazy load will accept (the independent pdfjs parser
 * refuses them or disagrees on the page count) — are skipped rather than
 * failing the whole request, but the skip is DISCLOSED, not silent: the
 * `X-PDF-Skipped-Files` header carries the count and the log names the files
 * (Open Item 20 — the audit's "silent 200" finding).
 */
export async function mergePdfs(req: Request, res: Response): Promise<void> {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length < 2) {
      res.status(400).json({ error: "At least 2 PDF files are required" });
      return;
    }

    const merged = await PDFDocument.create();
    const skipped: string[] = [];

    for (const file of files) {
      try {
        // Worker-normalised load (Item 32): the parse runs in a
        // terminated-on-deadline worker thread; the document is rebuilt from
        // the normalised bytes it returns.
        const { document: source } = await loadPdfViaWorker(file.buffer);
        // Cross-check with the independent parser before trusting the load:
        // pdf-lib resolves lazily, so trailer-level damage "loads" and would
        // silently merge a mangled page tree without this.
        const jsPageCount = await getPdfPageCount(file.buffer);
        if (jsPageCount !== source.getPageCount()) {
          throw new Error(
            `page count mismatch: pdfjs ${jsPageCount} vs pdf-lib ${source.getPageCount()}`,
          );
        }
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      } catch (err) {
        skipped.push(file.originalname);
        req.log.warn(
          { err, filename: file.originalname },
          "Skipping unparseable PDF during merge",
        );
      }
    }

    if (skipped.length > 0) {
      res.set("X-PDF-Skipped-Files", String(skipped.length));
      if (merged.getPageCount() === 0) {
        res.status(422).json({
          error:
            "None of the uploaded files could be read as PDFs, so there is nothing to merge.",
        });
        return;
      }
    }

    sendPdf(res, Buffer.from(await merged.save()), "merged.pdf");
  } catch (err) {
    req.log.error({ err }, "Merge failed");
    res.status(500).json({ error: "Failed to merge PDFs" });
  }
}
