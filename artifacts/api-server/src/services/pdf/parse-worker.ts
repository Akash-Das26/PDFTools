import { Worker } from "node:worker_threads";
import { ToolError } from "./shared";

/**
 * Off-thread pdf-lib parsing with a hard deadline (Open Item 32).
 *
 * pdf-lib's parser has a pathological tokenize path: certain adversarial byte
 * shapes (random-ASCII filler, xref-free entries) cost tens of seconds of
 * *synchronous* CPU per MB — measured at ~50 s/MB — and `PDFDocument.load`
 * runs that loop on the main thread, so a single unauthenticated upload stalls
 * every request on the process and no in-process timer can preempt it.
 *
 * The fix moves the load into a fresh worker thread per parse and enforces a
 * deadline on the main thread (which stays responsive, so the timer fires and
 * `terminate()` reclaims the worker mid-parse). Exceeding the deadline is a
 * client-error-shaped refusal: 422 "took too long to process".
 *
 * The worker does NOT return a PDFDocument (documents cannot cross a thread
 * boundary). It loads the buffer, re-serialises, and returns the bytes; the
 * caller rebuilds a document from them with a fast, trusted load. Errors are
 * rethrown with their original `name` so every existing classification
 * (`EncryptedPDFError`, password failures, merge's skip logic) is unchanged.
 *
 * `PDF_PARSE_DEADLINE_MS` (default 30 000): legitimate documents parse in
 * well under a second (the audit's own control: a 9.29 MB / 5 000-page valid
 * PDF loads in 676 ms), so the deadline never touches honest input.
 */
const PARSE_DEADLINE_MS = Number(process.env.PDF_PARSE_DEADLINE_MS ?? 30_000) || 30_000;

export interface WorkerParseOptions {
  ignoreEncryption?: boolean;
  throwOnInvalidObject?: boolean;
  warnOnInvalidObjects?: boolean;
  updateMetadata?: boolean;
  password?: string;
}

interface WorkerParsed {
  /** Re-serialised document bytes — normalised structure, safe to reload on the main thread. */
  bytes: Buffer;
  pageCount: number;
  encrypted: boolean;
}

class WorkerParseError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

// Second entry of the same esbuild entryPoints list (see build.mjs): esbuild
// keeps entry paths relative to their common root, so the bundle lands at
// dist/services/pdf/parse-worker-child.mjs beside dist/index.mjs. This URL
// resolves there at runtime (in src it is only executed under a bundler).
const WORKER_URL = new URL("./services/pdf/parse-worker-child.mjs", import.meta.url);

function parseInWorker(
  buffer: Buffer,
  loadOptions: WorkerParseOptions = {},
  deadlineMs: number = PARSE_DEADLINE_MS,
): Promise<WorkerParsed> {
  return new Promise<WorkerParsed>((resolve, reject) => {
    const worker = new Worker(WORKER_URL);
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(
        new ToolError(
          422,
          "This PDF took too long to process and was stopped. It may be damaged or adversarially constructed — try a smaller or less complex file.",
        ),
      );
    }, deadlineMs);

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      reject(err);
    };

    worker.once("message", (msg: { ok: boolean; bytes?: Buffer; pageCount?: number; encrypted?: boolean; name?: string; message?: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (msg.ok && msg.bytes) {
        resolve({ bytes: msg.bytes, pageCount: msg.pageCount ?? 0, encrypted: msg.encrypted ?? false });
      } else {
        // Name-preserving rethrow: isEncryptedPdfError / isPasswordError /
        // merge's skip logic all classify by error name.
        reject(new WorkerParseError(msg.name ?? "Error", msg.message ?? "PDF parse failed"));
      }
    });
    worker.once("error", fail);
    worker.once("exit", (code) => {
      if (!settled) fail(new Error(`PDF parse worker exited unexpectedly (code ${code})`));
    });

    // Structured clone copies only the view's bytes (multer buffers are views
    // into a pooled ArrayBuffer — transferring the slab would move unrelated
    // memory), and a memcpy of even the 50 MB cap is tens of milliseconds.
    worker.postMessage({ buffer, loadOptions });
  });
}

/**
 * Parses in the worker and returns a PDFDocument rebuilt from the normalised
 * bytes — a drop-in replacement for `PDFDocument.load(buffer, options)` at
 * every entry point that touches untrusted upload bytes.
 */
export async function loadPdfViaWorker(
  buffer: Buffer,
  options: WorkerParseOptions = {},
): Promise<{ document: import("@cantoo/pdf-lib").PDFDocument; parsed: WorkerParsed }> {
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const parsed = await parseInWorker(buffer, options);
  // The bytes were written by our own parser a moment ago — this reload is
  // fast and cannot hit the pathological path that motivated the worker.
  // ignoreEncryption carries over: pdf-lib re-emits /Encrypt when saving a
  // document loaded that way (the Unlock probe path relies on the reload
  // still reporting the document as encrypted).
  const document = await PDFDocument.load(parsed.bytes, {
    ignoreEncryption: options.ignoreEncryption ?? false,
  });
  return { document, parsed };
}
