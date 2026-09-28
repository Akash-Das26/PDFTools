import type { Request, Response } from "express";
import { failTool, unprocessable, requirePdfFile } from "./shared";
import { extractPdfText } from "./pdfjs";
import { AiNotConfiguredError, aiModel, openaiClient } from "./ai";

/** Roughly 12k characters keeps the request inside the model's token budget. */
const MAX_INPUT_CHARS = 12000;

const SYSTEM_PROMPT =
  'You are a professional document analyst. Given the text of a PDF, respond with a JSON object matching exactly this shape: { "summary": "<2-4 sentence overview>", "keyPoints": ["<point 1>", "<point 2>", "<point 3>", "<point 4>", "<point 5>"] }. Be concise and factual. Return only valid JSON, no markdown fences.';

/** Returns an AI summary plus key points for the uploaded document. */
export async function summarizePdf(req: Request, res: Response): Promise<void> {
  try {
    const file = requirePdfFile(req);

    // AI is optional: the API must start and the other tools must work without it.
    if (!openaiClient) {
      throw new AiNotConfiguredError();
    }

    const parsed = await extractPdfText(file.buffer);
    const rawText = parsed.text?.trim() || "";

    if (!rawText) {
      throw unprocessable("No extractable text found. The PDF may be a scanned image without text layers.");
    }

    const text =
      rawText.length > MAX_INPUT_CHARS
        ? rawText.slice(0, MAX_INPUT_CHARS) + "\n\n[…document truncated for summarization…]"
        : rawText;

    const completion = await openaiClient.chat.completions.create({
      model: aiModel,
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Summarize this document:\n\n${text}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let summary: { summary?: string; keyPoints?: string[] };
    try {
      summary = JSON.parse(raw);
    } catch {
      summary = { summary: raw, keyPoints: [] };
    }

    res.json({
      summary: summary.summary ?? "No summary available.",
      keyPoints: summary.keyPoints ?? [],
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      pageCount: parsed.pageCount,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    failTool(req, res, err, "AI summarize failed", "Failed to summarize PDF. Please check your OpenAI API key.");
  }
}
