import type { LucideIcon } from "lucide-react";
import {
  Combine,
  Download,
  Upload,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/**
 * Landing-page grouping for the tool catalog. The server catalog has five
 * categories (organize, optimize, security, ai, convert); the design system's
 * landing IA splits convert into "Convert to PDF" and "Convert from PDF" and
 * merges optimize into organize, so each display group lists the catalog
 * categories it contains. One source of truth for section headers, pill
 * filters and per-category tool counts (UI-NON-REGRESSION-RULES §3).
 */
export interface ToolCategoryMeta {
  /** Catalog `category` values that belong to this display group. */
  matches: string[];
  label: string;
  icon: LucideIcon;
  /** Icon-tile tone used by ToolCard across all screens. */
  tone: "primary" | "secondary" | "success" | "warning";
  /** Pill filter value in the search bar. */
  filter: string;
}

export const TOOL_CATEGORY_GROUPS: ToolCategoryMeta[] = [
  {
    matches: ["organize", "optimize"],
    label: "Organize PDF",
    icon: Combine,
    tone: "primary",
    filter: "organize",
  },
  {
    matches: ["convert"],
    label: "Convert from PDF",
    icon: Download,
    tone: "success",
    filter: "convert-from",
  },
  {
    matches: ["security"],
    label: "PDF Security",
    icon: ShieldCheck,
    tone: "warning",
    filter: "security",
  },
  {
    matches: ["ai"],
    label: "AI Tools",
    icon: Sparkles,
    tone: "primary",
    filter: "ai",
  },
];

/** Tone for a catalog category, resolved from the display groups. */
export function toneForCategory(category: string): ToolCategoryMeta["tone"] {
  return TOOL_CATEGORY_GROUPS.find((group) => group.matches.includes(category))?.tone ?? "primary";
}
