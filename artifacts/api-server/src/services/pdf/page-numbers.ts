import type { Request, Response } from "express";
import { rgb, StandardFonts } from "@cantoo/pdf-lib";
import type { AddPageNumbersOptionsInput } from "@workspace/api-zod";
import { failTool, loadPdf, requirePdfFile, sendPdf } from "./shared";

const FONT_SIZE = 11;
const MARGIN = 24;

/** Stamps a page number on every page in the chosen position and format. */
export async function addPageNumbers(
  req: Request,
  res: Response,
  options: AddPageNumbersOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const document = await loadPdf(file.buffer);
    const totalPages = document.getPageCount();
    const font = await document.embedFont(StandardFonts.Helvetica);

    document.getPages().forEach((page, index) => {
      const { width, height } = page.getSize();
      const pageNumber = index + options.startNumber;

      let label = String(pageNumber);
      if (options.format === "Page 1") label = `Page ${pageNumber}`;
      else if (options.format === "1/N") label = `${pageNumber} / ${totalPages + options.startNumber - 1}`;

      const textWidth = font.widthOfTextAtSize(label, FONT_SIZE);

      let x: number;
      let y: number;

      switch (options.position) {
        case "bottom-right":
          x = width - textWidth - MARGIN;
          y = MARGIN;
          break;
        case "bottom-left":
          x = MARGIN;
          y = MARGIN;
          break;
        case "top-center":
          x = (width - textWidth) / 2;
          y = height - MARGIN - FONT_SIZE;
          break;
        case "top-right":
          x = width - textWidth - MARGIN;
          y = height - MARGIN - FONT_SIZE;
          break;
        default: // bottom-center
          x = (width - textWidth) / 2;
          y = MARGIN;
      }

      page.drawText(label, {
        x,
        y,
        size: FONT_SIZE,
        font,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.85,
      });
    });

    sendPdf(res, Buffer.from(await document.save()), "numbered.pdf");
  } catch (err) {
    failTool(req, res, err, "Add page numbers failed", "Failed to add page numbers");
  }
}
