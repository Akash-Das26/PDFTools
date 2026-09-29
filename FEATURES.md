# PDF Tools — Feature Status

Audited 2026-09-25 against the actual code in `artifacts/api-server/src` (routes + services), `artifacts/pdftools/src` (pages + `components/tool-options` panels), and the tool catalog served by `routes/tools.ts`. Statuses reflect runtime-verified behaviour, not just the presence of a route.

> **Updated 2026-09-28 (Batch 8):** the last six ❌ rows below shipped — PDF to Word, PDF to PowerPoint, Edit PDF (overlay), Sign PDF, Redact PDF, Chat with Document — taking the catalog to **31 implemented · 1 partial · 0 pending**. The audit's blocker notes for those rows are preserved in git history; the shipped implementations state their honest scope in the panels and the spec.

> **Reconciled 2026-09-26 (frontend rebuild):** this table tracks *backend capabilities* (31 rows — it includes Repair and OCR, which have routes but no catalog card), while the UI catalog now serves **32 tools / 6 categories**: **17 implemented · 1 partial · 14 backend-pending** (pending tools render a disabled Process button and a visible badge — the UI never silently calls a missing endpoint). The 14 pending map to the ❌/🟡 rows below plus the Convert/Edit/AI tools the backend has not grown yet. Note `README.md` predates the rebuild and still describes the pre-rebuild frontend; run instructions remain correct.

**31 implemented, 1 partial, 0 not implemented.** (The request referred to 32 items; the supplied list contains 33.) This line previously read "19 implemented, 2 partial, 12 not implemented — see notes for blockers", the 2026-09-25 audit-time counts; every item in that queue has since shipped (Batches 5–8). Corrected 2026-09-29 under the production-readiness audit — the stale line sat directly under the Batch 8 note and contradicted it.

Every tool marked ✅ has a route in `routes/pdf.ts`, a catalog entry in `routes/tools.ts`, and an option panel in `components/tool-options`; most were verified this session with runtime smoke tests (real PDFs through the built server, headless-Chrome flows for the UI).

