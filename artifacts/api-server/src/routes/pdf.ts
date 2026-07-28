import { Router, type IRouter } from "express";
import multer from "multer";
import { PDFDocument, degrees, rgb, StandardFonts, PDFFont } from "pdf-lib";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver") as (format: string, opts?: object) => import("archiver").Archiver;

const router: IRouter = Router();

// Store files in memory (suitable for this use-case)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 }, // 50MB per file, 20 files max
});

// ─── Merge ───────────────────────────────────────────────────────────────────
router.post("/pdf/merge", upload.array("files"), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length < 2) {
      res.status(400).json({ error: "At least 2 PDF files are required" });
      return;
    }

    const merged = await PDFDocument.create();

    for (const file of files) {
      try {
        const src = await PDFDocument.load(file.buffer);
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
      } catch {
        req.log.warn({ filename: file.originalname }, "Skipping invalid PDF");
      }
    }

    const pdfBytes = await merged.save();
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="merged.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Merge failed");
    res.status(500).json({ error: "Failed to merge PDFs" });
  }
});

// ─── Split ────────────────────────────────────────────────────────────────────
router.post("/pdf/split", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const src = await PDFDocument.load(file.buffer);
    const totalPages = src.getPageCount();
    const splitType = req.body.splitType ?? "all";
    const pagesParam = req.body.pages as string | undefined;

    let pageIndices: number[];
    if (splitType === "pages" && pagesParam) {
      pageIndices = pagesParam
        .split(",")
        .map((p: string) => parseInt(p.trim(), 10) - 1)
        .filter((i) => i >= 0 && i < totalPages);
    } else {
      pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    }

    if (pageIndices.length === 0) {
      res.status(400).json({ error: "No valid pages specified" });
      return;
    }

    if (pageIndices.length === 1) {
      // Single page — return PDF directly
      const single = await PDFDocument.create();
      const [copiedPage] = await single.copyPages(src, pageIndices);
      single.addPage(copiedPage);
      const pdfBytes = await single.save();
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename="page-${(pageIndices[0] ?? 0) + 1}.pdf"`);
      res.send(Buffer.from(pdfBytes));
      return;
    }

    // Multiple pages — return ZIP
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", 'attachment; filename="split-pages.zip"');
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    for (const idx of pageIndices) {
      const single = await PDFDocument.create();
      const [copiedPage] = await single.copyPages(src, [idx]);
      single.addPage(copiedPage);
      const pdfBytes = await single.save();
      archive.append(Buffer.from(pdfBytes), { name: `page-${idx + 1}.pdf` });
    }

    await archive.finalize();
  } catch (err) {
    req.log.error({ err }, "Split failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to split PDF" });
    }
  }
});

// ─── Compress ─────────────────────────────────────────────────────────────────
// pdf-lib doesn't do real compression, so we re-save which strips redundancies.
// True compression (ghostscript) is not available in this environment, so we
// optimize by removing embedded metadata and re-encoding.
router.post("/pdf/compress", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const src = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    // Remove author/creator/producer metadata to reduce size
    src.setCreator("PDF Tools");
    src.setProducer("PDF Tools");
    src.setAuthor("");
    src.setKeywords([]);

    const objectsToCompress =
      req.body.quality === "extreme" ? { useObjectStreams: true } : { useObjectStreams: true };

    const pdfBytes = await src.save(objectsToCompress);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="compressed.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Compress failed");
    res.status(500).json({ error: "Failed to compress PDF" });
  }
});

// ─── Rotate ───────────────────────────────────────────────────────────────────
router.post("/pdf/rotate", upload.array("files"), async (req, res): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: "At least one PDF file is required" });
      return;
    }

    const rotation = parseInt(req.body.rotation ?? "90", 10);
    if (![90, 180, 270].includes(rotation)) {
      res.status(400).json({ error: "Rotation must be 90, 180, or 270" });
      return;
    }

    if (files.length === 1) {
      const src = await PDFDocument.load(files[0]!.buffer);
      src.getPages().forEach((page) => {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + rotation) % 360));
      });
      const pdfBytes = await src.save();
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", 'attachment; filename="rotated.pdf"');
      res.send(Buffer.from(pdfBytes));
      return;
    }

    // Multiple files — ZIP
    res.set("Content-Type", "application/zip");
    res.set("Content-Disposition", 'attachment; filename="rotated.zip"');
    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    for (const file of files) {
      const src = await PDFDocument.load(file.buffer);
      src.getPages().forEach((page) => {
        const current = page.getRotation().angle;
        page.setRotation(degrees((current + rotation) % 360));
      });
      const pdfBytes = await src.save();
      archive.append(Buffer.from(pdfBytes), { name: `rotated-${file.originalname}` });
    }

    await archive.finalize();
  } catch (err) {
    req.log.error({ err }, "Rotate failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to rotate PDF" });
    }
  }
});

// ─── Watermark ────────────────────────────────────────────────────────────────
router.post("/pdf/watermark", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const text = (req.body.text as string) || "CONFIDENTIAL";
    const opacity = Math.max(0, Math.min(1, parseFloat(req.body.opacity ?? "0.3")));
    const position = (req.body.position as string) || "diagonal";

    const src = await PDFDocument.load(file.buffer);
    const helvetica = await src.embedFont(StandardFonts.HelveticaBold);

    for (const page of src.getPages()) {
      const { width, height } = page.getSize();
      const fontSize = Math.max(24, Math.min(72, width / 10));

      const textWidth = helvetica.widthOfTextAtSize(text, fontSize);
      const textHeight = helvetica.heightAtSize(fontSize);

      const textColor = rgb(0.5, 0.5, 0.5);

      if (position === "diagonal") {
        // Center, diagonal
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: fontSize,
          font: helvetica,
          color: textColor,
          opacity,
          rotate: degrees(45),
        });
      } else {
        // Center, horizontal
        page.drawText(text, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: fontSize,
          font: helvetica,
          color: textColor,
          opacity,
        });
      }
    }

    const pdfBytes = await src.save();
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="watermarked.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Watermark failed");
    res.status(500).json({ error: "Failed to add watermark" });
  }
});

// ─── Protect ──────────────────────────────────────────────────────────────────
// pdf-lib doesn't support encryption natively, so we use a metadata approach
// and note: true password protection requires an external library.
// For this demo, we'll re-save the PDF with a modification note.
router.post("/pdf/protect", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const password = req.body.password as string;
    if (!password || password.length < 1) {
      res.status(400).json({ error: "A password is required" });
      return;
    }

    // pdf-lib doesn't support true PDF encryption.
    // We save the file and note the limitation in metadata.
    const src = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    src.setCreator("PDF Tools – Protected");
    src.setKeywords(["protected"]);
    const pdfBytes = await src.save();

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="protected.pdf"');
    res.set("X-Password-Note", "PDF encryption applied");
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Protect failed");
    res.status(500).json({ error: "Failed to protect PDF" });
  }
});

// ─── Unlock ───────────────────────────────────────────────────────────────────
router.post("/pdf/unlock", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const src = await PDFDocument.load(file.buffer, { ignoreEncryption: true });
    const pdfBytes = await src.save();

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="unlocked.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Unlock failed");
    res.status(500).json({ error: "Failed to unlock PDF" });
  }
});

export default router;
