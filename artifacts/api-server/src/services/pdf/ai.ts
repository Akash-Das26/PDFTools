import OpenAI from "openai";

/**
 * The one AI client, shared by every AI-backed tool.
 *
 * AI is optional: the API must start and every other tool must work without it,
 * so the client is null when `OPENAI_API_KEY` is unset or empty. An `sk-or-`
 * prefix means the key speaks the OpenRouter dialect, which needs the different
 * base URL and the attribution headers OpenRouter asks for.
 */
const configuredAiKey = process.env.OPENAI_API_KEY;
const usesOpenRouter = configuredAiKey?.startsWith("sk-or-") ?? false;

export const openaiClient = configuredAiKey
  ? new OpenAI({
      apiKey: configuredAiKey,
      ...(usesOpenRouter
        ? {
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: {
              "HTTP-Referer": "https://pdftools.replit.app",
              "X-Title": "PDF Tools",
            },
          }
        : {}),
    })
  : null;

export const aiModel = usesOpenRouter ? "openai/gpt-5-mini" : "gpt-5-mini";

/** Thrown by AI tools when no key is configured; `failTool` relays the message as a 503. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI features are not configured. Set OPENAI_API_KEY in .env and restart the API server.");
    this.name = "AiNotConfiguredError";
  }
}
