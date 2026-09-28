import type { Request, Response } from "express";
import type { EditPdfOptionsInput } from "@workspace/api-zod";
import { PDFDocument, StandardFonts, rgb } from "@cantoo/pdf-lib";
import {
  badRequest,
  baseName,
  failTool,
  imageKindOf,
  loadPdf,
  requirePdfFile,
  sendPdf,
  uploadedField,
} from "./shared";

/**
 * Edit PDF Content — overlay edits: new text, rectangles and one optional
 * image placed on top of the chosen pages. This is composition, matching the
 * tool card's promise ("Add text, shapes, and images on top of your PDF"),
 * using the same @cantoo primitives the watermark and page-number tools use.
 * Existing text is NOT rewritten — no tool in this stack can reflow a PDF's
 * text layer, and pretending otherwise is what the scoping audit rejected.
 *
 * The ops travel as one JSON array (the same decision the form filler made:
 * one multipart part per edit would need a spec table per field). An image op
 * consumes the single optional `image` part; its width defaults to a quarter
 * of the page and the height follows the image's aspect ratio.
 */

type EditOp =
  | { type: "text"; page: number; x: number; y: number; text: string; size: number; color: string }
  | { type: "rect"; page: number; x: number; y: number; w: number; h: number; color: string; opacity: number }
  | { type: "image"; page: number; x: number; y: number; w: number };

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function hexToRgb(color: string) {
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const value = Number.parseInt(hex, 16);
  return rgb(((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255);
}

/** Parses and validates the ops JSON, returning a typed list. */
function parseOps(raw: string): EditOp[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("\"ops\" is not valid JSON — send an array of edit operations");
  }
  if (!Array.isArray(parsed)) {
    throw badRequest("\"ops\" must be a JSON array of edit operations");
  }

  return parsed.map((entry, index) => {
    const where = `ops[${index}]`;
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw badRequest(`${where} must be an object`);
    }
    const op = entry as Record<string, unknown>;
    const type = op.type;
    const finite = (value: unknown, name: string) => {
      const num = Number(value);
      if (!Number.isFinite(num)) throw badRequest(`${where}: "${name}" must be a number`);
      return num;
    };
    const color = (fallback: string) => {
      const raw = typeof op.color === "string" && op.color.trim() ? op.color.trim() : fallback;
      if (!HEX.test(raw)) throw badRequest(`${where}: colour must be a hex value such as "#111111"`);
      return raw;
    };

    if (type === "text") {
      if (typeof op.text !== "string" || op.text.trim() === "") {
        throw badRequest(`${where}: text edits need a "text" string`);
      }
      const size = op.size === undefined ? 14 : finite(op.size, "size");
      if (size < 4 || size > 96) throw badRequest(`${where}: font size must be between 4 and 96`);
      return {
        type,
        page: finite(op.page, "page"),
        x: finite(op.x, "x"),
        y: finite(op.y, "y"),
        text: op.text,
        size,
        color: color("#111111"),
      };
    }
    if (type === "rect") {
      const opacity = op.opacity === undefined ? 1 : finite(op.opacity, "opacity");
      if (opacity < 0.05 || opacity > 1) throw badRequest(`${where}: opacity must be between 0.05 and 1`);
      return {
        type,
        page: finite(op.page, "page"),
        x: finite(op.x, "x"),
        y: finite(op.y, "y"),
        w: finite(op.w, "w"),
        h: finite(op.h, "h"),
        color: color("#FFD24D"),
        opacity,
      };
    }
    if (type === "image") {
      return {
        type,
        page: finite(op.page, "page"),
        x: finite(op.x, "x"),
        y: finite(op.y, "y"),
        w: op.w === undefined ? 0 : finite(op.w, "w"),
      };
    }
    throw badRequest(`${where}: unknown type ${JSON.stringify(type)} — use "text", "rect" or "image"`);
  });
}

export async function editPdfContent(
  req: Request,
  res: Response,
  options: EditPdfOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const ops = parseOps(options.ops);
    if (ops.length === 0) {
      throw badRequest("Add at least one edit — an empty edit list would return the document unchanged");
    }

    const imageFile = uploadedField(req, "image");
    const imageOps = ops.filter((op): op is Extract<EditOp, { type: "image" }> => op.type === "image");
    if (imageOps.length > 0 && !imageFile) {
      throw badRequest("An image edit needs the image part — attach a JPG or PNG alongside the PDF");
    }
    if (imageOps.length === 0 && imageFile) {
      throw badRequest("An image was attached but no edit uses it — add an image op or remove the file");
    }

    const document = await loadPdf(file.buffer);
    const pageCount = document.getPageCount();
    for (const op of ops) {
      if (!Number.isInteger(op.page) || op.page < 1 || op.page > pageCount) {
        throw badRequest(`Page ${op.page} is out of range — this PDF has ${pageCount} page${pageCount === 1 ? "" : "s"}`);
      }
    }

    // A placement entirely off the page is a user error worth catching:
    // coordinates are PDF points from the bottom-left corner, and content
    // drawn outside the MediaBox is invisible — a silent no-op that would
    // look exactly like the tool failing. The anchor must sit on the page.
    for (const op of ops) {
      const page = document.getPage(op.page - 1);
      const { width, height } = page.getSize();
      const x = op.x;
      const y = op.y;
      if (x < 0 || y < 0 || x > width || y > height) {
        throw badRequest(
          `The ${op.type} edit anchors at (${x}, ${y}) — outside page ${op.page}, which is ${Math.round(width)} × ${Math.round(height)} points. ` +
            "Coordinates are PDF points measured from the page's bottom-left corner.",
        );
      }
    }

    // One embedded image serves every image op (re-embedding per op would
    // duplicate bytes; pdf-lib reuses one embedded image across draws).
    let embeddedImage: Awaited<ReturnType<typeof document.embedPng>> | null = null;
    if (imageFile) {
      const kind = imageKindOf(imageFile.buffer);
      if (!kind) {
        throw badRequest("The image part is not a JPG or PNG — check the file's magic bytes");
      }
      embeddedImage = kind === "png"
        ? await document.embedPng(imageFile.buffer)
        : await document.embedJpg(imageFile.buffer);
    }

    for (const op of ops) {
      const page = document.getPage(op.page - 1);
      if (op.type === "text") {
        page.drawText(op.text, {
          x: op.x,
          y: op.y,
          size: op.size,
          font: await document.embedFont(StandardFonts.Helvetica),
          color: hexToRgb(op.color),
        });
      } else if (op.type === "rect") {
        page.drawRectangle({
          x: op.x,
          y: op.y,
          width: op.w,
          height: op.h,
          color: hexToRgb(op.color),
          opacity: op.opacity,
        });
      } else if (embeddedImage) {
        const width = op.w > 0 ? op.w : page.getWidth() / 4;
        const height = width * (embeddedImage.height / embeddedImage.width);
        page.drawImage(embeddedImage, { x: op.x, y: op.y, width, height });
      }
    }

    sendPdf(res, await document.save(), `${baseName(file.originalname, "document")}-edited.pdf`);
    req.log.info(
      {
        ops: ops.length,
        text: ops.filter((o) => o.type === "text").length,
        rects: ops.filter((o) => o.type === "rect").length,
        images: imageOps.length,
      },
      "pdf edited",
    );
  } catch (err) {
    failTool(req, res, err, "Edit PDF failed", "Failed to edit the PDF");
  }
}
