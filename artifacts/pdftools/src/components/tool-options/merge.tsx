import type { ToolOptionsProps } from "@/components/tool-options/types";
import { OptionField } from "@/components/tool-options/parts";
import { uiIcons } from "@/lib/icons";

/**
 * Merge PDF.
 *
 * `POST /pdf/merge` appends documents in upload order and requires at least
 * two files, so this panel's job is to make that order visible and editable:
 * one row per selected document with move up / move down / remove controls.
 * The file list itself lives in the tool page's `files` state — the panel
 * edits it through `onFilesChange` rather than keeping a copy.
 */
export function MergeOptions({
  files = [],
  onFilesChange,
}: ToolOptionsProps) {
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
    <OptionField
      label="Merge order"
      hint="Documents are appended top to bottom"
    >
      <div className="flex flex-col gap-space-sm">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            data-testid={`merge-row-${index}`}
            className="flex items-center gap-space-sm rounded-lg bg-surface-container-low px-space-md py-space-sm"
          >
            <span className="w-6 shrink-0 text-code-sm text-muted-foreground">
              {index + 1}
            </span>
            <uiIcons.fileText className="h-[18px] w-[18px] shrink-0 text-primary" />
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
              onClick={() =>
                onFilesChange?.(files.filter((_, at) => at !== index))
              }
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <uiIcons.x className="h-4 w-4" />
            </button>
          </div>
        ))}
        {files.length < 2 && (
          <p
            data-testid="merge-needs-two"
            className="text-body-sm text-muted-foreground"
          >
            {files.length === 0
              ? "Select at least two PDFs to merge."
              : "Add at least one more PDF — merging needs two or more documents."}
          </p>
        )}
      </div>
    </OptionField>
  );
}
