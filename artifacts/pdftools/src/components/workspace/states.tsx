import { Link } from "wouter";
import { Progress } from "@/components/ui/progress";
import { uiIcons } from "@/lib/icons";
import { COMPACT_CTA, DOWNLOAD_CTA, SECONDARY_BUTTON } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";
import type { ProgressInfo, WorkspaceErrorInfo, WorkspaceResult } from "@/lib/workspace";

/**
 * Processing, result and error panels — shared by both templates.
 *
 * These three are the reason the brief says "shared processing, result, and
 * error state components, used inside both templates": a stepper workspace and
 * a page-picker workspace must not grow private copies, or the product stops
 * feeling like one app.
 */

/** State 4 — processing. Progress bar, status label, cancel. */
export function ProcessingPanel({
  progress,
  onCancel,
  fileName,
  inputSize,
}: {
  progress: ProgressInfo;
  onCancel: () => void;
  fileName: string;
  inputSize: number;
}) {
  return (
    <div
      data-testid="processing-panel"
      className="flex w-full flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 sm:p-margin"
    >
      <div className="flex items-center gap-space-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <uiIcons.loader className="h-[22px] w-[22px] animate-spin" />
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-md text-foreground">
            Processing your document...
          </h2>
          <p className="truncate text-body-sm text-muted-foreground">
            {fileName} · {formatFileSize(inputSize)}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-space-xs">
        <Progress
          value={progress.percent}
          className="h-2 bg-border"
          data-testid="processing-progress"
        />
        <div className="flex items-center justify-between text-label-sm text-muted-foreground">
          <span data-testid="processing-label">{progress.label}</span>
          <span data-testid="processing-percent">
            {Math.round(progress.percent)}%
          </span>
        </div>
      </div>        <button
          type="button"
          data-testid="button-cancel"
          onClick={onCancel}
          className={cn(SECONDARY_BUTTON, "self-start")}
        >
          Cancel
        </button>
    </div>
  );
}

/** State 5 — complete. Download, before/after metrics, process another. */
export function ResultPanel({
  result,
  inputSize,
  onReset,
  resetLabel = "Process another file",
}: {
  result: WorkspaceResult;
  inputSize?: number;
  onReset: () => void;
  resetLabel?: string;
}) {
  // Only compare sizes when the tool's whole point is to shrink the document.
  // A compare report or an AI summary also produces a blob, but quoting a
  // before/after size delta for those would be meaningless.
  const outputSize =
    result.comparable && result.blob && typeof inputSize === "number"
      ? result.blob.size
      : undefined;

  const delta =
    typeof outputSize === "number" && inputSize
      ? Math.round(((outputSize - inputSize) / inputSize) * 100)
      : null;

  return (
    <div
      data-testid="result-panel"
      className="flex w-full flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 sm:p-margin"
    >
      <div className="flex items-center gap-space-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
          <uiIcons.circleCheck className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-md text-foreground">Done</h2>
          <p className="truncate text-body-sm text-muted-foreground">
            {result.fileName}
          </p>
        </div>
      </div>

      {typeof outputSize === "number" && typeof inputSize === "number" && (
        <div className="flex items-end gap-space-md rounded-lg bg-surface p-space-md">
          <div>
            <div className="text-label-sm uppercase text-muted-foreground">
              Before
            </div>
            <div className="text-headline-md text-muted-foreground line-through">
              {formatFileSize(inputSize)}
            </div>
          </div>
          <uiIcons.arrowRight className="mb-1 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-label-sm uppercase text-muted-foreground">
              After
            </div>
            <div className="text-headline-md font-bold text-success">
              {formatFileSize(outputSize)}
            </div>
          </div>
          {delta !== null && (
            <span
              data-testid="result-delta"
              className="mb-1 rounded-full bg-success-subtle px-2 py-0.5 text-label-sm text-success"
            >
              {delta > 0 ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>
      )}

      {result.notice && (
        <p
          data-testid="result-notice"
          role="status"
          className="rounded-lg border border-border bg-surface px-space-md py-space-sm text-body-sm text-muted-foreground"
        >
          {result.notice}
        </p>
      )}

      {result.meta.length > 0 && (
        <dl className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
          {result.meta.map((entry) => (
            <div
              key={entry.label}
              className="flex items-center justify-between rounded-lg border border-border p-space-sm"
            >
              <dt className="text-body-sm text-muted-foreground">{entry.label}</dt>
              <dd className="text-label-md text-foreground">{entry.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.body && (
        <div className="flex flex-col gap-space-xs">
          {result.bodyLabel && (
            <span className="text-label-sm uppercase text-muted-foreground">
              {result.bodyLabel}
            </span>
          )}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-space-md text-body-sm text-foreground">
            {result.body}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-space-sm sm:flex-row">
        {result.url && (
          <a
            href={result.url}
            download={result.fileName}
            data-testid="button-download"
            className={cn(DOWNLOAD_CTA, "flex-1")}
          >
            <uiIcons.download className="h-4 w-4" />
            Download
          </a>
        )}
        <button
          type="button"
          data-testid="button-process-another"
          onClick={onReset}
          className={SECONDARY_BUTTON}
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

/** Error — same panel shape as the result, different tone. */
export function ErrorPanel({
  error,
  onReset,
}: {
  error: WorkspaceErrorInfo;
  onReset: () => void;
}) {
  return (
    <div
      data-testid="error-panel"
      className="flex w-full flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 sm:p-margin"
    >
      <div className="flex items-start gap-space-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <uiIcons.triangleAlert className="h-[22px] w-[22px]" />
        </div>
        <div className="min-w-0">
          <h2 className="text-headline-md text-foreground">{error.title}</h2>
          <p
            data-testid="error-message"
            className="mt-space-xs text-body-sm text-muted-foreground"
          >
            {error.message}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-space-sm sm:flex-row">
        {error.recoveryHref && (
          <Link
            href={error.recoveryHref}
            data-testid="button-recover"
            className={COMPACT_CTA}
          >
            {error.recoveryLabel ?? "Open the fix"}
            <uiIcons.arrowRight className="h-4 w-4" />
          </Link>
        )}
        <button
          type="button"
          data-testid="button-error-reset"
          onClick={onReset}
          className={SECONDARY_BUTTON}
        >
          Try another file
        </button>
      </div>
    </div>
  );
}
