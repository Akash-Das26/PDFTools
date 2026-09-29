import OpenAI, { APIError } from "openai";
import type { Request, Response } from "express";
import { AiUpstreamError } from "./shared";

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
      // The per-call backoff lives in withAiRetry below; the SDK's own retries
      // are turned off (and the wait for response headers bounded) so the
      // server stays responsive and the per-call log line reflects the truth.
      maxRetries: 0,
      timeout: 120_000,
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

/** Attempt 1 now, then two retries at ~1 s and ~4 s. */
const AI_ATTEMPTS = 3;
const AI_BACKOFF_MS = [0, 1_000, 4_000];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One model call, retried while the provider itself is failing (5xx status or
 * a connection-level error such as a socket timeout), so a brief capacity
 * flap upstream is survivable instead of an error page. On giving up, throws
 * `AiUpstreamError`, which `failTool` relays as a clean 502 naming the
 * provider — never the generic 500, and never a lie about the user's file.
 * Deterministic 4xx answers (bad key, malformed request) are not retried.
 */
export async function withAiRetry<T>(
  call: () => Promise<T>,
  req: Request,
  res: Response,
  toolLabel: string,
): Promise<T> {
  for (let attempt = 0; attempt < AI_ATTEMPTS; attempt += 1) {
    await sleep(AI_BACKOFF_MS[attempt]);
    try {
      return await call();
    } catch (err) {
      const status = err instanceof APIError ? err.status : undefined;
      if (typeof status === "number" && status < 500) throw err;
      req.log.warn(
        {
          attempt: attempt + 1,
          of: AI_ATTEMPTS,
          status: status ?? "connection",
          tool: toolLabel,
          route: res.req?.route?.path,
        },
        "AI provider unavailable, retrying",
      );
    }
  }
  throw new AiUpstreamError(
    `The AI provider is temporarily unavailable (${toolLabel} gave up after ${AI_ATTEMPTS} attempts). Try again shortly.`,
  );
}

/** Thrown by AI tools when no key is configured; `failTool` relays the message as a 503. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI features are not configured. Set OPENAI_API_KEY in .env and restart the API server.");
    this.name = "AiNotConfiguredError";
  }
}
