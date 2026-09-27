import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

/**
 * Watermark — Configure panel for `POST /pdf/watermark`.
 *
 * Mirrors `WatermarkPdfOptions` in @workspace/api-zod: text or image stamps,
 * the nine-position grid plus diagonal, colour, size, opacity, an optional
 * rotation override, and an optional page selection. In image mode the chosen
 * file is passed through `options.image` — `buildFormData` appends File values
 * as real multipart parts under their key, which is exactly the `image` part
 * the route's `upload.fields` expects (documented in the OpenAPI spec).
 *
 * Empty fields mean the endpoint's defaults: no text falls back to
 * "CONFIDENTIAL" server-side, no rotation means 45° for diagonal and 0°
 * otherwise, no font size means the page-proportional auto size. The hints
 * state this rather than hiding it.
 */
const POSITIONS = [
  { value: "top-left", label: "Top left", description: "Upper-left corner" },
  { value: "top-center", label: "Top center", description: "Top edge, centered" },
  { value: "top-right", label: "Top right", description: "Upper-right corner" },
  { value: "middle-left", label: "Middle left", description: "Left edge" },
  { value: "center", label: "Center", description: "Middle of the page" },
  { value: "middle-right", label: "Middle right", description: "Right edge" },
  { value: "bottom-left", label: "Bottom left", description: "Lower-left corner" },
  { value: "bottom-center", label: "Bottom center", description: "Bottom edge, centered" },
  { value: "bottom-right", label: "Bottom right", description: "Lower-right corner" },
  { value: "diagonal", label: "Diagonal", description: "Centered, tilted 45°" },
] as const;

export function WatermarkOptions({ options, onChange, pagePlan }: ToolOptionsProps) {
  const type = options.type === "image" ? "image" : "text";
  const text = typeof options.text === "string" ? options.text : "";
  const position = typeof options.position === "string" ? options.position : "diagonal";
  const color = typeof options.color === "string" ? options.color : "";
  const fontSizeValue = typeof options.fontSize === "number" ? String(options.fontSize) : "";
  const opacity = typeof options.opacity === "number" ? options.opacity : 0.3;
  const rotation = typeof options.rotation === "number" ? String(options.rotation) : "auto";
  const scale = typeof options.scale === "number" ? options.scale : 0.35;
  const pages = typeof options.pages === "string" ? options.pages : "";
  const imageFile = options.image instanceof File ? options.image : undefined;

  const removed = pagePlan?.removed ?? [];
  const selected = (pagePlan?.selected ?? []).filter((page) => !removed.includes(page));
  const kept = (pagePlan?.order ?? []).filter((page) => !removed.includes(page));
  const scoped = selected.length > 0 ? selected : kept;

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Stamp type">
        <OptionRadioGroup
          name="type"
          value={type}
          columns={2}
          onChange={(value) =>
            onChange({
              type: value,
              // Switching back to text must not leave a stale image part behind.
              ...(value === "text" ? { image: undefined } : {}),
            })
          }
          options={[
            {
              value: "text",
              label: "Text",
              description: "Stamp styled text such as CONFIDENTIAL or a name.",
            },
            {
              value: "image",
              label: "Image",
              description: "Stamp a JPG or PNG logo with adjustable size.",
            },
          ]}
        />
      </OptionField>

      {type === "text" ? (
        <>
          <OptionField
            label="Watermark text"
            htmlFor="watermark-text"
            hint='Empty stamps "CONFIDENTIAL"'
          >
            <Input
              id="watermark-text"
              data-testid="watermark-text"
              value={text}
              placeholder="CONFIDENTIAL"
              maxLength={200}
              onChange={(event) => onChange({ text: event.target.value })}
              className="max-w-sm"
            />
          </OptionField>

          <OptionField
            label="Colour"
            htmlFor="watermark-color"
            hint="Hex such as #999999"
          >
            <Input
              id="watermark-color"
              data-testid="watermark-color"
              value={color}
              placeholder="#555555"
              onChange={(event) => onChange({ color: event.target.value })}
              className="max-w-[10rem]"
            />
          </OptionField>

          <OptionField
            label="Font size (pt)"
            htmlFor="watermark-font-size"
            hint="Empty scales with the page"
          >
            <Input
              id="watermark-font-size"
              data-testid="watermark-font-size"
              type="number"
              min={6}
              max={200}
              value={fontSizeValue}
              placeholder="Auto (24–72)"
              onChange={(event) =>
                onChange({
                  fontSize:
                    event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              className="max-w-[10rem]"
            />
          </OptionField>
        </>
      ) : (
        <>
          <OptionField
            label="Watermark image"
            htmlFor="watermark-image"
            hint="JPG or PNG"
          >
            <Input
              id="watermark-image"
              data-testid="watermark-image"
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) =>
                onChange({ image: event.target.files?.[0] ?? undefined })
              }
              className="max-w-sm"
            />
            {imageFile && (
              <p data-testid="watermark-image-name" className="text-body-sm text-muted-foreground">
                Using {imageFile.name}
              </p>
            )}
          </OptionField>

          <OptionField label="Image size" hint={`${Math.round(scale * 100)}% of the page width`}>
            <div data-testid="watermark-scale" className="max-w-sm">
              <Slider
                value={[scale]}
                min={0.05}
                max={1}
                step={0.05}
                onValueChange={(values) => onChange({ scale: values[0] ?? 0.35 })}
              />
            </div>
          </OptionField>
        </>
      )}

      <OptionField label="Position">
        <OptionRadioGroup
          name="position"
          value={position}
          columns={3}
          onChange={(value) => onChange({ position: value })}
          options={POSITIONS.map((option) => ({ ...option }))}
        />
      </OptionField>

      <OptionField
        label="Opacity"
        hint={`${Math.round(opacity * 100)}%`}
      >
        <div data-testid="watermark-opacity" className="max-w-sm">
          <Slider
            value={[opacity]}
            min={0.05}
            max={1}
            step={0.05}
            onValueChange={(values) => onChange({ opacity: values[0] ?? 0.3 })}
          />
        </div>
      </OptionField>

      <OptionField label="Angle" hint="Auto tilts diagonal stamps 45°">
        <OptionRadioGroup
          name="rotation"
          value={rotation}
          columns={3}
          onChange={(value) =>
            onChange({ rotation: value === "auto" ? undefined : Number(value) })
          }
          options={[
            { value: "auto", label: "Auto", description: "Endpoint default." },
            { value: "0", label: "0°", description: "Straight." },
            { value: "-45", label: "−45°", description: "Tilted left." },
          ]}
        />
      </OptionField>

      <OptionField
        label="Pages"
        htmlFor="watermark-pages"
        hint="Empty stamps every page"
      >
        <Input
          id="watermark-pages"
          data-testid="watermark-pages"
          value={pages}
          placeholder="1,3,5-8"
          onChange={(event) => onChange({ pages: event.target.value })}
          className="max-w-xs"
        />
        <p data-testid="watermark-scope" className="text-body-sm text-muted-foreground">
          {selected.length > 0
            ? `Applies to the ${selected.length} selected page${selected.length === 1 ? "" : "s"} (${selected.join(", ")}).`
            : scoped.length > 0
              ? `Applies to all ${scoped.length} pages.`
              : "Applies to every page of the document."}
        </p>
      </OptionField>
    </div>
  );
}
