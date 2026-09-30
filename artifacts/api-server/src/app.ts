import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter, uploadLimiter } from "./lib/rate-limit";

const app: Express = express();

// Behind exactly one trusted proxy (reverse proxy / load balancer), the real
// client address is in X-Forwarded-For; RATE_LIMIT_TRUST_PROXY=1 makes req.ip
// that address so the rate limiters count per client instead of per proxy.
// Default is off — direct exposure, socket address, the safe choice.
if (process.env.RATE_LIMIT_TRUST_PROXY === "1") app.set("trust proxy", 1);

/**
 * CORS (Open Item 19, production-readiness audit): the previous blanket
 * `cors()` mirrored every origin. Cross-origin reads of API responses are not
 * part of this app's design (the frontend is same-origin in every documented
 * deployment: Vite dev proxy or the API serving its own built frontend), so an
 * explicit allow-list costs nothing and removes the drive-by surface.
 *
 * `CORS_ORIGINS` is a comma-separated list of exact origins; a `*` entry opts
 * back into the old blanket behaviour for exotic deployments. Unset, the
 * defaults cover the documented local flows (Vite on :5173/:5174, loopback).
 * In Production mode with no list configured, cross-origin calls are refused
 * rather than silently allowed — a safer default than permissive.
 */
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const corsAllowAll = corsOrigins.includes("*");

if (corsAllowAll) {
  app.use(cors());
} else if (corsOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients (curl, the CDP suites' Node fetch) send no Origin
        // header at all; same-origin requests may also omit it. Those are not
        // cross-origin and pass through.
        if (!origin || corsOrigins.includes(origin)) callback(null, true);
        else callback(null, false);
      },
    }),
  );
} else if (process.env.NODE_ENV === "production") {
  logger.warn("CORS_ORIGINS unset in production — cross-origin browser calls will be refused");
} else {
  // Development defaults: the Vite dev server ports and loopback origins.
  const devPort = process.env.WEB_PORT ?? "5173";
  const apiPort = process.env.API_PORT ?? process.env.PORT ?? "8080";
  const devOrigins = [
    `http://localhost:${devPort}`,
    `http://127.0.0.1:${devPort}`,
    `http://localhost:${apiPort}`,
    `http://127.0.0.1:${apiPort}`,
  ];
  app.use(cors({ origin: devOrigins }));
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting (Open Item 18): the API backstop covers everything under /api,
// and the upload tier sits ahead of the pdf router so a rejected request never
// reaches multer's RAM buffering. Mounted after CORS so preflights are answered
// before a client builds up a rate-limit debt it cannot see.
app.use("/api", apiLimiter);
app.use("/api/pdf", uploadLimiter);

app.use("/api", router);

// Upload limit problems are raised by multer before any route handler runs, so
// they need a JSON error response to match the `{ error }` shape used elsewhere.
app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
  if (!(err instanceof multer.MulterError)) {
    next(err);
    return;
  }

  const messages: Partial<Record<string, string>> = {
    LIMIT_FILE_SIZE: "File is too large. The limit is 50 MB per file.",
    LIMIT_FILE_COUNT: "Too many files. You can upload up to 20 files at once.",
    LIMIT_UNEXPECTED_FILE: "Unexpected file field. Reload the page and try again.",
    // Body-bound rejects (Open Item 26): client-error 400s naming the bound,
    // answered as soon as multer crosses the limit instead of after the whole
    // body has been read and buffered.
    LIMIT_PART_COUNT: "The submitted form has too many parts. Reload the page and try again.",
    LIMIT_FIELD_COUNT: "Too many form fields. Reload the page and try again.",
    LIMIT_FIELD_VALUE: "A form field value is too large.",
    LIMIT_FIELD_NAME: "A form field name is too long.",
  };

  res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
    error: messages[err.code] ?? "The upload could not be accepted.",
  });
});

export default app;
