import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";

/**
 * PDF to Markdown — Configure panel for `POST /pdf/extract-text`.
 *
 * The tool and the endpoint do not default to the same thing: `format` is
 * `txt` on the server, while this tool promises Markdown. The panel therefore
 * sends `md` explicitly, so the downloaded file is really a `.md` rather than
 * a text file with a Markdown name (the tool shipped without a panel before,
 * which meant it silently produced plain text).
 *
 * `pdf-to-markdown` is a **partial** tool by its own catalog status: headings
 * and lists are inferred heuristically and tables are not converted, which the
 * note below states. A PDF without a text layer (a scan) has nothing to
 * extract and comes back as a 422 with the endpoint's own message.
 */
export function PdfToMarkdownOptions({ options, onChange }: ToolOptionsProps) {
  const format = options.format === "txt" ? "txt" : "md";
  const pages = typeof options.pages === "string" ? options.pages : "";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Output format">
        <OptionRadioGroup
          name="markdownFormat"
          value={format}
          columns={2}
          onChange={(value) => onChange({ format: value })}
          options={[
            {
              value: "md",
              label: "Markdown",
              description: "Headings and lists inferred from the text.",
            },
            {
              value: "txt",
              label: "Plain text",
              description: "The raw text layer, unchanged.",
            },
          ]}
        />
      </OptionField>

      <OptionField
        label="Pages"
        htmlFor="pdf-to-markdown-pages"
        hint="Empty exports every page"
      >
        <Input
          id="pdf-to-markdown-pages"
          data-testid="pdf-to-markdown-pages"
          value={pages}
          placeholder="1,3,5-8"
          onChange={(event) => onChange({ pages: event.target.value })}
          className="max-w-xs"
        />
      </OptionField>

      <p data-testid="pdf-to-markdown-note" className="text-body-sm text-muted-foreground">
        Partial support: headings and lists are inferred, tables are not
        converted. Scanned PDFs have no text layer to export.
      </p>
    </div>
  );
}
