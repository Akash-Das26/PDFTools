import type { Request, Response } from "express";
import { PDFDocument } from "@cantoo/pdf-lib";
import type { ProtectPdfOptionsInput, UnlockPdfOptionsInput } from "@workspace/api-zod";
import {
  failTool,
  isEncryptedPdfError,
  isPasswordError,
  loadPdf,
  rebuildWithPageOrder,
  requirePdfFile,
  sendPdf,
  unprocessable,
} from "./shared";

/**
 * Encrypts the document with AES-256 (pdf-lib upstream cannot do this — the
 * `@cantoo/pdf-lib` fork adds `PDFDocument.encrypt`).
 */
export async function protectPdf(req: Request, res: Response, options: ProtectPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);
    // loadPdf turns an already-encrypted source into a 422 pointing at Unlock.
    const document = await loadPdf(file.buffer);

    document.encrypt({
      userPassword: options.password,
      ownerPassword: options.ownerPassword ?? options.password,
      algorithm: options.algorithm,
      ...(options.algorithm.startsWith("RC4") ? { allowWeakCryptography: true } : {}),
      permissions: {
        printing: options.allowPrinting ? "highResolution" : false,
        copying: options.allowCopying,
        modifying: options.allowModifying,
        annotating: options.allowAnnotating,
        fillingForms: options.allowFillingForms,
        contentAccessibility: true,
        documentAssembly: options.allowModifying,
      },
    });

    sendPdf(res, Buffer.from(await document.save()), "protected.pdf");
  } catch (err) {
    failTool(req, res, err, "Protect failed", "Failed to protect PDF");
  }
}

/**
 * Removes password protection from a document when the password is known. The
 * pages are copied into a brand new document, which guarantees the result has no
 * encryption dictionary and no leftover encrypted streams.
 */
export async function unlockPdf(req: Request, res: Response, options: UnlockPdfOptionsInput): Promise<void> {
  try {
    const file = requirePdfFile(req);

    let encrypted = false;
    try {
      const probe = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
      encrypted = probe.isEncrypted;
    } catch (err) {
      if (isEncryptedPdfError(err)) encrypted = true;
      else throw err;
    }

    // Nothing to remove — hand the original file straight back.
    if (!encrypted) {
      sendPdf(res, file.buffer, "unlocked.pdf");
      return;
    }

    let source: PDFDocument;
    try {
      source = await PDFDocument.load(file.buffer, { password: options.password ?? "" });
    } catch (err) {
      if (isPasswordError(err)) {
        throw unprocessable(
          options.password
            ? "That password didn't unlock this PDF — check it and try again."
            : "This PDF needs a password. Enter it to unlock the file.",
        );
      }
      throw err;
    }

    const unlocked = await rebuildWithPageOrder(source, source.getPageIndices());
    sendPdf(res, unlocked, "unlocked.pdf");
  } catch (err) {
    failTool(req, res, err, "Unlock failed", "Failed to unlock PDF");
  }
}
