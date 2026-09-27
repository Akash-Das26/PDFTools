import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";

/**
 * Crop — Configure panel for `POST /pdf/crop`.
 *
 * Mirrors `CropPdfOptions` in @workspace/api-zod: four margins in either
 * percent of the page (the endpoint's default) or points, plus an optional
 * page selection. This is the page-picker panel the Open Items list has been
 * carrying since the rebuild: the picker grid supplies the page scope, so the
 * panel's job is the margins and the unit, stated against the live selection.
 *
 * The endpoint refuses margins that would leave less than 10 pt of page, and
 * it composes from the current crop box — cropping twice shrinks twice. Both
 * facts are hinted rather than hidden.
 */
export function CropOptions({ options, onChange, pagePlan }: ToolOptionsProps) {
  const unit = options.unit === "pt" ? "pt" : "percent";
  const margin = (key: "top" | "right" | "bottom" | "left") =>
    typeof options[key] === "number" && Number.isFinite(options[key])
      ? String(options[key])
      : typeof options[key] === "string" && options[key] !== ""
        ? options[key]
        : "";

  const removed = pagePlan?.removed ?? [];
  const selected = (pagePlan?.selected ?? []).filter((page) => !removed.includes(page));
  const kept = (pagePlan?.order ?? []).filter((page) => !removed.includes(page));
  const scoped = selected.length > 0 ? selected : kept;

  const fields = [
    { key: "top", label: "Top", testid: "crop-top" },
    { key: "right", label: "Right", testid: "crop-right" },
    { key: "bottom", label: "Bottom", testid: "crop-bottom" },
    { key: "left", label: "Left", testid: "crop-left" },
  ] as const;

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Unit">
        <OptionRadioGroup
          name="unit"
          value={unit}
          columns={2}
          onChange={(value) => onChange({ unit: value })}
          options={[
            {
              value: "percent",
              label: "Percent",
              description: "Share of the page's width or height.",
            },
            {
              value: "pt",
              label: "Points",
              description: "Absolute PDF units (72 per inch).",
            },
          ]}
        />
      </OptionField>

      <OptionField
        label="Margins to trim"
        hint={unit === "percent" ? "Percent of the page" : "Points from each edge"}
      >
        <div className="grid grid-cols-2 gap-space-md">
          {fields.map((field) => (
            <OptionField key={field.key} label={field.label} htmlFor={field.testid}>
              <Input
                id={field.testid}
                data-testid={field.testid}
                type="number"
                min={0}
                step={unit === "percent" ? 1 : 2}
                placeholder="0"
                value={margin(field.key)}
                onChange={(event) =>
                  onChange({
                    [field.key]:
                      event.target.value === "" ? undefined : Number(event.target.value),
                  })
                }
              />
            </OptionField>
          ))}
        </div>
      </OptionField>

      <OptionField
        label="Pages"
        htmlFor="crop-pages"
        hint="Pick pages in the grid, or type a range"
      >
        <Input
          id="crop-pages"
          data-testid="crop-pages"
          value={
            typeof options.pages === "string" ? options.pages : selected.join(",")
          }
          placeholder="1,3,5-8 — empty applies to every page"
          onChange={(event) => onChange({ pages: event.target.value })}
          className="max-w-xs"
        />
        <p data-testid="crop-scope" className="text-body-sm text-muted-foreground">
          {selected.length > 0
            ? `Applies to the ${selected.length} selected page${selected.length === 1 ? "" : "s"} (${selected.join(", ")}).`
            : scoped.length > 0
              ? `Applies to all ${scoped.length} pages — select pages in the grid to narrow it.`
              : "Applies to every page of the document."}
        </p>
      </OptionField>
    </div>
  );
}
