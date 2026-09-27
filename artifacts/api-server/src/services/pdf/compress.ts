import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import type { CompressPdfOptionsInput } from "@workspace/api-zod";
import { failTool, loadPdf, requirePdfFile, sendPdf } from "./shared";

const execFileAsync = promisify(execFile);

/**
 * Shrinks a PDF with Ghostscript's `pdfwrite` device, falling back to a
 * re-serialisation pass when Ghostscript is not available.
 *
 * `quality` maps onto Ghostscript's own PDF presets, which is what makes the
 * three profiles mean something concrete — they set the image downsampling
 * target: `extreme` → `/screen` (72 dpi), `recommended` → `/ebook` (150 dpi),
 * `high` → `/printer` (300 dpi).
 *
 * Two honesty rules are built in:
 *  - **The result is never bigger than the re-serialised original.** The 300 dpi
 *    preset in particular can *inflate* a text-only document, so both candidates
 *    are produced and the smaller one is returned.
 *  - **The response says which engine produced the bytes** (`X-PDF-Compression-Engine`),
 *    so a host without Ghostscript is visible rather than silently ignoring the
 *    profile. In that case the file is still re-serialised with object streams
 *    and its author/keyword metadata dropped, exactly as before Ghostscript
 *    support existed.
 */

/** Overridable for tests and for hosts with a non-PATH install. */
const GHOSTSCRIPT_BIN = process.env.GS_BIN?.trim() || "gs";
const GHOSTSCRIPT_TIMEOUT_MS = 120_000;

const PRESETS: Record<string, string> = {
  extreme: "screen",
  recommended: "ebook",
  high: "printer",
};

let ghostscriptPath: string | null | undefined;

/** Locates `gs` once, preferring `GS_BIN`. Null means the host has none. */
async function findGhostscript(): Promise<string | null> {
  if (ghostscriptPath !== undefined) return ghostscriptPath;
  const found = await execFileAsync("which", [GHOSTSCRIPT_BIN], { timeout: 5000 })
    .then((result) => result.stdout.trim())
    .catch(() => "");
  ghostscriptPath = found || null;
  return ghostscriptPath;
}

/**
 * Runs Ghostscript in an isolated temp directory and returns its output.
 *
 * Returns null — never throws — when the binary is missing, refuses the
 * document, or writes nothing: the caller then falls back to re-serialising.
 * `-dSAFER` is explicit (Ghostscript 10 defaults to it) so the interpreter
 * cannot touch the filesystem beyond the paths we pass.
 */
async function compressWithGhostscript(buffer: Buffer, quality: string): Promise<Buffer | null> {
  const binary = await findGhostscript();
  if (!binary) return null;

  const workdir = await mkdtemp(join(tmpdir(), "pdf-compress-"));
  try {
    const input = join(workdir, "input.pdf");
    const output = join(workdir, "output.pdf");
    await writeFile(input, buffer);

    try {
      await execFileAsync(
        binary,
        [
          "-sDEVICE=pdfwrite",
          `-dPDFSETTINGS=/${PRESETS[quality] ?? PRESETS.recommended}`,
          "-dCompatibilityLevel=1.7",
          "-dDetectDuplicateImages=true",
          "-dNOPAUSE",
          "-dBATCH",
          "-dQUIET",
          "-dSAFER",
          `-sOutputFile=${output}`,
          input,
        ],
        { timeout: GHOSTSCRIPT_TIMEOUT_MS, killSignal: "SIGKILL", maxBuffer: 16 * 1024 * 1024 },
      );
    } catch {
      return null;
    }

    try {
      const produced = await readFile(output);
      return produced.length > 0 ? produced : null;
    } catch {
      return null;
    }
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

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

    const reserialised = Buffer.from(await document.save({ useObjectStreams: true }));
    const ghostscript = await compressWithGhostscript(file.buffer, options.quality);

    const useGhostscript = ghostscript !== null && ghostscript.length < reserialised.length;
    const bytes = useGhostscript ? ghostscript : reserialised;

    req.log.debug(
      { quality: options.quality, preset: PRESETS[options.quality], engine: useGhostscript ? "ghostscript" : "pdf-lib", bytes: bytes.length, inputBytes: file.buffer.length },
      "Compressed PDF",
    );

    res.set("X-PDF-Compression-Engine", useGhostscript ? "ghostscript" : "pdf-lib");
    res.set("X-PDF-Compression-Level", options.quality);
    sendPdf(res, bytes, "compressed.pdf");
  } catch (err) {
    failTool(req, res, err, "Compress failed", "Failed to compress PDF");
  }
}
