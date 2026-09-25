import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { SplitPdfOptionsInput } from "@workspace/api-zod";
import {
  badRequest,
  failTool,
  loadPdf,
  pageRange,
  parsePageSelection,
  requirePdfFile,
  sendPdf,
  sendZip,
  type ZipEntry,
} from "./shared";

/**
 * Cuts the document into individual files. A one-page result is returned as a
 * PDF, anything longer comes back as a ZIP of single-page PDFs.
 */
export async function splitPdf(req: Request, res: Response, options: SplitPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const source = await loadPdf(file.buffer);
    const totalPages = source.getPageCount();

    // "pages" mode only reads the list when one was supplied — an empty list
    // keeps the historical behaviour of splitting every page.
    const targets =
      options.splitType === "pages"
        ? parsePageSelection(options.pages, totalPages, { name: "pages" })
        : pageRange(totalPages);

    if (targets.length === 0) throw badRequest("No valid pages specified");

    const extractPage = async (index: number): Promise<Buffer> => {
      const single = await PDFDocument.create();
      const [copiedPage] = await single.copyPages(source, [index]);
      if (copiedPage) single.addPage(copiedPage);
      return Buffer.from(await single.save());
    };

    if (targets.length === 1) {
      const index = targets[0]!;
      sendPdf(res, await extractPage(index), `page-${index + 1}.pdf`);
      return;
    }

    const entries: ZipEntry[] = [];
    for (const index of targets) {
      entries.push({ name: `page-${index + 1}.pdf`, data: await extractPage(index) });
    }

    await sendZip(res, entries, "split-pages.zip");
  } catch (err) {
    failTool(req, res, err, "Split failed", "Failed to split PDF");
  }
}
