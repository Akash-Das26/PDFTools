import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Tool } from "@workspace/api-client-react";
import { ToolHeader } from "@/components/workspace/tool-header";
import { StepIndicator, type StepStatus } from "@/components/workspace/step-indicator";
import { UploadDropzone } from "@/components/workspace/upload-dropzone";
import { PageThumbnail } from "@/components/workspace/page-thumbnail";
import {
  ErrorPanel,
  ProcessingPanel,
  ResultPanel,
} from "@/components/workspace/states";
import type { PageInfoPage } from "@/lib/process-tool";
import { categoryMeta } from "@/lib/tool-categories";
import { PRIMARY_CTA, SECONDARY_BUTTON } from "@/lib/ui";
import { uiIcons } from "@/lib/icons";
import type {
  ProgressInfo,
  WorkspaceErrorInfo,
  WorkspacePhase,
  WorkspaceResult,
} from "@/lib/workspace";
import { cn } from "@/lib/utils";

/**
 * Template 2 of 2 — the page-picker workspace.
 *
 * Same three steps and the same shared panels as the stepper template, but step
 * 2 becomes a thumbnail grid: 6 columns desktop down to 2 on mobile (per the
 * reference), selectable, rotatable, deletable and reorderable.
 *
 * Used only by the five tools whose job is to act on individual pages:
 * remove-pages, extract-pages, reorder-pages, rotate and crop — matching the
 * reference, where Crop sits in Edit PDF but still needs the page canvas.
 *
 * The template owns the page plan (order, selection, per-page rotation) and
 * reports it upward through `onPlanChange`, so the calling page only has to
 * translate the plan into the endpoint's option fields.
 *
 * State note: everything lives in ONE object updated with functional setters.
 * Separate `useState` hooks would let two edits dispatched in the same tick both
 * read the same stale snapshot, so a user clicking two page checkboxes in quick
 * succession would silently lose the first selection.
 */
export interface PagePlan {
  /** Full order, 1-based page numbers, including pages excluded from output. */
  order: number[];
  /** 1-based page numbers currently selected. */
  selected: number[];
  /** 1-based page numbers the user excluded from the output. */
  removed: number[];
  /** Extra rotation per page number, in degrees. */
  rotations: Record<number, number>;
}

export interface PagePickerWorkspaceProps {
  tool: Tool;
  phase: WorkspacePhase;
  files: File[];
  onFiles: (files: File[]) => void;
  onReplace: () => void;
  pages: PageInfoPage[];
  pagesLoading?: boolean;
  onPlanChange: (plan: PagePlan) => void;
  /** Tool-specific options shown beneath the grid (crop margins, etc.). */
  configure?: ReactNode;
  onProcess: () => void;
  processDisabled?: boolean;
  onCancel: () => void;
  progress: ProgressInfo;
  result: WorkspaceResult | null;
  error: WorkspaceErrorInfo | null;
  onReset: () => void;
  /** Label for the third step, e.g. "Download & Export". */
  downloadLabel?: string;
}

interface PickerState {
  order: number[];
  selected: number[];
  removed: number[];
  rotations: Record<number, number>;
}

const EMPTY_STATE: PickerState = {
  order: [],
  selected: [],
  removed: [],
  rotations: {},
};

const DENSITY = {
  S: "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8",
  M: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
  L: "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
} as const;

