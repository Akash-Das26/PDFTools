import type { Request, Response } from "express";
import type { SignPdfOptionsInput } from "@workspace/api-zod";
import { PDFDocument as PlainPdfDocument } from "pdf-lib";
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib";
import { SignPdf } from "@signpdf/signpdf";
import { P12Signer } from "@signpdf/signer-p12";
import { extractSignature } from "@signpdf/utils";
import forge from "node-forge";
import { StandardFonts, rgb } from "@cantoo/pdf-lib";
import {
  badRequest,
  baseName,
  failTool,
  loadPdf,
  requirePdfFile,
  sendPdf,
  unprocessable,
  uploadedField,
} from "./shared";

/**
 * Sign Document — a real cryptographic signature (PKCS#7 detached, P12/PFX
 * certificate), not a picture of one.
 *
 * Pipeline, straight from the scoping probe (probe-sign6.mjs):
 *   1. The visible stamp (signer + timestamp) is drawn with @cantoo/pdf-lib,
 *      the fork every other tool uses.
 *   2. The document is reloaded with PLAIN pdf-lib and the signature
 *      placeholder is added there. This split is load-bearing: the @cantoo
 *      fork silently drops /ByteRange placeholder objects on save (probed:
 *      `/ByteRange in bytes=false`), while plain pdf-lib serializes them.
 *      `pdflibAddPlaceholder` also requires all four metadata fields.
 *   3. `SignPdf.sign` fills the placeholder with a PKCS#7/CMS blob signed by
 *      the P12 key; the ByteRange covers the whole file afterwards.
 *
 * The certificate is either uploaded (.p12/.pfx with its passphrase) or
 * generated on the fly — a self-signed pair minted with node-forge, clearly
 * labelled as such in the log. No timestamp authority is contacted: the
 * signature time is the server's clock.
 */

/** Two lines of visible stamp text, drawn bottom-left of page 1. */
async function drawSignatureStamp(bytes: Buffer, signerName: string): Promise<Buffer> {
  const document = await loadPdf(bytes);
  const page = document.getPages()[0];
  if (!page) throw unprocessable("This PDF has no pages to sign");
  const font = await document.embedFont(StandardFonts.Helvetica);
  const { width } = page.getSize();
  const now = new Date();
  const stamp = `Signed by ${signerName}`;
  const when = `on ${now.toISOString().slice(0, 16).replace("T", " ")} UTC`;

  page.drawRectangle({
    x: 36,
    y: 36,
    width: Math.min(width - 72, 260),
    height: 44,
    color: rgb(0.98, 0.98, 0.98),
    borderColor: rgb(0.55, 0.55, 0.55),
    borderWidth: 0.75,
  });
  page.drawText(stamp, { x: 46, y: 62, size: 11, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(when, { x: 46, y: 46, size: 8.5, font, color: rgb(0.3, 0.3, 0.3) });
  return Buffer.from(await document.save());
}

function generateSelfSignedP12(passphrase: string, commonName: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  const attrs = [{ name: "commonName", value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, passphrase);
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), "binary");
}

export async function signPdfDocument(
  req: Request,
  res: Response,
  options: SignPdfOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const p12File = uploadedField(req, "p12");
    const signerName = (options.signerName ?? "").trim() || "PDFTools Signer";
    const passphrase = options.passphrase ?? "";

    let p12Buffer: Buffer;
    let certificateLabel: string;
    if (p12File) {
      if (!passphrase) {
        throw badRequest("The certificate's passphrase is required with the uploaded P12");
      }
      p12Buffer = p12File.buffer;
      certificateLabel = p12File.originalname;
    } else {
      if (!passphrase) {
        throw badRequest("Set a passphrase — it protects the generated self-signed certificate");
      }
      p12Buffer = generateSelfSignedP12(passphrase, signerName);
      certificateLabel = "self-signed (generated for this run)";
    }

    // 1. Visible stamp via the @cantoo fork the rest of the app uses.
    const stamped = await drawSignatureStamp(file.buffer, signerName);

    // 2. Placeholder via PLAIN pdf-lib (the fork drops it — see module comment).
    const preparedDoc = await PlainPdfDocument.load(stamped);
    pdflibAddPlaceholder({
      pdfDoc: preparedDoc,
      reason: "Document signed with PDFTools",
      contactInfo: signerName,
      name: signerName,
      location: "PDFTools",
    });
    const prepared = Buffer.from(await preparedDoc.save());

    // 3. Real PKCS#7 signature over the placeholder.
    let signed: Buffer;
    try {
      signed = Buffer.from(
        await new SignPdf().sign(prepared, new P12Signer(p12Buffer, { passphrase })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/password|passphrase|decrypt|mac/i.test(message)) {
        throw unprocessable(
          "The certificate could not be opened — check the passphrase. " +
            "The passphrase protects the .p12 file itself, not the document.",
        );
      }
      throw err;
    }

    // Self-check before answering: the signed buffer must parse back with a
    // ByteRange that reaches the end of the file, exactly like the suite
    // asserts. A tool that returns an unverifiable signature is worthless.
    const verify = extractSignature(signed) as { ByteRange: number[] };
    const [off1, len1, off2, len2] = verify.ByteRange;
    if (![off1, len1, off2, len2].every(Number.isFinite) || Math.abs(off2 + len2 - signed.length) > 1) {
      throw new Error("signature did not cover the whole file");
    }

    sendPdf(res, signed, `${baseName(file.originalname, "document")}-signed.pdf`);
    req.log.info(
      { certificate: certificateLabel, signer: signerName, signatureBytes: len2 },
      "pdf signed",
    );
  } catch (err) {
    failTool(req, res, err, "Sign failed", "Failed to sign the PDF");
  }
}
