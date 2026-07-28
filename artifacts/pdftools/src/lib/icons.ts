import {
  Combine,
  Split,
  Minimize2,
  RotateCw,
  FileText,
  Lock,
  LucideIcon,
} from "lucide-react";

export const toolIcons: Record<string, LucideIcon> = {
  merge: Combine,
  split: Split,
  compress: Minimize2,
  rotate: RotateCw,
  watermark: FileText,
  protect: Lock,
};