| Feature | Status | Notes |
|---|---|---|
| Merge PDF | ✅ Implemented | `POST /pdf/merge` · catalog `merge` · multi-file, order preserved |
| Split PDF | ✅ Implemented | `POST /pdf/split` · `splitType=all` (ZIP of pages) or `pages` (single PDF) |
| Remove pages | ✅ Implemented | `POST /pdf/remove-pages` |
| Extract pages | ✅ Implemented | Same endpoint/panel as Split (`splitType=pages`) — no separate route needed |
| Organize PDF | ✅ Implemented | `POST /pdf/reorder-pages` + `POST /pdf/page-info` (previews power the drag-and-drop UI) |
| Scan to PDF | ❌ Not implemented | **Pending build.** Backend half exists (`/pdf/images-to-pdf`); missing a client-side camera/scan capture flow (`getUserMedia`) — buildable now, approved |
| Compress PDF | ✅ Implemented | `POST /pdf/compress` · quality presets |
| Repair PDF | ✅ Implemented | `POST /pdf/repair` · strict parse with `throwOnInvalidObject: true`, tolerant recovery pass, `X-Repair-Recovered` header; verified on byte-corrupted files (recovery works — the "needs a corruption-recovery strategy" concern is already addressed) |
| OCR PDF | ✅ Implemented | `POST /pdf/ocr` · tesseract.js, 17 languages, `text` (.txt/.md) and `searchable-pdf` modes, grouped language selector, persisted + shareable `?ocr=` preset |
| JPG to PDF | ✅ Implemented | `POST /pdf/images-to-pdf` · page size/orientation/margin |
| Word to PDF | ❌ Not implemented | Needs a DOCX→PDF converter — LibreOffice headless or a hosted conversion API; no JS-only option of quality |
| PPT to PDF | ❌ Not implemented | Same blocker as Word to PDF (LibreOffice headless / hosted) |
| Excel to PDF | ❌ Not implemented | Same blocker as Word to PDF (LibreOffice headless / hosted) |
| HTML to PDF | ❌ Not implemented | Needs a real HTML layout engine — headless Chromium (puppeteer/playwright); pdf-lib cannot lay out HTML |
| PDF to JPG | ✅ Implemented | `POST /pdf/pdf-to-images` · JPG/PNG, width/quality options, ZIP for multi-page |
| PDF to Word | ✅ Implemented | `POST /pdf/pdf-to-word` · `docx` writer text rebuild: per-page headings + paragraphs; layout/columns/images/tables do not carry over (stated in the panel and spec); text-free documents refused (OCR first) |
| PDF to PowerPoint | ✅ Implemented | `POST /pdf/pdf-to-powerpoint` · `pptxgenjs` deck, one editable text slide per page; text-free pages noted so page count is preserved |
| PDF to Excel | ❌ Not implemented | **Pending build** (CSV form): `pdf-parse.getTable()` exists, so per-page tables → CSV is buildable now; a true `.xlsx` writer (`exceljs`) remains a future dependency |
| PDF to PDF/A | ✅ Implemented | `POST /pdf/pdf-to-pdfa` · `convertToPDFA` with conformance choice (1B–3U); XMP/OutputIntent verified |
| Rotate PDF | ✅ Implemented | `POST /pdf/rotate` · per-page selection |
| Add page numbers | ✅ Implemented | `POST /pdf/add-page-numbers` · position/format/start |
| Add watermark | ✅ Implemented | `POST /pdf/watermark` · text or image, opacity/position/scale |
| Crop PDF | ✅ Implemented | `POST /pdf/crop` · pt/percent margins, page selection |
| Edit PDF | ✅ Implemented | `POST /pdf/edit` · overlay composition (text/rect/one image) as a JSON ops array in PDF points, matching the card's exact promise; off-page anchors refused; existing text is **not** rewritten (the audit's warning stands — no reflow exists) |
| PDF Forms | 🟡 Partial | **Pending build (approved).** Fill/flatten of *existing* interactive fields is buildable now (`@cantoo/pdf-lib` exposes `getForm()`); creating new form fields is future scope |
| Unlock PDF | ✅ Implemented | `POST /pdf/unlock` · rebuilds page-by-page to shed `/Encrypt` |
| Protect PDF | ✅ Implemented | `POST /pdf/protect` · AES-256/AES-128/RC4, permission flags |
| Sign PDF | ✅ Implemented | `POST /pdf/sign` · real PKCS#7 detached signature via `@signpdf` (uploaded `.p12` or per-run self-signed via node-forge); visible stamp; ByteRange self-check; no TSA |
| Redact PDF | ✅ Implemented | `POST /pdf/redact` · true content removal via mupdf (WASM): text objects deleted, black box drawn; literal case-insensitive terms; the removes-nothing run is a 422, not an unchanged file |
| Compare PDF | ✅ Implemented | `POST /pdf/compare` · bounded LCS line diff with set-based fallback, JSON report rendered in the UI + Markdown download; bidi-aware extraction for Arabic/Hebrew |
| AI Summarizer | ✅ Implemented | `POST /pdf/ai-summarize` · OpenAI-protocol provider via `OPENAI_BASE_URL`/`OPENAI_MODEL` (default `gpt-5-mini`; runs on Gemini in this deployment), JSON summary + key points |
| Translate PDF | ✅ Implemented | `POST /pdf/translate-pdf` · page-by-page model calls with a strict JSON contract; 50-page cap; 503 when the key is unset |
| Chat with Document | ✅ Implemented | `POST /pdf/chat-with-document` · one grounded question per run over the whole text layer (≈60k chars); must answer only from the document; no chunking/vector store (honest scope); 503 when the key is unset |
| PDF to Markdown | 🟡 Partial | `/pdf/extract-text?format=md` exports Markdown with heuristic headings/lists; tables are not converted to Markdown tables |

## Pending queue (approved, not started)

These four were classified as buildable with current dependencies and approved for implementation later. Nothing was stubbed — the rows above stay ❌/🟡 until the code exists:

1. **PDF Forms (fill + flatten)** — `PDFForm` via `getForm()`; extract fields, set values, flatten, download
2. **PDF to Excel (CSV)** — `pdf-parse.getTable()` per page → CSV (ZIP when multiple pages)
3. **Translate PDF** — existing OpenAI client, page-wise, target language option
4. **Scan to PDF (UI)** — `getUserMedia` camera capture → multi-image upload into `/pdf/images-to-pdf`

## Audit notes

- **Known limitation (2026-09-29, production-readiness audit — see AUDIT.md / Open Item 22):** Translate PDF's fidelity depends on the chosen model snapshot. A `*-latest` alias was observed live echoing the English source on 4 of 6 pages while reporting `failedPages: 0`; the JSON contract and caps hold, but output quality rides on the model. The service sends `temperature: 0.2` and the suite asserts a majority of pages are genuinely translated; pin concrete snapshots after probing them (README "Swapping the AI provider").
- **No duplicate implementations found.** No feature has two routes or two catalog entries. `pages/compare.tsx` (index of SEO competitor pages) and `pages/comparison.tsx` (single competitor page) are unrelated to the Compare PDF tool — both are content pages and neither duplicates a tool.
- **Premise corrections vs. the request:** Repair PDF (blocker listed) is implemented with a working recovery strategy; Compare PDF (blocker listed) is implemented; OCR PDF (blocker listed) is implemented on tesseract.js.
- Runtime verification this session covered: duplicate-pages, repair (healthy + corrupted), PDF/A, OCR (Latin/CJK/Arabic/Hindi/Hebrew text + searchable-PDF layers), compare (Latin + RTL), plus earlier verified tools (merge, split, rotate, remove/reorder, crop, watermark, protect, unlock, images-to-pdf, pdf-to-images, extract-text, ai-summarize).
