import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";

export type WorkspaceStep = "upload" | "configure" | "download";

interface StepperProps {
  step: WorkspaceStep;
  fileName?: string;
  stepLabels?: [string, string, string];
}

/** Sequential three-step indicator from the canonical workspace mockup. */
function Stepper({ step, fileName, stepLabels = ["Upload", "Configure", "Download"] }: StepperProps) {
  const states: Array<{ label: string; value: string; state: "done" | "active" | "queued" }> = [
    {
      label: step === "upload" ? "Step 1: In progress" : "Step 1: Completed",
      value: step === "upload" ? "Choose a file" : fileName ?? "File selected",
      state: step === "upload" ? "active" : "done",
    },
    {
      label: step === "configure" ? "Step 2: Active" : step === "upload" ? "Step 2: Queued" : "Step 2: Completed",
      value: stepLabels[1],
      state: step === "configure" ? "active" : step === "upload" ? "queued" : "done",
    },
    {
      label: step === "download" ? "Step 3: Active" : "Step 3: Queued",
      value: stepLabels[2],
      state: step === "download" ? "active" : "queued",
    },
  ];

  return (
    <div className="w-full bg-card p-4 rounded-xl shadow-xs border border-border">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {states.map((entry, index) => (
          <div
            key={entry.label}
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg transition-all",
              entry.state === "active" && "bg-background shadow-md border border-border",
              entry.state === "done" && "bg-background/60",
              entry.state === "queued" && "opacity-60",
            )}
            data-testid={`stepper-step-${index + 1}`}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold",
                entry.state === "done" && "bg-success text-success-foreground",
                entry.state === "active" && "bg-primary text-primary-foreground",
                entry.state === "queued" && "bg-muted text-muted-foreground",
              )}
            >
              {entry.state === "done" ? <Check className="w-4 h-4" /> : index + 1}
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  entry.state === "done" && "text-success",
                  entry.state === "active" && "text-primary",
                  entry.state === "queued" && "text-muted-foreground",
                )}
              >
                {entry.label}
              </span>
              <span className={cn("text-sm truncate", entry.state === "queued" ? "text-muted-foreground" : "text-foreground", entry.state === "active" && "font-semibold")}>
                {entry.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FileSummaryStripProps {
  fileName: string;
  fileSize: number;
  pageCount?: number | null;
  onReplace: () => void;
  onClear?: () => void;
}

/** File metadata strip shown under the stepper once a file is staged. */
function FileSummaryStrip({ fileName, fileSize, pageCount, onReplace, onClear }: FileSummaryStripProps) {
  return (
    <div className="w-full bg-card p-4 rounded-xl shadow-xs border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Check className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(fileSize)}
            {pageCount != null ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={onReplace} className="h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent transition-colors" data-testid="button-replace-file">
          Replace
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="h-9 px-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors" data-testid="button-clear-file">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export interface ToolWorkspaceProps {
  toolName: string;
  toolDescription?: string;
  icon: React.ComponentType<{ className?: string }>;
  step: WorkspaceStep;
  fileName?: string;
  fileSize?: number;
  pageCount?: number | null;
  stepLabels?: [string, string, string];
  /** Step 1 content (dropzone) — hidden once a file is staged. */
  upload: React.ReactNode;
  /** Step 2 content (options panel / page picker). */
  configure?: React.ReactNode;
  /** Shown while processing (progress) or after (result/error panels). */
  overlay?: React.ReactNode;
  /** Primary action configuration. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  onReplace: () => void;
  onClear?: () => void;
}

/**
 * The generic three-step workspace template (Upload → Configure → Download)
 * shared by all simple tools (UI-NON-REGRESSION-RULES §4). Owns the stepper,
 * file strip and primary action bar; tools only supply their Configure panel
 * and state overlays.
 */
export function ToolWorkspace({
  toolName,
  toolDescription,
  icon: Icon,
  step,
  fileName,
  fileSize,
  pageCount,
  stepLabels,
  upload,
  configure,
  overlay,
  actionLabel = "Process",
  onAction,
  actionDisabled = false,
  onReplace,
  onClear,
}: ToolWorkspaceProps) {
  const hasFile = step !== "upload";

  return (
    <div className="space-y-4">
      {/* Workspace header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{toolName}</h1>
          {toolDescription && <p className="text-sm text-muted-foreground">{toolDescription}</p>}
        </div>
      </div>

      <Stepper step={step} fileName={fileName} stepLabels={stepLabels} />

      {hasFile && fileName != null && fileSize != null && (
        <FileSummaryStrip fileName={fileName} fileSize={fileSize} pageCount={pageCount} onReplace={onReplace} onClear={onClear} />
      )}

      {!hasFile && <div data-testid="workspace-upload">{upload}</div>}

      {hasFile && configure && <div data-testid="workspace-configure">{configure}</div>}

      {overlay}

      {hasFile && step === "configure" && (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          data-testid="button-process"
          className="w-full h-12 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
