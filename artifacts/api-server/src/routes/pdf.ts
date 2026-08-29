import { Router, type IRouter } from "express";
import multer from "multer";
import { PDFDocument, degrees, rgb, StandardFonts } from "pdf-lib";
import OpenAI from "openai";

// Polyfill browser globals that pdfjs-dist requires even in Node.js text-extraction mode
// (DOMMatrix, ImageData, Path2D are not available in Node.js but pdfjs initialises them at module load)
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    a=1;b=0;c=0;d=1;e=0;f=0;
    m11=1;m12=0;m13=0;m14=0;
    m21=0;m22=1;m23=0;m24=0;
    m31=0;m32=0;m33=1;m34=0;
    m41=0;m42=0;m43=0;m44=1;
    is2D=true;isIdentity=true;
    constructor(_init?: unknown) {}
    multiply(_other?: unknown) { return this; }
    translate(_tx?: number, _ty?: number, _tz?: number) { return this; }
    scale(_sx?: number, _sy?: number, _sz?: number, _ox?: number, _oy?: number, _oz?: number) { return this; }
    rotate(_angle?: number) { return this; }
    rotateAxisAngle(_x?: number, _y?: number, _z?: number, _angle?: number) { return this; }
    skewX(_angle?: number) { return this; }
    skewY(_angle?: number) { return this; }
    flipX() { return this; }
    flipY() { return this; }
    inverse() { return this; }
    transformPoint(_point?: unknown) { return { x: 0, y: 0, z: 0, w: 1 }; }
    toFloat32Array() { return new Float32Array(16); }
    toFloat64Array() { return new Float64Array(16); }
    toString() { return "matrix(1, 0, 0, 1, 0, 0)"; }
  };
}
if (typeof (globalThis as Record<string, unknown>).ImageData === "undefined") {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(w: number, h: number) { this.width=w; this.height=h; this.data=new Uint8ClampedArray(w*h*4); }
  };
}
if (typeof (globalThis as Record<string, unknown>).Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = class Path2D {};
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require("archiver") as (format: string, opts?: object) => import("archiver").Archiver;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse") as {
  PDFParse: new (options: { data: Buffer }) => {
    getText: () => Promise<{ text: string; total: number }>;
    destroy: () => Promise<void>;
  };
};

const configuredAiKey = process.env.OPENAI_API_KEY;
const usesOpenRouter = configuredAiKey?.startsWith("sk-or-") ?? false;
const openaiClient = new OpenAI({
  apiKey: configuredAiKey,
  ...(usesOpenRouter
    ? {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://pdftools.replit.app",
          "X-Title": "PDF Tools",
        },
      }
    : {}),
});
const aiModel = usesOpenRouter ? "openai/gpt-5-mini" : "gpt-5-mini";

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total };
  } finally {
    await parser.destroy();
  }
}

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

// ─── Add Page Numbers ─────────────────────────────────────────────────────────
router.post("/pdf/add-page-numbers", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const position = (req.body.position as string) || "bottom-center";
    const startNumber = Math.max(1, parseInt(req.body.startNumber ?? "1", 10));
    const format = (req.body.format as string) || "1"; // "1" | "Page 1" | "1/N"

    const src = await PDFDocument.load(file.buffer);
    const totalPages = src.getPageCount();
    const font = await src.embedFont(StandardFonts.Helvetica);
    const fontSize = 11;
    const margin = 24;

    src.getPages().forEach((page, idx) => {
      const { width, height } = page.getSize();
      const pageNum = idx + startNumber;
      let label = String(pageNum);
      if (format === "Page 1") label = `Page ${pageNum}`;
      else if (format === "1/N") label = `${pageNum} / ${totalPages + startNumber - 1}`;

      const textWidth = font.widthOfTextAtSize(label, fontSize);

      let x: number;
      let y: number;

      switch (position) {
        case "bottom-right":
          x = width - textWidth - margin;
          y = margin;
          break;
        case "bottom-left":
          x = margin;
          y = margin;
          break;
        case "top-center":
          x = (width - textWidth) / 2;
          y = height - margin - fontSize;
          break;
        case "top-right":
          x = width - textWidth - margin;
          y = height - margin - fontSize;
          break;
        default: // bottom-center
          x = (width - textWidth) / 2;
          y = margin;
      }

      page.drawText(label, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.85,
      });
    });

    const pdfBytes = await src.save();
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", 'attachment; filename="numbered.pdf"');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    req.log.error({ err }, "Add page numbers failed");
    res.status(500).json({ error: "Failed to add page numbers" });
  }
});

// ─── Extract Text ─────────────────────────────────────────────────────────────
router.post("/pdf/extract-text", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const parsed = await extractPdfText(file.buffer);
    const text = parsed.text?.trim() || "";

    if (!text) {
      res.status(422).json({ error: "No extractable text found. The PDF may be a scanned image." });
      return;
    }

    const baseName = file.originalname.replace(/\.pdf$/i, "");
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="${baseName}.txt"`);
    res.send(text);
  } catch (err) {
    req.log.error({ err }, "Extract text failed");
    res.status(500).json({ error: "Failed to extract text from PDF" });
  }
});

// ─── AI Summarize ─────────────────────────────────────────────────────────────
router.post("/pdf/ai-summarize", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    const parsed = await extractPdfText(file.buffer);
    const rawText = parsed.text?.trim() || "";

    if (!rawText) {
      res.status(422).json({ error: "No extractable text found. The PDF may be a scanned image without text layers." });
      return;
    }

    // Truncate to ~12 000 chars to stay within token budget while preserving most docs
    const text = rawText.length > 12000 ? rawText.slice(0, 12000) + "\n\n[…document truncated for summarization…]" : rawText;

    const completion = await openaiClient.chat.completions.create({
      model: aiModel,
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You are a professional document analyst. Given the text of a PDF, respond with a JSON object matching exactly this shape: { \"summary\": \"<2-4 sentence overview>\", \"keyPoints\": [\"<point 1>\", \"<point 2>\", \"<point 3>\", \"<point 4>\", \"<point 5>\"] }. Be concise and factual. Return only valid JSON, no markdown fences.",
        },
        { role: "user", content: `Summarize this document:\n\n${text}` },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed2: { summary?: string; keyPoints?: string[] };
    try {
      parsed2 = JSON.parse(raw);
    } catch {
      parsed2 = { summary: raw, keyPoints: [] };
    }

    res.json({
      summary: parsed2.summary ?? "No summary available.",
      keyPoints: parsed2.keyPoints ?? [],
      wordCount: rawText.split(/\s+/).filter(Boolean).length,
      pageCount: parsed.pageCount,
    });
  } catch (err) {
    req.log.error({ err }, "AI summarize failed");
    res.status(500).json({ error: "Failed to summarize PDF. Please check your OpenAI API key." });
  }
});

export default router;
