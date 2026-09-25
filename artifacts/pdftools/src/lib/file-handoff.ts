import type { Tool } from "@workspace/api-client-react";

/**
 * In-memory handoff between the landing quick-dropzone and a workspace page.
 *
 * Holding the File in a module variable (never localStorage — a File cannot be
 * serialised, and documents must not be written to disk) lets the landing page
 * route a dropped file straight into the matching tool with the file already
 * selected, which is what the reference's "auto-detect tools" launcher offers.
 */

let pending: File[] | null = null;

export function handOffFiles(files: File[]): void {
  pending = files;
}

/** Read and clear the handoff — the workspace claims it exactly once. */
export function takeHandedOffFiles(): File[] {
  const files = pending ?? [];
  pending = null;
  return files;
}

const WORD = [".doc", ".docx"];
const SLIDES = [".ppt", ".pptx"];
const SHEETS = [".xls", ".xlsx"];
const WEB = [".html", ".htm", ".mht", ".mhtml"];

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

/**
 * Pick the tool that best fits the dropped files, by file type only — this is
 * a routing convenience, not content analysis, and the description on the
 * launcher says so. Returns null when nothing in the catalog accepts the type.
 */
export function suggestToolId(files: File[], tools: Tool[]): string | null {
  if (files.length === 0) return null;

  const accepts = (toolId: string, required: (name: string) => boolean) => {
    const tool = tools.find((entry) => entry.id === toolId);
    if (!tool || tool.status === "pending") return null;
    return files.every((file) => required(file.name)) ? toolId : null;
  };

  const allImages = files.every((file) => file.type.startsWith("image/"));
  const allPdf = files.every((file) => file.type === "application/pdf");

  if (allImages) {
    return accepts("images-to-pdf", (name) => true) ?? null;
  }
  if (allPdf) {
    // A single PDF most often wants shrinking; several usually want merging.
    const preferred = files.length > 1 ? "merge" : "compress";
    return tools.some((tool) => tool.id === preferred && tool.status !== "pending")
      ? preferred
      : null;
  }

  const named = (extensions: string[]) => (name: string) =>
    extensions.includes(extension(name));

  return (
    accepts("word-to-pdf", named(WORD)) ??
    accepts("ppt-to-pdf", named(SLIDES)) ??
    accepts("excel-to-pdf", named(SHEETS)) ??
    accepts("html-to-pdf", named(WEB)) ??
    null
  );
}
