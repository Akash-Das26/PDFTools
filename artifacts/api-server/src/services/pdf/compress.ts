import type { Request, Response } from "express";
import type { CompressPdfOptionsInput } from "@workspace/api-zod";
import { failTool, loadPdf, requirePdfFile, sendPdf } from "./shared";

/**
 * Reduces a PDF by re-serialising it with object streams and dropping the
 * author/keyword metadata. There is no Ghostscript in this environment, so all
 * quality modes take the same path — the option is accepted so the tool's
 * request shape stays stable (and stays meaningful if a real compressor lands).
 */
export async function compressPdf(
  req: Request,
  res: Response,
  options: CompressPdfOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const document = await loadPdf(file.buffer, { ignoreEncryption: true });

    document.setCreator("PDF Tools");
    document.setProducer("PDF Tools");
    document.setAuthor("");
    document.setKeywords([]);

    req.log.debug({ quality: options.quality }, "Compressing PDF");

    sendPdf(res, Buffer.from(await document.save({ useObjectStreams: true })), "compressed.pdf");
  } catch (err) {
    failTool(req, res, err, "Compress failed", "Failed to compress PDF");
  }
}
