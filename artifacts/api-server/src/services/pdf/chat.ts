import type { Request, Response } from "express";
import type { ChatWithDocumentOptionsInput } from "@workspace/api-zod";
import { AiUpstreamError, failTool, requirePdfFile, unprocessable } from "./shared";
import { extractPdfText } from "./pdfjs";
import { AiNotConfiguredError, aiModel, openaiClient, withAiRetry } from "./ai";

/**
 * Chat with Document — one grounded question, one model call.
 *
 * The document's text is extracted and sent with the user's question under a
 * strict contract: answer only from the document, and say plainly when the
 * document does not contain the answer. There is no chunking and no vector
 * store (the honest scope agreed for this batch): the whole text layer rides
 * in one prompt, up to a character budget, so this suits documents of tens of
 * pages rather than thousands.
 *
 * Like the translator, this route is key-aware: without a configured
 * OPENAI_API_KEY it answers 503 naming the variable, before touching the
 * file. The live path is exercised in verification through the OpenAI
 * base-URL mock (scripts/verify-ui/lib/mock-openai.mjs).
 */

/** Roughly 60k characters of document text per request. */
const MAX_DOC_CHARS = 60_000;

const SYSTEM_PROMPT =
  "You answer questions about a document. The document's text is provided as JSON " +
  '({"pageCount": <number>, "text": "<full text layer>"}). Answer the user\'s question ' +
  "using ONLY what the document says — quote or refer to the page content when it helps. " +
  "If the document does not contain the answer, say exactly that in one sentence instead of " +
  "guessing. Answer in plain prose, no markdown headings.";

export async function chatWithDocument(
  req: Request,
  res: Response,
  options: ChatWithDocumentOptionsInput,
): Promise<void> {
  try {
    if (!openaiClient) {
      throw new AiNotConfiguredError();
    }
    const client = openaiClient;

    const file = requirePdfFile(req);
    const extracted = await extractPdfText(file.buffer);
    // pdf-parse's combined `text` always carries its `-- 1 of N --` page
    // banners, so it is never empty even for a scanned document; emptiness is
    // judged per page instead, the same way the translator filters, so an
    // image-only PDF is honestly refused instead of reaching the model.
    if (!extracted.pages.some((page) => Boolean(page.text?.trim()))) {
      throw unprocessable(
        "No extractable text found. The PDF may be a scanned image without a text layer — run OCR on it first.",
      );
    }
    const text = extracted.text ?? "";

    const question = options.question.trim();
    req.log.info({ pages: extracted.pageCount, chars: text.length }, "chat: calling the model");

    const completion = await withAiRetry(
      () =>
        client.chat.completions.create({
          model: aiModel,
          max_completion_tokens: 2048,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                pageCount: extracted.pageCount,
                text: text.slice(0, MAX_DOC_CHARS),
              }),
            },
            { role: "user", content: question },
          ],
        }),
      req,
      res,
      "Chat with Document",
    );

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      throw unprocessable("The model returned no answer — try again.");
    }

    res.json({
      question,
      answer,
      pageCount: extracted.pageCount,
      markdown: `# Question\n\n${question}\n\n# Answer\n\n${answer}\n`,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) {
      res.status(503).json({ error: err.message });
      return;
    }
    if (err instanceof AiUpstreamError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    failTool(req, res, err, "Chat with Document failed", "Failed to answer the question");
  }
}
