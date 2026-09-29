import { z } from "zod";

/**
 * Validators for the PDF tool routes.
 *
 * These are hand-written (not generated) because every PDF tool endpoint accepts
 * `multipart/form-data`, where multer hands the handler string values for all
 * non-file fields. The schemas therefore coerce strings, which Orval cannot
 * derive from the OpenAPI document — the spec in `@workspace/api-spec` describes
 * the same fields for client generation, while these objects validate at runtime.
 *
 * Names intentionally end in `Options` so they never collide with the
 * `...Body` schemas that Orval generates into `./generated`.
 */

/** Accepts `true`/`false`/`1`/`0`/`on`/`off`/`yes`/`no` as sent by form data. */
const booleanish = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0", "on", "off", "yes", "no"])])
  .transform((value) => (typeof value === "boolean" ? value : ["true", "1", "on", "yes"].includes(value)));

/** Comma separated page numbers and ranges, e.g. `1,3,5-8`. Empty means "all pages". */
const pageSelection = z.string().trim().max(4000).optional();

const nonEmptyPageSelection = z.string().trim().min(1, { message: "List at least one page" }).max(4000);

const hexColor = z
  .string()
  .trim()
  .regex(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i, { message: 'Colour must be a hex value such as "#999999"' });

const watermarkPosition = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "diagonal",
]);

// ─── Split ────────────────────────────────────────────────────────────────────

export const SplitPdfOptions = z.object({
  splitType: z.enum(["all", "pages"]).default("all"),
  /** Only read when `splitType` is `pages`; empty falls back to every page. */
  pages: pageSelection,
});

// ─── Compress ─────────────────────────────────────────────────────────────────

export const CompressPdfOptions = z.object({
  quality: z.enum(["extreme", "recommended", "high"]).default("recommended"),
});

// ─── Add page numbers ─────────────────────────────────────────────────────────

export const AddPageNumbersOptions = z.object({
  position: z
    .enum(["bottom-center", "bottom-right", "bottom-left", "top-center", "top-right"])
    .default("bottom-center"),
  startNumber: z.coerce
    .number()
    .int()
    .min(1, { message: "The starting number must be 1 or greater" })
    .max(100000, { message: "The starting number is too large" })
    .default(1),
  format: z.enum(["1", "Page 1", "1/N"]).default("1"),
});

// ─── Rotate ───────────────────────────────────────────────────────────────────

export const RotatePdfOptions = z.object({
  rotation: z.coerce
    .number()
    .int()
    .refine((value) => [90, 180, 270].includes(value), { message: "Rotation must be 90, 180, or 270 degrees" }),
  pages: pageSelection,
  /** Per-page clockwise deltas as "page:degrees" pairs, e.g. "1:90,3:270".
   *  Overrides `rotation` for the pages it names; each page may appear once,
   *  degrees must be non-zero multiples of 90, and page numbers must be
   *  unique positive integers (validated against the real page count in the
   *  service, like `pages`). */
  rotations: z
    .string()
    .trim()
    .max(4000)
    .refine(
      (value) => value === "" || value.split(",").every((pair) => /^[1-9]\d*:[1-9]\d*0$/.test(pair.trim())),
      { message: 'Rotations must be page:degrees pairs such as "1:90,3:270"' },
    )
    .refine(
      (value) => {
        if (value === "") return true;
        const pages = value.split(",").map((pair) => pair.trim().split(":")[0]);
        return new Set(pages).size === pages.length;
      },
      { message: "Each page may appear at most once in rotations" },
    )
    .refine(
      (value) => {
        if (value === "") return true;
        return value.split(",").every((pair) => {
          const degrees = Number(pair.trim().split(":")[1]);
          return degrees > 0 && degrees < 360 && degrees % 90 === 0;
        });
      },
      { message: "Per-page rotation must be 90, 180, or 270 degrees" },
    )
    .optional(),
});

// ─── Page info ────────────────────────────────────────────────────────────────

export const PdfPageInfoOptions = z.object({
  /** Page previews make the organise UI draggable by sight; skip them for huge documents. */
  thumbnails: booleanish.default(true),
  thumbnailWidth: z.coerce
    .number()
    .int()
    .min(60, { message: "Thumbnail width must be between 60 and 400 pixels" })
    .max(400, { message: "Thumbnail width must be between 60 and 400 pixels" })
    .default(140),
});

// ─── Remove pages ─────────────────────────────────────────────────────────────

export const RemovePdfPagesOptions = z.object({
  pages: nonEmptyPageSelection,
});

// ─── Reorder pages ────────────────────────────────────────────────────────────

export const ReorderPdfPagesOptions = z.object({
  order: nonEmptyPageSelection,
});

