import type { Request, Response } from "express";
import type { DuplicatePdfPagesOptionsInput } from "@workspace/api-zod";
import {
  badRequest,
  failTool,
  loadPdf,
  pageRange,
  parsePageSelection,
  rebuildWithPageOrder,
  requirePdfFile,
  sendPdf,
} from "./shared";

/** Keeps a runaway `copies` value from producing a multi-thousand-page document. */
const MAX_OUTPUT_PAGES = 5000;

/**
 * Copies the selected pages. With `placement: "after"` each copy is inserted
 * directly after its original; with `"end"` all copies are appended in one block
 * at the end of the document.
 */
export async function duplicatePdfPages(
  req: Request,
  res: Response,
  options: DuplicatePdfPagesOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const source = await loadPdf(file.buffer);
    const totalPages = source.getPageCount();

    // An empty selection means "every page", which is the natural default for
    // running this tool on a whole document.
    const selected = parsePageSelection(options.pages, totalPages);
    const selectedSet = new Set(selected);

    const order: number[] = [];
    for (const index of pageRange(totalPages)) order.push(index);

    if (options.placement === "after") {
      order.length = 0;
      for (const index of pageRange(totalPages)) {
        order.push(index);
        if (selectedSet.has(index)) {
          for (let copy = 0; copy < options.copies; copy += 1) order.push(index);
        }
      }
    } else {
      for (const index of pageRange(totalPages)) {
        if (!selectedSet.has(index)) continue;
        for (let copy = 0; copy < options.copies; copy += 1) order.push(index);
      }
    }

    if (order.length > MAX_OUTPUT_PAGES) {
      throw badRequest(
        `That would produce ${order.length} pages. The limit is ${MAX_OUTPUT_PAGES} — reduce the number of copies or pages.`,
      );
    }

    sendPdf(
      res,
      await rebuildWithPageOrder(source, order),
      `${file.originalname.replace(/\.[a-z0-9]{1,5}$/i, "")}-duplicated.pdf`,
    );
  } catch (err) {
    failTool(req, res, err, "Duplicate pages failed", "Failed to duplicate pages");
  }
}
