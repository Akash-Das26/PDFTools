import { Router, type IRouter, type Request, type Response } from "express";
import {
  AddPageNumbersOptions,
  ComparePdfOptions,
  CompressPdfOptions,
  CropPdfOptions,
  DuplicatePdfPagesOptions,
  ExcelToPdfOptions,
  ExportPdfTextOptions,
  HtmlToPdfOptions,
  ImagesToPdfOptions,
  PptToPdfOptions,
  ScanToPdfOptions,
  OcrPdfOptions,
  PdfPageInfoOptions,
  PdfToImagesOptions,
  PdfToPdfAOptions,
  ProtectPdfOptions,
  RemovePdfPagesOptions,
  RepairPdfOptions,
  ReorderPdfPagesOptions,
  RotatePdfOptions,
  SplitPdfOptions,
  UnlockPdfOptions,
  WatermarkPdfOptions,
  WordToPdfOptions,
} from "@workspace/api-zod";
import { upload } from "../lib/upload";
import { mergePdfs } from "../services/pdf/merge";
import { splitPdf } from "../services/pdf/split";
import { compressPdf } from "../services/pdf/compress";
import { rotatePdf } from "../services/pdf/rotate";
import { addPageNumbers } from "../services/pdf/page-numbers";
import { removePdfPages, reorderPdfPages } from "../services/pdf/organize";
import { comparePdfs } from "../services/pdf/compare";
import { watermarkPdf } from "../services/pdf/watermark";
import { protectPdf, unlockPdf } from "../services/pdf/security";
import { cropPdf } from "../services/pdf/crop";
import { duplicatePdfPages } from "../services/pdf/duplicate-pages";
import { pdfToPdfA } from "../services/pdf/pdfa";
import { repairPdf } from "../services/pdf/repair";
import { imagesToPdf, pdfToImages } from "../services/pdf/convert";
import { exportPdfText } from "../services/pdf/export-text";
import { excelToPdf, htmlToPdf, pptToPdf, wordToPdf } from "../services/pdf/office";
import { scanToPdf } from "../services/pdf/scan";
import { ocrPdf } from "../services/pdf/ocr";
import { getPdfPageInfo } from "../services/pdf/page-info";
import { summarizePdf } from "../services/pdf/summarize";

const router: IRouter = Router();

// ─── Option validation ────────────────────────────────────────────────────────
// Every tool route takes its options from multipart form fields, so the zod
// schemas in @workspace/api-zod coerce strings. Cross-field checks that need the
// document itself (page ranges against the real page count) live in the services.

interface OptionSchema<T> {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false; error: { issues: Array<{ message?: string }> } };
}

function optionErrorMessage(error: { issues: Array<{ message?: string }> }): string {
  return error.issues[0]?.message || "Invalid options";
}

function withOptions<T>(
  schema: OptionSchema<T>,
  handler: (req: Request, res: Response, options: T) => Promise<void>,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: optionErrorMessage(parsed.error) });
      return;
    }
    await handler(req, res, parsed.data);
  };
}

// ─── Organize ─────────────────────────────────────────────────────────────────
router.post("/pdf/merge", upload.array("files"), mergePdfs);
router.post("/pdf/split", upload.single("file"), withOptions(SplitPdfOptions, splitPdf));
router.post("/pdf/rotate", upload.array("files"), withOptions(RotatePdfOptions, rotatePdf));
router.post("/pdf/remove-pages", upload.single("file"), withOptions(RemovePdfPagesOptions, removePdfPages));
router.post("/pdf/reorder-pages", upload.single("file"), withOptions(ReorderPdfPagesOptions, reorderPdfPages));
router.post("/pdf/crop", upload.single("file"), withOptions(CropPdfOptions, cropPdf));
router.post("/pdf/add-page-numbers", upload.single("file"), withOptions(AddPageNumbersOptions, addPageNumbers));
router.post("/pdf/duplicate-pages", upload.single("file"), withOptions(DuplicatePdfPagesOptions, duplicatePdfPages));
router.post("/pdf/compare", upload.array("files"), withOptions(ComparePdfOptions, comparePdfs));

// ─── Page info (JSON) ─────────────────────────────────────────────────────────
// Powers the organise UI, which needs the page list (and previews) before it can
// render a draggable page order.
router.post("/pdf/page-info", upload.single("file"), withOptions(PdfPageInfoOptions, getPdfPageInfo));

// ─── Optimize ─────────────────────────────────────────────────────────────────
router.post("/pdf/compress", upload.single("file"), withOptions(CompressPdfOptions, compressPdf));
router.post("/pdf/repair", upload.single("file"), withOptions(RepairPdfOptions, repairPdf));
router.post(
  "/pdf/watermark",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  withOptions(WatermarkPdfOptions, watermarkPdf),
);

// ─── Security ─────────────────────────────────────────────────────────────────
router.post("/pdf/protect", upload.single("file"), withOptions(ProtectPdfOptions, protectPdf));
router.post("/pdf/unlock", upload.single("file"), withOptions(UnlockPdfOptions, unlockPdf));

// ─── Convert ──────────────────────────────────────────────────────────────────
router.post("/pdf/word-to-pdf", upload.single("file"), withOptions(WordToPdfOptions, wordToPdf));
router.post("/pdf/ppt-to-pdf", upload.single("file"), withOptions(PptToPdfOptions, pptToPdf));
router.post("/pdf/excel-to-pdf", upload.single("file"), withOptions(ExcelToPdfOptions, excelToPdf));
router.post("/pdf/html-to-pdf", upload.single("file"), withOptions(HtmlToPdfOptions, htmlToPdf));
router.post("/pdf/scan-to-pdf", upload.array("files"), withOptions(ScanToPdfOptions, scanToPdf));
router.post("/pdf/pdf-to-images", upload.single("file"), withOptions(PdfToImagesOptions, pdfToImages));
router.post("/pdf/images-to-pdf", upload.array("files"), withOptions(ImagesToPdfOptions, imagesToPdf));
router.post("/pdf/extract-text", upload.single("file"), withOptions(ExportPdfTextOptions, exportPdfText));
router.post("/pdf/ocr", upload.single("file"), withOptions(OcrPdfOptions, ocrPdf));
router.post("/pdf/pdf-to-pdfa", upload.single("file"), withOptions(PdfToPdfAOptions, pdfToPdfA));

// ─── AI ───────────────────────────────────────────────────────────────────────
router.post("/pdf/ai-summarize", upload.single("file"), summarizePdf);

export default router;
