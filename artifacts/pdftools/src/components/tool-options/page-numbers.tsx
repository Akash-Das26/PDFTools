import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";

/**
 * Add Page Numbers — Configure panel for `POST /pdf/add-page-numbers`.
 *
 * Mirrors `AddPageNumbersOptions` in @workspace/api-zod: one of five positions,
 * a start number (the endpoint stamps every page, so the last number is
 * startNumber + pageCount − 1), and one of three label formats. Numbers are
 * stamped in a fixed 11 pt grey — the endpoint exposes no styling knobs, and
 * the panel does not pretend otherwise.
 */
const POSITIONS = [
  { value: "bottom-center", label: "Bottom center", description: "Footer, centered." },
  { value: "bottom-right", label: "Bottom right", description: "Footer, right edge." },
  { value: "bottom-left", label: "Bottom left", description: "Footer, left edge." },
  { value: "top-center", label: "Top center", description: "Header, centered." },
  { value: "top-right", label: "Top right", description: "Header, right edge." },
] as const;

const FORMATS = [
  { value: "1", label: "1", description: "Just the number." },
  { value: "Page 1", label: "Page 1", description: "Number with a prefix." },
  { value: "1/N", label: "1 / N", description: "Number over the total." },
] as const;

export function AddPageNumbersOptions({ options, onChange }: ToolOptionsProps) {
  const position = typeof options.position === "string" ? options.position : "bottom-center";
  const format = typeof options.format === "string" ? options.format : "1";
  const startNumber =
    typeof options.startNumber === "number" && Number.isFinite(options.startNumber)
      ? String(options.startNumber)
      : typeof options.startNumber === "string" && options.startNumber !== ""
        ? options.startNumber
        : "1";

  const start = Number.parseInt(startNumber, 10);

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Position">
        <OptionRadioGroup
          name="position"
          value={position}
          columns={3}
          onChange={(value) => onChange({ position: value })}
          options={POSITIONS.map((option) => ({ ...option }))}
        />
      </OptionField>

      <OptionField label="Number format">
        <OptionRadioGroup
          name="format"
          value={format}
          columns={3}
          onChange={(value) => onChange({ format: value })}
          options={FORMATS.map((option) => ({ ...option }))}
        />
      </OptionField>

      <OptionField
        label="Start numbering at"
        htmlFor="page-numbers-start"
        hint="Stamps every page"
      >
        <Input
          id="page-numbers-start"
          data-testid="page-numbers-start"
          type="number"
          min={1}
          max={100000}
          value={startNumber}
          onChange={(event) =>
            onChange({
              startNumber:
                event.target.value === "" ? undefined : Number(event.target.value),
            })
          }
          className="max-w-[10rem]"
        />
        <p data-testid="page-numbers-range" className="text-body-sm text-muted-foreground">
          {Number.isInteger(start) && start >= 1
            ? `Numbering starts at ${start} — every page is stamped in sequence.`
            : "Every page is stamped in sequence; leave 1 to start from the first page."}
        </p>
      </OptionField>
    </div>
  );
}
