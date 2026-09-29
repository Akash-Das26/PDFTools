import app from "./app";
import { logger } from "./lib/logger";

// Contain, don't die: a malformed PDF can make pdfjs surface an error as an
// unhandled promise rejection (reproduced 2026-09-29 with pdfjs' `FormatError:
// Command token too long` — under Node's default mode that exits the process,
// so one corrupt upload was a remote kill). The affected request still gets its
// own error response from its route handler; this handler exists so the
// rejection can never take the whole server down with it. Any rejection here is
// logged loudly: it means some code path leaked a promise, which is still a bug
// to fix at the source (AUDIT.md 2026-09-29 Reliability entry, Open Item 17).
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection contained (request was still answered by its handler)");
});

const rawPort = process.env["PORT"] ?? "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
