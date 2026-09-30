import multer from "multer";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { StorageEngine } from "multer";

/**
 * Hybrid upload storage (Open Item 22, production-readiness audit).
 *
 * Files UNDER the threshold accumulate in memory exactly like memoryStorage;
 * once a part crosses the threshold it is flushed to a per-request temp dir and
 * the remaining bytes stream straight to disk. Spilled files expose `.buffer`
 * as a lazy getter — the bytes are only read back when a handler actually
 * touches them — so every service keeps its `file.buffer` code unchanged while
 * the worst-case resident set drops from "the whole 20 × 50 MB a request may
 * send" to "small uploads + the spilled files this handler actually reads".
 *
 * Cleanup: the first spilled file of a request registers a `res.once("close")`
 * hook that removes the request's temp dir on any response end — success,
 * error, or client abort. Handlers that never touch a spilled file never pay
 * for reading it, and abandoned requests leave nothing behind.
 *
 * `UPLOAD_SPILL_THRESHOLD_BYTES` (default 10 MB): 0 forces every upload to
 * disk; a huge value disables spilling (pure memoryStorage behaviour).
 */
const SPILL_THRESHOLD = Number(process.env.UPLOAD_SPILL_THRESHOLD_BYTES ?? 10 * 1024 * 1024) || 0;

const SPILL_ROOT = path.join(os.tmpdir(), "pdftools-uploads");

interface SpilledState {
  dir: string;
  index: number;
}

function hybridStorage(): StorageEngine {
  // One temp dir per request, created lazily on first spill.
  const dirs = new WeakMap<Express.Request, SpilledState>();

  async function dirFor(req: Express.Request): Promise<SpilledState> {
    const existing = dirs.get(req);
    if (existing) return existing;
    const state: SpilledState = { dir: path.join(SPILL_ROOT, `${Date.now()}-${randomBytes(8).toString("hex")}`), index: 0 };
    dirs.set(req, state);
    await mkdir(state.dir, { recursive: true });
    // Any end of this response — success, error, or client abort — removes
    // everything the request spilled. "close" fires after "finish" too.
    (req as unknown as { res?: import("express").Response }).res?.once("close", () => {
      dirs.delete(req);
      void rm(state.dir, { recursive: true, force: true }).catch(() => {});
    });
    return state;
  }

  return {
    _handleFile(_req, file, cb) {
      void (async () => {
        const chunks: Buffer[] = [];
        let inMemory = true;
        let spilled: { dir: string; filePath: string } | null = null;
        let size = 0;
        let streamError: Error | null = null;

        file.stream.on("error", (err: Error) => {
          streamError = err;
        });

        try {
          for await (const chunk of file.stream as AsyncIterable<Buffer>) {
            size += chunk.length;
            if (inMemory) {
              chunks.push(chunk);
              if (size > SPILL_THRESHOLD) {
                // Crossed the threshold: flush what we hold and stream on.
                const state = await dirFor(_req);
                const filePath = path.join(state.dir, `${file.fieldname}-${state.index++}`);
                const target = createWriteStream(filePath);
                for (const held of chunks) target.write(held);
                chunks.length = 0;
                inMemory = false;
                spilled = { dir: state.dir, filePath };
                await pipeline(file.stream, target);
                break; // pipeline consumed the rest
              }
            }
          }
          if (streamError) throw streamError;
        } catch (err) {
          if (spilled) void rm(spilled.filePath, { force: true }).catch(() => {});
          cb(err as Error);
          return;
        }

        if (inMemory) {
          // Stayed under the threshold: byte-identical to memoryStorage.
          cb(null, { buffer: Buffer.concat(chunks), size });
          return;
        }

        // Spilled: `.buffer` becomes a lazy synchronous getter so handlers keep
        // working unchanged; the bytes are read at most once per request. It
        // MUST be enumerable: multer reconstructs the file object by spreading
        // `{...file, ...info}`, and a non-enumerable property silently vanishes
        // (first live test caught exactly that).
        const info: Record<string, unknown> = { size, path: spilled!.filePath };
        let cache: Buffer | null = null;
        Object.defineProperty(info, "buffer", {
          get() {
            cache ??= readFileSync(spilled!.filePath);
            return cache;
          },
          enumerable: true,
          configurable: true,
        });
        cb(null, info as unknown as Express.Multer.File);
      })();
    },
    _removeFile(_req, file, cb) {
      // Per-request dirs are removed wholesale on res close; nothing per-file.
      void file;
      cb(null);
    },
  };
}

export const upload = multer({
  storage: hybridStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 }, // 50MB per file, 20 files max
});

/** Best-effort sweep of the spill root at boot (crashed processes' leftovers). */
export async function sweepSpillRoot(): Promise<void> {
  await mkdir(SPILL_ROOT, { recursive: true });
  const cutoff = Date.now() - 60 * 60 * 1000; // one hour
  const { readdir } = await import("node:fs/promises");
  for (const entry of await readdir(SPILL_ROOT)) {
    const stamp = Number(entry.split("-")[0]);
    if (Number.isFinite(stamp) && stamp < cutoff) {
      void rm(path.join(SPILL_ROOT, entry), { recursive: true, force: true }).catch(() => {});
    }
  }
}
