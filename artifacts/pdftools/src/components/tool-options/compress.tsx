import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Compress PDF.
 *
 * The endpoint (`POST /pdf/compress`) accepts exactly one option, `quality`,
 * with three values — `extreme` / `recommended` / `high` — so this panel is
 * those three presets and nothing more. Order matters: the reference presents
 * the balanced middle option as the default.
 *
 * The presets are Ghostscript's own `/screen`, `/ebook` and `/printer` PDF
 * settings, which is why the descriptions name an image resolution: that is
 * what actually differs between them. The note states the two guarantees the
 * endpoint keeps, because both are things a user would otherwise have to
 * discover by inspecting the result: the file never comes back larger, and a
 * host without Ghostscript re-serialises instead of pretending.
 */
export function CompressOptions({ options, onChange }: ToolOptionsProps) {
  const quality = typeof options.quality === "string" ? options.quality : "recommended";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField
        label="Compression profile"
        hint="Ghostscript presets — image resolution is what changes"
      >
        <OptionRadioGroup
          name="quality"
          value={quality}
          onChange={(value) => onChange({ quality: value })}
          options={[
            {
              value: "extreme",
              label: "Extreme",
              description: "Smallest file: images downsampled to 72 dpi.",
            },
            {
              value: "recommended",
              label: "Recommended",
              description: "Balanced: images downsampled to 150 dpi.",
            },
            {
              value: "high",
              label: "Less compression",
              description: "Highest quality: images kept up to 300 dpi.",
            },
          ]}
        />
      </OptionField>

      <p data-testid="compress-note" className="text-body-sm text-muted-foreground">
        Nothing is dropped: text stays vector and selectable, pages keep their
        size and count. If the selected profile would make the file larger than a
        plain re-save — which happens to text-heavy documents at the 300 dpi
        setting — the smaller result is returned instead. Compression needs
        Ghostscript on the server; where it is unavailable the file is
        re-serialised and the profile is not applied.
      </p>
    </div>
  );
}
