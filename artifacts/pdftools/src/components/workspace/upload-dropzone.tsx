import { useRef, useState } from "react";
import type { ToolAccent } from "@workspace/api-client-react";
import { ACCENT_TILE } from "@/lib/tool-categories";
import { COMPACT_CTA } from "@/lib/ui";
import { uiIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Step 1 — upload dropzone.
 *
 * Per DESIGN.md: a 2px dashed border in `border-strong`, `rounded-xl`, and on
 * drag-over the border goes solid `primary` against a faint brand tint. A
 * keyboard-accessible "Browse files" button is mandatory (accessibility
 * section), so the hidden input always has a labelled trigger.
 *
 * The limits line states the real server limits (50 MB per file, 20 files),
 * which come from `artifacts/api-server/src/lib/upload.ts`.
 */
export function UploadDropzone({
  onFiles,
  accept,
  multiple = false,
  accent = "primary",
  inputLabel,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  accept?: string[];
  multiple?: boolean;
  accent?: ToolAccent;
  inputLabel: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptAttr = accept?.join(",");

  return (
    <div
      data-testid="upload-dropzone"
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        onFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-space-md rounded-xl border-2 border-dashed border-border-strong px-space-lg py-margin-lg text-center transition-colors",
        dragging && "border-solid border-primary bg-primary/5",
        disabled && "opacity-60",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          ACCENT_TILE[accent],
        )}
      >
        <uiIcons.uploadCloud className="h-6 w-6" />
      </div>

      <div className="flex flex-col gap-space-xs">
        <p className="text-headline-sm text-foreground">{inputLabel}</p>
        <p className="text-body-sm text-muted-foreground">
          Drag and drop {multiple ? "files" : "a file"} here, or browse from your
          device
        </p>
      </div>

      <button
        type="button"
        data-testid="button-browse-files"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={COMPACT_CTA}
      >
        Choose {multiple ? "files" : "file"}
      </button>

      <p className="text-label-sm text-muted-foreground">
        Up to 50 MB each
        {multiple ? ", 20 files per job" : ""}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={multiple}
        disabled={disabled}
        data-testid="input-file"
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </div>
  );
}
