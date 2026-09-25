import type { Request, Response } from "express";
import { degrees, rgb, StandardFonts, type PDFImage } from "@cantoo/pdf-lib";
import type { WatermarkPdfOptionsInput } from "@workspace/api-zod";
import {
  badRequest,
  clamp,
  failTool,
  imageKindOf,
  loadPdf,
  parsePageSelection,
  requirePdfFile,
  sendPdf,
  uploadedField,
} from "./shared";

type Position = WatermarkPdfOptionsInput["position"];

/** Converts a hex colour (`#abc` / `abc` / `#aabbcc`) to pdf-lib rgb. */
function parseColor(value: string | undefined) {
  if (!value) return rgb(0.5, 0.5, 0.5);
  const hex = value.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int)) return rgb(0.5, 0.5, 0.5);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

/**
 * The standard PDF fonts only encode WinAnsi (Latin-1). Curly quotes, dashes and
 * any non-Latin script would make pdf-lib throw, so unsupported code points are
 * transliterated or dropped instead of failing the request.
 */
function toWinAnsi(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "")
    .trim();
}

/**
 * Where to draw a rotation-aware box so that its *visual* centre lands on the
 * requested anchor. pdf-lib rotates around the drawing origin, so the origin has
 * to be pulled back by the rotated bounding box.
 */
function originFor(
  position: Position,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  contentHeight: number,
  rotation: number,
): { x: number; y: number; width: number; height: number } {
  const radians = (rotation * Math.PI) / 180;
  const rotatedWidth = Math.abs(contentWidth * Math.cos(radians)) + Math.abs(contentHeight * Math.sin(radians));
  const rotatedHeight = Math.abs(contentWidth * Math.sin(radians)) + Math.abs(contentHeight * Math.cos(radians));

  const marginX = Math.max(18, pageWidth * 0.05);
  const marginY = Math.max(18, pageHeight * 0.05);

  const [vertical, horizontal] = position.includes("-") ? position.split("-") : ["center", "center"];

  let centreX: number;
  if (horizontal === "left") centreX = marginX + rotatedWidth / 2;
  else if (horizontal === "right") centreX = pageWidth - marginX - rotatedWidth / 2;
  else centreX = pageWidth / 2;

  let centreY: number;
  if (vertical === "top") centreY = pageHeight - marginY - rotatedHeight / 2;
  else if (vertical === "bottom") centreY = marginY + rotatedHeight / 2;
  else centreY = pageHeight / 2;

  const x = centreX - (contentWidth / 2) * Math.cos(radians) + (contentHeight / 2) * Math.sin(radians);
  const y = centreY - (contentWidth / 2) * Math.sin(radians) - (contentHeight / 2) * Math.cos(radians);

  return { x, y, width: contentWidth, height: contentHeight };
}

/** Adds a text or image watermark to the selected pages. */
export async function watermarkPdf(req: Request, res: Response, options: WatermarkPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const document = await loadPdf(file.buffer);
    const targetPages = parsePageSelection(options.pages, document.getPageCount());
    const pages = document.getPages();

    const rotation =
      options.rotation ?? (options.position === "diagonal" ? 45 : 0);

    if (options.type === "image") {
      const imageFile = uploadedField(req, "image");
      if (!imageFile) throw badRequest("Choose a JPG or PNG image to use as the watermark");

      const kind = imageKindOf(imageFile.buffer);
      if (!kind) throw badRequest("The watermark image must be a JPG or PNG file");

      const image: PDFImage =
        kind === "png" ? await document.embedPng(imageFile.buffer) : await document.embedJpg(imageFile.buffer);

      for (const index of targetPages) {
        const page = pages[index];
        if (!page) continue;
        const { width: pageWidth, height: pageHeight } = page.getSize();
        const imageWidth = clamp(pageWidth * options.scale, 16, pageWidth);
        const imageHeight = imageWidth * (image.height / image.width);

        const box = originFor(options.position, pageWidth, pageHeight, imageWidth, imageHeight, rotation);
        page.drawImage(image, {
          x: box.x,
          y: box.y,
          width: imageWidth,
          height: imageHeight,
          opacity: options.opacity,
          ...(rotation === 0 ? {} : { rotate: degrees(rotation) }),
        });
      }

      sendPdf(res, Buffer.from(await document.save()), "watermarked.pdf");
      return;
    }

    const text = toWinAnsi(options.text?.trim() || "CONFIDENTIAL");
    if (!text) {
      throw badRequest("The watermark text needs at least one Latin character (A–Z, 0–9 or punctuation)");
    }

    const font = await document.embedFont(StandardFonts.HelveticaBold);
    const color = parseColor(options.color);

    for (const index of targetPages) {
      const page = pages[index];
      if (!page) continue;
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const fontSize = options.fontSize ?? clamp(pageWidth / 10, 24, 72);
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      const box = originFor(options.position, pageWidth, pageHeight, textWidth, textHeight, rotation);
      page.drawText(text, {
        x: box.x,
        y: box.y,
        size: fontSize,
        font,
        color,
        opacity: options.opacity,
        ...(rotation === 0 ? {} : { rotate: degrees(rotation) }),
      });
    }

    sendPdf(res, Buffer.from(await document.save()), "watermarked.pdf");
  } catch (err) {
    failTool(req, res, err, "Watermark failed", "Failed to add watermark");
  }
}
