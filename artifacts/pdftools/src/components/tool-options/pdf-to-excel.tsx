import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import { Input } from "@/components/ui/input";

/**
 * PDF to Excel — Configure panel for `POST /pdf/pdf-to-excel`.
 *
 * The only real choices are which pages to read and what separates the cells.
 * The note carries the tool's one hard limit — the detector reads *ruled*
 * tables, so a borderless column layout is not something it can see — because
 * that is the difference between "this tool cannot help" and "this tool is
 * broken", and the user deserves to know which one they are looking at.
 */
export function PdfToExcelOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const delimiter = [",", ";", "tab"].includes(options.delimiter as string)
    ? (options.delimiter as string)
    : ",";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Pages" hint="Empty means every page">
        <Input
          value={typeof options.pages === "string" ? options.pages : ""}
          placeholder="e.g. 1-3, 7"
          data-testid="excel-pages"
          onChange={(event) => onChange({ pages: event.target.value })}
          className="max-w-[12rem]"
        />
      </OptionField>

      <OptionField label="Cell separator" hint="What Excel opens by default">
        <OptionRadioGroup
          name="delimiter"
          value={delimiter}
          columns={3}
          onChange={(value) => onChange({ delimiter: value })}
          options={[
            { value: ",", label: "Comma", description: "Standard CSV." },
            { value: ";", label: "Semicolon", description: "European Excel locale." },
            { value: "tab", label: "Tab", description: "Pastes into sheets cleanly." },
          ]}
        />
      </OptionField>

      <p data-testid="pdf-to-excel-note" className="text-body-sm text-muted-foreground">
        Tables are found by their ruled lines, so a grid drawn with borders is
        extracted cell by cell while a layout of plain text columns without
        rules is refused rather than guessed at. Rows are read between the
        rules, so a header sitting on the outer line can land outside the grid
        — check the first rows of the result. One table downloads as a
        <code className="text-code-sm"> .csv</code>; several come back as a ZIP
        with one file per page.
      </p>
    </div>
  );
}
