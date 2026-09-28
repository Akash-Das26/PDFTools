import type { Request, Response } from "express";
import type { PdfToPowerpointOptionsInput } from "@workspace/api-zod";
import pptxgen from "pptxgenjs";
import {
  baseName,
  failTool,
  requirePdfFile,
  sendBuffer,
  unprocessable,
} from "./shared";
import { extractPdfText } from "./pdfjs";

/**
 * PDF to PowerPoint — one slide per page, carrying that page's extracted
 * text: a real editable deck (ppt/slides/slideN.xml entries with the text in
 * them), which is exactly what the LibreOffice converter failed to produce
 * (probed: a 2.6 KB shell deck with zero slides).
 *
 * Honest scope, stated in the panel and the spec: text-per-slide. Images,
 * backgrounds and layout do not carry over; a text-free page becomes a slide
 * noting that, so page count is always preserved. `pptxgenjs` is CJS and is
 * imported through esModuleInterop like any other default export.
 */

/** The deck's working canvas: 13.33 x 7.5 inches is the 16:9 default. */
const SLIDE_W = 13.33;
const SLIDE_H = 7.5;

interface SlideContent {
  title: string;
  body: string;
}

export async function pdfToPowerpoint(
  req: Request,
  res: Response,
  _options: PdfToPowerpointOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const extracted = await extractPdfText(file.buffer);

    if (extracted.pages.length === 0) {
      throw unprocessable("This PDF has no pages to convert into slides");
    }

    const slides: SlideContent[] = extracted.pages.map((page) => {
      const body = (page.text ?? "").trim();
      return {
        title: `Page ${page.num}`,
        body:
          body.length > 0
            ? body
            : "(no extractable text on this page — likely an image or scan)",
      };
    });

    const pptx = new pptxgen();
    pptx.title = "Converted from PDF";
    pptx.layout = "LAYOUT_16x9";
    for (const slide of slides) {
      const added = pptx.addSlide();
      added.addText(slide.title, {
        x: 0.6,
        y: 0.4,
        w: SLIDE_W - 1.2,
        h: 0.9,
        fontSize: 28,
        bold: true,
        color: "1F2937",
      });
      added.addText(slide.body, {
        x: 0.6,
        y: 1.5,
        w: SLIDE_W - 1.2,
        h: SLIDE_H - 2.1,
        fontSize: 14,
        color: "111827",
        valign: "top",
      });
    }

    const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
    sendBuffer(res, buffer, {
      filename: `${baseName(file.originalname, "document")}.pptx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    req.log.info({ slides: slides.length }, "pdf converted to pptx");
  } catch (err) {
    failTool(req, res, err, "PDF to PowerPoint failed", "Failed to convert the PDF to a slide deck");
  }
}