// ─── Watermark ────────────────────────────────────────────────────────────────

export const WatermarkPdfOptions = z.object({
  type: z.enum(["text", "image"]).default("text"),
  text: z.string().max(200).optional(),
  opacity: z.coerce
    .number()
    .min(0.05, { message: "Opacity must be between 0.05 and 1" })
    .max(1, { message: "Opacity must be between 0.05 and 1" })
    .default(0.3),
  position: watermarkPosition.default("diagonal"),
  color: hexColor.optional(),
  fontSize: z.coerce.number().min(6).max(200).optional(),
  rotation: z.coerce.number().min(-180).max(180).optional(),
  scale: z.coerce
    .number()
    .min(0.05, { message: "Image size must be between 5% and 100% of the page" })
    .max(1, { message: "Image size must be between 5% and 100% of the page" })
    .default(0.35),
  pages: pageSelection,
});

// ─── Protect ──────────────────────────────────────────────────────────────────

export const ProtectPdfOptions = z.object({
  password: z.string().min(1, { message: "A password is required" }).max(200),
  ownerPassword: z.string().min(1).max(200).optional(),
  algorithm: z.enum(["AES-256", "AES-128", "RC4-128", "RC4-40"]).default("AES-256"),
  allowPrinting: booleanish.default(true),
  allowCopying: booleanish.default(true),
  allowModifying: booleanish.default(true),
  allowAnnotating: booleanish.default(true),
  allowFillingForms: booleanish.default(true),
});

// ─── Unlock ───────────────────────────────────────────────────────────────────

export const UnlockPdfOptions = z.object({
  password: z.string().max(200).optional(),
});

// ─── Crop ─────────────────────────────────────────────────────────────────────

export const CropPdfOptions = z.object({
  unit: z.enum(["pt", "percent"]).default("percent"),
  top: z.coerce.number().min(0).default(0),
  right: z.coerce.number().min(0).default(0),
  bottom: z.coerce.number().min(0).default(0),
  left: z.coerce.number().min(0).default(0),
  pages: pageSelection,
});

// ─── PDF to JPG / PNG ─────────────────────────────────────────────────────────

export const PdfToImagesOptions = z.object({
  format: z.enum(["jpg", "png"]).default("jpg"),
  quality: z.coerce
    .number()
    .int()
    .min(1, { message: "Quality must be between 1 and 100" })
    .max(100, { message: "Quality must be between 1 and 100" })
    .default(85),
  width: z.coerce
    .number()
    .int()
    .min(100, { message: "Image width must be between 100 and 4000 pixels" })
    .max(4000, { message: "Image width must be between 100 and 4000 pixels" })
    .default(1200),
  pages: pageSelection,
});

// ─── Image to PDF ─────────────────────────────────────────────────────────────

export const ImagesToPdfOptions = z.object({
  pageSize: z.enum(["fit", "a4", "letter"]).default("fit"),
  orientation: z.enum(["auto", "portrait", "landscape"]).default("auto"),
  margin: z.coerce
    .number()
    .min(0, { message: "Margin must be between 0 and 200 points" })
    .max(200, { message: "Margin must be between 0 and 200 points" })
    .default(24),
});

// ─── PDF to PDF/A ─────────────────────────────────────────────────────────────

export const PdfToPdfAOptions = z.object({
  /** PDF/A part and conformance level, e.g. `3B` = ISO 19005-3 level B. */
  conformance: z.enum(["1B", "2B", "2U", "3B", "3U"]).default("3B"),
});

// ─── Repair ───────────────────────────────────────────────────────────────────

/** No options — the repair path is chosen automatically from the file itself. */
export const RepairPdfOptions = z.object({});

// ─── Compare ──────────────────────────────────────────────────────────────────

/** No options — the diff is chosen from the two documents themselves. */
export const ComparePdfOptions = z.object({});

// ─── Duplicate pages ──────────────────────────────────────────────────────────

export const DuplicatePdfPagesOptions = z.object({
  /** Pages to copy. Empty means every page. */
  pages: pageSelection,
  copies: z.coerce
    .number()
    .int()
    .min(1, { message: "Copies must be between 1 and 20" })
    .max(20, { message: "Copies must be between 1 and 20" })
    .default(1),
  /** `after` inserts each copy beside its original, `end` appends all copies. */
  placement: z.enum(["after", "end"]).default("after"),
});

// ─── Export text / markdown ───────────────────────────────────────────────────

export const ExportPdfTextOptions = z.object({
  format: z.enum(["txt", "md"]).default("txt"),
  pages: pageSelection,
});

// ─── OCR ──────────────────────────────────────────────────────────────────────

