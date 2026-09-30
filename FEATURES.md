# PDF Tools — Feature Status

Audited 2026-09-25 against the actual code in `artifacts/api-server/src` (routes + services), `artifacts/pdftools/src` (pages + `components/tool-options` panels), and the tool catalog served by `routes/tools.ts`. Statuses reflect runtime-verified behaviour, not just the presence of a route.

> **Reconciled 2026-09-30 (FEATURES maintenance session):** every row re-checked against the live repo — the catalog's 32 ids in `routes/tools.ts`, all 33 `POST /pdf/*` routes in `routes/pdf.ts`, and every flipped tool's path in `lib/api-spec/openapi.yaml`. **Seven rows were stale** and are corrected below: Scan to PDF, Word to PDF, PPT to PDF, Excel to PDF, HTML to PDF (Batches 5–6), PDF to Excel and PDF Forms (Batch 7) — all now Implemented with real routes. The table now reads **33 implemented · 1 partial · 0 not implemented** (34 capability rows: the 32 catalog tools plus Repair and OCR, which have routes but no catalog card). The UI catalog's own rollup is unchanged at **31 implemented · 1 partial · 0 pending** and README already said so — no divergence.

> **Updated 2026-09-28 (Batch 8):** the last six ❌ rows below shipped — PDF to Word, PDF to PowerPoint, Edit PDF (overlay), Sign PDF, Redact PDF, Chat with Document — taking the catalog to **31 implemented · 1 partial · 0 pending**. The audit's blocker notes for those rows are preserved in git history; the shipped implementations state their honest scope in the panels and the spec.

> **Reconciled 2026-09-26 (frontend rebuild):** this table tracks *backend capabilities* (now 34 rows — it includes Repair and OCR, which have routes but no catalog card), while the UI catalog serves **32 tools / 6 categories**. At that date the split was 17 · 1 · 14; the pending tools rendered a disabled Process button and a visible badge, so the UI never silently called a missing endpoint. *(That 17 · 1 · 14 snapshot is superseded — every pending tool shipped through Batches 5–8.)*

**33 implemented, 1 partial, 0 not implemented** across 34 capability rows. (The UI catalog counts 32 tools because Repair and OCR have routes but no card.) This line previously read "19 implemented, 2 partial, 12 not implemented" (the 2026-09-25 audit-time counts) and then "31 implemented, 1 partial, 0" after Batch 8 — both supersessions are recorded in the notes above. Corrected 2026-09-30 when the seven stale ❌/🟡 rows from Batches 5–7 were flipped on re-verification.

Every tool marked ✅ has a route in `routes/pdf.ts`, a catalog entry in `routes/tools.ts`, and an option panel in `components/tool-options`; most were verified this session with runtime smoke tests (real PDFs through the built server, headless-Chrome flows for the UI).

