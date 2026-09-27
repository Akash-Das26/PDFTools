import { PdfaExportField } from "@/components/tool-options/pdfa-export";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Word to PDF — Configure panel for `POST /pdf/word-to-pdf`.
 *
 * The endpoint takes the document as `file` plus one option: the PDF/A export
 * level (`WordToPdfOptions`). Layout comes from the headless LibreOffice that
 * performs the conversion, so the panel says that rather than promising
 * pixel-fidelity, and repeats the intake rule the endpoint enforces — the file
 * must really be a .doc/.docx package, not just named like one.
 */
export function WordToPdfOptions({ options, onChange }: ToolOptionsProps) {
  return (
    <div className="flex flex-col gap-space-lg">
      <PdfaExportField options={options} onChange={onChange} />

      <p data-testid="word-to-pdf-note" className="text-body-sm text-muted-foreground">
        The .doc or .docx is converted by a headless LibreOffice on the server,
        which preserves the document&apos;s own layout — there is no page-by-page
        reconstruction. A file that is not a real Word package is rejected before
        conversion, and the server reports honestly when LibreOffice is not
        installed on the host.
      </p>
    </div>
  );
}
