import { forwardRef } from "react";
import { Check, GripVertical, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { PageInfoPage } from "@/lib/process-tool";
import { cn } from "@/lib/utils";

/**
 * One page in the picker grid.
 *
 * Matches the reference card: `rounded-xl surface card`, checkbox top-left,
 * drag handle top-right, a `1 / 1.414` miniature, a hover overlay of
 * micro-actions, and — when selected — a 2px ring in the primary red
 * (`ring-2 ring-primary-container`).
 *
 * Note on a reference/DESIGN.md conflict: DESIGN.md puts the selection checkbox
 * top-right; the actual page-picker screens put it top-left with the drag
 * handle top-right. The screens win, and the divergence is flagged.
 *
 * A11y: the Radix checkbox is the single keyboard control for selection (Space
 * toggles), arrow keys move between pages, and every micro-action is a real
 * button with an accessible name. Reorder is available by drag *and* by
 * Alt+Arrow so it is not pointer-only.
 */
export interface PageThumbnailProps {
  page: PageInfoPage;
  /** Position in the current order, 1-based. */
  position: number;
  selected: boolean;
  rotation: number;
  onToggle: () => void;
  onRotate: (degrees: number) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDropOn: () => void;
  onNavigate: (offset: -1 | 1) => void;
  onKeySelect: () => void;
}

export const PageThumbnail = forwardRef<HTMLButtonElement, PageThumbnailProps>(
  function PageThumbnail(
    {
      page,
      position,
      selected,
      rotation,
      onToggle,
      onRotate,
      onDelete,
      onMove,
      onDragStart,
      onDropOn,
      onNavigate,
      onKeySelect,
    },
    ref,
  ) {
    return (
      <div
        data-testid={`page-card-${page.number}`}
        data-selected={selected}
        draggable
        onDragStart={onDragStart}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDropOn();
        }}
        className={cn(
          "group relative flex cursor-pointer flex-col rounded-xl bg-surface-container-lowest p-space-sm shadow-level-2 transition-all duration-150 hover:shadow-level-3",
          selected && "ring-2 ring-primary-container",
        )}
      >
        <div className="mb-space-xs flex w-full items-center justify-between">
          <button
            ref={ref}
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={`Page ${page.number}${selected ? ", selected" : ""}`}
            data-testid={`page-checkbox-${page.number}`}
            onClick={onToggle}
            onKeyDown={(event) => {
              // Alt+Arrow must be tested BEFORE the plain-arrow branches: a
              // combined keydown also matches `key === "ArrowLeft"`, so testing
              // the plain branch first made Alt+Arrow reorder unreachable —
              // keyboard users could move focus but never reorder pages.
              if (event.altKey && event.key === "ArrowLeft") {
                event.preventDefault();
                onMove(-1);
              } else if (event.altKey && event.key === "ArrowRight") {
                event.preventDefault();
                onMove(1);
              } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                onNavigate(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                onNavigate(-1);
              } else if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                onKeySelect();
              }
            }}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded shadow-level-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected
                ? "bg-primary-container text-on-primary-container"
                : "border border-border-strong bg-background",
            )}
          >
            {selected && <Check className="h-[15px] w-[15px]" />}
          </button>

          <button
            type="button"
            aria-label={`Reorder page ${page.number}`}
            data-testid={`page-drag-${page.number}`}
            className="flex items-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <GripVertical className="h-[18px] w-[18px] cursor-grab" />
          </button>
        </div>

        <div className="relative flex aspect-[1/1.414] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
          {page.thumbnail ? (
            <img
              src={page.thumbnail}
              alt={`Page ${page.number}`}
              loading="lazy"
              className="h-full w-full object-contain transition-transform duration-150"
              style={{ transform: `rotate(${(page.rotation + rotation) % 360}deg)` }}
            />
          ) : (
            <span className="text-code-sm text-muted-foreground">
              Page {page.number}
            </span>
          )}

          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-foreground/40 p-2 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              title="Rotate counter-clockwise"
              aria-label={`Rotate page ${page.number} counter-clockwise`}
              data-testid={`page-rotate-ccw-${page.number}`}
              onClick={() => onRotate(-90)}
              className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-lowest text-foreground shadow-level-3 transition-colors hover:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Rotate clockwise"
              aria-label={`Rotate page ${page.number} clockwise`}
              data-testid={`page-rotate-cw-${page.number}`}
              onClick={() => onRotate(90)}
              className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-lowest text-foreground shadow-level-3 transition-colors hover:text-primary"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Remove page"
              aria-label={`Remove page ${page.number}`}
              data-testid={`page-delete-${page.number}`}
              onClick={onDelete}
              className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-lowest text-foreground shadow-level-3 transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-space-xs flex items-center justify-between">
          <span
            data-testid={`page-label-${page.number}`}
            className="text-label-sm text-muted-foreground"
          >
            Page {page.number}
          </span>
          {rotation !== 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-code-sm text-primary">
              {((rotation % 360) + 360) % 360}°
            </span>
          )}
        </div>
      </div>
    );
  },
);
