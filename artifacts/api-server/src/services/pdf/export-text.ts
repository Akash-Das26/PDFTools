import type { Request, Response } from "express";
import type { ExportPdfTextOptionsInput } from "@workspace/api-zod";
import { extractPdfText } from "./pdfjs";
import { baseName, failTool, parsePageSelection, requirePdfFile, sendBuffer, unprocessable } from "./shared";

const HEADING_MAX_LENGTH = 80;
const HEADING_MAX_WORDS = 8;
const ALL_CAPS = /^[A-Z0-9][A-Z0-9\s&/'’(),.:-]*$/;
const TITLE_CASE = /^([A-Z][\w'’().-]*)(\s+(\w[\w'’().-]*))*$/;

/**
 * Heuristic heading detection for markdown export: short standalone lines that
 * either shout (ALL CAPS) or read like a title, and never end as a sentence.
 * Anything longer is treated as body copy and rewrapped into paragraphs.
 */
function isHeading(line: string): boolean {
  if (line.length < 3 || line.length > HEADING_MAX_LENGTH) return false;
  if (/[.;,]$/.test(line)) return false;
  if (line.split(/\s+/).length > HEADING_MAX_WORDS) return false;
  if (/\d{4,}/.test(line)) return false;
  return ALL_CAPS.test(line) || TITLE_CASE.test(line);
}

function markdownBody(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(paragraph.join(" "));
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(list.join("\n"));
      list = [];
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (!line) {
      flushAll();
      continue;
    }

    const bullet = /^[-•‣◦▪*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(`- ${bullet[1]!.trim()}`);
      continue;
    }

    const numbered = /^(\d{1,3})[.)]\s+(.+)$/.exec(line);
    if (numbered) {
      flushParagraph();
      list.push(`${numbered[1]}. ${numbered[2]!.trim()}`);
      continue;
    }

    if (isHeading(line)) {
      flushAll();
      blocks.push(`### ${line.replace(/[.:;]$/, "").trim()}`);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

export function toMarkdown(
  title: string,
  pages: Array<{ num: number; text: string }>,
  totalPages: number,
): string {
  const blocks: string[] = [`# ${title}`];

  for (const page of pages) {
    blocks.push(`## Page ${page.num} of ${totalPages}`);
    blocks.push(...markdownBody(page.text));
  }

  return blocks.join("\n\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Exports the document's text layer as a downloadable `.txt` or `.md` file.
 * `partial` selection is applied after extraction so the page count is known
 * without parsing the document twice.
 */
export async function exportPdfText(
  req: Request,
  res: Response,
  options: ExportPdfTextOptionsInput,
): Promise<void> {
  try {
    const file = requirePdfFile(req);
    const parsed = await extractPdfText(file.buffer);
    const rawText = parsed.text?.trim() || "";

    if (!rawText) {
      throw unprocessable("No extractable text found. The PDF may be a scanned image.");
    }

    const name = baseName(file.originalname, "document");
    const selectedPages = options.pages
      ? parsePageSelection(options.pages, parsed.pageCount).map((index) => parsed.pages[index]!)
      : parsed.pages;

    const pages = selectedPages.filter((page): page is { num: number; text: string } => Boolean(page));
    if (pages.length === 0) throw unprocessable("None of the selected pages contained text");

    if (options.format === "md") {
      sendBuffer(res, Buffer.from(toMarkdown(name, pages, parsed.pageCount), "utf8"), {
        filename: `${name}.md`,
        contentType: "text/markdown; charset=utf-8",
      });
      return;
    }

    // Keep the original single-block output when the whole document is exported.
    const body = options.pages ? pages.map((page) => page.text.trim()).filter(Boolean).join("\n\n") : rawText;
    sendBuffer(res, Buffer.from(body, "utf8"), {
      filename: `${name}.txt`,
      contentType: "text/plain; charset=utf-8",
    });
  } catch (err) {
    failTool(req, res, err, "Extract text failed", "Failed to extract text from PDF");
  }
}
