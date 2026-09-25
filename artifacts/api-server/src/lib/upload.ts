import multer from "multer";

// Store files in memory (suitable for this use-case)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 20 }, // 50MB per file, 20 files max
});
