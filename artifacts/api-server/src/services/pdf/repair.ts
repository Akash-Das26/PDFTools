import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { RepairPdfOptionsInput } from "@workspace/api-zod";
import { loadPdfViaWorker } from "./parse-worker";
import {
  ENCRYPTED_PDF_MESSAGE,
  ToolError,
  baseName,
  failTool,
  isEncryptedPdfError,
  requirePdfFile,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * Rebuilds a damaged document. The strict parse runs first; if it fails, the
 * second attempt tolerates broken objects and lets the parser recover what it
 * can. The result is re-serialised with object streams, which normalises stale
 * cross-reference tables and offsets.
 *
 * The `X-Repair-Recovered` response header reports whether the recovery path was
 * needed, so the UI can tell the user the file was damaged rather than merely
 * rewritten. Content that was never in the file cannot be invented — this
 * rebuilds structure, it does not restore missing content.
 */
export async function repairPdf(
  req: Request,
  res: Response,
  _options: RepairPdfOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);

    let document: PDFDocument;
    let recovered = false;

    try {
      // pdf-lib defaults `throwOnInvalidObject` to false, which would silently
      // accept damaged objects here and make the recovery pass below
      // unreachable. Force strict parsing so genuinely broken files take the
      // recovery branch and clients see an honest X-Repair-Recovered value.
      // Both loads run in the deadline-terminated parse worker (Item 32).
      ({ document } = await loadPdfViaWorker(file.buffer, { throwOnInvalidObject: true }));
    } catch (strictError) {
      if (isEncryptedPdfError(strictError)) throw unprocessable(ENCRYPTED_PDF_MESSAGE);
      // Same rule as loadPdfWithRecovery (Item 32): a parse-deadline refusal
      // stops here — the lenient retry costs a second deadline for nothing.
      if (strictError instanceof ToolError) throw strictError;

      try {
        ({ document } = await loadPdfViaWorker(file.buffer, {
          throwOnInvalidObject: false,
          warnOnInvalidObjects: true,
          updateMetadata: false,
        }));
        recovered = true;
      } catch {
        throw unprocessable(
          "This PDF could not be repaired — its page structure is too damaged to rebuild.",
        );
      }
    }

    if (document.getPageCount() === 0) {
      throw unprocessable("No readable pages were found in this file, so there is nothing to repair.");
    }

    const bytes = Buffer.from(await document.save({ useObjectStreams: true }));

    req.log.info(
      { recovered, pages: document.getPageCount(), inputBytes: file.size, outputBytes: bytes.length },
      "Repaired PDF",
    );

    res.set("X-Repair-Recovered", String(recovered));
    sendPdf(res, bytes, `${baseName(file.originalname)}-repaired.pdf`);
  } catch (err) {
    failTool(req, res, err, "Repair failed", "Failed to repair PDF");
  }
}
