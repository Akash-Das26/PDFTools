import type { Request, Response } from "express";
import { ZipArchive } from "archiver";
import { EncryptedPDFError, PDFDocument } from "@cantoo/pdf-lib";

// archiver v8 is ESM-only and exports archive classes rather than the old
// `archiver("zip", …)` factory, so ZIPs are built from ZipArchive directly.

/** Shown whenever a password protected document reaches a tool that cannot open it. */
export const ENCRYPTED_PDF_MESSAGE =
  "This PDF is password protected. Unlock it first, or use Unlock PDF to remove the password.";

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ToolError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ToolError";
    this.status = status;
  }
}

export function badRequest(message: string): ToolError {
  return new ToolError(400, message);
}

export function unprocessable(message: string): ToolError {
  return new ToolError(422, message);
}

export function isEncryptedPdfError(err: unknown): boolean {
  if (err instanceof EncryptedPDFError) return true;
  return (err as { name?: string } | null)?.name === "EncryptedPDFError";
}

export function isPasswordError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = err instanceof Error ? err.message : "";
  return /password/i.test(name) || /password/i.test(message);
}

/**
 * Single error funnel for every PDF tool route: ToolError carries a client-safe
 * status, encrypted sources become 422, everything else is logged and reported
 * as a generic 500 exactly like the original routes did.
 */
export function failTool(req: Request, res: Response, err: unknown, logLabel: string, fallback: string): void {
  req.log.error({ err }, logLabel);
  if (res.headersSent) return;
  if (err instanceof ToolError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (isEncryptedPdfError(err)) {
    res.status(422).json({ error: ENCRYPTED_PDF_MESSAGE });
    return;
  }
  res.status(500).json({ error: fallback });
}

// ─── Form fields ──────────────────────────────────────────────────────────────

/**
 * Reads the main PDF upload. `upload.single` populates `req.file`, while
 * `upload.fields` (used by the watermark tool) populates `req.files.file`.
 */
export function requirePdfFile(req: Request, message = "A PDF file is required"): Express.Multer.File {
  const file = req.file ?? uploadedField(req, "file");
  if (!file) throw badRequest(message);
  return file;
}

export function requireUploadedFiles(req: Request): Express.Multer.File[] {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) throw badRequest("At least one file is required");
  return files;
}

/** Reads a single upload from a `upload.fields([...])` request. */
export function uploadedField(req: Request, field: string): Express.Multer.File | undefined {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return files?.[field]?.[0];
}

// ─── Values ───────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function pageRange(count: number): number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/**
 * Parses a page selection such as "1,3,5-8" into zero-based indices.
 * Empty input means "all pages" unless `fallbackToAll` is false.
 * Duplicates are dropped, first-seen order is preserved.
 */
export function parsePageSelection(
  raw: string | undefined | null,
  totalPages: number,
  options: { name?: string; fallbackToAll?: boolean } = {},
): number[] {
  const name = options.name ?? "pages";
  const fallbackToAll = options.fallbackToAll ?? true;

  if (totalPages < 1) throw unprocessable("This PDF has no pages to work with");

  const selection = (raw ?? "").trim();
  if (!selection || selection.toLowerCase() === "all") {
    if (!fallbackToAll) throw badRequest(`"${name}" must list at least one page`);
    return pageRange(totalPages);
  }

  const label = `this PDF has ${totalPages} page${totalPages === 1 ? "" : "s"}`;
  const indices: number[] = [];

  const push = (index: number) => {
    if (!indices.includes(index)) indices.push(index);
  };

  for (const rawChunk of selection.split(",")) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;

    const rangeMatch = /^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i.exec(chunk);
    if (rangeMatch) {
      const first = Number(rangeMatch[1]);
      const second = Number(rangeMatch[2]);
      if (first < 1 || second < 1) {
        throw badRequest(`Page numbers start at 1 — check "${chunk}"`);
      }
      const [from, to] = first <= second ? [first, second] : [second, first];
      if (to > totalPages) throw badRequest(`Page ${to} is out of range — ${label}`);
      for (let page = from; page <= to; page += 1) push(page - 1);
      continue;
    }

    if (!/^\d+$/.test(chunk)) {
      throw badRequest(`Could not read "${chunk}" — use page numbers like 1,3,5 or ranges like 4-8`);
    }

    const page = Number(chunk);
    if (page < 1) throw badRequest(`Page numbers start at 1 — check "${chunk}"`);
    if (page > totalPages) throw badRequest(`Page ${page} is out of range — ${label}`);
    push(page - 1);
  }

  if (indices.length === 0) throw badRequest(`"${name}" did not contain any page numbers`);
  return indices;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function loadPdf(buffer: Buffer, options: { ignoreEncryption?: boolean } = {}): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: options.ignoreEncryption ?? false });
  } catch (err) {
    if (isEncryptedPdfError(err)) throw unprocessable(ENCRYPTED_PDF_MESSAGE);
    throw err;
  }
}

/**
 * Copies the given pages into a brand new document. Used by every tool that
 * rebuilds a file (remove/reorder/unlock) — a fresh document never inherits
 * encryption, metadata or a stale page tree from the source.
 */
export async function rebuildWithPageOrder(source: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const rebuilt = await PDFDocument.create();
  const pages = await rebuilt.copyPages(source, indices);
  pages.forEach((page) => rebuilt.addPage(page));
  return rebuilt.save();
}

// ─── Responses ────────────────────────────────────────────────────────────────

/** Strips directory components and characters that would break a Content-Disposition header. */
export function sanitizeFileName(name: string, fallback = "document"): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim();
  return cleaned || fallback;
}

export function baseName(name: string, fallback = "document"): string {
  return sanitizeFileName(name, fallback).replace(/\.[a-z0-9]{1,5}$/i, "");
}

export function sendBuffer(
  res: Response,
  data: Buffer | Uint8Array,
  options: { filename: string; contentType: string },
): void {
  res.set("Content-Type", options.contentType);
  res.set("Content-Disposition", `attachment; filename="${sanitizeFileName(options.filename)}"`);
  res.send(Buffer.from(data));
}

export function sendPdf(res: Response, bytes: Buffer | Uint8Array, filename: string): void {
  sendBuffer(res, bytes, { filename, contentType: "application/pdf" });
}

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Streams entries to the client as a ZIP, matching the merge/split response pattern. */
export async function sendZip(res: Response, entries: ZipEntry[], filename: string): Promise<void> {
  res.set("Content-Type", "application/zip");
  res.set("Content-Disposition", `attachment; filename="${sanitizeFileName(filename)}"`);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.pipe(res);

  for (const entry of entries) {
    archive.append(entry.data, { name: sanitizeFileName(entry.name, "file") });
  }

  await archive.finalize();
}

// ─── Images ───────────────────────────────────────────────────────────────────

export type ImageKind = "jpeg" | "png";

/** Sniffs the magic bytes rather than trusting the multipart mimetype. */
export function imageKindOf(buffer: Buffer): ImageKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  return null;
}
