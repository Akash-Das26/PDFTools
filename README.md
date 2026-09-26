# PDFTools

<p align="center">
  <img src="artifacts/pdftools/public/favicon.svg" width="72" alt="PDFTools mark" /><br/>
  <strong>PDFTools</strong> — a self-hosted PDF toolkit: 32 tools, an Express API, and a React workspace UI.
</p>

Every number in this file is traceable to a file in this repository or a command that was run against it — see
[Testing & verification](#12-testing--verification) and [Known limitations](#13-known-limitations).

## Table of contents

1. [The problem](#1-the-problem)
2. [Architecture](#2-architecture)
3. [Feature catalog](#3-feature-catalog)
4. [Tech stack](#4-tech-stack)
5. [Installation](#5-installation)
6. [Quickstart](#6-quickstart)
7. [API reference](#7-api-reference)
8. [Project structure](#8-project-structure)
9. [Testing & verification](#12-testing--verification)
10. [Known limitations](#13-known-limitations)
11. [Roadmap](#14-roadmap)
12. [License](#16-license)

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
│  ┌──────────────────────────────┐      │ pdf       21 × POST /pdf/*      │  │
│  │ @workspace/api-spec          │      │ services/pdf/                   │  │
│  │ openapi.yaml — 25 paths      │      │ @cantoo/pdf-lib · tesseract.js  │  │
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
│  scripts/  dev-local.mjs · build-all.mjs                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

The contract chain is the point: `openapi.yaml` → **orval** → generated Zod schemas (`@workspace/api-zod`)
and generated React Query hooks (`@workspace/api-client-react`). The frontend imports types and hooks; it does
not hand-write API calls. (The PDF-processing page uses a raw `fetch` transport for multipart streaming —
see [Known limitations](#13-known-limitations).)

---

## 3. Feature catalog

32 tools in 6 categories, served by `GET /api/tools` and rendered as cards in the UI.
**17 implemented · 1 partial · 14 backend-pending.** A pending tool is visibly badged and its Process button
is disabled in the UI — the catalog never silently calls an endpoint that does not exist. Counts are exact;
nothing is rounded up.

| Category | Tools | Implemented | Partial | Pending |
|---|---:|---:|---:|---:|
| Organize | 7 | 7 | 0 | 0 |
| Convert to PDF | 6 | 1 | 0 | 5 |
| Convert from PDF | 6 | 2 | 1 | 3 |
| Edit | 5 | 3 | 0 | 2 |
| Security | 4 | 2 | 0 | 2 |
| AI | 4 | 2 | 0 | 2 |
| **Total** | **32** | **17** | **1** | **14** |

### Organize — 7 tools, all implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Merge PDF | `POST /pdf/merge` | Implemented | Multi-file, order preserved; ZIP output for multi-file results |
| Split PDF | `POST /pdf/split` | Implemented | `all` (ZIP of pages) or `pages` (single PDF) |
| Remove Pages | `POST /pdf/remove-pages` | Implemented | Page selection |
| Extract Pages | `POST /pdf/split` | Implemented | Shares the split endpoint (`splitType=pages`) |
| Organize Pages | `POST /pdf/reorder-pages` | Implemented | Page-picker UI with drag/keyboard reorder |
| Rotate PDF | `POST /pdf/rotate` | Implemented | Single angle, optionally scoped by `pages` — see limitation 3 |
| Compress PDF | `POST /pdf/compress` | Implemented | Re-serialisation only — the `quality` option is a **no-op** (limitation 1) |

### Convert to PDF — 6 tools, 1 implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| JPG/PNG to PDF | `POST /pdf/images-to-pdf` | Implemented | Page size/orientation/margin options |
| Word to PDF | — | Pending | Needs DOCX→PDF (LibreOffice headless or hosted converter) |
| PowerPoint to PDF | — | Pending | Same blocker as Word to PDF |
| Excel to PDF | — | Pending | Same blocker as Word to PDF |
| Scan to PDF | — | Pending | Backend half (`/pdf/images-to-pdf`) exists; needs camera capture UI |
| HTML to PDF | — | Pending | Needs a real HTML layout engine (headless Chromium) |

### Convert from PDF — 6 tools, 2 implemented, 1 partial

| Tool | Route | Status | Notes |
|---|---|---|---|
| PDF to JPG | `POST /pdf/pdf-to-images` | Implemented | JPG/PNG, width/quality options, ZIP for multi-page |
| PDF to PDF/A | `POST /pdf/pdf-to-pdfa` | Implemented | Conformance 1B–3U, XMP/OutputIntent |
| PDF to Markdown | `POST /pdf/extract-text` | Partial | `format=md` with heuristic headings/lists; tables are **not** converted |
| PDF to Word | — | Pending | Needs a DOCX writer + layout reconstruction |
| PDF to PowerPoint | — | Pending | Needs a PPTX writer |
| PDF to Excel | — | Pending | CSV form is buildable with `pdf-parse` tables |

### Edit — 5 tools, 3 implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Add Page Numbers | `POST /pdf/add-page-numbers` | Implemented | Position/format/start |
| Add Watermark | `POST /pdf/watermark` | Implemented | Text or image; opacity/position/scale |
| Crop PDF | `POST /pdf/crop` | Implemented | pt/percent margins, page selection |
| Edit PDF Content | — | Pending | pdf-lib cannot rewrite existing text/objects |
| PDF Form Filler | — | Pending | Fill/flatten of existing fields is buildable via `getForm()` |

### Security — 4 tools, 2 implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| Protect PDF | `POST /pdf/protect` | Implemented | AES-256/AES-128/RC4, permission flags |
| Unlock PDF | `POST /pdf/unlock` | Implemented | Rebuilds page-by-page to shed encryption |
| Sign Document | — | Pending | Real signatures need `@signpdf/*` + `node-forge` |
| Redact Sensitive Data | — | Pending | True redaction needs content removal, not black boxes |

### AI — 4 tools, 2 implemented

| Tool | Route | Status | Notes |
|---|---|---|---|
| AI PDF Summarizer | `POST /pdf/ai-summarize` | Implemented | OpenAI; returns 503 with setup instructions if `OPENAI_API_KEY` is unset |
| Compare Two PDFs | `POST /pdf/compare` | Implemented | Bounded LCS line diff + JSON report; bidi-aware extraction |
| Translate PDF | — | Pending | Buildable with the existing OpenAI client |
| Chat with Document | — | Pending | — |

> Behind the catalog there are also implemented endpoints without catalog cards — `POST /pdf/page-info`,
> `/pdf/repair`, `/pdf/ocr` (tesseract.js, 17 languages, text or searchable-PDF output), and
> `/pdf/duplicate-pages` — see the [API reference](#7-api-reference).

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
| | pdf-parse (text/tables) | ^2.4.5 |
| | openai (AI summarize) | ^7.0.0 |
| | pino / pino-http (logging) | ^9.14.0 / ^10.5.0 |
| | archiver (ZIP output) | ^8.0.0 |
| | cors | ^2.8.6 |
| Database | drizzle-orm | ^0.45.2 |
| | drizzle-kit (schema push) | ^0.31.10 |
| | pg | ^8.22.0 |
| Codegen | orval | ^8.23.0 |
| | zod (schemas) | ^3.25.76 |

Notes: `@replit/vite-plugin-*` packages are dev-only Replit niceties gated behind `REPL_ID` in
`vite.config.ts` — a non-Replit checkout does not exercise them. Root declares `@replit/connectors-sdk` but no
code imports it (tracked as an open cleanup item). `cookie-parser` is declared by the API server but unused by
any source file (same).

---

## 5. Installation

> **Execution status:** the sequence below was **executed** in the authoring session on a Linux checkout
> (Node 22.22.1, pnpm 10.26.1, local PostgreSQL 16 server) with one exception — see the
> [Database setup](#database-setup) note and [Troubleshooting](#troubleshooting).

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 | Latest tested: 22.22.1 (this session). Replit provisions Node 24. The project ships no `engines` field or `.nvmrc`. Vite 7 supports Node 20.19+/22.12+ |
| pnpm | 10.26.1 (pinned) | Enforced: root `packageManager` field + a `preinstall` hook that exits with *"Use pnpm instead"* under npm or yarn |
| PostgreSQL | ≥ 14 | Latest tested: server 16 (Replit's module); client tools 18.6 on the test machine. Required at API startup |
| OS | Linux / macOS / Windows | Linux x64 assumed by the `pnpm-workspace.yaml` platform overrides (Replit heritage); they remove non-linux-x64 `esbuild`/`rollup`/`lightningcss`/`@tailwindcss/oxide` optional packages |

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
| `OPENAI_API_KEY` | Enables `/pdf/ai-summarize` | Optional. Without it all other tools work and `ai-summarize` returns an HTTP 503 JSON error telling you to set it |
| `WEB_PORT` | Port for the Vite dev server when launched via `pnpm dev:local` | Optional, default `5173` |
| `API_PORT` | Port for the API server when launched via `pnpm dev:local` | Optional, default `8080` |

Additional variables read by the code but not needed for the standard flow: `PORT` (server listen port,
default `8080`; Vite also reads it, default `5173`), `BASE_PATH` (Vite build base, default `/`),
`API_URL` (dev-proxy target, defaults to `http://127.0.0.1:$API_PORT`), `REPL_ID` (gates Replit-only Vite
plugins), `LOG_LEVEL` / `NODE_ENV` (logging).

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

⚠️ **Honest status:** on this session's test machine, `drizzle-kit push` **exited 1 with no actionable
output** ("Pulling schema from database…" then silence) because the local Postgres rejected the
`DATABASE_URL` credentials — a **machine-side credentials issue**, not a script defect (the API server
was still able to connect later only because the auth failure was reproduced independently with `pg`;
`drizzle-kit` simply swallowed the error). Run it interactively once; if it dies silently, check the
credentials in `DATABASE_URL` first.

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
- **`drizzle-kit push` dies silently after "Pulling schema from database…"** — almost always a credential
  or connectivity problem with `DATABASE_URL`; drizzle-kit 0.31.10 exits 1 without printing the underlying
  error. Test the URL directly (any Postgres client) before assuming the schema step is broken.
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
modelled in `lib/api-spec/openapi.yaml` (25 paths total). Uploads are multipart form-data; limits are
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
| POST | `/api/pdf/compress` | `file` | Rewrite/re-serialise; `quality` presets exist but are a no-op |
| POST | `/api/pdf/repair` | `file` | Strict parse + tolerant recovery pass |
| POST | `/api/pdf/extract-text` | `file` | Text export (`.txt`/Markdown) |
| POST | `/api/pdf/ocr` | `file` | OCR (tesseract.js; 17 languages; text or searchable-PDF) |
| POST | `/api/pdf/pdf-to-pdfa` | `file` | PDF/A conversion (1B–3U) |
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
├── .replit / replit.md           # Replit: nodejs-24 + postgresql-16 modules, port map
├── run-local.sh / run-local.bat  # one-command launchers (install + env + run)
├── REVIEW.md                     # audit log: every change + its verification evidence
├── AGENTS.md                     # pointer to the REVIEW.md protocol
├── FEATURES.md / UI-NON-REGRESSION-RULES.md  # feature status / design regression rules
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
├── scripts/                      # dev-local.mjs, build-all.mjs (workspace scripts)
├── stitch_pdftools_web_application_ui/   # 16 canonical design screens + DESIGN.md sets
└── attached_assets/              # pasted session transcripts (provenance records)
```

---

## 12. Testing & verification

**There is no committed test suite.** No test runner (`vitest`, `jest`, `playwright`, …) is declared in any
`package.json`, and no `*.test.*`/`*.spec.*` files are tracked. CI does not exist either: there is no
`.github/workflows/` directory and no other CI configuration. Do not assume `pnpm test` works — there is no
such script.

What does exist is a verification log with teeth: [`REVIEW.md`](REVIEW.md) records every change since the
project's start with the exact command or suite that backs each "verified" claim, plus an open-items list.
During its most recent sessions, verification was done with disposable headless-Chrome (CDP) suites that ran
against the live app and API:

- a **127-assertion** full-regression suite (all five tool-page states on both workspace templates, real
  upload→process→download through `/api/pdf/compress` and `/api/pdf/remove-pages`, search, filters, theme),
- a **38-assertion** accent/contrast suite (WCAG contrast computed from rendered pixels),
- a **21-assertion** Batch-1 suite (all seven Organize panels through real routes).

These harnesses live in `/tmp` by design and are **not** committed — reproducing them means rewriting them
(committing them under `scripts/verify-ui/` is an open item).

Minimum verification available to anyone, right now: `pnpm build` (typechecks every package and builds all
artifacts — this was run as part of authoring this README) and the `/api/healthz` check from the
[Installation](#verify-the-installation) section.

---

## 13. Known limitations

Pulled verbatim in substance from REVIEW.md's Open Items (nothing softened):

1. **`/pdf/compress` `quality` is a no-op** — no Ghostscript in the environment; `extreme`/`recommended`/`high`
   take the identical re-serialisation path, but the Compress panel still offers three choices. Fix: build real
   compression or collapse the UI to one honest option.
2. **Batches 2–6 of the tool UI are not built** — Batch 1 (all 7 Organize tools) is done and verified; **13
   backend-pending tools** still render with a disabled Process button and a pending badge; the page-picker
   Configure panel for Crop is still open.
3. **Rotate picker rotations are preview-only** — `POST /pdf/rotate` applies ONE angle (optionally scoped by
   `pages`), so the page-picker's per-page rotate arrows cannot be honoured per-page yet. Product decision
   pending: extend the backend, or keep the honest preview-only framing.
4. **`on-tertiary-container` contrast never measured** — the `tertiary-fixed` token family is ported but used
   by nothing yet; it must be measured before first use.
5. **No test framework / CI** — the CDP suites live in `/tmp` and are disposable (see
   [Testing & verification](#12-testing--verification)).
6. **Spec ↔ multer coupling** — every new `/pdf/*` route must add its binary part(s) to `openapi.yaml` with
   the exact field name (`file`/`files`/`image`), or the generated client cannot upload.
7. **Unused dependencies** — `cookie-parser` + `@types/cookie-parser` (API server; zero imports) and root
   `@replit/connectors-sdk` (zero imports; Replit platform coupling under review). Removal deliberately
   deferred.
8. **This README** — authored 2026-09-26 against `feat/frontend-rebuild` @ `9ef1a7a`; it will drift as the
   remaining tool batches land. Refresh it when the catalog settles — [REVIEW.md](REVIEW.md) is the source of
   truth for what changed.

---

## 14. Roadmap

Ordered by REVIEW.md's actual open items and the queued work they reference — not invented phases:

1. **Batch 2 — PDF Security panels** (next per the batch-and-stop discipline): Protect, Unlock, then the
   pending Sign/Redact placeholders stay honestly disabled until their backends exist.
2. **Batches 3–6 — remaining Configure panels** for the Edit / Convert / AI categories, plus the Crop
   page-picker panel. 13 tools are backend-pending; each needs a real backend before its UI enables.
3. **Fix the compress honesty gap** — either implement real compression or reduce the quality selector to one
   option that tells the truth.
4. **Rotate per-page decision** — extend the rotate endpoint to per-page angles or reframe the UI.
5. **Commit the verification harnesses** (e.g. `scripts/verify-ui/`) so the 127/38/21-assertion suites are
   reproducible by anyone, and consider a minimal CI on top of `pnpm build`.
6. **Dependency hygiene** — remove `cookie-parser` if still unused; decide `@replit/connectors-sdk`'s platform
   coupling before touching it.
7. **Approved backend candidates** (from the feature audit): PDF form fill/flatten, PDF→Excel (CSV), Translate
   PDF, Scan-to-PDF camera capture — each was assessed as buildable with current dependencies.

The catalog itself (32 tools / 6 categories) and both workspace templates are done and verified; the roadmap
is execution of what the UI already promises, not new scope.

---

## 16. License

[MIT](package.json) — `"license": "MIT"` in the root `package.json`.

**PDFTools** — real PDF processing, on your machine, with receipts. Every claim in this file has a paper
trail: [REVIEW.md](REVIEW.md).
