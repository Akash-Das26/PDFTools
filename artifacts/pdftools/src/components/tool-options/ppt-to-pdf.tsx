import { PdfaExportField } from "@/components/tool-options/pdfa-export";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * PowerPoint to PDF — Configure panel for `POST /pdf/ppt-to-pdf`.
 *
 * Same shape as the Word panel (`PptToPdfOptions` is `pdfa` only): slides are
 * exported one page per slide by the conversion engine, so there is no slide
 * range or handout layout to configure today, and the panel does not pretend
 * otherwise.
 */
export function PptToPdfOptions({ options, onChange }: ToolOptionsProps) {
  return (
    <div className="flex flex-col gap-space-lg">
      <PdfaExportField options={options} onChange={onChange} />

      <p data-testid="ppt-to-pdf-note" className="text-body-sm text-muted-foreground">
        Each slide becomes one PDF page, laid out by the headless LibreOffice on
        the server. Slide ranges and handout layouts are not configurable yet —
        the endpoint exports the whole deck.
      </p>
    </div>
  );
}
