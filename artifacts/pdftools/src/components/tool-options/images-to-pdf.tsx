import { FileOrderList } from "@/components/tool-options/file-order";
import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";
import { uiIcons } from "@/lib/icons";

/**
 * JPG/PNG to PDF — Configure panel for `POST /pdf/images-to-pdf`.
 *
 * Mirrors `ImagesToPdfOptions` in @workspace/api-zod: page size, orientation and
 * a margin in points. `fit` (the endpoint's default) sizes each page to its
 * image plus the margin; A4/Letter scale the image onto a standard page and
 * centre it. Orientation only means something for those fixed sizes — `auto`
 * follows the image's own aspect — so the control is hidden in `fit` mode,
 * which is what the endpoint does with it there.
 *
 * The endpoint composes uploads in order and rejects any file that is not a
 * JPG or PNG by name, so the per-file rejection is left to the server's own
 * message while the order is made editable here — the same row list Merge PDF
 * uses, since the upload array *is* the page order.
 */
export function ImagesToPdfOptions({
  options,
  onChange,
  files = [],
  onFilesChange,
}: ToolOptionsProps) {
  const pageSize =
    options.pageSize === "a4" || options.pageSize === "letter"
      ? options.pageSize
      : "fit";
  const orientation =
    options.orientation === "portrait" || options.orientation === "landscape"
      ? options.orientation
      : "auto";
  const margin =
    typeof options.margin === "number" && Number.isFinite(options.margin)
      ? String(options.margin)
      : typeof options.margin === "string" && options.margin !== ""
        ? options.margin
        : "";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Page size">
        <OptionRadioGroup
          name="pageSize"
          value={pageSize}
          columns={3}
          onChange={(value) => onChange({ pageSize: value })}
          options={[
            {
              value: "fit",
              label: "Fit the image",
              description: "Page matches the image, plus the margin.",
            },
            { value: "a4", label: "A4", description: "210 × 297 mm, image scaled." },
            {
              value: "letter",
              label: "Letter",
              description: "8.5 × 11 in, image scaled.",
            },
          ]}
        />
      </OptionField>

      {pageSize !== "fit" && (
        <OptionField label="Orientation" hint="Auto follows the image">
          <OptionRadioGroup
            name="orientation"
            value={orientation}
            columns={3}
            onChange={(value) => onChange({ orientation: value })}
            options={[
              { value: "auto", label: "Auto", description: "Portrait or landscape per image." },
              { value: "portrait", label: "Portrait", description: "Taller than wide." },
              { value: "landscape", label: "Landscape", description: "Wider than tall." },
            ]}
          />
        </OptionField>
      )}

      <OptionField label="Margin (pt)" htmlFor="images-to-pdf-margin" hint="Empty uses 24 pt">
        <Input
          id="images-to-pdf-margin"
          data-testid="images-to-pdf-margin"
          type="number"
          min={0}
          max={200}
          value={margin}
          placeholder="24"
          onChange={(event) =>
            onChange({
              margin: event.target.value === "" ? undefined : Number(event.target.value),
            })
          }
          className="max-w-[10rem]"
        />
      </OptionField>

      <OptionField label="Page order" hint="One page per image, top to bottom">
        <FileOrderList
          files={files}
          onFilesChange={onFilesChange}
          rowTestId="images-to-pdf-row"
          icon={uiIcons.image}
          hint={
            <p
              data-testid="images-to-pdf-order"
              className="text-body-sm text-muted-foreground"
            >
              {files.length === 0
                ? "Select images to convert — each becomes one page."
                : `${files.length} image${files.length === 1 ? "" : "s"} queued — reorder with the arrows to change the page order.`}
            </p>
          }
        />
      </OptionField>
    </div>
  );
}
