import { parentPort } from "node:worker_threads";
import { PDFDocument } from "@cantoo/pdf-lib";

/**
 * Worker-side half of the Item 32 parse isolation (see parse-worker.ts).
 *
 * One message in, one message out: load with the requested options, save the
 * result (which normalises structure and hands back bytes that can cross the
 * thread boundary), and report pageCount/encrypted alongside. On failure the
 * error's `name` and `message` travel back verbatim — the main thread
 * reconstructs an error with the same name so classification is unchanged.
 *
 * A fresh worker is spawned per parse; nothing here persists between
 * requests, mirroring pdf-parse's per-request isolation.
 */
parentPort?.on("message", async ({ buffer, loadOptions }: { buffer: Buffer; loadOptions: Record<string, unknown> }) => {
  try {
    let document = await PDFDocument.load(buffer, loadOptions);
    // pdf-lib keeps a document's security handler across save(): a
    // password-decrypted load re-emits /Encrypt on serialisation, which would
    // hand the main thread bytes it cannot reload plainly. A password load is
    // explicit decryption intent (Unlock PDF), so rebuild the pages into a
    // fresh handler-free document first — the same copy the tool itself does.
    if (typeof loadOptions.password === "string") {
      const fresh = await PDFDocument.create();
      const pages = await fresh.copyPages(document, document.getPageIndices());
      pages.forEach((page) => fresh.addPage(page));
      document = fresh;
    }
    const bytes = Buffer.from(await document.save({ useObjectStreams: true }));
    parentPort?.postMessage({ ok: true, bytes, pageCount: document.getPageCount(), encrypted: document.isEncrypted });
  } catch (err) {
    const error = err as { name?: string; message?: string };
    parentPort?.postMessage({ ok: false, name: error?.name ?? "Error", message: error?.message ?? String(err) });
  }
});
