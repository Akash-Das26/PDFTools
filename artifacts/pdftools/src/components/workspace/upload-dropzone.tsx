import { useRef, useState } from "react";
import { UploadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";

interface UploadDropzoneProps {
  accept: string[];
  /** 1 file for most tools; higher for multi-file tools. */
  maxFiles?: number;
  onFiles: (files: File[]) => void;
  /** Files currently staged (for the selected state). */
  files?: File[];
  onRemove?: (index: number) => void;
  disabled?: boolean;
  label?: string;
}

/**
 * Upload dropzone (Step 1). Dashed 2px border that goes solid primary on
 * drag-over with a faint brand tint; includes the "Browse files" fallback
 * button (keyboard accessible, per design spec §6) and a staged-file strip
 * with size metadata once files are chosen.
 */
export function UploadDropzone({ accept, maxFiles = 1, onFiles, files = [], onRemove, disabled = false, label }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = Array.from(event.dataTransfer.files ?? []);
    if (dropped.length > 0) onFiles(dropped.slice(0, maxFiles));
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && openPicker()}
        data-testid="upload-dropzone"
        className={cn(
          "rounded-xl border-2 border-dashed border-border bg-card p-8 md:p-10 text-center cursor-pointer transition-all",
          "hover:border-foreground/30",
          dragging && "border-solid border-primary bg-primary/5 dark:bg-primary/5",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        <div className={cn("w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-4 transition-all", dragging ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="font-semibold text-foreground">{label ?? "Drop any document here"}</div>
        <p className="mt-1 text-sm text-muted-foreground">or</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            openPicker();
          }}
          className="mt-3 inline-flex h-10 px-5 items-center rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 active:scale-[0.98] transition-all"
          data-testid="button-browse-files"
        >
          Browse files
        </button>
        <p className="mt-3 text-xs text-muted-foreground">Up to 50MB each{maxFiles > 1 ? ` · up to ${maxFiles} files` : ""}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(",")}
          multiple={maxFiles > 1}
          className="hidden"
          data-testid="input-file"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length > 0) onFiles(selected.slice(0, maxFiles));
            event.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              data-testid={`file-item-${index}`}
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="text-xs font-medium text-destructive hover:underline shrink-0"
                  data-testid={`button-remove-file-${index}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
