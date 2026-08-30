---
name: Local pnpm build approvals
description: Fresh local checkouts can fail when pnpm treats ignored dependency build scripts as fatal.
---

The project explicitly allowlists trusted build dependencies and disables strict failure for ignored dependency build scripts, so fresh pnpm installs can complete non-interactively on developer machines.

**Why:** Some pnpm 10 environments enable strict build-script failures globally, which can stop installation before Vite or the API server can run.

**How to apply:** Keep the workspace build allowlist and project-level strict-build setting aligned when changing package-manager configuration; local launchers should also detect partial installs.