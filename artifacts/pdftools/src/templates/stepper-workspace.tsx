import type { ReactNode } from "react";
import type { Tool } from "@workspace/api-client-react";
import { ToolHeader } from "@/components/workspace/tool-header";
import { StepIndicator, type StepStatus } from "@/components/workspace/step-indicator";
import { FileStrip } from "@/components/workspace/file-strip";
import { UploadDropzone } from "@/components/workspace/upload-dropzone";
import {
  ErrorPanel,
  ProcessingPanel,
  ResultPanel,
} from "@/components/workspace/states";
import { categoryMeta } from "@/lib/tool-categories";
import { PRIMARY_CTA, SECONDARY_BUTTON } from "@/lib/ui";
import { uiIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type {
  ProgressInfo,
  WorkspaceErrorInfo,
  WorkspacePhase,
  WorkspaceResult,
} from "@/lib/workspace";

/**
 * Template 1 of 2 — the generic three-step workspace.
 *
 * Upload → Configure → Download. Every tool that is not a page picker uses this
 * shell; only the `configure` slot changes (and, for backend-pending tools, the
 * disabled action). It owns the five required interaction states plus the error
 * state, lays out the reference's stepper header, and delegates all data
 * fetching and option-building to the calling page so the template stays dumb.
 *
 * Approved template count stays at two — do not add a third without flagging.
 */
export interface StepperWorkspaceProps {
  tool: Tool;
  phase: WorkspacePhase;
  files: File[];
  onFiles: (files: File[]) => void;
  onReplace: () => void;
  pageCount?: number | null;
  /** Tool-specific Configure panel. */
  configure?: ReactNode;
  onProcess: () => void;
  processDisabled?: boolean;
  onCancel: () => void;
  progress: ProgressInfo;
  result: WorkspaceResult | null;
  error: WorkspaceErrorInfo | null;
  onReset: () => void;
}

export function StepperWorkspace({
  tool,
  phase,
  files,
  onFiles,
  onReplace,
  pageCount,
  configure,
  onProcess,
  processDisabled = false,
  onCancel,
  progress,
  result,
  error,
  onReset,
}: StepperWorkspaceProps) {
  const category = categoryMeta(tool.category);
  const hasFile = files.length > 0;
  const inputSize = files.reduce((sum, file) => sum + file.size, 0);
  const fileName = files.length > 1 ? `${files.length} files` : (files[0]?.name ?? "");

  const step2Label = `Configure ${tool.name.replace(/ (PDF|Document)$/, "")}`;

  const stepStatus = (index: 1 | 2 | 3): StepStatus => {
    if (index === 1) return hasFile ? "complete" : "active";
    if (index === 2) {
      if (phase === "processing" || phase === "complete" || phase === "error")
        return "complete";
      return hasFile ? "active" : "queued";
    }
    return phase === "complete" ? "active" : "queued";
  };

  const showConfigureStep =
    phase === "selected" || phase === "configuring" || phase === "processing";

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <ToolHeader tool={tool} />

      <StepIndicator
        steps={[
          {
            status: stepStatus(1),
            eyebrow: hasFile ? "Step 1: Completed" : "Step 1: Upload",
            label: hasFile ? fileName : tool.inputLabel,
          },
          {
            status: stepStatus(2),
            eyebrow:
              stepStatus(2) === "complete"
                ? "Step 2: Completed"
                : stepStatus(2) === "active"
                  ? "Step 2: Active"
                  : "Step 2: Queued",
            label: step2Label,
          },
          {
            status: stepStatus(3),
            eyebrow: stepStatus(3) === "active" ? "Step 3: Active" : "Step 3: Queued",
            label: "Download & Export",
          },
        ]}
      />

      {phase === "error" && error ? (
        <ErrorPanel error={error} onReset={onReset} />
      ) : phase === "complete" && result ? (
        <ResultPanel result={result} inputSize={inputSize} onReset={onReset} />
      ) : phase === "processing" ? (
        <>
          <FileStrip files={files} pageCount={pageCount} onReplace={onReplace} disabled />
          <ProcessingPanel
            progress={progress}
            onCancel={onCancel}
            fileName={fileName}
            inputSize={inputSize}
          />
        </>
      ) : !hasFile ? (
        <UploadDropzone
          onFiles={onFiles}
          accept={tool.accept}
          multiple={tool.acceptMultiple}
          accent={category.accent}
          inputLabel={tool.inputLabel}
        />
      ) : (
        <>
          <FileStrip files={files} pageCount={pageCount} onReplace={onReplace} />

          <div className="flex w-full flex-col gap-space-xl rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 sm:p-margin">
            <div
              data-testid="workspace-configure"
              className="flex flex-col gap-space-lg"
            >
              {configure ?? (
                <p className="text-body-sm text-muted-foreground">
                  No options — this tool runs with its defaults.
                </p>
              )}
            </div>
          </div>

          {tool.status === "pending" && (
            <div
              data-testid="pending-badge"
              className="flex items-start gap-space-sm rounded-xl border border-warning/40 bg-warning-subtle p-space-md"
            >
              <uiIcons.info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />
              <div>
                <p className="text-label-md text-foreground">
                  This tool is not connected to a backend yet
                </p>
                <p className="mt-space-xs text-body-sm text-muted-foreground">
                  The workspace and its options are complete, but there is no
                  endpoint to process the file. Processing is disabled until the
                  backend route ships.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-space-sm sm:flex-row sm:justify-end">
            <button
              type="button"
              data-testid="button-back"
              onClick={onReplace}
              className={SECONDARY_BUTTON}
            >
              Back
            </button>
            <button
              type="button"
              data-testid="button-process"
              disabled={processDisabled || tool.status === "pending"}
              onClick={onProcess}
              className={cn(PRIMARY_CTA, "w-full sm:w-auto")}
            >
              <uiIcons.arrowRight className="h-4 w-4" />
              {tool.status === "pending" ? "Unavailable" : `Process ${tool.outputLabel}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
