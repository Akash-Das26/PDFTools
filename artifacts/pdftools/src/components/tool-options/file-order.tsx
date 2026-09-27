import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { uiIcons } from "@/lib/icons";

/**
 * One row per selected file, with move-up / move-down / remove controls.
 *
 * Multi-file tools post their uploads in array order, so this list *is* the
 * output order — Merge PDF appends documents in it and JPG/PNG to PDF turns
 * each image into the next page. The file list lives in the tool page's `files`
 * state; this component edits it through `onFilesChange` rather than keeping a
 * copy, so the stepper's file strip and the request always agree.
 *
 * Extracted from the Merge panel (Batch 1) in Batch 5 so both multi-file panels
 * share one implementation; the row and button test ids are unchanged for
 * Merge, which the Batch 1 suite pins.
 */
export function FileOrderList({
  files,
  onFilesChange,
  rowTestId,
  icon: Icon = uiIcons.fileText,
  hint,
}: {
  files: File[];
  onFilesChange?: (files: File[]) => void;
  rowTestId: string;
  icon?: LucideIcon;
  hint?: ReactNode;
}) {
  const move = (index: number, direction: -1 | 1) => {
    if (!onFilesChange) return;
    const to = index + direction;
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item!);
    onFilesChange(next);
  };

  return (
    <div className="flex flex-col gap-space-sm">
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          data-testid={`${rowTestId}-${index}`}
          className="flex items-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm"
        >
          <span className="w-6 shrink-0 text-code-sm text-muted-foreground">
            {index + 1}
          </span>
          <Icon className="h-[18px] w-[18px] shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-body-sm text-foreground">
            {file.name}
          </span>
          <button
            type="button"
            data-testid={`button-file-up-${index}`}
            aria-label={`Move ${file.name} up`}
            disabled={index === 0}
            onClick={() => move(index, -1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <uiIcons.arrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid={`button-file-down-${index}`}
            aria-label={`Move ${file.name} down`}
            disabled={index === files.length - 1}
            onClick={() => move(index, 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-container hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <uiIcons.arrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            data-testid={`button-file-remove-${index}`}
            aria-label={`Remove ${file.name}`}
            onClick={() => onFilesChange?.(files.filter((_, at) => at !== index))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <uiIcons.x className="h-4 w-4" />
          </button>
        </div>
      ))}
      {hint}
    </div>
  );
}
