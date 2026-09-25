import type { Request, Response } from "express";
import type { PdfToPdfAOptionsInput } from "@workspace/api-zod";
import { badRequest, baseName, failTool, loadPdf, requirePdfFile, sendPdf } from "./shared";

/**
 * Adds the structural pieces PDF/A requires: a trailer `/ID`, an `OutputIntent`
 * with an embedded sRGB ICC profile, a conformance-level XMP packet kept in sync
 * with the Info dictionary, and a suitable header version.
 *
 * This is a structural conversion only. PDF/A also forbids encryption,
 * non-embedded fonts (including the 14 standard fonts), JavaScript and external
 * references — content that violates those rules still has to be fixed or
 * rejected upstream, so the result should be validated with a checker such as
 * veraPDF before it is relied on for archiving.
 */
export async function pdfToPdfA(
  req: Request,
  res: Response,
  options: PdfToPdfAOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    // PDF/A forbids encryption, so an encrypted source fails the standard 422 here.
    const document = await loadPdf(file.buffer);

    if (document.getPageCount() === 0) {
      throw badRequest("This PDF has no pages to convert");
    }

    document.convertToPDFA({ conformance: options.conformance });

    const bytes = Buffer.from(await document.save());
    req.log.info({ conformance: options.conformance, pages: document.getPageCount() }, "Converted to PDF/A");

    sendPdf(res, bytes, `${baseName(file.originalname)}-pdfa-${options.conformance.toLowerCase()}.pdf`);
  } catch (err) {
    failTool(req, res, err, "PDF/A conversion failed", "Failed to convert PDF to PDF/A");
  }
}
