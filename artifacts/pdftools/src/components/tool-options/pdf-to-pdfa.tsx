import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * PDF to PDF/A — Configure panel for `POST /pdf/pdf-to-pdfa`.
 *
 * `PdfToPdfAOptions` carries exactly one field: the conformance level, one of
 * PDF/A-1b, 2b, 2u, 3b, 3u (the endpoint defaults to 3b). The service adds the
 * structural pieces the standard requires — a trailer `/ID`, an sRGB
 * `OutputIntent`, a conformance-level XMP packet — and its own docblock is
 * explicit that this is structural: fonts must already be embedded, there can
 * be no encryption, JavaScript or external references, and a real archival
 * claim needs a validator. The panel repeats that rather than implying the
 * output is automatically compliant.
 */
const LEVELS = [
  { value: "1B", label: "PDF/A-1b", description: "ISO 19005-1, visual fidelity." },
  { value: "2B", label: "PDF/A-2b", description: "Part 2, visual fidelity." },
  { value: "2U", label: "PDF/A-2u", description: "Part 2, Unicode text mapping." },
  { value: "3B", label: "PDF/A-3b", description: "Part 3, attachments allowed." },
  { value: "3U", label: "PDF/A-3u", description: "Part 3, Unicode text mapping." },
] as const;

export function PdfToPdfaOptions({ options, onChange }: ToolOptionsProps) {
  const conformance =
    typeof options.conformance === "string" &&
    LEVELS.some((level) => level.value === options.conformance)
      ? options.conformance
      : "3B";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Conformance level" hint="3b is the endpoint default">
        <OptionRadioGroup
          name="conformance"
          value={conformance}
          columns={3}
          onChange={(value) => onChange({ conformance: value })}
          options={LEVELS.map((level) => ({ ...level }))}
        />
      </OptionField>

      <p data-testid="pdf-to-pdfa-note" className="text-body-sm text-muted-foreground">
        Adds the structural PDF/A pieces (trailer ID, sRGB output intent, XMP
        packet). Encryption is not allowed by the standard, so an encrypted
        source must be unlocked first; for archival use, validate the result with
        a checker such as veraPDF.
      </p>
    </div>
  );
}
