import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Rotate PDF.
 *
 * `POST /pdf/rotate` applies the panel's shared angle (`rotation`:
 * 90 | 180 | 270) to the `pages` selection, and the optional `rotations`
 * field overrides it per page with page:degrees pairs — which is what the
 * picker's rotate arrows post. So the arrows are now real: a page rotated
 * individually keeps its own delta, everything else gets the angle chosen
 * here. The scope line below states both layers.
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
  const perPage = Object.entries(pagePlan?.rotations ?? {})
    .filter(([page, delta]) => delta !== 0 && !removed.includes(Number(page)))
    .map(([page, delta]) => `${page}:${((delta % 360) + 360) % 360}°`);

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
        {perPage.length > 0 &&
          ` Pages rotated individually (${perPage.join(", ")}) keep their own angle.`}
      </p>
    </OptionField>
  );
}
