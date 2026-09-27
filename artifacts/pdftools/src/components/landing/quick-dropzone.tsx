import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { handOffFiles, suggestToolId } from "@/lib/file-handoff";
import { useToolCatalog } from "@/lib/tool-catalog";
import { uiIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Hero quick-dropzone — the reference's "drop any document here to
 * auto-detect tools" launcher.
 *
 * The reference promises content analysis ("auto-suggests compression,
 * conversion, or redaction"). Nothing in this app inspects document contents,
 * so the copy states what actually happens: the file *type* picks the tool, and
 * the file arrives already selected. No invented capability.
 */
export function QuickDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { tools } = useToolCatalog();
  const [, navigate] = useLocation();

  const route = (files: File[]) => {
    if (files.length === 0) return;
    const toolId = suggestToolId(files, tools);
    if (!toolId) {
      // No tool accepts this type — send them to the grid to choose by hand.
      document.getElementById("tools-container")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    handOffFiles(files);
    navigate(`/tools/${toolId}`);
  };

  return (
    <div
      data-testid="quick-dropzone"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        route(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        "group mt-space-xl flex w-full max-w-3xl cursor-pointer flex-col items-center justify-between gap-space-md rounded-xl bg-surface p-space-lg text-left shadow-level-2 transition-all duration-200 hover:shadow-level-3 sm:flex-row",
        dragging && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center gap-space-md">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:scale-105 group-hover:bg-primary group-hover:text-on-primary">
          <uiIcons.uploadCloud className="h-6 w-6" />
        </div>
        <div>
          <div className="text-headline-sm text-foreground transition-colors group-hover:text-primary">
            Drop a document here to jump to the right tool
          </div>
          <div className="text-body-sm text-muted-foreground">
            PDFs open in Compress, images in JPG/PNG to PDF, and Office files in
            their matching converter
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end self-stretch sm:self-auto">
        <button
          type="button"
          data-testid="quick-dropzone-select"
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-surface-container px-space-md py-space-xs text-label-md text-foreground transition-all group-hover:bg-primary group-hover:text-on-primary"
        >
          Select File
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        data-testid="quick-dropzone-input"
        onChange={(event) => route(Array.from(event.target.files ?? []))}
      />
    </div>
  );
}
