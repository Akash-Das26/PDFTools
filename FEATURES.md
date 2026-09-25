# PDF Tools — Feature Status

Audited 2026-09-25 against the actual code in `artifacts/api-server/src` (routes + services), `artifacts/pdftools/src` (pages + `components/tool-options` panels), and the tool catalog served by `routes/tools.ts`. Statuses reflect runtime-verified behaviour, not just the presence of a route.

**19 implemented, 2 partial, 12 not implemented — see notes for blockers.** (The request referred to 32 items; the supplied list contains 33.) Four items are **approved and pending build** — feasible with current dependencies, deliberately not yet started: PDF Forms (fill/flatten), PDF to Excel (CSV), Translate PDF, Scan to PDF (camera UI).

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
| PDF to Word | ❌ Not implemented | Needs a DOCX writer dependency (e.g. `docx`) plus layout reconstruction — non-trivial fidelity problem |
| PDF to PowerPoint | ❌ Not implemented | Needs a PPTX writer (e.g. `pptxgenjs`) — new dependency |
| PDF to Excel | ❌ Not implemented | **Pending build** (CSV form): `pdf-parse.getTable()` exists, so per-page tables → CSV is buildable now; a true `.xlsx` writer (`exceljs`) remains a future dependency |
| PDF to PDF/A | ✅ Implemented | `POST /pdf/pdf-to-pdfa` · `convertToPDFA` with conformance choice (1B–3U); XMP/OutputIntent verified |
| Rotate PDF | ✅ Implemented | `POST /pdf/rotate` · per-page selection |
| Add page numbers | ✅ Implemented | `POST /pdf/add-page-numbers` · position/format/start |
| Add watermark | ✅ Implemented | `POST /pdf/watermark` · text or image, opacity/position/scale |
| Crop PDF | ✅ Implemented | `POST /pdf/crop` · pt/percent margins, page selection |
| Edit PDF | ❌ Not implemented | pdf-lib can add overlays but cannot rewrite existing text/objects; true editing needs mupdf-class tooling. Overlay-only "edit" would be misleading |
| PDF Forms | 🟡 Partial | **Pending build (approved).** Fill/flatten of *existing* interactive fields is buildable now (`@cantoo/pdf-lib` exposes `getForm()`); creating new form fields is future scope |
| Unlock PDF | ✅ Implemented | `POST /pdf/unlock` · rebuilds page-by-page to shed `/Encrypt` |
| Protect PDF | ✅ Implemented | `POST /pdf/protect` · AES-256/AES-128/RC4, permission flags |
| Sign PDF | ❌ Not implemented | Real signatures need `@signpdf/*` + `node-forge` plus a capture/placement UI; a drawn-only signature would not be cryptographically valid |
| Redact PDF | ❌ Not implemented | True redaction requires content removal (mupdf/muhammara/qpdf). Drawing black boxes over text leaves it extractable — unsafe to ship |
| Compare PDF | ✅ Implemented | `POST /pdf/compare` · bounded LCS line diff with set-based fallback, JSON report rendered in the UI + Markdown download; bidi-aware extraction for Arabic/Hebrew |
| AI Summarizer | ✅ Implemented | `POST /pdf/ai-summarize` · OpenAI (gpt-5-mini / openrouter), JSON summary + key points |
| Translate PDF | ❌ Not implemented | **Pending build.** Translatable with the **existing** OpenAI client (no new dependency); scope is page segmentation, prompt/cost controls, and target-language selection |
| PDF to Markdown | 🟡 Partial | `/pdf/extract-text?format=md` exports Markdown with heuristic headings/lists; tables are not converted to Markdown tables |

## Pending queue (approved, not started)

These four were classified as buildable with current dependencies and approved for implementation later. Nothing was stubbed — the rows above stay ❌/🟡 until the code exists:

1. **PDF Forms (fill + flatten)** — `PDFForm` via `getForm()`; extract fields, set values, flatten, download
2. **PDF to Excel (CSV)** — `pdf-parse.getTable()` per page → CSV (ZIP when multiple pages)
3. **Translate PDF** — existing OpenAI client, page-wise, target language option
4. **Scan to PDF (UI)** — `getUserMedia` camera capture → multi-image upload into `/pdf/images-to-pdf`

## Audit notes

- **No duplicate implementations found.** No feature has two routes or two catalog entries. `pages/compare.tsx` (index of SEO competitor pages) and `pages/comparison.tsx` (single competitor page) are unrelated to the Compare PDF tool — both are content pages and neither duplicates a tool. `artifacts/mockup-sandbox` carries ~60 copied `components/ui` files but is a standalone artifact, not part of the tool surface.
- **Premise corrections vs. the request:** Repair PDF (blocker listed) is implemented with a working recovery strategy; Compare PDF (blocker listed) is implemented; OCR PDF (blocker listed) is implemented on tesseract.js.
- Runtime verification this session covered: duplicate-pages, repair (healthy + corrupted), PDF/A, OCR (Latin/CJK/Arabic/Hindi/Hebrew text + searchable-PDF layers), compare (Latin + RTL), plus earlier verified tools (merge, split, rotate, remove/reorder, crop, watermark, protect, unlock, images-to-pdf, pdf-to-images, extract-text, ai-summarize).
