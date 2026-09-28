import type { Request, Response } from "express";
import type { ScanToPdfOptionsInput } from "@workspace/api-zod";
import { buildImagesPdf } from "./convert";
import { makeSearchablePdf } from "./ocr";
import { baseName, failTool, requireUploadedFiles, sendPdf } from "./shared";

/**
 * Scan to PDF — captures (or selected photos) in, one PDF out.
 *
 * The tool exists so a phone photo of a page can become a document, so it does
 * not reimplement anything: the pages are composed by the same code path as
 * JPG/PNG to PDF (including its page-size and margin handling and its per-file
 * rejection of anything that is not a JPG or PNG), and the optional searchable
 * layer is the same OCR pass that backs `POST /pdf/ocr` in `searchable-pdf`
 * mode. `searchable` therefore costs a real OCR run per page and can fail with
 * the OCR endpoint's own messages ("no text could be recognised", or the
 * per-language page cap) — which is why it is opt-in rather than the default.
 */
export async function scanToPdf(
  req: Request,
  res: Response,
  options: ScanToPdfOptionsInput,
): Promise<void> {
  try {
    const files = requireUploadedFiles(req);
    const images = await buildImagesPdf(files, options);

    const name = files.length === 1 ? baseName(files[0]!.originalname, "scan") : "scan";

    if (!options.searchable) {
      sendPdf(res, images, `${name}.pdf`);
      return;
    }

    req.log.info({ pages: files.length, language: options.language }, "Recognising scanned pages");
    const searchable = await makeSearchablePdf(images, { language: options.language });
    sendPdf(res, searchable, `${name}-searchable.pdf`);
  } catch (err) {
    failTool(req, res, err, "Scan to PDF failed", "Failed to build the scanned PDF");
  }
}
