import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, AlertTriangle, RotateCcw, Lock, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize, downloadBlob } from "@/lib/file-utils";

// ─── Processing ───────────────────────────────────────────────────────────────

interface ProcessingPanelProps {
  label: string;
  detail?: string;
  onCancel?: () => void;
}

/**
 * Step-4 processing overlay: determinate/indeterminate primary progress bar,
 * dynamic status label, inputs effectively disabled (template hides the
 * configure panel), plus a cancel trigger.
 */
export function ProcessingPanel({ label, detail, onCancel }: ProcessingPanelProps) {
  const [progress, setProgress] = useState(8);
  const timer = useRef<number | null>(null);

  // The API has no progress endpoint, so the bar advances on a slow asymptote
  // toward 90% — honest "work happening" feedback without faking completion.
  useEffect(() => {
    timer.current = window.setInterval(() => {
      setProgress((current) => current + (90 - current) * 0.06);
    }, 400);
    return () => {
      if (timer.current != null) window.clearInterval(timer.current);
    };
  }, []);

  return (
    <div className="w-full bg-card p-6 md:p-8 rounded-xl border border-border shadow-xs" data-testid="processing-panel">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <p className="font-semibold text-foreground">{label}</p>
          {detail && <p className="text-sm text-muted-foreground mt-0.5">{detail}</p>}
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary" data-testid="processing-percent">
          {Math.floor(progress)}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.floor(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
      {onCancel && (
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent transition-colors"
            data-testid="button-cancel"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Result ───────────────────────────────────────────────────────────────────

interface ResultPanelProps {
  /** Download-ready blob and its suggested name. */
  blob: Blob;
  filename: string;
  /** Input size for the before/after comparison (compress-type tools). */
  inputSize?: number;
  /** Extra metrics line, e.g. "4 pages · 17 languages". */
  meta?: string;
  onReset: () => void;
}

/**
 * Step-5 success panel: success-tinted icon badge, before/after size
 * comparison with a percent badge, full-width primary download CTA and the
 * "process another file" reset.
 */
export function ResultPanel({ blob, filename, inputSize, meta, onReset }: ResultPanelProps) {
  const outputSize = blob.size;
  const savedPercent = inputSize && inputSize > 0 ? Math.round((1 - outputSize / inputSize) * 100) : null;
  const smaller = savedPercent != null && savedPercent > 0;

  return (
    <div className="w-full bg-card p-6 md:p-8 rounded-xl border border-border shadow-xs" data-testid="result-panel">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-success-subtle text-success flex items-center justify-center mb-4">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Your file is ready</h2>
        {meta && <p className="text-sm text-muted-foreground mt-1">{meta}</p>}

        {inputSize != null && (
          <div className="mt-5 w-full max-w-sm rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-center gap-3 text-sm">
              <span className="text-muted-foreground line-through">{formatFileSize(inputSize)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-bold text-success">{formatFileSize(outputSize)}</span>
              {savedPercent != null && savedPercent !== 0 && (
                <span
                  className={cn(
                    "text-xs font-semibold rounded-full px-2 py-0.5",
                    smaller ? "bg-success-subtle text-success" : "bg-warning-subtle text-warning",
                  )}
                  data-testid="result-delta"
                >
                  {smaller ? `−${savedPercent}%` : `+${Math.abs(savedPercent)}%`}
                </span>
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => downloadBlob(blob, filename)}
          data-testid="button-download"
          className="mt-6 w-full max-w-sm h-12 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download {filename.length > 24 ? "" : ""}
          {filename}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-process-another"
        >
          <RotateCcw className="w-4 h-4" />
          Process another file
        </button>
      </div>
    </div>
  );
}

// ─── Error ────────────────────────────────────────────────────────────────────

interface ErrorPanelProps {
  title: string;
  message: string;
  /** Optional recovery route, e.g. /tools/unlock for password errors. */
  recoverTo?: string;
  recoverLabel?: string;
  onReset: () => void;
}

/**
 * Error variant with the same panel shape as Result, destructive tone. Password
 * errors offer an inline jump to the Unlock tool ("resilient, in-place
 * recovery" from the mockup); corrupt files offer the Repair tool.
 */
export function ErrorPanel({ title, message, recoverTo, recoverLabel, onReset }: ErrorPanelProps) {
  const Icon = recoverTo ? Lock : FileWarning;

  return (
    <div className="w-full bg-card p-6 md:p-8 rounded-xl border border-destructive/30 shadow-xs" data-testid="error-panel">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">{message}</p>

        {recoverTo && (
          <a
            href={recoverTo}
            data-testid="button-recover"
            className="mt-6 w-full max-w-sm h-12 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
          >
            <Icon className="w-4 h-4" />
            {recoverLabel ?? "Recover this file"}
          </a>
        )}

        <button
          type="button"
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-error-reset"
        >
          <RotateCcw className="w-4 h-4" />
          Try another file
        </button>
      </div>
    </div>
  );
}
