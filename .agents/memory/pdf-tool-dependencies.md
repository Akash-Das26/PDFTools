---
name: PDF tool dependencies
description: Build and codegen constraints for the PDF processing dependencies used by the API server.
---

Three constraints are easy to trip over when extending the PDF tools:

1. **archiver v8 is ESM-only.** It exports the archive classes (`ZipArchive`, `TarArchive`,
   `JsonArchive`) — the old `archiver("zip", options)` factory no longer exists, and the
   `require("archiver")` call that used to be in `routes/pdf.ts` silently produced a namespace
   object instead of a callable. Build ZIPs with `new ZipArchive({ zlib: { level: 6 } })` from
   `services/pdf/shared.ts`.

2. **`@cantoo/pdf-lib` is the only PDF library.** Upstream `pdf-lib` has no encryption API, so
   Protect/Unlock cannot work on it. The fork adds `doc.encrypt({ userPassword, ownerPassword,
   permissions, algorithm })` and `PDFDocument.load(bytes, { password })`. Unlocking rebuilds the
   document page by page (`rebuildWithPageOrder`) because a password-loaded document keeps its
   `/Encrypt` trailer entry until the pages are copied into a fresh document. Upstream `pdf-lib`
   was removed from `artifacts/api-server/package.json` — do not re-add it; every route imports the
   fork, which is API-compatible.

3. **Orval's zod output is zod-v4 only for multipart bodies.** Orval v8 emits `zod.int()` and
   `zod.looseObject()` for `multipart/form-data` request bodies, which do not exist in the zod v3
   version this workspace pins. The `pdf` tag is therefore excluded from the zod config in
   `lib/api-spec/orval.config.ts`; those endpoints are validated at runtime by the hand-written
   schemas in `lib/api-zod/src/pdf-tools.ts` (which also coerce the strings that multipart
   delivers). Client hooks are still generated for them.

4. **tesseract.js must stay external.** Its Node worker is spawned as a `worker_threads` worker
   by filesystem path (`tesseract.js/src/worker-script/node/index.js`), and that worker loads
   `tesseract.js-core` WASM plus the traineddata pack relative to its own package. Bundling it
   into `dist/index.mjs` breaks those paths. `tesseract.js`, `tesseract.js-core` and
   `@tesseract.js-data/*` are therefore in the esbuild `external` list — no asset copy step is
   needed for OCR (unlike pdf-parse, whose worker genuinely resolves relative to the bundle).
   Seventeen packs ship (Latin: `eng`, `spa`, `fra`, `deu`, `ita`, `por`, `nld`, `rus`, `pol`,
   `tur`; other scripts: `ara`, `hin`, `heb`, `chi_sim`, `chi_tra`, `jpn`, `kor`). Add a language by installing its
   `@tesseract.js-data/<code>` package, adding it to the static `LANG_DATA` map in
   `services/pdf/ocr.ts`, and widening `OCR_LANGUAGES` in `pdf-tools.ts` — the three must stay
   in sync or the API will accept a code the worker cannot load. CJK pages are slower to
   recognise, so `selectPages` applies a lower 20-page cap for them.

   Tesseract's PDF renderer emits a ToUnicode CMap for every script it recognises, CJK included,
   so searchable-PDF output does **not** need a bundled Unicode font — the extracted text layer of
   a CJK page matches the OCR text exactly. Do not add a 10 MB+ CJK font or `@pdf-lib/fontkit`
   for this; it was measured and found unnecessary.

5. **`pdf-parse` reverses right-to-left text.** For an Arabic searchable PDF the embedded layer is
   correct (poppler's `pdftotext` returns the logical text, wrapped in bidi embedding marks), but
   `pdf-parse` returns each Arabic/Hebrew word with its characters reversed. Any test that checks
   RTL extraction must use a bidi-aware extractor, not `pdf-parse`. `services/pdf/extract.ts`
   routes RTL documents through `pdftotext` (found on PATH at runtime) for this reason; without
   poppler installed it falls back to pdf-parse and RTL diffs degrade.

**How to apply:** keep `@napi-rs/canvas`, `@cantoo/pdf-lib` and `tesseract.js` in the esbuild `external` list,
remember the `pdf-tools.ts` validators when adding a tool route, and validate ZIP or encrypted
output with a real request — neither failure mode shows up in the typecheck.
