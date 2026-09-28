import { PdfaExportField } from "@/components/tool-options/pdfa-export";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * HTML to PDF — Configure panel for `POST /pdf/html-to-pdf`.
 *
 * One option (`HtmlToPdfOptions.pdfa`), so the panel is the shared PDF/A field
 * plus the one thing a user cannot guess from the outside: what the conversion
 * engine does with a web page. LibreOffice's HTML import renders the markup in
 * the uploaded file and nothing else — it runs no JavaScript, follows no
 * external references, and cannot fetch a URL. The panel says that rather than
 * letting the card's "save a web page" wording imply otherwise.
 */
export function HtmlToPdfOptions({ options, onChange }: ToolOptionsProps) {
  return (
    <div className="flex flex-col gap-space-lg">
      <PdfaExportField options={options} onChange={onChange} />

      <p data-testid="html-to-pdf-note" className="text-body-sm text-muted-foreground">
        Only the markup inside the uploaded .html file is rendered — by the same
        headless LibreOffice as the Office tools. JavaScript is not executed,
        images and stylesheets the page links to are not fetched, and a URL cannot
        be converted, so for a faithful capture save the page first (the browser
        saves its assets alongside it) and check the result.
      </p>
    </div>
  );
}