/**
 * Language packs shipped with the server. Each code maps to an installed
 * `@tesseract.js-data/<code>` package — keep this list in sync with the
 * `LANG_DATA` map in `services/pdf/ocr.ts` when adding a language.
 */
export const OCR_LANGUAGES = [
  "eng",
  "spa",
  "fra",
  "deu",
  "ita",
  "por",
  "nld",
  "rus",
  "pol",
  "tur",
  "ara",
  "hin",
  "heb",
  "chi_sim",
  "chi_tra",
  "jpn",
  "kor",
] as const;

/**
 * Scan to PDF reuses the image page-composition fields and adds the optional OCR
 * pass: `searchable` turns the composed PDF into one with an invisible text
 * layer, using the same language packs the OCR tool exposes.
 */
export const ScanToPdfOptions = ImagesToPdfOptions.extend({
  searchable: booleanish.default(false),
  language: z.enum(OCR_LANGUAGES).default("eng"),
});

export type ScanToPdfOptionsInput = z.infer<typeof ScanToPdfOptions>;

export const OcrPdfOptions = z.object({
  language: z.enum(OCR_LANGUAGES).default("eng"),
  /** `text` downloads a .txt/.md file; `searchable-pdf` returns a PDF with a text layer. */
  mode: z.enum(["text", "searchable-pdf"]).default("text"),
  format: z.enum(["txt", "md"]).default("txt"),
  pages: pageSelection,
});

// ─── Office → PDF (Word / PowerPoint / Excel) ─────────────────────────────────

/**
 * LibreOffice's PDF export filter takes the archival level as filter data:
 * `off` is plain PDF 1.7, while 1b/2b/3b select PDF/A-1b/2b/3b. Verified against
 * the writer, calc and impress filters — each writes a `pdfaid:part` XMP packet.
 */
const pdfaLevel = z.enum(["off", "1b", "2b", "3b"]).default("off");

export const WordToPdfOptions = z.object({
  pdfa: pdfaLevel,
});

export const PptToPdfOptions = z.object({
  pdfa: pdfaLevel,
});

export const ExcelToPdfOptions = z.object({
  pdfa: pdfaLevel,
  /** Calc export only: scale each sheet so its used range lands on one page. */
  fitToPage: booleanish.default(false),
});

export const HtmlToPdfOptions = z.object({
  pdfa: pdfaLevel,
});

// ─── PDF Form Filler ─────────────────────────────────────────────────────────

/**
 * Filler values, posted as a JSON object string keyed by field name. A string
 * fills a text field (or selects a dropdown/radio option); `true`/`"true"`
 * checks a checkbox, `false` unchecks it. The service rejects unknown names —
 * the field inventory comes from the document, and `/pdf/pdf-form-inspect`
 * returns it to the UI before anything is filled.
 */
const formValues = z
  .string()
  .trim()
  .max(100_000, { message: "The field values payload is too large" });

export const PdfFormFillerOptions = z.object({
  values: formValues,
  /** Flatten after filling: values become page content and fields disappear. */
  flatten: booleanish.default(true),
});

export const PdfFormInspectOptions = z.object({});

// ─── PDF to Excel (CSV) ───────────────────────────────────────────────────────

export const PdfToExcelOptions = z.object({
  pages: pageSelection,
  delimiter: z.enum([",", ";", "tab"]).default(","),
});

// ─── Translate PDF ────────────────────────────────────────────────────────────

/**
 * The target languages the translator supports — the same set the OCR tool
 * ships packs for, written out in full because the words go into the prompt.
 */
export const TRANSLATE_LANGUAGES = [
  "english",
  "spanish",
  "french",
  "german",
  "italian",
  "portuguese",
  "dutch",
  "polish",
  "turkish",
  "russian",
  "arabic",
  "hebrew",
  "hindi",
  "chinese (simplified)",
  "chinese (traditional)",
  "japanese",
  "korean",
] as const;

export const TranslatePdfOptions = z.object({
  targetLanguage: z.enum(TRANSLATE_LANGUAGES).default("english"),
});

// ─── Redact ───────────────────────────────────────────────────────────────────

/**
 * Terms arrive as one JSON array string. Matching is literal and
 * case-insensitive — no regex, no patterns: redaction that silently did less
 * than the user believed is the one failure this tool must never have, so
 * every term is reported with its hit count and a run that removes nothing
 * is a 422 rather than an unchanged file.
 */
const redactTerms = z
  .string()
  .trim()
  .min(1, { message: "List at least one term to redact" })
  .max(20_000, { message: "The terms payload is too large" });

export const RedactPdfOptions = z.object({
  terms: redactTerms,
});

// ─── Sign ─────────────────────────────────────────────────────────────────────

