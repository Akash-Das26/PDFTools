---
name: PDF text extraction runtime
description: Node and esbuild compatibility constraint for server-side PDF text extraction.
---

The v2 pdf-parse package uses pdfjs-dist and loads pdf.worker.mjs relative to the bundled server entrypoint. In this esbuild setup, the worker is not included automatically, so the API build must copy the package worker beside the generated server entrypoint.

**Why:** Without the adjacent worker, parser construction succeeds but the first extraction request fails with a fake-worker module resolution error.

**How to apply:** Preserve the worker-copy step whenever the API bundle or pdf-parse dependency is changed; validate with a real multipart extraction request after restarting the API.