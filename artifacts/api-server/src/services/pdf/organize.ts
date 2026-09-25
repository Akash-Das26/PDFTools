import type { Request, Response } from "express";
import type { RemovePdfPagesOptionsInput, ReorderPdfPagesOptionsInput } from "@workspace/api-zod";
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

/** Deletes the selected pages and returns a rebuilt document. */
export async function removePdfPages(
  req: Request,
  res: Response,
  options: RemovePdfPagesOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const source = await loadPdf(file.buffer);
    const totalPages = source.getPageCount();

    const removing = new Set(
      parsePageSelection(options.pages, totalPages, { name: "pages", fallbackToAll: false }),
    );
    const keeping = pageRange(totalPages).filter((index) => !removing.has(index));

    if (keeping.length === 0) {
      throw badRequest("You can't remove every page — keep at least one.");
    }

    sendPdf(res, await rebuildWithPageOrder(source, keeping), "pages-removed.pdf");
  } catch (err) {
    failTool(req, res, err, "Remove pages failed", "Failed to remove pages");
  }
}

/**
 * Rebuilds the document in the requested page order. Pages that are not listed
 * are dropped, which lets one request express both reordering and deletion.
 */
export async function reorderPdfPages(
  req: Request,
  res: Response,
  options: ReorderPdfPagesOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const source = await loadPdf(file.buffer);
    const order = parsePageSelection(options.order, source.getPageCount(), {
      name: "order",
      fallbackToAll: false,
    });

    sendPdf(res, await rebuildWithPageOrder(source, order), "pages-reordered.pdf");
  } catch (err) {
    failTool(req, res, err, "Reorder pages failed", "Failed to reorder pages");
  }
}
