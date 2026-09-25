import {
  Archive,
  Combine,
  Copy,
  Crop,
  FileImage,
  FileMinus,
  FileText,
  FileType,
  GitCompare,
  Hash,
  ImagePlus,
  ListOrdered,
  Lock,
  LucideIcon,
  // NOTE: lucide-react@0.545.0 does not export a "Compress" icon. Minimize2
  // (arrows converging inward) is the standardized compress glyph — used for
  // the compress tool everywhere (UI-NON-REGRESSION-RULES §2).
  Minimize2,
  RotateCw,
  ScanText,
  Sparkles,
  Split,
  Stamp,
  Unlock,
  Wrench,
} from "lucide-react";

export const toolIcons: Record<string, LucideIcon> = {
  merge: Combine,
  split: Split,
  compress: Minimize2,
  rotate: RotateCw,
  "remove-pages": FileMinus,
  "reorder-pages": ListOrdered,
  crop: Crop,
  watermark: Stamp,
  protect: Lock,
  unlock: Unlock,
  "ai-summarize": Sparkles,
  "add-page-numbers": Hash,
  "extract-text": FileType,
  ocr: ScanText,
  "pdf-to-images": FileImage,
  "images-to-pdf": ImagePlus,
  "duplicate-pages": Copy,
  compare: GitCompare,
  repair: Wrench,
  "pdf-to-pdfa": Archive,
};

export const defaultToolIcon = FileText;
