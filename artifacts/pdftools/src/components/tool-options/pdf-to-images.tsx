import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";

/**
 * PDF to JPG — Configure panel for `POST /pdf/pdf-to-images`.
 *
 * Mirrors `PdfToImagesOptions` in @workspace/api-zod: format, quality, render
 * width and an optional page selection. Quality is a JPEG encoder setting —
 * the PNG path in the service ignores it — so the control is hidden for PNG
 * rather than shown as a knob that does nothing.
 *
 * Two endpoint limits are stated up front instead of arriving as an error:
 * at most 50 pages per run, and one selected page downloads as an image while
 * several come back as a ZIP.
 */
export function PdfToImagesOptions({ options, onChange, pagePlan }: ToolOptionsProps) {
  const format = options.format === "png" ? "png" : "jpg";
  const quality =
    typeof options.quality === "number" && Number.isFinite(options.quality)
      ? String(options.quality)
      : typeof options.quality === "string" && options.quality !== ""
        ? options.quality
        : "";
  const width =
    typeof options.width === "number" && Number.isFinite(options.width)
      ? String(options.width)
      : typeof options.width === "string" && options.width !== ""
        ? options.width
        : "";
  const pages = typeof options.pages === "string" ? options.pages : "";

  const pageCount = pagePlan?.order?.length ?? 0;

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Image format">
        <OptionRadioGroup
          name="imageFormat"
          value={format}
          columns={2}
          onChange={(value) => onChange({ format: value })}
          options={[
            {
              value: "jpg",
              label: "JPG",
              description: "Smaller files; quality setting applies.",
            },
            {
              value: "png",
              label: "PNG",
              description: "Lossless; larger files.",
            },
          ]}
        />
      </OptionField>

      {format === "jpg" && (
        <OptionField label="Quality" htmlFor="pdf-to-images-quality" hint="1–100, empty uses 85">
          <Input
            id="pdf-to-images-quality"
            data-testid="pdf-to-images-quality"
            type="number"
            min={1}
            max={100}
            value={quality}
            placeholder="85"
            onChange={(event) =>
              onChange({
                quality: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
            className="max-w-[10rem]"
          />
        </OptionField>
      )}

      <OptionField
        label="Render width (px)"
        htmlFor="pdf-to-images-width"
        hint="100–4000, empty uses 1200"
      >
        <Input
          id="pdf-to-images-width"
          data-testid="pdf-to-images-width"
          type="number"
          min={100}
          max={4000}
          value={width}
          placeholder="1200"
          onChange={(event) =>
            onChange({
              width: event.target.value === "" ? undefined : Number(event.target.value),
            })
          }
          className="max-w-[10rem]"
        />
      </OptionField>

      <OptionField
        label="Pages"
        htmlFor="pdf-to-images-pages"
        hint="Empty exports every page"
      >
        <Input
          id="pdf-to-images-pages"
          data-testid="pdf-to-images-pages"
          value={pages}
          placeholder="1,3,5-8"
          onChange={(event) => onChange({ pages: event.target.value })}
          className="max-w-xs"
        />
        <p data-testid="pdf-to-images-note" className="text-body-sm text-muted-foreground">
          {pageCount > 0
            ? `This document has ${pageCount} page${pageCount === 1 ? "" : "s"}. Up to 50 export in one run; a single page downloads as an image, several as a ZIP.`
            : "Up to 50 pages export in one run; a single page downloads as an image, several as a ZIP."}
        </p>
      </OptionField>
    </div>
  );
}