| Feature | Status | Notes |
|---|---|---|
| Merge PDF | ✅ Implemented | `POST /pdf/merge` · catalog `merge` · multi-file, order preserved |
| Split PDF | ✅ Implemented | `POST /pdf/split` · `splitType=all` (ZIP of pages) or `pages` (single PDF) |
| Remove pages | ✅ Implemented | `POST /pdf/remove-pages` |
| Extract pages | ✅ Implemented | Same endpoint/panel as Split (`splitType=pages`) — no separate route needed |
| Organize PDF | ✅ Implemented | `POST /pdf/reorder-pages` + `POST /pdf/page-info` (previews power the drag-and-drop UI) |
| Scan to PDF | ✅ Implemented | `POST /pdf/scan-to-pdf` · Batch 6. Camera/photo capture composes pages through the same code path as JPG/PNG to PDF (page size, margins, per-file JPG/PNG rejection), with the optional searchable-PDF layer from OCR — the `getUserMedia` flow the old blocker named shipped with it |
| Compress PDF | ✅ Implemented | `POST /pdf/compress` · quality presets |
| Repair PDF | ✅ Implemented | `POST /pdf/repair` · strict parse with `throwOnInvalidObject: true`, tolerant recovery pass, `X-Repair-Recovered` header; verified on byte-corrupted files (recovery works — the "needs a corruption-recovery strategy" concern is already addressed) |
| OCR PDF | ✅ Implemented | `POST /pdf/ocr` · tesseract.js, 17 languages, `text` (.txt/.md) and `searchable-pdf` modes, grouped language selector, persisted + shareable `?ocr=` preset |
| JPG to PDF | ✅ Implemented | `POST /pdf/images-to-pdf` · page size/orientation/margin |
| Word to PDF | ✅ Implemented | `POST /pdf/word-to-pdf` · Batch 5. Headless LibreOffice (`soffice`, `SOFFICE_BIN`-overridable); fidelity is LibreOffice's |
| PPT to PDF | ✅ Implemented | `POST /pdf/ppt-to-pdf` · Batch 5. Same headless-LibreOffice path |
| Excel to PDF | ✅ Implemented | `POST /pdf/excel-to-pdf` · Batch 5. Same headless-LibreOffice path |
| HTML to PDF | ✅ Implemented | `POST /pdf/html-to-pdf` · Batch 6. Headless LibreOffice's HTML import — stated honest scope: no JavaScript execution, no remote asset fetching (documented in `office.ts` and the spec) |
| PDF to JPG | ✅ Implemented | `POST /pdf/pdf-to-images` · JPG/PNG, width/quality options, ZIP for multi-page |
| PDF to Word | ✅ Implemented | `POST /pdf/pdf-to-word` · `docx` writer text rebuild: per-page headings + paragraphs; layout/columns/images/tables do not carry over (stated in the panel and spec); text-free documents refused (OCR first) |
| PDF to PowerPoint | ✅ Implemented | `POST /pdf/pdf-to-powerpoint` · `pptxgenjs` deck, one editable text slide per page; text-free pages noted so page count is preserved |
| PDF to Excel | ✅ Implemented | `POST /pdf/pdf-to-excel` · Batch 7, in exactly the CSV form the audit sanctioned: pdf-parse's rule-based detector needs *ruled* tables (grid built from drawn lines — borderless layouts yield nothing, probe-verified); one table downloads `.csv`, several as a ZIP; a true `.xlsx` writer remains future scope |
| PDF to PDF/A | ✅ Implemented | `POST /pdf/pdf-to-pdfa` · `convertToPDFA` with conformance choice (1B–3U); XMP/OutputIntent verified |
| Rotate PDF | ✅ Implemented | `POST /pdf/rotate` · per-page selection · per-page angles via `rotations` (picker arrows post real overrides) |
| Add page numbers | ✅ Implemented | `POST /pdf/add-page-numbers` · position/format/start |
| Add watermark | ✅ Implemented | `POST /pdf/watermark` · text or image, opacity/position/scale |
| Crop PDF | ✅ Implemented | `POST /pdf/crop` · pt/percent margins, page selection |
| Edit PDF | ✅ Implemented | `POST /pdf/edit` · overlay composition (text/rect/one image) as a JSON ops array in PDF points, matching the card's exact promise; off-page anchors refused; existing text is **not** rewritten (the audit's warning stands — no reflow exists) |
| PDF Forms | ✅ Implemented | `POST /pdf/pdf-form-filler` (fill + flatten; `POST /pdf/pdf-form-inspect` powers the field list) · Batch 7. `@cantoo/pdf-lib` `getForm()` across text/radio/dropdown/checkbox/signature fields; creating *new* form fields is still future scope (unchanged) |
| Unlock PDF | ✅ Implemented | `POST /pdf/unlock` · rebuilds page-by-page to shed `/Encrypt` |
| Protect PDF | ✅ Implemented | `POST /pdf/protect` · AES-256/AES-128/RC4, permission flags |
| Sign PDF | ✅ Implemented | `POST /pdf/sign` · real PKCS#7 detached signature via `@signpdf` (uploaded `.p12` or per-run self-signed via node-forge); visible stamp; ByteRange self-check; no TSA |
| Redact PDF | ✅ Implemented | `POST /pdf/redact` · true content removal via mupdf (WASM): text objects deleted, black box drawn; literal case-insensitive terms; the removes-nothing run is a 422, not an unchanged file |
| Compare PDF | ✅ Implemented | `POST /pdf/compare` · bounded LCS line diff with set-based fallback, JSON report rendered in the UI + Markdown download; bidi-aware extraction for Arabic/Hebrew |
| AI Summarizer | ✅ Implemented | `POST /pdf/ai-summarize` · OpenAI-protocol provider via `OPENAI_BASE_URL`/`OPENAI_MODEL` (default `gpt-5-mini`; runs on Gemini in this deployment), JSON summary + key points |
| Translate PDF | ✅ Implemented | `POST /pdf/translate-pdf` · page-by-page model calls with a strict JSON contract; 50-page cap; 503 when the key is unset. Known limitation (Open Item 25, below): fidelity rides on the model snapshot |
| Chat with Document | ✅ Implemented | `POST /pdf/chat-with-document` · one grounded question per run over the whole text layer (≈60k chars); must answer only from the document; no chunking/vector store (honest scope); 503 when the key is unset |
| PDF to Markdown | 🟡 Partial | `/pdf/extract-text?format=md` exports Markdown with heuristic headings/lists; tables are not converted to Markdown tables |

