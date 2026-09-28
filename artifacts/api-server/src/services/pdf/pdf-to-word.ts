import type { Request, Response } from "express";
import type { PdfToWordOptionsInput } from "@workspace/api-zod";
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  baseName,
  failTool,
  requirePdfFile,
  sendBuffer,
  unprocessable,
} from "./shared";
import { extractPdfText } from "./pdfjs";

/**
 * PDF to Word — the document's text, page by page, rebuilt as a real DOCX
 * (an OOXML zip that Word, LibreOffice and friends open natively).
 *
 * Honest scope, stated in the panel and the spec: this is a *text* rebuild.
 * Layout is not reconstructed — columns, precise positioning, fonts, images
 * and tables do not carry over; each page becomes a heading plus its
 * paragraphs, in reading order. The LibreOffice converter that would have
 * preserved layout imports PDFs as Draw documents and produces either errors
 * or empty shells (probed), so a text document is what is honestly on offer.
 */

/** Blank lines are paragraph separators; real paragraphs cannot be empty. */
function pageParagraphs(text: string): Paragraph[] {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter((block) => block.length > 0);

  if (blocks.length === 0) {
    return [new Paragraph({ children: [new TextRun("(no extractable text on this page)")] })];
  }
  return blocks.map(
    (block) => new Paragraph({ children: [new TextRun(block)] }),
  );
}

export async function pdfToWord(
  req: Request,
  res: Response,
  _options: PdfToWordOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const extracted = await extractPdfText(file.buffer);
    const pages = extracted.pages.filter((page) => (page.text ?? "").trim().length > 0);

    if (pages.length === 0) {
      throw unprocessable(
        "No extractable text found. The PDF may be a scanned image without a text layer — run OCR on it first.",
      );
    }

    const children = pages.flatMap((page) => [
      new Paragraph({
        text: `Page ${page.num}`,
        heading: HeadingLevel.HEADING_1,
      }),
      ...pageParagraphs(page.text),
    ]);

    const document = new Document({
      sections: [{ children }],
    });

    const buffer = await Packer.toBuffer(document);
    sendBuffer(res, buffer, {
      filename: `${baseName(file.originalname, "document")}.docx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    req.log.info({ pages: pages.length }, "pdf converted to docx");
  } catch (err) {
    failTool(req, res, err, "PDF to Word failed", "Failed to convert the PDF to Word");
  }
}
