---
name: PDF Tools build environment
description: The web artifact's Vite configuration validates its workflow environment before building.
---

Direct production builds for the PDF Tools web artifact must provide the configured `PORT` and `BASE_PATH` values; the workflow supplies them automatically, while standalone checks do not.

**Why:** The Vite config intentionally fails fast when either value is missing so preview and production routing stay aligned.

**How to apply:** When running the web build manually, use the artifact's configured port and `/` base path rather than treating a missing-variable failure as an application error.