/**
 * The certificate is either an uploaded .p12/.pfx part (`p12`) or, when that
 * part is absent, a self-signed pair generated for this run. Either way a
 * passphrase is required: uploaded P12 files are encrypted with it, and the
 * generated one must not ship unprotected.
 */
export const SignPdfOptions = z.object({
  signerName: z.string().trim().max(120).optional(),
  passphrase: z.string().min(1, { message: "A passphrase is required" }).max(200),
});

// ─── PDF to Word / PowerPoint ─────────────────────────────────────────────────

/** No options — the text rebuild is the whole contract. */
export const PdfToWordOptions = z.object({});

/** No options — one slide per page, text only. */
export const PdfToPowerpointOptions = z.object({});

// ─── Chat with Document ───────────────────────────────────────────────────────

export const ChatWithDocumentOptions = z.object({
  question: z
    .string()
    .trim()
    .min(1, { message: "Ask a question about the document" })
    .max(2000, { message: "The question is too long (2000 characters at most)" }),
});

// ─── Edit PDF Content ─────────────────────────────────────────────────────────

/**
 * Edit operations, posted as one JSON array string: text, rect and image
 * placements in PDF points, page numbers 1-based. Shape-checked here for
 * size only; the full per-op validation lives in the service where the
 * errors can name the offending index.
 */
const editOps = z
  .string()
  .trim()
  .min(1, { message: "Add at least one edit" })
  .max(200_000, { message: "The edit payload is too large" });

export const EditPdfOptions = z.object({
  ops: editOps,
});

export type WordToPdfOptionsInput = z.infer<typeof WordToPdfOptions>;
export type PptToPdfOptionsInput = z.infer<typeof PptToPdfOptions>;
export type ExcelToPdfOptionsInput = z.infer<typeof ExcelToPdfOptions>;
export type HtmlToPdfOptionsInput = z.infer<typeof HtmlToPdfOptions>;
export type PdfFormFillerOptionsInput = z.infer<typeof PdfFormFillerOptions>;
export type PdfFormInspectOptionsInput = z.infer<typeof PdfFormInspectOptions>;
export type PdfToExcelOptionsInput = z.infer<typeof PdfToExcelOptions>;
export type TranslatePdfOptionsInput = z.infer<typeof TranslatePdfOptions>;
export type PdfPageInfoOptionsInput = z.infer<typeof PdfPageInfoOptions>;
export type ComparePdfOptionsInput = z.infer<typeof ComparePdfOptions>;
export type SplitPdfOptionsInput = z.infer<typeof SplitPdfOptions>;
export type PdfToPdfAOptionsInput = z.infer<typeof PdfToPdfAOptions>;
export type RepairPdfOptionsInput = z.infer<typeof RepairPdfOptions>;
export type DuplicatePdfPagesOptionsInput = z.infer<typeof DuplicatePdfPagesOptions>;
export type CompressPdfOptionsInput = z.infer<typeof CompressPdfOptions>;
export type AddPageNumbersOptionsInput = z.infer<typeof AddPageNumbersOptions>;
export type RotatePdfOptionsInput = z.infer<typeof RotatePdfOptions>;
export type RemovePdfPagesOptionsInput = z.infer<typeof RemovePdfPagesOptions>;
export type ReorderPdfPagesOptionsInput = z.infer<typeof ReorderPdfPagesOptions>;
export type WatermarkPdfOptionsInput = z.infer<typeof WatermarkPdfOptions>;
export type ProtectPdfOptionsInput = z.infer<typeof ProtectPdfOptions>;
export type UnlockPdfOptionsInput = z.infer<typeof UnlockPdfOptions>;
export type CropPdfOptionsInput = z.infer<typeof CropPdfOptions>;
export type PdfToImagesOptionsInput = z.infer<typeof PdfToImagesOptions>;
export type ImagesToPdfOptionsInput = z.infer<typeof ImagesToPdfOptions>;
export type ExportPdfTextOptionsInput = z.infer<typeof ExportPdfTextOptions>;
export type OcrPdfOptionsInput = z.infer<typeof OcrPdfOptions>;
export type RedactPdfOptionsInput = z.infer<typeof RedactPdfOptions>;
export type SignPdfOptionsInput = z.infer<typeof SignPdfOptions>;
export type PdfToWordOptionsInput = z.infer<typeof PdfToWordOptions>;
export type PdfToPowerpointOptionsInput = z.infer<typeof PdfToPowerpointOptions>;
export type ChatWithDocumentOptionsInput = z.infer<typeof ChatWithDocumentOptions>;
export type EditPdfOptionsInput = z.infer<typeof EditPdfOptions>;
