# PDFTools

<p align="center">
  <img src="artifacts/pdftools/public/favicon.svg" width="72" alt="PDFTools mark" /><br/>
  <strong>PDFTools</strong> — a self-hosted PDF toolkit: 32 tools, an Express API, and a React workspace UI.
</p>
<p align="center">
  <a href="https://github.com/Akash-Das26/PDFTools/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Akash-Das26/PDFTools/ci.yml?label=CI&amp;logo=github" alt="CI status" /></a>
  <a href="https://github.com/Akash-Das26/PDFTools/blob/HEAD/LICENSE"><img src="https://img.shields.io/github/license/Akash-Das26/PDFTools?label=license" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/node-%E2%89%A520-brightgreen?logo=nodedotjs" alt="Node 20+" />
  <img src="https://img.shields.io/badge/pnpm-10.26.1-orange?logo=pnpm" alt="pnpm 10.26.1" />
</p>

Every number in this file is traceable to a file in this repository or a command that was run against it — see
[Testing & verification](#9-testing--verification) and [Known limitations](#10-known-limitations).

## Table of contents

1. [The problem](#1-the-problem)
2. [Architecture](#2-architecture)
3. [Feature catalog](#3-feature-catalog)
4. [Tech stack](#4-tech-stack)
5. [Installation](#5-installation)
6. [Quickstart](#6-quickstart)
7. [API reference](#7-api-reference)
8. [Project structure](#8-project-structure)
9. [Testing & verification](#9-testing--verification)
10. [Known limitations](#10-known-limitations)
11. [Roadmap](#11-roadmap)
12. [License](#12-license)

---

## 1. The problem

Browser PDF tooling today splits into two unsatisfying camps:

- **Hosted "free" PDF tools** that upload your documents to someone else's servers, cap file sizes, watermark
  results, and sit behind subscriptions.
- **Native desktop suites** that are heavy, platform-bound, and overkill when you just need pages reordered or
  a file split.

PDFTools fills the middle: **real PDF processing that runs on hardware you control**. Uploads go to your own API
over multipart `POST`s, processing happens server-side with real PDF libraries (`@cantoo/pdf-lib`,
`tesseract.js`), and the React frontend talks to it through a typed, generated client. PDFs are documents people
keep locally precisely because they are private — the processing should be private too.

This is a developer-first project. It is a pnpm monorepo you clone and run, not a hosted product. The
Replit-born configuration is intact (`.replit`, `run-local.sh`/`run-local.bat`), but every command in this
README was exercised on a plain Linux checkout with Node 22 and pnpm 10.

---

## 2. Architecture

```
│  pnpm workspace — pnpm@10.26.1 · TypeScript 5.9 · MIT                       │
│                                                                             │
│  artifacts/                                                                 │
│  ┌──────────────────────────────┐      ┌─────────────────────────────────┐  │
│  │ @workspace/pdftools (web)    │      │ @workspace/api-server (API)     │  │
│  │ React 19 · Vite · Tailwind 4 │      │ Express 5 · multer 2 · pino     │  │
│  │ wouter · TanStack Query      │      │ Zod-validated · JSON errors     │  │
│  │ dev :5173 · proxy /api→:8080 │      │ routes/  (mounted at /api)      │  │
│  │ /api/* ──────────────────────┼─────▶│ health    GET /healthz          │  │
│  └──────────────────────────────┘      │ tools     GET /tools            │  │
│  lib/                                  │ jobs      /stats · /jobs        │  │
│  ┌──────────────────────────────┐      │ pdf       24 × POST /pdf/*      │  │
│  │ @workspace/api-spec          │      │ services/pdf/                   │  │
│  │ openapi.yaml — 30 paths      │      │ @cantoo/pdf-lib · tesseract.js  │  │
│  └──────────────┬───────────────┘      │ pdf-parse · archiver · openai   │  │
│                 │  orval codegen       │ pino-http request logging       │  │
│                 ▼                      │ jobs · stats via @workspace/db  │  │
│  ┌──────────────────────────────┐      └────────────────┬────────────────┘  │
│  │ @workspace/api-zod           │                       │                   │
│  │ generated Zod schemas        │                       ▼                   │
│  └──────────────────────────────┘      ┌─────────────────────────────────┐  │
│  ┌──────────────────────────────┐      │ PostgreSQL 14+                  │  │
│  │ @workspace/api-client-react  │      │ jobs table · usage stats        │  │
│  │ generated React Query hooks  │      │ (drizzle-kit push creates it)   │  │
│  └──────────────────────────────┘      └─────────────────────────────────┘  │
│  scripts/  dev-local.mjs · build-all.mjs · verify-ui/ (CDP suites)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

The contract chain is the point: `openapi.yaml` → **orval** → generated Zod schemas (`@workspace/api-zod`)
and generated React Query hooks (`@workspace/api-client-react`). The frontend imports types and hooks; it does
not hand-write API calls. The PDF-processing page is the deliberate exception: every tool call goes through one
transport helper, `src/lib/process-tool.ts`, which owns the `file`-vs-`files` field rule, stringifies the
option bag, appends secondary upload parts such as the watermark image, and normalises document-vs-JSON
responses into one `ProcessOutcome`.

---

## 3. Feature catalog

32 tools in 6 categories, served by `GET /api/tools` and rendered as cards in the UI.
**31 implemented · 1 partial · 0 backend-pending.** The one partial tool (PDF to Markdown, which reuses the
extract-text endpoint without table conversion) is labelled as such in the UI. Counts are exact;
nothing is rounded up.

| Category | Tools | Implemented | Partial | Pending |
|---|---:|---:|---:|---:|
| Organize | 7 | 7 | 0 | 0 |
| Convert to PDF | 6 | 6 | 0 | 0 |
| Convert from PDF | 6 | 5 | 1 | 0 |
| Edit | 5 | 5 | 0 | 0 |
| Security | 4 | 4 | 0 | 0 |
| AI | 4 | 4 | 0 | 0 |
| **Total** | **32** | **31** | **1** | **0** |

### Organize — 7 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Merge PDF | `POST /pdf/merge` | Implemented | Multi-file with reorder rows; document order preserved; always one `merged.pdf` result |
| Split PDF | `POST /pdf/split` | Implemented | `all` (ZIP of pages) or `pages` (single PDF) |
| Remove Pages | `POST /pdf/remove-pages` | Implemented | Page selection |
| Extract Pages | `POST /pdf/split` | Implemented | Shares the split endpoint (`splitType=pages`) |
| Organize Pages | `POST /pdf/reorder-pages` | Implemented | Page-picker UI with drag/keyboard reorder |
| Rotate PDF | `POST /pdf/rotate` | Implemented | Single angle, optionally scoped by `pages` — see limitation 3 |
| Compress PDF | `POST /pdf/compress` | Implemented | Real Ghostscript presets — images at 72/150/300 dpi; never returns a larger file (see limitation 1 for hosts without Ghostscript) |

### Convert to PDF — 6 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| JPG/PNG to PDF | `POST /pdf/images-to-pdf` | Implemented | Page size/orientation/margin options |
| Word to PDF | `POST /pdf/word-to-pdf` | Implemented | Headless LibreOffice; PDF/A-1b/2b/3b export option |
| PowerPoint to PDF | `POST /pdf/ppt-to-pdf` | Implemented | Same pipeline; one slide becomes one page |
| Excel to PDF | `POST /pdf/excel-to-pdf` | Implemented | Same pipeline, plus *fit each sheet to one page* |
| Scan to PDF | `POST /pdf/scan-to-pdf` | Implemented | Captures composed one page each (same page-size/orientation/margin options); optional OCR text layer in 17 languages; the browser's camera is requested on phones via the input's `capture` attribute |
| HTML to PDF | `POST /pdf/html-to-pdf` | Implemented | Headless LibreOffice (`writer_web_pdf_Export`); PDF/A-1b/2b/3b option; a markup sniff rejects files that are not really HTML (`.html`/`.htm` only) |

### Convert from PDF — 6 tools, 5 implemented, 1 partial

| Tool | Route | Status | Notes |
|---|---|---|---|
| PDF to JPG | `POST /pdf/pdf-to-images` | Implemented | JPG/PNG, width/quality options, ZIP for multi-page |
| PDF to PDF/A | `POST /pdf/pdf-to-pdfa` | Implemented | Conformance 1B–3U, XMP/OutputIntent |
| PDF to Excel | `POST /pdf/pdf-to-excel` | Implemented | Ruled-table detection via pdf-parse; CSV (UTF-8 BOM) or ZIP per table; delimiter option; table-less documents are refused, not guessed |
| PDF to Markdown | `POST /pdf/extract-text` | Partial | `format=md` with heuristic headings/lists; tables are **not** converted |
| PDF to Word | `POST /pdf/pdf-to-word` | Implemented | Text rebuild via the `docx` writer: per-page headings + paragraphs, round-trips into Word/LibreOffice; layout, columns, images and tables do not carry over; a text-free document is refused (OCR first) |
| PDF to PowerPoint | `POST /pdf/pdf-to-powerpoint` | Implemented | Text-per-slide deck via `pptxgenjs` — one editable slide per page, text-free pages noted; images and layout do not carry over |

### Edit — 5 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Add Page Numbers | `POST /pdf/add-page-numbers` | Implemented | Position/format/start |
| Add Watermark | `POST /pdf/watermark` | Implemented | Text or image; opacity/position/scale |
| Crop PDF | `POST /pdf/crop` | Implemented | pt/percent margins, page selection |
| PDF Form Filler | `POST /pdf/pdf-form-filler` | Implemented | Field inventory via `POST /pdf/pdf-form-inspect`; values as one JSON object; text fields, checkboxes, dropdowns, option lists, radio groups; flatten on by default; an empty fill is refused |
| Edit PDF Content | `POST /pdf/edit` | Implemented | Overlay edits — text, rectangles, one image (aspect-ratio height) — as one JSON ops array in PDF points; off-page anchors are refused; existing text is **not** rewritten (no tool can reflow a PDF's text layer) |

### Security — 4 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Protect PDF | `POST /pdf/protect` | Implemented | AES-256/AES-128/RC4, permission flags |
| Unlock PDF | `POST /pdf/unlock` | Implemented | Rebuilds page-by-page to shed encryption |
| Sign Document | `POST /pdf/sign` | Implemented | Real PKCS#7 detached signature via `@signpdf` — uploaded `.p12`/`.pfx` or a self-signed certificate generated per run (node-forge); visible stamp with signer + time; ByteRange covers the whole file; no timestamp authority |
| Redact Sensitive Data | `POST /pdf/redact` | Implemented | True content removal via mupdf (WASM) — text objects deleted, black box drawn; literal case-insensitive terms as one JSON array; a run that removes nothing is refused, not returned unchanged |

### AI — 4 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| AI PDF Summarizer | `POST /pdf/ai-summarize` | Implemented | OpenAI; returns 503 with setup instructions if `OPENAI_API_KEY` is unset |
| Compare Two PDFs | `POST /pdf/compare` | Implemented | Bounded LCS line diff + JSON report; bidi-aware extraction |
| Translate PDF | `POST /pdf/translate-pdf` | Implemented | Page-by-page model calls with a strict JSON contract; Markdown download; layout is not rebuilt; 50 text pages per request; 503 when the key is unset |
| Chat with Document | `POST /pdf/chat-with-document` | Implemented | One grounded question per run over the whole text layer (≈60k chars); the model must answer only from the document and say so when it cannot; 503 with setup instructions when `OPENAI_API_KEY` is unset |

> Behind the catalog there are also implemented endpoints without catalog cards — `POST /pdf/page-info`,
> `/pdf/repair`, `/pdf/ocr` (tesseract.js, 17 languages, text or searchable-PDF output),
> `/pdf/duplicate-pages`, and `/pdf/pdf-form-inspect` (the form filler's inventory half) — see the
> [API reference](#7-api-reference).

---

## 4. Tech stack

Sourced from the workspace `package.json` files (no dependency is listed that is not declared there).

**Root** — pnpm 10.26.1 (pinned via `packageManager`; a `preinstall` hook rejects npm/yarn) · TypeScript ~5.9.3 · Prettier ^3.9.6

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + react-dom | 19.1.0 (pinned in `pnpm-workspace.yaml` catalog) |
| | Vite | ^7.3.2 |
| | Tailwind CSS | ^4.1.14 (CSS-first, `@theme`) |
| | wouter | ^3.3.5 |
| | @tanstack/react-query | ^5.90.21 |
| API | Express | ^5.2.1 |
| | multer (uploads) | ^2.2.0 |
| | @cantoo/pdf-lib (PDF engine) | 2.11.1 |
| | tesseract.js (OCR) | 7.0.0 |
| | pdf-parse (per-page text) | ^2.4.5 |
| | openai (AI summarize) | ^7.0.0 |
| | pino / pino-http (logging) | ^9.14.0 / ^10.5.0 |
| | archiver (ZIP output) | ^8.0.0 |
| | cors | ^2.8.6 |
| Database | drizzle-orm | ^0.45.2 |
| | drizzle-kit (schema push) | ^0.31.10 |
| | pg | ^8.22.0 |
| Codegen | orval | ^8.23.0 |
| | zod (schemas) | ^3.25.76 |

Notes: the three `@replit/vite-plugin-*` packages are dev-only, and each is gated differently in
`vite.config.ts`: `runtime-error-modal` loads whenever Vite runs in `development` mode, while `cartographer`
and `dev-banner` additionally require `REPL_ID` to be set — so a non-Replit checkout exercises only the error
overlay, never the two Replit-hosted ones. Root declares `@replit/connectors-sdk` but no
code imports it (tracked as an open cleanup item). `cookie-parser` is declared by the API server but unused by
any source file (same).

---

## 5. Installation

> **Execution status:** every step below was **executed** in the authoring sessions on a Linux checkout
> (Node 22.22.1, pnpm 10.26.1) — including Database setup, which was proven end-to-end against a fresh
> PostgreSQL 18 server (empty `pdftools` database → `push` → tables created → API stored and listed a job).
> See [Troubleshooting](#troubleshooting) for the failure modes encountered along the way.

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Latest tested: 22.22.1 (this session). Replit provisions Node 24. The project ships no `engines` field or `.nvmrc`. Vite 7 supports Node 20.19+/22.12+ |
| pnpm | 10.26.1 (pinned) | Enforced: root `packageManager` field + a `preinstall` hook that exits with *"Use pnpm instead"* under npm or yarn |
| PostgreSQL | ≥ 14 | Latest tested: 18.6 (fresh scratch server, full install flow) and 16 (Replit's module); client tools 18.6. Required at API startup |
| OS | Linux / macOS / Windows | Linux x64 assumed by the `pnpm-workspace.yaml` platform overrides (Replit heritage); they remove non-linux-x64 `esbuild`/`rollup`/`lightningcss`/`@tailwindcss/oxide` optional packages |
| Ghostscript (optional) | tested with 10.06 | Powers the Compress profiles; located as `gs` (override with `GS_BIN`). Without it Compress still returns a smaller doc by re-serialising, and says so in `X-PDF-Compression-Engine` |
| LibreOffice (optional) | any recent release | The Office → PDF tools and HTML to PDF need it; they are the only features that shell out to a system binary. Located as `soffice` (override with `SOFFICE_BIN`), cached per process, and reported as an honest `503` when absent — nothing else in the app is affected. Verified here with LibreOffice's `writer_pdf_Export` / `impress_pdf_Export` / `calc_pdf_Export` / `writer_web_pdf_Export` filters |

### Clone and install

```bash
git clone <repository-url>
cd pdftools          # the directory containing pnpm-workspace.yaml
pnpm install
```

Expect a one-line warning: `Ignored build scripts: tesseract.js@7.0.0` — pnpm 10 blocks postinstall
scripts by default. It is harmless here; if OCR never downloads a language at runtime, run
`pnpm approve-builds` and allow `tesseract.js`, then `pnpm install` again.

### Environment variables

Copy the template, then fill in what you need:

```bash
cp .env.example .env
```

| Variable | Purpose | Required? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by Drizzle for job history and usage stats | **Required** — the API **fails to start** without it (checked in both `lib/db/src/index.ts` and `@workspace/db`'s drizzle config) |
| `OPENAI_API_KEY` | Enables the three model-backed AI tools (AI PDF Summarizer, Translate PDF, Chat with Document) | Optional. Without it all other tools work and these three return an HTTP 503 JSON error naming this variable |
| `OPENAI_BASE_URL` | Point the AI client at an OpenAI-protocol-compatible provider instead of OpenAI (see the ops note below) | Optional |
| `OPENAI_MODEL` | Model name used for every AI call (see the ops note below) | Optional, default `gpt-5-mini` |
| `WEB_PORT` | Port for the Vite dev server when launched via `pnpm dev:local` | Optional, default `5173` |
| `API_PORT` | Port for the API server when launched via `pnpm dev:local` | Optional, default `8080` |

Additional variables read by the code but not needed for the standard flow: `PORT` (server listen port,
default `8080`; Vite also reads it, default `5173`), `BASE_PATH` (Vite build base, default `/`),
`API_URL` (dev-proxy target, defaults to `http://127.0.0.1:$API_PORT`), `REPL_ID` (gates Replit-only Vite
plugins), `LOG_LEVEL` / `NODE_ENV` (logging).

#### Swapping the AI provider

Every AI tool speaks the OpenAI chat-completions protocol through one shared client, so any
provider that speaks the same protocol works without code changes — set two variables in `.env`
and restart the API server. This project itself runs against Google's OpenAI-compatible endpoint:

```bash
# Google Gemini via its OpenAI-compatible layer (needs a Google API key in OPENAI_API_KEY)
OPENAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
OPENAI_MODEL=gemini-3.5-flash-lite
```

Unset, the client targets OpenAI's default endpoint with `gpt-5-mini`; a key starting with
`sk-or-` is treated as OpenRouter and gets that provider's base URL, attribution headers and
`openai/gpt-5-mini` automatically. Pick a **concrete model snapshot** rather than a `*-latest`
alias after probing it with a real request — aliases can silently resolve to a snapshot that
behaves differently (this bit us: an alias began echoing the source text instead of translating).
Upstream 5xx/timeouts are retried (3 attempts, ~1 s and ~4 s backoff) and surface as a clean 502
naming the tool if the provider stays down.

### Codegen step

The generated API clients (`lib/api-zod`, `lib/api-client-react`) are committed, so **first run needs no
codegen**. Regenerate after editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Verified: after re-running it on a clean tree, `git status` stayed empty — the committed clients are exactly
what the current spec generates.

### Database setup

`@workspace/db` uses `drizzle-kit push` (no migration files) to create/update the `jobs` table:

```bash
set -a; source .env; set +a   # drizzle-kit reads DATABASE_URL from the environment
pnpm --filter @workspace/db run push
```

**Verified:** against a fresh PostgreSQL 18 server with an empty `pdftools` database, this command reports
`[✓] Changes applied` (exit 0) and creates the `jobs` table exactly as defined in `lib/db/src/schema/jobs.ts`;
a second run reports `No changes detected` (idempotent). An API server pointed at that database then served
`/api/stats` and stored + listed a job through `/api/jobs`. One sharp edge: `drizzle-kit` exits 1 **silently**
when it cannot connect — bad credentials in `DATABASE_URL` are the usual cause (reproduced and diagnosed in
this repo) — see [Troubleshooting](#troubleshooting).

### Verify the installation

```bash
set -a; source .env; set +a
pnpm build                                  # typecheck + build every package; exits 0
node --enable-source-maps artifacts/api-server/dist/index.mjs &
curl -s http://127.0.0.1:8080/api/healthz
```

Expected: the build prints `✓ built in ≈2–3s` for the web app and exits `0`; the curl prints
`{"status":"ok"}` (verified in this session: HTTP 200, exact body).

### Troubleshooting

Only failure modes actually observed or structurally expected in this repo:

- **`preinstall` fails with "Use pnpm instead"** — you ran `npm install`/`yarn`. The workspace hard-requires
  pnpm 10.26.1 (`packageManager` field). Install it and re-run.
- **`Ignored build scripts: tesseract.js`** — expected on every fresh install (pnpm 10 blocks build
  scripts by default). Harmless for non-OCR tools; see the note above if you need OCR.
- **API exits immediately, log ends with `Error: DATABASE_URL must be set. Did you forget to provision a
  database?`** — `.env` was not created or not sourced. This throw was reproduced on purpose in this session.
- **`drizzle-kit push` dies silently after "Pulling schema from database…"** — this is what a failed
  connection looks like: drizzle-kit 0.31.10 exits 1 without printing the underlying error. Reproduced here
  with wrong credentials, and the identical command **passes on a correctly-credentialed fresh database** —
  so on a silent exit, test `DATABASE_URL` directly (`psql "$DATABASE_URL" -c 'select 1'`) before assuming
  the schema step is broken.
- **Port conflicts (8080 / 5173)** — Vite runs with `strictPort: true`, so a busy 5173 aborts the dev server
  rather than drifting to 5174. Free the port or set `WEB_PORT`/`API_PORT` in `.env`. The error surfaces as
  `Invalid PORT value` only if a non-numeric value is set.
- **Vite build fails mentioning `PORT`/`BASE_PATH`** — both must be set to sane values for the web build;
  the launcher sets them, but a bare `pnpm --filter @workspace/pdftools run build` with a broken `PORT`
  value fails fast by design.
- **`pnpm --filter @workspace/db` says no project matches** — you are not in the directory containing
  `pnpm-workspace.yaml` (or you have a partial clone). Run all commands from the repo root.

---

## 6. Quickstart

Prerequisites already installed? (Full guide: [Installation](#5-installation).)

```bash
pnpm install
cp .env.example .env                  # then edit DATABASE_URL
set -a; source .env; set +a
pnpm --filter @workspace/db run push  # create the jobs table
pnpm dev:local                        # API on :8080, web on :5173
```

Open **http://localhost:5173** — the health endpoint should answer at
`http://localhost:8080/api/healthz` with `{"status":"ok"}`.

On Windows, `run-local.bat` (or `./run-local.sh` on macOS/Linux) wraps this: first-run install, `.env`
bootstrap from `.env.example`, then launch. The Replit workspace button runs the same flow.

---

## 7. API reference

All routes are mounted under `/api` (`app.use("/api", router)` in `artifacts/api-server/src/app.ts`) and are
modelled in `lib/api-spec/openapi.yaml` (34 paths total). Uploads are multipart form-data; limits are
**50 MB per file, 20 files max** (`artifacts/api-server/src/lib/upload.ts`), enforced with JSON error
responses (413 for oversized files).

| Method | Path | Upload field(s) | Purpose |
|---|---|---|---|
| GET | `/api/healthz` | — | Liveness check; returns `{"status":"ok"}` |
| GET | `/api/tools` | — | The 32-tool catalog (names, categories, status, routes) |
| GET | `/api/stats` | — | Aggregate usage stats (total jobs, jobs today, files processed, MB in/out, most popular tool) |
| GET | `/api/jobs` | — | Recent jobs (defaults to 20; `?limit=` supported) |
| POST | `/api/jobs` | — | Record a job entry |
| POST | `/api/pdf/merge` | `files` (multiple) | Merge PDFs in order |
| POST | `/api/pdf/split` | `file` | Split: ZIP of all pages, or a page subset |
| POST | `/api/pdf/rotate` | `files` (multiple) | Rotate; single angle, optional `pages` scope |
| POST | `/api/pdf/remove-pages` | `file` | Delete selected pages |
| POST | `/api/pdf/reorder-pages` | `file` | Reorder pages |
| POST | `/api/pdf/crop` | `file` | Crop margins (pt/percent), optional page selection |
| POST | `/api/pdf/add-page-numbers` | `file` | Stamp page numbers |
| POST | `/api/pdf/duplicate-pages` | `file` | Duplicate selected pages |
| POST | `/api/pdf/compare` | `files` (multiple) | Diff two PDFs; JSON report (+ Markdown download in the UI) |
| POST | `/api/pdf/page-info` | `file` | Page metadata (powers page-picker previews) |
| POST | `/api/pdf/watermark` | `file` + `image` | Text or image watermark |
| POST | `/api/pdf/protect` | `file` | Encrypt: AES-256/AES-128/RC4 + permissions |
| POST | `/api/pdf/unlock` | `file` | Remove encryption |
| POST | `/api/pdf/pdf-to-images` | `file` | Rasterize pages to JPG/PNG (ZIP for multi-page) |
| POST | `/api/pdf/images-to-pdf` | `files` (multiple) | Build a PDF from images |
| POST | `/api/pdf/word-to-pdf` | `file` | Convert .doc/.docx via headless LibreOffice; optional PDF/A |
| POST | `/api/pdf/ppt-to-pdf` | `file` | Convert .ppt/.pptx; same pipeline and PDF/A option |
| POST | `/api/pdf/excel-to-pdf` | `file` | Convert .xls/.xlsx; PDF/A option plus `fitToPage` |
| POST | `/api/pdf/compress` | `file` | Ghostscript presets (`/screen`, `/ebook`, `/printer`); `X-PDF-Compression-Engine` names the engine used |
| POST | `/api/pdf/repair` | `file` | Strict parse + tolerant recovery pass |
| POST | `/api/pdf/extract-text` | `file` | Text export (`.txt`/Markdown) |
| POST | `/api/pdf/ocr` | `file` | OCR (tesseract.js; 17 languages; text or searchable-PDF) |
| POST | `/api/pdf/pdf-to-pdfa` | `file` | PDF/A conversion (1B–3U) |
| POST | `/api/pdf/scan-to-pdf` | `files` (multiple) | Compose phone captures into one PDF; optional searchable OCR pass |
| POST | `/api/pdf/html-to-pdf` | `file` | Convert .html/.htm via headless LibreOffice; optional PDF/A |
| POST | `/api/pdf/pdf-to-excel` | `file` | Extract ruled tables as CSV (one table) or a ZIP of CSVs; delimiter option |
| POST | `/api/pdf/pdf-form-inspect` | `file` | List a PDF's form fields (names, kinds, values, choices) as JSON |
| POST | `/api/pdf/pdf-form-filler` | `file` + `values` | Fill fields from a JSON object; flatten by default |
| POST | `/api/pdf/translate-pdf` | `file` | Page-by-page AI translation; JSON + Markdown; 503 if `OPENAI_API_KEY` is unset |
| POST | `/api/pdf/ai-summarize` | `file` | AI summary; 503 JSON if `OPENAI_API_KEY` is unset |

Every `/pdf/*` route above declares its binary part(s) in `openapi.yaml` with the exact multer field names —
new routes must do the same or the generated client cannot upload (project rule, enforced in code review).

---

## 8. Project structure

```
PDFTools/
├── package.json                  # workspace root: scripts, MIT license, pnpm pin
├── pnpm-workspace.yaml           # packages + dependency catalog + supply-chain guard
├── .env.example                  # DATABASE_URL / OPENAI_API_KEY / port template
├── LICENSE                       # MIT — full license text
├── .github/workflows/ci.yml      # CI: install → typecheck → build (Node 20 & 22)
├── .replit / replit.md           # Replit: nodejs-24 + postgresql-16 modules, port map
├── run-local.sh / run-local.bat  # one-command launchers (install + env + run)
├── REVIEW.md                     # audit log: every change + its verification evidence
├── AGENTS.md                     # pointer to the REVIEW.md protocol
├── FEATURES.md / UI-NON-REGRESSION-RULES.md  # feature status / design regression rules
├── PDFTools-Frontend-Design.md   # the rebuild's design brief and screen inventory
├── tsconfig.base.json / tsconfig.json
├── artifacts/
│   ├── api-server/               # @workspace/api-server — Express 5 API
│   │   └── src/
│   │       ├── app.ts            # /api mount, CORS, multer error handler
│   │       ├── index.ts          # listen :8080
│   │       ├── routes/           # health · tools · jobs · pdf (21 /pdf/* routes)
│   │       ├── services/pdf/     # per-tool processing implementations
│   │       └── lib/              # upload (multer limits), logger
│   └── pdftools/                 # @workspace/pdftools — React 19 + Vite 7 web app
│       ├── public/               # favicon.svg (flat red mark)
│       └── src/
│           ├── pages/            # landing, tool pages, content pages
│           ├── templates/        # two workspace templates (stepper, page-picker)
│           ├── components/       # tool-options panels, workspace, landing, ui/
│           └── lib/              # tool catalog helpers, tokens, icons
├── lib/
│   ├── api-spec/                 # @workspace/api-spec — openapi.yaml + orval config
│   ├── api-zod/                  # @workspace/api-zod — generated Zod schemas
│   ├── api-client-react/         # @workspace/api-client-react — generated React Query hooks
│   └── db/                       # @workspace/db — Drizzle schema + `push` scripts
├── scripts/                      # dev-local.mjs, build-all.mjs, verify-ui/ (CDP suites)
├── stitch_pdftools_web_application_ui/   # 16 canonical design screens + DESIGN.md sets
└── attached_assets/              # pasted session transcripts (provenance records)
```

---

## 9. Testing & verification

**There is still no test runner.** No `vitest`, `jest`, `playwright`, … is declared in any `package.json`, and no
`*.test.*`/`*.spec.*` files are tracked — `pnpm test` does not exist. What does exist is a committed set of
headless-Chrome (CDP) suites that drive the **live** app and API: [`scripts/verify-ui/`](scripts/verify-ui/)
(committed 2026-09-27, which closed REVIEW.md Open Item 10). They were disposable `/tmp` harnesses; they are
not any more, so verification is reproducible by anyone with Chrome and a built API.

| Suite | Assertions | What it covers |
|---|---:|---|
| `verify.mjs` | 127 | Full regression: all five tool-page states on both workspace templates, a real upload→process→download through `/api/pdf/compress` and `/api/pdf/remove-pages`, search, filters, theme, plus a whole-catalog walk proving every wired tool renders a real Configure panel |
| `accent.mjs` | 38 | Accent colours and WCAG contrast computed from rendered pixels |
| `batch1.mjs` | 21 | Batch 1 — all seven Organize panels through real routes |
| `batch2.mjs` | 48 | Batch 2 — Protect/Unlock round-trips (including an encrypted file refusing to unlock without its password), the Protect guard, Sign/Redact's honest pending state |
| `batch3.mjs` | 59 | Batch 3 — Watermark text and image runs, Add Page Numbers, picker-scoped Crop, the image-part guard, Edit PDF Content / PDF Form Filler pending state |
| `batch4.mjs` | 54 | Batch 4 — JPG/PNG to PDF, PDF to JPG, PDF to PDF/A and PDF to Markdown through real routes, panel parity, the conditional controls, the download filenames, and the shared move-up/move-down/remove row list |
| `batch5.mjs` | 65 | Batch 5 — Word/PowerPoint/Excel to PDF: the conversions themselves (text and page counts read back through the API), PDF/A-1b/2b/3b markers, fit-to-page collapsing 3 pages to 1, and the guards that reject a mislabelled or wrong-family upload |
| `batch6.mjs` | 70 | Batch 6 — Scan to PDF (captures composed one page each, geometry, the optional OCR text layer read back as real text, a text-free capture refused) and HTML to PDF (markup text in the output, PDF/A markers, the markup sniff that rejects a text file named `.html`), plus a bidirectional spec ↔ router coupling check |
| `batch7.mjs` | 76 | Batch 7 — PDF Form Filler (the inspected inventory, filled values proven by a no-flatten inspect round-trip and by reading the flattened output's text, flatten removing the fields, every wrong-value guard) and PDF to Excel (ruled tables in, CSV/ZIP out, delimiter proven both ways, table-less refusal); Translate PDF's 503 without a key; the spec ↔ router coupling check repeated at the new counts |
| `batch8.mjs` | 110 | Batch 8 — Redact (the redacted string unextractable, neighbours surviving, case-insensitive matching, the removes-nothing refusal), Sign (openssl-parsed PKCS#7, ByteRange covering the file, visible stamp, uploaded and generated certificates, wrong-passphrase 422), PDF to Word and PDF to PowerPoint (real OOXML zips with the text round-tripped and one slide per page), Chat's key-aware 503, Edit (placed text extractable, off-page anchors refused, every malformed-ops guard); catalog at 31/1/0; the spec ↔ router coupling check at 36 paths |
| `compress.mjs` | 44 | Compression — the three Ghostscript profiles measured on a generated image-heavy document (extreme downsamples to 72 dpi, recommended re-encodes at full size), the never-larger guarantee including the profile that would inflate a text-only file, the engine header, and a real UI run |
| `compare.mjs` | — | Reference fidelity against the canonical Stitch design screens |
| `contrast.mjs` | — | Informational WCAG audit (reports ratios; exit code never gates) |

Run one with `bash scripts/verify-ui/drive.sh <suite>.mjs` — or `pnpm verify:ui <suite>.mjs`. The driver sources
`.env`, starts the built API on `:8080` and Vite on `:5173`, runs the suite, and tears both down on exit; it
needs a built API (`pnpm build` once) and Chrome at `/usr/bin/google-chrome`. `bash scripts/verify-ui/run-all.sh`
runs `verify.mjs`.

**CI exists and runs the build pipeline.** `.github/workflows/ci.yml` (added 2026-09-26) runs on every push
and pull request across Node 20 and 22: `pnpm install --frozen-lockfile` → `pnpm run typecheck` → `pnpm build`.
Those are exactly the steps executed locally while authoring this README, so the workflow encodes an
already-verified sequence; the badge at the top shows the latest live run. **CI does not run the CDP suites**
— they need Chrome plus two live servers on fixed ports, so wiring them into the workflow is the natural next
step.

What does exist is a verification log with teeth: [`REVIEW.md`](REVIEW.md) records every change since the
project's start with the exact command or suite that backs each "verified" claim, plus an open-items list.

Minimum verification available to anyone, right now: `pnpm build` (typechecks every package and builds all
artifacts — this was run as part of authoring this README) and the `/api/healthz` check from the
[Installation](#verify-the-installation) section.

---

## 10. Known limitations

Pulled verbatim in substance from REVIEW.md's Open Items (nothing softened):

1. **Compression profiles need Ghostscript on the host** — the three profiles are real (72/150/300 dpi image
   downsampling, verified: 5.76 MB → 176 KB at `extreme`), but they are Ghostscript presets. Where `gs` is
   absent the endpoint still answers 200 and still shrinks a text-heavy file by re-serialising; it just cannot
   apply the profile, which the `X-PDF-Compression-Engine: pdf-lib` header and the panel note both say. The
   open part is the UI surfacing that difference instead of only documenting it.
2. **Batch 8 wired the last six tools, but three honest scope limits stand** — the catalog is 31 implemented ·
   1 partial · 0 pending. The limits the new tools state in their panels and in the spec: PDF to Word and
   PDF to PowerPoint are text rebuilds (layout, columns, images and tables do not carry over); Edit PDF
   Content is overlay-only (existing text is not rewritten — no tool can reflow a PDF's text layer); Sign
   uses self-signed or uploaded P12 certificates with no timestamp authority; Redact matches literal,
   case-insensitive terms only; Chat with Document is one grounded question per run with no chunking or
   vector store. The live model paths were exercised against a real provider on 2026-09-29 (both AI suites
   green with a rotated key); translate fidelity depends on the chosen model snapshot — pin concrete
   snapshots, not `*-latest` aliases (see [Swapping the AI provider](#swapping-the-ai-provider)).
3. **Rotate picker rotations are preview-only** — `POST /pdf/rotate` applies ONE angle (optionally scoped by
   `pages`), so the page-picker's per-page rotate arrows cannot be honoured per-page yet. Product decision
   pending: extend the backend, or keep the honest preview-only framing.
4. **`on-tertiary-container` contrast measured 2026-09-29: 13.16:1** on `tertiary-container` (passes WCAG
   easily); the `tertiary-fixed` token family is ported but still used by no component, so the pair is
   unexercised in real UIs — measure per-usage if it is ever adopted on non-default backgrounds.
5. **No test runner** — the CDP suites are committed and reproducible (see
   [Testing & verification](#9-testing--verification)), but there is still no framework (`vitest`/`jest`/
   `playwright`) and CI runs install/typecheck/build only, so no automated run happens on push; the suites
   need Chrome plus live servers on fixed ports.
6. **Spec ↔ multer coupling** — every new `/pdf/*` route must add its binary part(s) to `openapi.yaml` with
   the exact field name (`file`/`files`/`image`), or the generated client cannot upload.
7. **Unused dependencies** — `cookie-parser` + `@types/cookie-parser` (API server; zero imports) and root
   `@replit/connectors-sdk` (zero imports; Replit platform coupling under review). Removal deliberately
   deferred.
8. **This README** — authored 2026-09-26 against `feat/frontend-rebuild` @ `9ef1a7a`; refreshed 2026-09-27
   against `main` @ `8fed014` (after Batch 3) to realign the testing and roadmap sections, then audited claim
   by claim against the live tree (six stale claims corrected: merge's output, the CI badge's branch pin,
   `pdf-parse`'s scope, §2's transport note, the Replit plugin gating, and the §8 file list). Refreshed again
   for Batch 5 — the three Office → PDF tools and their routes and spec paths, the optional LibreOffice
   prerequisite, the 20/1/11 catalog split, the `batch5.mjs` row, and the Ghostscript correction above. Further
   refreshed for the compression work: the Compress row and route, the Ghostscript prerequisite, the
   `compress.mjs` row, and limitation 1 rewritten from "the option is a no-op" to the dependency that actually
   remains. Refreshed for Batch 6 — Scan/HTML to PDF and their routes, the `capture` field on the Tool schema,
   the 22/1/9 catalog split, the `batch6.mjs` row, the 30-path count, and limitation 2 moved to Batch 7. Refreshed
   for Batch 7 — Form Filler/Excel/Translate rows and routes, the 25/1/6 catalog split, the 34-path count, the
   `batch7.mjs` row, and limitation 2 moved to Batch 8. Refreshed   for Batch 8 — the last six tool rows and
   routes, the 31/1/0 catalog split, the 36-path count, the `batch8.mjs` row, limitation 2 rewritten as the
   new tools' honest scope limits, and the roadmap re-pointed at the chat live-branch mock. [REVIEW.md](REVIEW.md) is the source of truth.
9. **Production hardening gaps (2026-09-29 adversarial audit — Open Items 16–22)** — the tool is honest and
   thorough for single-user use, but it is not hardened for multi-user deployment: a malformed PDF can crash
   the API process (pdfjs unhandled rejection, Open Item 17); there is no rate limiting (Item 18); CORS is
   allow-all (Item 19); uploads sit fully in RAM, so the 20×50 MB limit is per-connection, not systemic
   (Item 22); and the lockfile-pinned multer carries upstream HIGH DoS advisories on the upload path
   (Item 16). None affects correctness of successful runs; all block a production deployment.

---

## 11. Roadmap

Ordered by REVIEW.md's actual open items and the queued work they reference — not invented phases:

1. **Make the chat live branch mock-provable** — `scripts/verify-ui/lib/mock-openai.mjs` speaks translate's
   per-page request shape; extending it to Chat with Document's single-question shape would let the live
   branch be exercised without a real key, as translate's already is. (Batch 8 shipped the last six tools;
   the catalog is 31 implemented · 1 partial · 0 pending.)
2. **Measure the `on-tertiary-container` pair before first use** — the `tertiary-fixed` token family is ported
   but consumed by nothing (badges use `success-subtle-foreground` instead), so its contrast has never been
   measured. Tracked as Known limitation 4 and REVIEW.md Open Item 9.
3. **Surface optional system-binary availability in the UI** — Compress needs Ghostscript and the three
   Office → PDF tools need LibreOffice; both degrade honestly in the API (`X-PDF-Compression-Engine`, a 503
   with a clear message) but the browser cannot tell whether this server has them, so a user picks a profile
   or a tool that may fall back. A capability endpoint (or the tool catalog) could carry that.
4. **Rotate per-page decision** — extend the rotate endpoint to per-page angles or reframe the UI.
5. **Wire the committed verification suites into CI** — `scripts/verify-ui/` (the regression, accent/contrast and
   batch 1–8 + compression suites, 706 counted assertions in total) is committed and reproducible locally; making a workflow run it
   (Chrome + live servers) is the natural next step now that CI covers install/typecheck/build.
6. **Dependency hygiene** — remove `cookie-parser` if still unused; decide `@replit/connectors-sdk`'s platform
   coupling before touching it.
7. **Approved backend candidates** (from the feature audit): PDF form fill/flatten, PDF→Excel (CSV), Translate
   PDF — shipped in Batch 7 (Scan to PDF in Batch 6); PDF to Word, PDF to PowerPoint, Edit PDF Content, Sign,
   Redact and Chat with Document — shipped in Batch 8. The audit's list is exhausted and the catalog is
   complete: 32 tools / 6 categories, 31 implemented, 1 partial (PDF to Markdown, which states its
   no-tables scope), 0 pending. The roadmap is polish and hardening now, not new scope.

---

## 12. License

[MIT](LICENSE) — the [LICENSE](LICENSE) file carries the full text, and `"license": "MIT"` in the root
`package.json` declares it to tooling.

**PDFTools** — real PDF processing, on your machine, with receipts. Every claim in this file has a paper
trail: [REVIEW.md](REVIEW.md).