export function PagePickerWorkspace({
  tool,
  phase,
  files,
  onFiles,
  onReplace,
  pages,
  pagesLoading = false,
  onPlanChange,
  configure,
  onProcess,
  processDisabled = false,
  onCancel,
  progress,
  result,
  error,
  onReset,
  downloadLabel = "Download & Export",
}: PagePickerWorkspaceProps) {
  const category = categoryMeta(tool.category);
  const hasFile = files.length > 0;
  const inputSize = files.reduce((sum, file) => sum + file.size, 0);
  const fileName = files.length > 1 ? `${files.length} files` : (files[0]?.name ?? "");

  const [state, setState] = useState<PickerState>(EMPTY_STATE);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [density, setDensity] = useState<keyof typeof DENSITY>("M");
  const checkboxRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Re-seed whenever a different document's page list arrives.
  const pageKey = pages.map((page) => page.number).join(",");
  useEffect(() => {
    setState({ ...EMPTY_STATE, order: pages.map((page) => page.number) });
  }, [pageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish the plan whenever it changes, so the parent never reads stale data.
  useEffect(() => {
    onPlanChange({
      order: state.order,
      selected: [...state.selected].sort((a, b) => a - b),
      removed: [...state.removed].sort((a, b) => a - b),
      rotations: state.rotations,
    });
  }, [state, onPlanChange]);

  const toggle = useCallback((pageNumber: number) => {
    setState((prev) => ({
      ...prev,
      selected: prev.selected.includes(pageNumber)
        ? prev.selected.filter((page) => page !== pageNumber)
        : [...prev.selected, pageNumber],
    }));
  }, []);

  const bulkSelect = useCallback((mode: "all" | "none" | "odd" | "even" | "invert") => {
    setState((prev) => {
      const visible = prev.order.filter((page) => !prev.removed.includes(page));
      if (mode === "all") return { ...prev, selected: visible };
      if (mode === "none") return { ...prev, selected: [] };
      if (mode === "odd")
        return { ...prev, selected: visible.filter((page) => page % 2 === 1) };
      if (mode === "even")
        return { ...prev, selected: visible.filter((page) => page % 2 === 0) };
      return {
        ...prev,
        selected: visible.filter((page) => !prev.selected.includes(page)),
      };
    });
  }, []);

  const rotate = useCallback((pageNumber: number, degrees: number) => {
    setState((prev) => ({
      ...prev,
      rotations: {
        ...prev.rotations,
        [pageNumber]: (((prev.rotations[pageNumber] ?? 0) + degrees) % 360 + 360) % 360,
      },
    }));
  }, []);

  const rotateAll = useCallback((degrees: number) => {
    setState((prev) => {
      const next = { ...prev.rotations };
      for (const page of prev.order) {
        if (prev.removed.includes(page)) continue;
        next[page] = (((next[page] ?? 0) + degrees) % 360 + 360) % 360;
      }
      return { ...prev, rotations: next };
    });
  }, []);

  const remove = useCallback((pageNumber: number) => {
    setState((prev) => ({
      ...prev,
      removed: prev.removed.includes(pageNumber)
        ? prev.removed.filter((page) => page !== pageNumber)
        : [...prev.removed, pageNumber],
      selected: prev.selected.filter((page) => page !== pageNumber),
    }));
  }, []);

  const move = useCallback((pageNumber: number, direction: -1 | 1) => {
    setState((prev) => {
      const from = prev.order.indexOf(pageNumber);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= prev.order.length) return prev;
      const order = [...prev.order];
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item!);
      return { ...prev, order };
    });
  }, []);

  const dropOn = useCallback(
    (targetPage: number) => {
      setState((prev) => {
        if (dragFrom === null) return prev;
        const from = prev.order.indexOf(dragFrom);
        const to = prev.order.indexOf(targetPage);
        if (from === -1 || to === -1 || from === to) return prev;
        const order = [...prev.order];
        const [item] = order.splice(from, 1);
        order.splice(to, 0, item!);
        return { ...prev, order };
      });
      setDragFrom(null);
    },
    [dragFrom],
  );

  const focusPage = (from: number, offset: -1 | 1) => {
    const target = state.order[from + offset];
    if (target === undefined) return;
    checkboxRefs.current[state.order.indexOf(target)]?.focus();
  };

  const visibleCount = state.order.filter(
    (page) => !state.removed.includes(page),
  ).length;
  const selectedList = useMemo(
    () => [...state.selected].sort((a, b) => a - b),
    [state.selected],
  );

  const step2Active = hasFile && (phase === "selected" || phase === "configuring");

  const stepStatus = (index: 1 | 2 | 3): StepStatus => {
    if (index === 1) return hasFile ? "complete" : "active";
    if (index === 2) {
      if (phase === "processing" || phase === "complete" || phase === "error")
        return "complete";
      return hasFile ? "active" : "queued";
    }
    return phase === "complete" ? "active" : "queued";
  };

  const pageByNumber = useMemo(
    () => new Map(pages.map((page) => [page.number, page])),
    [pages],
  );

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
            eyebrow: step2Active
              ? "Step 2: Active"
              : stepStatus(2) === "complete"
                ? "Step 2: Completed"
                : "Step 2: Queued",
            label: "Select & Curate Pages",
          },
          {
            status: stepStatus(3),
            eyebrow: stepStatus(3) === "active" ? "Step 3: Active" : "Step 3: Queued",
            label: downloadLabel,
          },
        ]}
      />

      {phase === "error" && error ? (
        <ErrorPanel error={error} onReset={onReset} />
      ) : phase === "complete" && result ? (
        <ResultPanel result={result} inputSize={inputSize} onReset={onReset} />
      ) : phase === "processing" ? (
        <ProcessingPanel
          progress={progress}
          onCancel={onCancel}
          fileName={fileName}
          inputSize={inputSize}
        />
      ) : !hasFile ? (
        <UploadDropzone
          onFiles={onFiles}
          accept={tool.accept}
          multiple={tool.acceptMultiple}
          accent={category.accent}
          inputLabel={tool.inputLabel}
          capture={tool.capture}
        />
      ) : pagesLoading ? (
        <div
          data-testid="pages-loading"
          className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2"
        >
          <div className="flex items-center gap-space-sm text-body-sm text-muted-foreground">
            <uiIcons.loader className="h-4 w-4 animate-spin" />
            Rendering page previews...
          </div>
          <div className="grid grid-cols-2 gap-space-md sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[1/1.414] animate-pulse rounded-xl bg-surface-container"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Sticky operational control bar — selection shortcuts + density */}
          <section className="sticky top-16 z-30 w-full bg-surface-container-lowest/95 py-space-sm shadow-level-2 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-space-md">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 hidden text-label-sm text-muted-foreground sm:inline">
                  Select:
                </span>
                {(
                  [
                    ["all", `All (${visibleCount})`],
                    ["none", "None"],
                    ["odd", "Odd"],
                    ["even", "Even"],
                    ["invert", "Invert"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`page-select-${mode}`}
                    onClick={() => bulkSelect(mode)}
                    className="flex items-center gap-1 rounded-lg bg-surface-container px-space-sm py-1 text-label-sm text-foreground transition-colors hover:bg-surface-container-low"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-space-md">
                <div className="hidden items-center gap-space-xs text-code-sm text-muted-foreground lg:flex">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span data-testid="page-visible-count">{visibleCount} pages</span>
                  <span>•</span>
                  <span
                    data-testid="page-selected-summary"
                    className="font-semibold text-primary"
                  >
                    {state.selected.length} selected
                  </span>
                  {selectedList.length > 0 && (
                    <span className="max-w-[180px] truncate text-[11px]">
                      ({selectedList.join(", ")})
                    </span>
                  )}
                </div>

                <div className="flex items-center rounded-lg bg-surface-container p-0.5">
                  {(["S", "M", "L"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      title={
                        size === "S"
                          ? "Dense layout"
                          : size === "M"
                            ? "Standard layout"
                            : "Spacious layout"
                      }
                      aria-label={
                        size === "S"
                          ? "Dense layout"
                          : size === "M"
                            ? "Standard layout"
                            : "Spacious layout"
                      }
                      aria-pressed={density === size}
                      data-testid={`page-density-${size}`}
                      onClick={() => setDensity(size)}
                      className={cn(
                        "rounded px-2 py-1 text-code-sm transition-all",
                        density === size
                          ? "bg-surface-container-lowest font-semibold text-foreground shadow-level-2"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  title="Rotate all 90° clockwise"
                  aria-label="Rotate all pages 90 degrees clockwise"
                  data-testid="page-rotate-all"
                  onClick={() => rotateAll(90)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-foreground transition-colors hover:bg-surface-container-low"
                >
                  <uiIcons.rotateCcw className="h-[18px] w-[18px] rotate-90" />
                </button>
              </div>
            </div>
          </section>

          <div className={cn("grid gap-space-md", DENSITY[density])}>
            {state.order.map((pageNumber, index) => {
              const page = pageByNumber.get(pageNumber);
              if (!page) return null;
              const isRemoved = state.removed.includes(pageNumber);
              return (
                <div key={pageNumber} className={cn(isRemoved && "opacity-40")}>
                  <PageThumbnail
                    ref={(element) => {
                      checkboxRefs.current[index] = element;
                    }}
                    page={page}
                    position={index + 1}
                    selected={state.selected.includes(pageNumber)}
                    rotation={state.rotations[pageNumber] ?? 0}
                    onToggle={() => toggle(pageNumber)}
                    onKeySelect={() => toggle(pageNumber)}
                    onRotate={(degrees) => rotate(pageNumber, degrees)}
                    onDelete={() => remove(pageNumber)}
                    onMove={(direction) => move(pageNumber, direction)}
                    onDragStart={() => setDragFrom(pageNumber)}
                    onDropOn={() => dropOn(pageNumber)}
                    onNavigate={(offset) => focusPage(index, offset)}
                  />
                </div>
              );
            })}
          </div>

          {configure && (
            <div
              data-testid="workspace-configure"
              className="flex w-full flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-level-2 sm:p-margin"
            >
              {configure}
            </div>
          )}

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
                  The page picker is complete, but there is no endpoint to process
                  the file. Processing is disabled until the backend route ships.
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
