import {
  Combine,
  Split,
  Minimize2,
  RotateCw,
  FileText,
  Lock,
  Unlock,
  Stamp,
  Sparkles,
  Hash,
  FileType,
  LucideIcon,
} from "lucide-react";

export const toolIcons: Record<string, LucideIcon> = {
  merge: Combine,
  split: Split,
  compress: Minimize2,
  rotate: RotateCw,
  watermark: Stamp,
  protect: Lock,
  unlock: Unlock,
  "ai-summarize": Sparkles,
  "add-page-numbers": Hash,
  "extract-text": FileType,
};
