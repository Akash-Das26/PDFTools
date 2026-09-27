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
- Fixtures live in `fixtures/` (two tiny generated PDFs).
- When adding a tool batch, add a `batchN.mjs` suite here following the `batch1.mjs` pattern
  and keep the per-suite assertion counts cited in REVIEW.md entries. An implemented tool that
  has no Configure panel yet is a valid `options-not-built` example for the regression suite
  (`verify.mjs` points at `pdf-to-images` since Batch 3).
