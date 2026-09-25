import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import multer from "multer";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  };

  res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
    error: messages[err.code] ?? "The upload could not be accepted.",
  });
});

export default app;
