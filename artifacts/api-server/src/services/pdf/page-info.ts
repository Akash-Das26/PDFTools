import type { Request, Response } from "express";
import type { PdfPageInfoOptionsInput } from "@workspace/api-zod";
import { renderPdfPages } from "./pdfjs";
import { failTool, loadPdf, pageRange, requirePdfFile } from "./shared";

/** Rendering previews for a huge document would blow up the JSON response. */
const MAX_THUMBNAIL_PAGES = 40;

export interface PdfPageInfoPage {
  number: number;
  width: number;
  height: number;
  rotation: number;
  /** PNG data URL, present when previews were included for this document. */
  thumbnail?: string;
}

export interface PdfPageInfo {
  pageCount: number;
  pages: PdfPageInfoPage[];
  thumbnailsIncluded: boolean;
  thumbnailWidth: number;
}

/**
 * Reports the page count, geometry and (optionally) page previews of an uploaded
 * PDF. The organise UI needs all three before it can render a draggable page
 * list — it is the only PDF tool endpoint that answers with JSON rather than a
 * document.
 */
export async function getPdfPageInfo(
  req: Request,
  res: Response,
  options: PdfPageInfoOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const document = await loadPdf(file.buffer);
    const pageCount = document.getPageCount();

    const pages: PdfPageInfoPage[] = document.getPages().map((page, index) => {
      const size = page.getSize();
      return {
        number: index + 1,
        width: Math.round(size.width * 100) / 100,
        height: Math.round(size.height * 100) / 100,
        rotation: page.getRotation().angle,
      };
    });

    const wantThumbnails = options.thumbnails && pageCount <= MAX_THUMBNAIL_PAGES;
    if (wantThumbnails) {
      const rendered = await renderPdfPages(file.buffer, {
        indices: pageRange(pageCount),
        width: options.thumbnailWidth,
      });

      for (const page of rendered) {
        const target = pages[page.pageNumber - 1];
        if (!target) continue;
        target.thumbnail = `data:image/png;base64,${page.png.toString("base64")}`;
      }
    }

    const info: PdfPageInfo = {
      pageCount,
      pages,
      thumbnailsIncluded: wantThumbnails && pages.every((page) => Boolean(page.thumbnail)),
      thumbnailWidth: options.thumbnailWidth,
    };

    res.json(info);
  } catch (err) {
    failTool(req, res, err, "Page info failed", "Failed to read PDF page information");
  }
}
