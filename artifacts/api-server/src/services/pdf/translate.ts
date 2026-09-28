import type { Request, Response } from "express";
import type { TranslatePdfOptionsInput } from "@workspace/api-zod";
import { failTool, requirePdfFile, unprocessable } from "./shared";
import { extractPdfText } from "./pdfjs";
import { AiNotConfiguredError, aiModel, openaiClient } from "./ai";

/**
 * Translate PDF, in the text-layer form the feature audit sanctioned: the
 * document's text is extracted page by page, sent to the model with a strict
 * per-page contract, and the translations come back as JSON the UI renders and
 * offers as a Markdown download.
 *
 * Two honest limits, both stated in the panel and the spec: layout is not
 * rebuilt (this is the translated text, page by page — not a translated PDF),
 * and the work is one model call per page, so a 50-page document is 50 calls.
 */

/** Roughly 12k characters per page keeps each request inside the model's budget. */
const MAX_PAGE_CHARS = 12_000;

/** Hard page cap so one upload cannot fire an unbounded number of model calls. */
const MAX_PAGES = 50;

const SYSTEM_PROMPT =
  "You are a professional document translator. You receive one page of a document as JSON " +
  '("number" and "text") and respond with ONLY a JSON object of the shape {"number": <the same number>, ' +
  '"text": "<the full page translated>"} — no commentary, no markdown fences, nothing else. ' +
  "Translate faithfully: keep the page's paragraphs and line structure, keep numbers, names, code " +
  "identifiers and URLs unchanged, and never add or drop content.";

interface TranslatedPage {
  num: number;
  text: string;
}

/** Coerces whatever the model returned into a usable translation, or null when unusable. */
function parsePageTranslation(raw: string | null | undefined, num: number): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const parsed = JSON.parse(trimmed) as { number?: unknown; text?: unknown };
    if (typeof parsed.text === "string" && parsed.text.trim()) {
      return typeof parsed.number === "number" ? parsed.text : parsed.text;
    }
  } catch {
    // The model answered in prose despite the contract; use the prose as-is
    // rather than discarding a translation the user asked and paid for.
    return trimmed;
  }
  return null;
}

export async function translatePdf(
  req: Request,
  res: Response,
  options: TranslatePdfOptionsInput,
): Promise<void> {
  try {
    if (!openaiClient) {
      throw new AiNotConfiguredError();
    }

    const file = requirePdfFile(req);
    const parsed = await extractPdfText(file.buffer);
    const pages = parsed.pages
      .filter((page): page is { num: number; text: string } => Boolean(page.text?.trim()))
      .map((page) => ({ num: page.num, text: page.text }));

    if (pages.length === 0) {
      throw unprocessable(
        "No extractable text found. The PDF may be a scanned image without text layers.",
      );
    }
    if (pages.length > MAX_PAGES) {
      throw unprocessable(
        `This tool translates at most ${MAX_PAGES} text pages per request — this document has ${pages.length}. ` +
          "Split it first and translate the parts.",
      );
    }

    const target = options.targetLanguage;

    req.log.info({ pages: pages.length, target }, "translate: calling the model");

    const translations: TranslatedPage[] = [];
    let failed = 0;
    for (const page of pages) {
      const completion = await openaiClient.chat.completions.create({
        model: aiModel,
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              number: page.num,
              text: page.text.slice(0, MAX_PAGE_CHARS),
              targetLanguage: target,
            }),
          },
        ],
      });
      const text = parsePageTranslation(completion.choices[0]?.message?.content, page.num);
      if (text) translations.push({ num: page.num, text });
      else failed += 1;
    }

    if (translations.length === 0) {
      throw unprocessable("The model returned no usable translation — try again.");
    }

    const body = translations
      .map((page) => `## Page ${page.num}\n\n${page.text.trim()}`)
      .join("\n\n");
    const markdown = `# Translation (${target})\n\n${body}\n`;

    res.json({
      pages: translations,
      targetLanguage: target,
      failedPages: failed,
      pageCount: parsed.pageCount,
      markdown,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    failTool(req, res, err, "Translate PDF failed", "Failed to translate the PDF");
  }
}
