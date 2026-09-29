import type { Request, Response } from "express";
import type { CropPdfOptionsInput } from "@workspace/api-zod";
import { badRequest, failTool, loadPdfWithRecovery, markRecovered, parsePageSelection, requirePdfFile, sendPdf } from "./shared";

const MIN_CROP_SIZE = 10; // points

/** Applies the requested margins to the selected pages (all pages by default). */
export async function cropPdf(req: Request, res: Response, options: CropPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const { document, recovered } = await loadPdfWithRecovery(file.buffer);
    markRecovered(res, recovered);
    const targetPages = parsePageSelection(options.pages, document.getPageCount());
    const pages = document.getPages();

    const toPoints = (value: number, axisSize: number): number =>
      options.unit === "percent" ? (value / 100) * axisSize : value;

    for (const index of targetPages) {
      const page = pages[index];
      if (!page) continue;

      // Start from the current visible area so cropping twice composes.
      const box = page.getCropBox();
      const left = toPoints(options.left, box.width);
      const right = toPoints(options.right, box.width);
      const top = toPoints(options.top, box.height);
      const bottom = toPoints(options.bottom, box.height);

      const width = box.width - left - right;
      const height = box.height - top - bottom;

      if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) {
        throw badRequest(
          `Those margins leave nothing on page ${index + 1}. Reduce them and try again.`,
        );
      }

      const x = box.x + left;
      const y = box.y + bottom;

      // Crop box alone is ignored by some viewers, so keep every page box aligned.
      page.setCropBox(x, y, width, height);
      page.setMediaBox(x, y, width, height);
      page.setTrimBox(x, y, width, height);
      page.setBleedBox(x, y, width, height);
      page.setArtBox(x, y, width, height);
    }

    sendPdf(res, Buffer.from(await document.save()), "cropped.pdf");
  } catch (err) {
    failTool(req, res, err, "Crop failed", "Failed to crop PDF");
  }
}
