/**
 * Transport for every tool call.
 *
 * One helper covers all 18 wired endpoints because they share a shape: a
 * multipart POST with the file(s) plus stringified option fields, answering with
 * either a document (or ZIP) or, for page-info / compare / ai-summarize, JSON.
 *
 * Callers must pass a `signal` so Cancel actually aborts the request rather than
 * only hiding the progress bar.
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/** Shape returned by `POST /api/pdf/page-info`. */
export interface PageInfoPage {
  number: number;
  width: number;
  height: number;
  rotation: number;
  /** PNG data URL, present when previews were included for this document. */
  thumbnail?: string;
}

export interface PageInfo {
  pageCount: number;
  pages: PageInfoPage[];
  thumbnailsIncluded: boolean;
  thumbnailWidth: number;
}

export interface ProcessOutcome {
  kind: "blob" | "json";
  blob?: Blob;
  fileName?: string;
  json?: unknown;
}

/**
 * Endpoints backed by `upload.array("files")` — see routes/pdf.ts. They accept
 * one-or-many through the `files` field, so a single document must NOT be
 * renamed to `file` (the server would see no upload at all).
 */
const MULTI_FILE_ROUTES = new Set([
  "/api/pdf/merge",
  "/api/pdf/rotate",
  "/api/pdf/compare",
  "/api/pdf/images-to-pdf",
  "/api/pdf/scan-to-pdf",
]);

/** Build multipart form data from the selected files plus the tool's options. */
export function buildFormData(
  files: File[],
  options: Record<string, unknown>,
  route?: string,
): FormData {
  const form = new FormData();
  const useFilesField = files.length > 1 || (route !== undefined && MULTI_FILE_ROUTES.has(route));

  if (useFilesField) {
    files.forEach((file) => form.append("files", file));
  } else {
    form.append("file", files[0]!);
  }

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null || value === "") continue;
    if (value instanceof File) {
      // Secondary upload parts (e.g. the watermark image) ride in the options
      // bag and are appended under their own field name, which matches the
      // route's multer `upload.fields` entry — see routes/pdf.ts and the
      // OpenAPI spec's multipart-part table.
      form.append(key, value);
    } else if (Array.isArray(value)) {
      form.append(key, value.join(","));
    } else {
      form.append(key, String(value));
    }
  }

  return form;
}

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

/** POST to a tool route and normalise the response. */
export async function postTool(
  route: string,
  files: File[],
  options: Record<string, unknown>,
  signal: AbortSignal,
  fallbackFileName = "result",
): Promise<ProcessOutcome> {
  const response = await fetch(route, {
    method: "POST",
    body: buildFormData(files, options, route),
    signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ToolError(message);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return { kind: "json", json: await response.json() };
  }

  return {
    kind: "blob",
    blob: await response.blob(),
    fileName: filenameFrom(
      response.headers.get("content-disposition"),
      fallbackFileName,
    ),
  };
}

/**
 * Read page count, geometry and previews.
 *
 * This is the one PDF endpoint that answers with JSON, so it goes through the
 * same request shape as every other tool rather than a bespoke path. The file
 * is sent as a single `file` part.
 */
export async function fetchPageInfo(
  file: File,
  signal: AbortSignal,
): Promise<PageInfo> {
  const form = new FormData();
  form.append("file", file);
  form.append("thumbnails", "true");
  form.append("thumbnailWidth", "140");

  const response = await fetch("/api/pdf/page-info", {
    method: "POST",
    body: form,
    signal,
  });

  if (!response.ok) {
    let message = `Could not read the document (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ToolError(message);
  }

  return (await response.json()) as PageInfo;
}

/**
 * Map a server or transport failure to something the error panel can show,
 * including a route to the tool that fixes it when one exists.
 */
export function describeError(
  message: string,
): { title: string; message: string; recoveryHref?: string; recoveryLabel?: string } {
  const lower = message.toLowerCase();

  if (lower.includes("password") || lower.includes("encrypt")) {
    return {
      title: "Document is password protected",
      message:
        "This PDF is encrypted, so it has to be unlocked before it can be processed. Remove the password with Unlock PDF, then run this tool on the unlocked copy.",
      recoveryHref: "/tools/unlock",
      recoveryLabel: "Unlock this PDF",
    };
  }

  if (lower.includes("corrupt") || lower.includes("invalid pdf") || lower.includes("damaged")) {
    return {
      title: "That file could not be read",
      message:
        "The document appears to be damaged or is not a valid PDF. Try re-exporting it, or run it through a repair step in your PDF reader first.",
    };
  }

  if (lower.includes("page")) {
    return {
      title: "Check the page selection",
      message,
    };
  }

  return {
    title: "Something went wrong",
    message,
  };
}
