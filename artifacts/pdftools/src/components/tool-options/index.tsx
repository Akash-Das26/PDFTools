import type { ComponentType } from "react";
import { CropOptions, ExtractTextOptions, ImagesToPdfOptions, OcrOptions, PdfToImagesOptions } from "./convert";
import { RemovePagesOptions, ReorderPagesOptions, RotateOptions } from "./organize";
import { ProtectOptions, UnlockOptions } from "./security";
import {
  AddPageNumbersOptions,
  CompareOptions,
  CompressOptions,
  DuplicatePagesOptions,
  MergeOptions,
  PdfToPdfAOptions,
  RepairOptions,
  SplitOptions,
  SummarizeOptions,
} from "./simple";
import { WatermarkOptions } from "./watermark";
import type { ToolOptionsPanelProps } from "./types";

const PANELS: Record<string, ComponentType<ToolOptionsPanelProps>> = {
  merge: MergeOptions,
  split: SplitOptions,
  rotate: RotateOptions,
  "remove-pages": RemovePagesOptions,
  "reorder-pages": ReorderPagesOptions,
  crop: CropOptions,
  compress: CompressOptions,
  watermark: WatermarkOptions,
  protect: ProtectOptions,
  unlock: UnlockOptions,
  "add-page-numbers": AddPageNumbersOptions,
  "duplicate-pages": DuplicatePagesOptions,
  compare: CompareOptions,
  repair: RepairOptions,
  "pdf-to-pdfa": PdfToPdfAOptions,
  "pdf-to-images": PdfToImagesOptions,
  "images-to-pdf": ImagesToPdfOptions,
  "extract-text": ExtractTextOptions,
  ocr: OcrOptions,
  "ai-summarize": SummarizeOptions,
};

/**
 * Renders the option form for a tool. Every panel owns its state and reports the
 * finished multipart payload, so the tool page stays tool-agnostic.
 */
export function ToolOptionsPanel({ toolId, ...props }: ToolOptionsPanelProps & { toolId: string }) {
  const Panel = PANELS[toolId];
  if (!Panel) return null;
  return <Panel {...props} />;
}

export function hasOptionsPanel(toolId: string): boolean {
  return Boolean(PANELS[toolId]);
}