## Pending queue (empty)

All four approved items have shipped: **PDF Forms** (Batch 7, `/pdf/pdf-form-filler`), **PDF to Excel CSV** (Batch 7, `/pdf/pdf-to-excel`), **Translate PDF** (implemented; live with a key), and **Scan to PDF's capture UI** (Batch 6, `/pdf/scan-to-pdf`). The queue stands at zero; future scope notes live on their rows (new-form-field creation, a true `.xlsx` writer).

## Audit notes

- **Known limitation (2026-09-30, re-audit Open Item 29):** Compress answers 200 on a password-protected PDF with a byte-identical, still-encrypted no-op result (`X-PDF-Compression-Engine: pdf-lib`), where sibling tools 422 with the unlock message. Silent-success shape in the Item 20 family; open at reconciliation time.
- **Known limitation (2026-09-29, production-readiness audit — see AUDIT.md / Open Item 25):** Translate PDF's fidelity depends on the chosen model snapshot. A `*-latest` alias was observed live echoing the English source on 4 of 6 pages while reporting `failedPages: 0`; the JSON contract and caps hold, but output quality rides on the model. The service sends `temperature: 0.2` and the suite asserts a majority of pages are genuinely translated; pin concrete snapshots after probing them (README "Swapping the AI provider"). Natural distinct prose does not invite the whole-page copy-through the templated fixture did (2026-09-30 fixture addendum).
- **No duplicate implementations found.** No feature has two routes or two catalog entries. `pages/compare.tsx` (index of SEO competitor pages) and `pages/comparison.tsx` (single competitor page) are unrelated to the Compare PDF tool — both are content pages and neither duplicates a tool.
- **Premise corrections vs. the request:** Repair PDF (blocker listed) is implemented with a working recovery strategy; Compare PDF (blocker listed) is implemented; OCR PDF (blocker listed) is implemented on tesseract.js.
- Runtime verification this session covered: duplicate-pages, repair (healthy + corrupted), PDF/A, OCR (Latin/CJK/Arabic/Hindi/Hebrew text + searchable-PDF layers), compare (Latin + RTL), plus earlier verified tools (merge, split, rotate, remove/reorder, crop, watermark, protect, unlock, images-to-pdf, pdf-to-images, extract-text, ai-summarize).
