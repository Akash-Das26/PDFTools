import multer from "multer";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Writable } from "node:stream";
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
        // Holder object on purpose: TS flow-narrows a plain `let` to `null`
        // here because assignments happen inside the sink's closures.
        const spill: { ref: { dir: string; filePath: string } | null } = { ref: null };
        let size = 0;
        let target: ReturnType<typeof createWriteStream> | null = null;

        // The upload stream is consumed EXACTLY ONCE, by this sink (Item 28):
        // the earlier two-phase shape iterated the stream with `for await` and
        // then handed the same half-consumed stream to `pipeline()`, which
        // deadlocks on the second consumer (cutoff exactly at busboy's 64 KB
        // chunk boundary). Instead a single `pipeline(file.stream, sink)` runs
        // for the whole upload; the sink buffers to memory until the threshold
        // is crossed, then opens the target in-file and streams the rest with
        // real backpressure (it only asks for the next chunk once the disk
        // write has room).
        const sink = new Writable({
          write(chunk: Buffer, _enc, next) {
            size += chunk.length;
            if (target) {
              if (!target.write(chunk)) target.once("drain", () => next());
              else next();
              return;
            }
            chunks.push(chunk);
            if (size > SPILL_THRESHOLD) {
              // Crossed the threshold: flush what we hold and stream on.
              void (async () => {
                const state = await dirFor(_req);
                const filePath = path.join(state.dir, `${file.fieldname}-${state.index++}`);
                const ws = createWriteStream(filePath);
                // Disk errors must fail the request, not hang the pipeline.
                ws.on("error", (err) => sink.destroy(err));
                for (const held of chunks) {
                  if (!ws.write(held)) await new Promise<void>((resolve) => ws.once("drain", resolve));
                }
                chunks.length = 0;
                target = ws;
                inMemory = false;
                spill.ref = { dir: state.dir, filePath };
                next();
              })().catch(next);
              return;
            }
            next();
          },
          final(cb) {
            if (target) target.end(() => cb());
            else cb();
          },
        });

        try {
          await pipeline(file.stream, sink);
        } catch (err) {
          if (spill.ref) void rm(spill.ref.filePath, { force: true }).catch(() => {});
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
        const info: Record<string, unknown> = { size, path: spill.ref!.filePath };
        let cache: Buffer | null = null;
        Object.defineProperty(info, "buffer", {
          get() {
            cache ??= readFileSync(spill.ref!.filePath);
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
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 20, // 20 files max
    // Body bounds (Open Item 26): per-file and per-count caps leave the
    // multipart body itself unbounded — a request of thousands of non-file
    // fields was fully buffered before any 400 (a 1 GB all-fields body took
    // ~1 GB of RSS). The largest documented form sends 3 text fields, so 40
    // fields and a 2 MB value cap are wide guard bands; parts bounds the
    // total (fields + files + stray parts) at 70; field names are URL-short.
    fields: 40,
    fieldSize: 2 * 1024 * 1024,
    parts: 70,
    fieldNameSize: 200,
  },
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
