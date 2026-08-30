import { spawn } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(pnpm, ["-r", "--if-present", "run", "build"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: process.env.PORT ?? "5173",
    BASE_PATH: process.env.BASE_PATH ?? "/",
  },
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`Failed to start workspace build: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Workspace build stopped by signal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});