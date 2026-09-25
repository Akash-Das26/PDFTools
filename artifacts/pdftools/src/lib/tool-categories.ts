import type { Tool, ToolAccent, ToolCategory } from "@workspace/api-client-react";

/**
 * Client-side display metadata for the six landing categories.
 *
 * `category` itself and its *order* come from the catalog (the server stores
 * tools in render order); this table supplies the presentation the API has no
 * business knowing — headings, filter labels, header-nav grouping and the
 * accent token each section's icon tiles use.
 *
 * Accent tokens are exact, taken from `precision_pdf_utility` and mirrored by
 * the catalog's per-tool `accent` field. They are never raw hex:
 *   organize / security -> primary
 *   convert-to / convert-from -> secondary
 *   edit -> tertiary
 *   ai -> secondary-container
 */

/** Icon-tile classes: the 40x40 rounded container on every tool card. */
export const ACCENT_TILE: Record<ToolAccent, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  tertiary: "bg-tertiary/10 text-tertiary",
  ai: "bg-secondary-container/20 text-secondary-hover",
};

/**
 * Count-badge classes for a section heading.
 *
 * These are the reference's exact pairs, which are deliberately NOT uniform:
 *
 *   organize / security      bg-primary/10            + text-primary
 *   convert-to / convert-from  bg-secondary-fixed     + text-on-secondary-fixed
 *   edit                     bg-success-subtle       + success-subtle-foreground
 *   ai                       bg-secondary-container/20 + text-secondary-hover
 *
 * The two non-obvious entries are not cosmetic:
 *   - `secondary-fixed` is a pale chip, and "fixed" in the M3 sense means it
 *     does not flip between themes, so its dark text stays readable on either
 *     canvas (13.25:1).
 *   - the edit badge's foreground is `success-subtle-foreground` (#00682B) —
 *     the same value the reference's `text-tertiary` resolves to in light, so
 *     light is pixel-identical. It needs its own token because `tertiary`
 *     itself inverts to #62DF7D in dark mode, which on the pale green chip
 *     would measure 1.55:1.
 */
export const ACCENT_BADGE: Record<ToolAccent, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary-fixed text-on-secondary-fixed",
  tertiary: "bg-success-subtle text-success-subtle-foreground",
  ai: "bg-secondary-container/20 text-secondary-hover",
};

/** Glyph-only variant, for icon chips outside a tinted tile. */
export const ACCENT_GLYPH: Record<ToolAccent, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  tertiary: "text-tertiary",
  ai: "text-secondary-hover",
};

/**
 * Hover tint for a tool card's title and "Open tool" footer. The reference
 * animates these to the card's own accent, so a Compress card warms to primary
 * while an AI card warms to `secondary-hover`.
 *
 * The count badge on a section heading is a separate concern with its own
 * pairs — see `ACCENT_BADGE`.
 */
export const ACCENT_CARD_HOVER: Record<ToolAccent, string> = {
  primary: "group-hover:text-primary",
  secondary: "group-hover:text-secondary",
  tertiary: "group-hover:text-tertiary",
  ai: "group-hover:text-secondary-hover",
};

export interface CategoryMeta {
  id: ToolCategory;
  /** Landing section heading — verbatim from the reference. */
  label: string;
  /** Filter-pill label — shorter for Security, which drops the "PDF" prefix. */
  pillLabel: string;
  accent: ToolAccent;
  /** Header-nav entry this section belongs to; Convert covers both directions. */
  nav: {
    label: string;
    href: string;
  };
}

/**
 * Header nav — five entries, in the reference's order:
 * Organize / Convert / Edit / Security / AI.
 */
export const HEADER_NAV: Array<{ label: string; href: string; matches: ToolCategory[] }> = [
  { label: "Organize", href: "#organize", matches: ["organize"] },
  { label: "Convert", href: "#convert-to", matches: ["convert-to", "convert-from"] },
  { label: "Edit", href: "#edit", matches: ["edit"] },
  { label: "Security", href: "#security", matches: ["security"] },
  { label: "AI", href: "#ai", matches: ["ai"] },
];

/** The six landing sections, in render order. */
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "organize",
    label: "Organize PDF",
    pillLabel: "Organize PDF",
    accent: "primary",
    nav: HEADER_NAV[0]!,
  },
  {
    id: "convert-to",
    label: "Convert to PDF",
    pillLabel: "Convert to PDF",
    accent: "secondary",
    nav: HEADER_NAV[1]!,
  },
  {
    id: "convert-from",
    label: "Convert from PDF",
    pillLabel: "Convert from PDF",
    accent: "secondary",
    nav: HEADER_NAV[1]!,
  },
  {
    id: "edit",
    label: "Edit PDF",
    pillLabel: "Edit PDF",
    accent: "tertiary",
    nav: HEADER_NAV[2]!,
  },
  {
    id: "security",
    label: "PDF Security",
    pillLabel: "Security",
    accent: "primary",
    nav: HEADER_NAV[3]!,
  },
  {
    id: "ai",
    label: "AI Document Tools",
    pillLabel: "AI Document Tools",
    accent: "ai",
    nav: HEADER_NAV[4]!,
  },
];

export function categoryMeta(id: ToolCategory): CategoryMeta {
  const meta = CATEGORIES.find((category) => category.id === id);
  if (!meta) {
    throw new Error(`Unknown tool category: ${id}`);
  }
  return meta;
}

/**
 * Tools in a category, in catalog order. The landing page renders sections and
 * count badges from this one function, so a badge can never disagree with the
 * number of cards beneath it.
 */
export function toolsForCategory(tools: Tool[], id: ToolCategory): Tool[] {
  return tools.filter((tool) => tool.category === id);
}
