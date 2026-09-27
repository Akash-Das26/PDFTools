import { PdfaExportField } from "@/components/tool-options/pdfa-export";
import { OptionField } from "@/components/tool-options/parts";
import { Switch } from "@/components/ui/switch";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Excel to PDF — Configure panel for `POST /pdf/excel-to-pdf`.
 *
 * `ExcelToPdfOptions` adds `fitToPage` to the shared PDF/A choice. It maps to
 * LibreOffice Calc's `SinglePageSheets` export option, which scales each sheet
 * so its used range lands on a single page — verified against a 200-row sheet
 * (5 pages → 1). The panel describes it as scaling, because that is what it
 * does: nothing is dropped, the sheet is made smaller.
 */
export function ExcelToPdfOptions({ options, onChange }: ToolOptionsProps) {
  const fitToPage = options.fitToPage === undefined ? false : options.fitToPage === true || options.fitToPage === "true";

  return (
    <div className="flex flex-col gap-space-lg">
      <PdfaExportField options={options} onChange={onChange} />

      <OptionField label="Sheet layout" hint="Applies to every sheet in the workbook">
        <label className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md">
          <span>
            <span className="block text-label-md text-foreground">Fit each sheet to one page</span>
            <span className="block text-body-sm text-muted-foreground">
              Scales a sheet down until its used range fits a single page instead of
              spilling across several.
            </span>
          </span>
          <Switch
            checked={fitToPage}
            onCheckedChange={(checked) => onChange({ fitToPage: checked })}
            aria-label="Fit each sheet to one page"
            data-testid="excel-fit-to-page"
          />
        </label>
      </OptionField>

      <p data-testid="excel-to-pdf-note" className="text-body-sm text-muted-foreground">
        The workbook is exported by a headless LibreOffice, so its page setup and
        print ranges apply. Multi-sheet workbooks are exported in full.
      </p>
    </div>
  );
}
