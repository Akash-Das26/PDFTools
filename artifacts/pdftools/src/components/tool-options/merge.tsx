import type { ToolOptionsProps } from "@/components/tool-options/types";
import { FileOrderList } from "@/components/tool-options/file-order";
import { OptionField } from "@/components/tool-options/parts";

/**
 * Merge PDF.
 *
 * `POST /pdf/merge` appends documents in upload order and requires at least
 * two files, so this panel's job is to make that order visible and editable:
 * one row per selected document with move up / move down / remove controls
 * (the shared `FileOrderList`, also used by JPG/PNG to PDF). The file list
 * itself lives in the tool page's `files` state — the panel edits it through
 * `onFilesChange` rather than keeping a copy.
 */
export function MergeOptions({ files = [], onFilesChange }: ToolOptionsProps) {
  return (
    <OptionField
      label="Merge order"
      hint="Documents are appended top to bottom"
    >
      <FileOrderList
        files={files}
        onFilesChange={onFilesChange}
        rowTestId="merge-row"
        hint={
          files.length < 2 ? (
            <p
              data-testid="merge-needs-two"
              className="text-body-sm text-muted-foreground"
            >
              {files.length === 0
                ? "Select at least two PDFs to merge."
                : "Add at least one more PDF — merging needs two or more documents."}
            </p>
          ) : null
        }
      />
    </OptionField>
  );
}
