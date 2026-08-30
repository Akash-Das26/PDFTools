import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function loadDotEnv() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    const value = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
    process.env[key] = value;
  }
}

loadDotEnv();

const apiPort = process.env.API_PORT ?? "8080";
const webPort = process.env.WEB_PORT ?? "5173";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[local] DATABASE_URL is not set. Add it to .env before using API routes that record job history.",
  );
}

const services = [
  {
    name: "api",
    args: ["--filter", "@workspace/api-server", "run", "dev"],
    env: { PORT: apiPort },
  },
  {
    name: "web",
    args: ["--filter", "@workspace/pdftools", "run", "dev"],
    env: { PORT: webPort, BASE_PATH: "/", API_PORT: apiPort },
  },
];

const children = services.map(({ name, args, env }) => {
  const child = spawn(pnpm, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ["inherit", "pipe", "pipe"],
  });

  const prefix = `[${name}]`;
  child.stdout.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) console.log(`${prefix} ${line}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line) console.error(`${prefix} ${line}`);
    }
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal === null) {
      console.error(`${prefix} exited with code ${code ?? "unknown"}`);
      shutdown(code ?? 1);
    }
  });

  return child;
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[local] Web app: http://localhost:${webPort}`);
console.log(`[local] API server: http://localhost:${apiPort}`);