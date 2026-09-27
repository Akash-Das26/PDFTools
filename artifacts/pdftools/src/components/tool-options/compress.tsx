import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Compress PDF.
 *
 * The endpoint (`POST /pdf/compress`) accepts exactly one option, `quality`,
 * with three values — `extreme` / `recommended` / `high` — so this panel is
 * those three presets and nothing more. Order matters: the reference presents
 * the balanced middle option as the default.
 */
export function CompressOptions({ options, onChange }: ToolOptionsProps) {
  const quality = typeof options.quality === "string" ? options.quality : "recommended";

  return (
    <OptionField
      label="Compression profile"
      hint="Presets tune sampling, dpi and font subsets"
    >
      <OptionRadioGroup
        name="quality"
        value={quality}
        onChange={(value) => onChange({ quality: value })}
        options={[
          {
            value: "extreme",
            label: "Extreme",
            description: "Smallest file, visibly lower image quality.",
          },
          {
            value: "recommended",
            label: "Recommended",
            description: "Good balance of size and quality.",
          },
          {
            value: "high",
            label: "Less compression",
            description: "Highest quality, smaller savings.",
          },
        ]}
      />
    </OptionField>
  );
}
