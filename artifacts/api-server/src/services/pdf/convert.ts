import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { ImagesToPdfOptionsInput, PdfToImagesOptionsInput } from "@workspace/api-zod";
import { encodeJpeg } from "./canvas";
import { getPdfPageCount, renderPdfPages } from "./pdfjs";
import {
  badRequest,
  baseName,
  failTool,
  imageKindOf,
  parsePageSelection,
  requirePdfFile,
  requireUploadedFiles,
  sendBuffer,
  sendPdf,
  sendZip,
} from "./shared";

const MAX_RENDERED_PAGES = 50;

const PAGE_SIZES = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
} as const;

/** The page-composition options shared by JPG/PNG to PDF and Scan to PDF. */
export type ImagePageOptions = Pick<ImagesToPdfOptionsInput, "pageSize" | "orientation" | "margin">;

/**
 * Renders the selected pages to JPG or PNG. One page is returned as an image,
 * several pages come back as a ZIP — the same single/multiple contract the split
 * and rotate tools use.
 */
export async function pdfToImages(
  req: Request,
  res: Response,
  options: PdfToImagesOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const totalPages = await getPdfPageCount(file.buffer);
    const indices = parsePageSelection(options.pages, totalPages);

    if (indices.length > MAX_RENDERED_PAGES) {
      throw badRequest(
        `You can export up to ${MAX_RENDERED_PAGES} pages at a time — this selection has ${indices.length}.`,
      );
    }

    const rendered = await renderPdfPages(file.buffer, { indices, width: options.width });
    const extension = options.format === "png" ? "png" : "jpg";
    const contentType = options.format === "png" ? "image/png" : "image/jpeg";

    const images: Array<{ pageNumber: number; data: Buffer }> = [];
    for (const page of rendered) {
      images.push({
        pageNumber: page.pageNumber,
        data: options.format === "png" ? page.png : await encodeJpeg(page.png, options.quality),
      });
    }

    const first = images[0];
    if (!first) throw badRequest("None of the selected pages could be rendered");

    if (images.length === 1) {
      sendBuffer(res, first.data, { filename: `page-${first.pageNumber}.${extension}`, contentType });
      return;
    }

    await sendZip(
      res,
      images.map((image) => ({ name: `page-${image.pageNumber}.${extension}`, data: image.data })),
      `${baseName(file.originalname)}-${extension}.zip`,
    );
  } catch (err) {
    failTool(req, res, err, "PDF to image failed", "Failed to convert PDF to images");
  }
}

/**
 * Composes one or more JPG/PNG uploads into a single PDF, in upload order.
 *
 * Split out of the route so Scan to PDF can build the same document from its
 * captures and then optionally put it through OCR, rather than the two tools
 * sharing a route they would have to distinguish between.
 */
export async function buildImagesPdf(
  files: Express.Multer.File[],
  options: ImagePageOptions,
): Promise<Buffer> {
  const document = await PDFDocument.create();
    const margin = options.margin;

    for (const file of files) {
      const kind = imageKindOf(file.buffer);
      if (!kind) {
        throw badRequest(`"${file.originalname}" is not a JPG or PNG image`);
      }

      const image = kind === "png" ? await document.embedPng(file.buffer) : await document.embedJpg(file.buffer);

      if (options.pageSize === "fit") {
        const page = document.addPage([image.width + margin * 2, image.height + margin * 2]);
        page.drawImage(image, { x: margin, y: margin, width: image.width, height: image.height });
        continue;
      }

      const base = PAGE_SIZES[options.pageSize];
      const portrait =
        options.orientation === "portrait"
          ? true
          : options.orientation === "landscape"
            ? false
            : image.height >= image.width;
      const pageWidth = portrait ? base.width : base.height;
      const pageHeight = portrait ? base.height : base.width;
      const page = document.addPage([pageWidth, pageHeight]);

      const contentWidth = Math.max(1, pageWidth - margin * 2);
      const contentHeight = Math.max(1, pageHeight - margin * 2);
      const scale = Math.min(contentWidth / image.width, contentHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;

      page.drawImage(image, {
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
      });
    }

  return Buffer.from(await document.save());
}

/** Composes one or more JPG/PNG uploads into a single PDF, in upload order. */
export async function imagesToPdf(
  req: Request,
  res: Response,
  options: ImagesToPdfOptionsInput,
): Promise<void> {
  try {
    const files = requireUploadedFiles(req);
    sendPdf(res, await buildImagesPdf(files, options), "images.pdf");
  } catch (err) {
    failTool(req, res, err, "Image to PDF failed", "Failed to convert images to PDF");
  }
}
