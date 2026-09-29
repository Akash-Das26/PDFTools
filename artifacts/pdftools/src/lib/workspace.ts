/**
 * The workspace state machine and result shapes shared by both templates.
 *
 * DESIGN.md requires all five interaction states for every tool, not just the
 * happy path. They are enumerated here once so a workspace can never quietly
 * skip one:
 *
 *   1. empty        dropzone only, no file yet
 *   2. selected     file chosen, Configure unlocked, nothing set yet
 *   3. configuring  options visible and the primary CTA is live
 *   4. processing   progress bar, inputs disabled, cancel available
 *   5. complete     download-ready with a "process another" reset
 *
 * `error` is the sixth member of the union — same panel shape as `complete`,
 * different tone (corrupt file, wrong password, unsupported input).
 */
export type WorkspacePhase =
  | "empty"
  | "selected"
  | "configuring"
  | "processing"
  | "complete"
  | "error";

/** A finished job: either a downloadable file or a JSON payload rendered in place. */
export interface WorkspaceResult {
  /** Suggested download filename, or a display title for JSON results. */
  fileName: string;
  /** Set for binary results. */
  blob?: Blob;
  url?: string;
  /**
   * Show the before/after size comparison. Set only by tools whose purpose is
   * to change the file size (Compress), so the metric is never quoted where it
   * has no meaning.
   */
  comparable?: boolean;
  /** Human-readable lines shown in the result panel (page count, summary, ...). */
  meta: Array<{ label: string; value: string }>;
  /** Free text body — used by AI summary and Compare. */
  body?: string;
  bodyLabel?: string;
  /**
   * Disclosure notice (Open Item 20): set when the server had to recover a
   * damaged document or skip unparseable inputs, so the success is never
   * silent about lost content.
   */
  notice?: string;
}

export interface WorkspaceErrorInfo {
  title: string;
  message: string;
  /** Optional route back to the tool that fixes the problem (e.g. Unlock). */
  recoveryHref?: string;
  recoveryLabel?: string;
}

export interface ProgressInfo {
  percent: number;
  label: string;
}

/** Step labels are per-tool because the reference names step 2 after the tool. */
export interface StepLabels {
  upload: string;
  configure: string;
  download: string;
}
