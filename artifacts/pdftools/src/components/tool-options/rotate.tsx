import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Rotate PDF.
 *
 * `POST /pdf/rotate` applies ONE angle (`rotation`: 90 | 180 | 270) to the
 * uploaded documents, optionally narrowed by `pages` — it has no per-page
 * rotation field, so the picker's per-page rotate arrows are a preview only.
 * This panel therefore sets the angle that is actually sent, with the scoping
 * (all pages vs the current selection) stated explicitly below the control.
 */
export function RotateOptions({ options, onChange, pagePlan }: ToolOptionsProps) {
  const rotation =
    options.rotation === 180 || options.rotation === 270
      ? options.rotation
      : 90;

  const removed = pagePlan?.removed ?? [];
  const selected = (pagePlan?.selected ?? []).filter(
    (page) => !removed.includes(page),
  );
  const kept = (pagePlan?.order ?? []).filter(
    (page) => !removed.includes(page),
  );
  const scoped = selected.length > 0 ? selected : kept;

  return (
    <OptionField label="Rotation">
      <OptionRadioGroup
        name="rotation"
        value={String(rotation)}
        columns={3}
        onChange={(value) => onChange({ rotation: Number(value) })}
        options={[
          {
            value: "90",
            label: "90° clockwise",
            description: "Quarter turn to the right.",
          },
          {
            value: "180",
            label: "180°",
            description: "Half turn — upside down.",
          },
          {
            value: "270",
            label: "270° clockwise",
            description: "Quarter turn to the left (90° anticlockwise).",
          },
        ]}
      />
      <p
        data-testid="rotate-scope"
        className="text-body-sm text-muted-foreground"
      >
        {selected.length > 0
          ? `Applies to the ${selected.length} selected page${selected.length === 1 ? "" : "s"} (${selected.join(", ")}).`
          : scoped.length > 0
            ? `Applies to all ${scoped.length} pages — select pages in the grid to narrow it.`
            : "Applies to every page of the document."}
      </p>
    </OptionField>
  );
}
