# verify-ui — committed CDP verification suites

Headless-Chrome (CDP) suites that run against the **live** app and API. These were previously
disposable harnesses in `/tmp/pdfcheck` (REVIEW.md Open Item 10); they are now committed so
verification is reproducible by anyone.

## Prerequisites

- Google Chrome at `/usr/bin/google-chrome` (the suites spawn it with `--remote-debugging-port`)
- A built API server (`pnpm build` once, or at least `artifacts/api-server/dist/index.mjs` present)
- A local `.env` with `DATABASE_URL` (the driver sources it before starting the API)

## Run

```bash
# Full 127-assertion regression (all five tool-page states on both templates, real uploads)
bash scripts/verify-ui/drive.sh verify.mjs

# 38-assertion accent/contrast suite (WCAG contrast computed from rendered pixels)
bash scripts/verify-ui/drive.sh accent.mjs

# 21-assertion Batch 1 suite (all seven Organize panels through real routes)
bash scripts/verify-ui/drive.sh batch1.mjs

# 48-assertion Batch 2 suite (Protect/Unlock round-trips, Sign/Redact pending UX)
bash scripts/verify-ui/drive.sh batch2.mjs

# 59-assertion Batch 3 suite (Watermark text+image, Page Numbers, Crop)
bash scripts/verify-ui/drive.sh batch3.mjs

# 54-assertion Batch 4 suite (Image to PDF, PDF to JPG, PDF/A, PDF to Markdown, and the
# shared move-up/move-down/remove row list)
bash scripts/verify-ui/drive.sh batch4.mjs

# 65-assertion Batch 5 suite (Word/PowerPoint/Excel to PDF, PDF/A export, fit-to-page,
# and the container guards) — needs LibreOffice on PATH, or those tools answer 503
bash scripts/verify-ui/drive.sh batch5.mjs

# 70-assertion Batch 6 suite (Scan to PDF: composed captures, geometry, the optional
# OCR text layer read back as real text; HTML to PDF: PDF/A markers and the markup
# sniff that rejects a text file named .html) — needs LibreOffice on PATH, or
# html-to-pdf answers 503
bash scripts/verify-ui/drive.sh batch6.mjs

# 75-assertion Batch 7 suite (PDF Form Filler: the inspected inventory drives the
# panel, filled values proven by round-trip and by flatten; PDF to Excel: ruled
# tables to CSV/ZIP with the delimiter proven both ways; Translate PDF's honest
# 503 without a key) — NOTE: the translate section ASSERTS the 503, so it fails
# by design if OPENAI_API_KEY is ever set; make it key-aware first
bash scripts/verify-ui/drive.sh batch7.mjs

# 44-assertion compression suite (Ghostscript profiles, the never-larger guarantee,
# the engine header, the panel copy) — generate-and-compress, so it needs Ghostscript
# for the profile assertions (without it they exercise the re-serialise fallback)
bash scripts/verify-ui/drive.sh compress.mjs

# Reference comparison against the Stitch design screens
bash scripts/verify-ui/drive.sh compare.mjs

# Informational WCAG audit (reports ratios; exit code never gates)
bash scripts/verify-ui/drive.sh contrast.mjs

# Everything: bash scripts/verify-ui/run-all.sh   (runs verify.mjs)
# Or from the repo root: pnpm verify:ui [suite.mjs]
```

The driver kills anything on ports 5173/8080/9222/9333/9444/9555/9666/9888, sources `.env`,
starts the built API on :8080 and the Vite dev server on :5173, runs the suite, and tears
everything down on exit.

## Notes

- Suites write PNG screenshots **next to themselves** (`scripts/verify-ui/*.png`); these are
  gitignored — delete or inspect them after a run.
- Chrome profiles are created under `/tmp/pdfcheck-ui-profile*` and removed at suite start.
- Fixtures live in `fixtures/` (two tiny generated PDFs, plus the Batch 5 Office documents).
  `fixtures/make-office-fixtures.py` regenerates the Office ones — `office.docx`, `office.pptx`
  (one page/slide of text), `office.xlsx` (120 rows, so the default export is 3 pages and
  `fitToPage` can be shown to collapse them to 1) and `office-mislabelled.docx` (plain text with
  a `.docx` name, which LibreOffice *would* convert happily — the endpoint rejects it instead).
- `batch5.mjs` and `batch6.mjs` need LibreOffice: `soffice` on PATH, or
  `SOFFICE_BIN=/path/to/soffice` for the API process. Without it `batch5.mjs` fails at its first
  conversion and `batch6.mjs` at its first HTML one — which is itself the honest 503 behaviour,
  so run the suites on a host that has it.
- `batch7.mjs` needs no system binaries, but the committed `form.pdf`/`table.pdf`/`notform.pdf`
  fixtures are generated: `bash scripts/verify-ui/fixtures/make-batch7-fixtures.sh` rebuilds them
  with `@cantoo/pdf-lib` (which only resolves from the api-server workspace, hence the wrapper).
  The table fixture draws real ruled lines because the detector builds its grid from lines and
  clips anything outside them — every column needs both of its rules.
- `compress.mjs` builds its own input: a 1200×1600 noise PNG (~5.7 MB, written to
  `/tmp/compress-noise.png`) through `/api/pdf/images-to-pdf`, then compresses it at each
  profile. Real noise matters — a cheap PRNG's byte stream deflates to 55 KB and hides the
  difference between the presets entirely. Ghostscript (`gs`, or `GS_BIN`) is needed for the
  profile assertions; without it the endpoint still answers 200 via the re-serialise fallback
  and the engine header says `pdf-lib`.
- When adding a tool batch, add a `batchN.mjs` suite here following the `batch1.mjs` pattern
  and keep the per-suite assertion counts cited in REVIEW.md entries.
- Landing-state assertions move with each batch: `verify.mjs` counts pending badges (6 after
  Batch 7) and `batch4.mjs` names a still-pending Convert card for its example. When a batch
  wires a tool those numbers change, and the suites must be updated in the same commit — older
  suites' pending examples move too (Batch 7 retired batch3's pdf-form-filler example and
  batch5/batch6's catalog counts).
- `batch4.mjs` is 53 assertions (it lost one when Batch 6 retired its html-to-pdf pending
  example and gained one new still-pending check), so the tracked total is **595**:
  127 + 38 + 21 + 48 + 54 + 53 + 65 + 70 + 75 + 44.
- `verify.mjs` no longer points at a single wired-but-panel-less tool as its `options-not-built`
  example (Batch 4 gave every wired tool a panel). It now walks the whole catalog: every
  `implemented`/`partial` tool must render a Configure panel after an upload and stay runnable.
  Keep that invariant true for new tools — a wired tool without a panel would otherwise call its
  endpoint with silently-unset defaults. The walk uploads a fixture each tool's own `accept` list
  allows (`WALK_FIXTURES`), so a new tool with a different input type needs its fixture added
  there too.
