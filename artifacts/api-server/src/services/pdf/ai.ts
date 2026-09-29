import OpenAI from "openai";

/**
 * The one AI client, shared by every AI-backed tool.
 *
 * AI is optional: the API must start and every other tool must work without it,
 * so the client is null when `OPENAI_API_KEY` is unset or empty. An `sk-or-`
 * prefix means the key speaks the OpenRouter dialect, which needs the different
 * base URL and the attribution headers OpenRouter asks for. Any other provider
 * speaking the OpenAI protocol — Google's OpenAI-compatible endpoint, say —
 * works by pointing `OPENAI_BASE_URL` at it (the openai SDK reads that itself)
 * and naming a model it serves via `OPENAI_MODEL`.
 */
const configuredAiKey = process.env.OPENAI_API_KEY;
const usesOpenRouter = configuredAiKey?.startsWith("sk-or-") ?? false;
const configuredModel = process.env.OPENAI_MODEL?.trim();

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

/**
 * Model for every AI-backed call. `OPENAI_MODEL` overrides the default so
 * OpenAI-protocol providers that need their own model names can ride the same
 * client; unset it stays `gpt-5-mini` (`openai/gpt-5-mini` behind OpenRouter).
 */
export const aiModel =
  configuredModel || (usesOpenRouter ? "openai/gpt-5-mini" : "gpt-5-mini");

/** Thrown by AI tools when no key is configured; `failTool` relays the message as a 503. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI features are not configured. Set OPENAI_API_KEY in .env and restart the API server.");
    this.name = "AiNotConfiguredError";
  }
}
