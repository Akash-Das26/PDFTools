import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";
import type { RequestHandler } from "express";

/**
 * Rate limiting for the API (Open Item 18, production-readiness audit).
 *
 * Two tiers:
 *  - `apiLimiter` — the general backstop for everything under /api: generous,
 *    sized so a person clicking through the UI can never hit it.
 *  - `uploadLimiter` — the expensive path. Every /pdf/* route buffers uploads in
 *    RAM (up to 50 MB × 20 files) and runs conversion/OCR/Ghostscript/AI work,
 *    so it gets its own tighter budget, applied BEFORE the multer middleware so
 *    rejected requests never even reach the buffering stage.
 *
 * Configuration (all optional, read once at startup):
 *  - RATE_LIMIT_DISABLED  — set to any non-empty value to skip both limiters.
 *    Escape hatch for the CDP verification suites (13 suites × repeated runs
 *    from one Chrome profile would trip an honest limit and turn verification
 *    green suites red). The variable is documented in .env.example; leaving it
 *    unset in production is the safe default.
 *  - RATE_LIMIT_WINDOW_MINUTES — global window in minutes (default 15).
 *  - RATE_LIMIT_API_MAX        — global requests per window (default 300).
 *  - RATE_LIMIT_UPLOAD_MAX     — upload requests per window (default 30).
 *
 * Trusting the proxy: `app.set("trust proxy", ...)` decides what
 * `req.ip` is. Deployments behind exactly one trusted proxy set
 * RATE_LIMIT_TRUST_PROXY=1; the default (0) is the safe choice for
 * direct exposure — the validation error express-rate-limit throws when
 * trust proxy is misconfigured must not be swallowed, so nothing here
 * wraps the limiter construction in a try/catch.
 */

const disabled = Boolean(process.env.RATE_LIMIT_DISABLED?.trim());
const windowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES ?? 15) || 15;

/** Shared JSON shape for rejections — matches the app's `{ error }` contract. */
const handler = (_req: Request, res: Response): void => {
  res.status(429).json({
    error:
      "Too many requests. Slow down and try again shortly — the retry window is shown in the Retry-After header.",
  });
};

/** Standard headers so well-behaved clients (and the suites) can see the budget. */
const standard = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  handler,
};

export const apiLimiter: RequestHandler = disabled
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: windowMinutes * 60_000,
      limit: Number(process.env.RATE_LIMIT_API_MAX ?? 300) || 300,
      ...standard,
      skip: (req) => req.path === "/healthz",
    });

export const uploadLimiter: RequestHandler = disabled
  ? (_req: Request, _res: Response, next: NextFunction) => next()
  : rateLimit({
      windowMs: windowMinutes * 60_000,
      limit: Number(process.env.RATE_LIMIT_UPLOAD_MAX ?? 30) || 30,
      ...standard,
    });
