import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * The PDF/A export choice shared by the three Office → PDF panels.
 *
 * `pdfa` is one field on `WordToPdfOptions` / `PptToPdfOptions` /
 * `ExcelToPdfOptions`, and all three default to `off` — the same default the
 * schema carries, so the displayed card is what the request sends. The levels
 * are LibreOffice's own `SelectPdfVersion` values (1/2/3 → PDF/A-1b/2b/3b), and
 * the note is deliberately narrow: the export filter writes the archival marker,
 * but a compliance claim belongs to a validator, not to this panel.
 */
export const PDFA_LEVELS = [
  { value: "off", label: "PDF", description: "Plain PDF 1.7 — opens anywhere." },
  { value: "1b", label: "PDF/A-1b", description: "ISO 19005-1, visual fidelity." },
  { value: "2b", label: "PDF/A-2b", description: "Part 2, visual fidelity." },
  { value: "3b", label: "PDF/A-3b", description: "Part 3, attachments allowed." },
] as const;

export function selectedPdfa(options: Record<string, unknown>): string {
  return typeof options.pdfa === "string" && PDFA_LEVELS.some((level) => level.value === options.pdfa)
    ? options.pdfa
    : "off";
}

export function PdfaExportField({ options, onChange }: ToolOptionsProps) {
  const pdfa = selectedPdfa(options);

  return (
    <OptionField label="Archival format" hint="Plain PDF by default">
      <OptionRadioGroup
        name="pdfa"
        value={pdfa}
        columns={2}
        onChange={(value) => onChange({ pdfa: value })}
        options={PDFA_LEVELS.map((level) => ({ ...level }))}
      />
      <p className="text-body-sm text-muted-foreground">
        The PDF/A levels are written by the conversion engine&apos;s own export
        filter, which adds the archival marker and output intent. Real archival
        use should still be checked with a validator such as veraPDF.
      </p>
    </OptionField>
  );
}
