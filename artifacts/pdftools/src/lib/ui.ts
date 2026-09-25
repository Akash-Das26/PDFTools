/**
 * Shared button styling.
 *
 * These strings are copied from the reference markup rather than invented, so
 * every commit point in the product (Process, Download, recovery) renders
 * identically. Keep them here, not inline, or the two templates will drift.
 *
 * Reference sources:
 *   workspace Process CTA   `tool_workspace_stepper_flow_compress_pdf` #process-cta
 *   result Download CTA     `result_state_success_optimization_breakdown`
 *
 * Note both use `primary-container` (#DC2626), not `primary` (#B70011):
 * `primary` is the brand/icon accent, while the container shade is the
 * documented "Primary Action Button" fill in DESIGN.md. Their radii differ in
 * the reference too (the workspace CTA is `rounded-xl`, the download bar
 * `rounded-lg`), and both are reproduced as-is.
 *
 * Because the fill is `primary-container`, the label is `on-primary-container`
 * and the hover is `primary-container-hover` — NOT the `on-primary` /
 * `primary-hover` pair. `primary` and `on-primary` invert in dark mode (that is
 * what keeps accent *text* legible on the dark canvas), so reusing their
 * foreground here would put #410002 on #DC2626: 3.55:1. The three tokens used
 * below are theme-invariant, so this CTA measures 4.83:1 in light and dark and
 * 6.47:1 on hover in both. `on-primary-container` is pure #ffffff to match the
 * reference's `text-on-primary` exactly.
 */

/** Commit button — "Process <output>" in either workspace template. */
export const PRIMARY_CTA =
  "flex items-center justify-center gap-space-sm rounded-xl bg-primary-container px-margin py-3.5 text-label-md text-on-primary-container shadow-level-2 transition-all hover:bg-primary-container-hover active:scale-95 disabled:pointer-events-none disabled:opacity-50";

/** Full-width download bar in the result panel. */
export const DOWNLOAD_CTA =
  "flex w-full items-center justify-center gap-space-sm rounded-lg bg-primary-container px-6 py-3.5 text-label-md text-on-primary-container shadow-level-3 transition-all hover:bg-primary-container-hover active:scale-[0.99]";

/** Compact secondary action (browse, recover, navigate) — still a primary fill. */
export const COMPACT_CTA =
  "inline-flex items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-md py-space-sm text-label-md text-on-primary-container transition-colors hover:bg-primary-container-hover disabled:pointer-events-none disabled:opacity-50";

/** Neutral, surface-matched secondary button (Back, Cancel, Replace). */
export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-space-xs rounded-lg border border-border bg-background px-space-md py-space-sm text-label-md text-foreground transition-colors hover:bg-surface-container disabled:pointer-events-none disabled:opacity-50";
