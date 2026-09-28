import { FileOrderList } from "@/components/tool-options/file-order";
import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { uiIcons } from "@/lib/icons";

/**
 * Scan to PDF — Configure panel for `POST /pdf/scan-to-pdf`.
 *
 * The endpoint is JPG/PNG to PDF plus an optional OCR pass, and this panel is
 * that shape: the same page-size, orientation and margin controls (with
 * orientation hidden under `fit`, exactly as the endpoint ignores it there), the
 * same page-order row list, then a "searchable" switch that reveals the language
 * picker only when it is on. The language list mirrors `OCR_LANGUAGES` — the
 * packs the server actually ships.
 *
 * The note states the two things a user would otherwise learn the hard way:
 * searchable means a real recognition run per page (so it is slower and can come
 * back with nothing recognised), and the camera comes from the browser's own
 * capture input, which only phones offer.
 */
const LANGUAGES = [
  { value: "eng", label: "English" },
  { value: "spa", label: "Spanish" },
  { value: "fra", label: "French" },
  { value: "deu", label: "German" },
  { value: "ita", label: "Italian" },
  { value: "por", label: "Portuguese" },
  { value: "nld", label: "Dutch" },
  { value: "pol", label: "Polish" },
  { value: "tur", label: "Turkish" },
  { value: "rus", label: "Russian" },
  { value: "ara", label: "Arabic" },
  { value: "heb", label: "Hebrew" },
  { value: "hin", label: "Hindi" },
  { value: "chi_sim", label: "Chinese (simplified)" },
  { value: "chi_tra", label: "Chinese (traditional)" },
  { value: "jpn", label: "Japanese" },
  { value: "kor", label: "Korean" },
] as const;

export function ScanToPdfOptions({
  options,
  onChange,
  files = [],
  onFilesChange,
}: ToolOptionsProps) {
  const pageSize =
    options.pageSize === "a4" || options.pageSize === "letter" ? options.pageSize : "fit";
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
  const searchable = options.searchable === undefined ? false : options.searchable === true || options.searchable === "true";
  const language = LANGUAGES.some((entry) => entry.value === options.language)
    ? (options.language as string)
    : "eng";

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
              label: "Fit the capture",
              description: "Page matches the photo, plus the margin.",
            },
            { value: "a4", label: "A4", description: "210 × 297 mm, capture scaled." },
            { value: "letter", label: "Letter", description: "8.5 × 11 in, capture scaled." },
          ]}
        />
      </OptionField>

      {pageSize !== "fit" && (
        <OptionField label="Orientation" hint="Auto follows each capture">
          <OptionRadioGroup
            name="orientation"
            value={orientation}
            columns={3}
            onChange={(value) => onChange({ orientation: value })}
            options={[
              { value: "auto", label: "Auto", description: "Portrait or landscape per capture." },
              { value: "portrait", label: "Portrait", description: "Upright pages." },
              { value: "landscape", label: "Landscape", description: "Sideways pages." },
            ]}
          />
        </OptionField>
      )}

      <OptionField
        label="Margin"
        hint="Points around each capture"
        htmlFor="scan-margin"
      >
        <Input
          id="scan-margin"
          inputMode="numeric"
          value={margin}
          placeholder="24"
          data-testid="scan-margin"
          onChange={(event) => onChange({ margin: event.target.value })}
          className="max-w-[10rem]"
        />
      </OptionField>

      <OptionField label="Text layer" hint="Optional — costs a recognition run">
        <label className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md">
          <span>
            <span className="block text-label-md text-foreground">Make it searchable</span>
            <span className="block text-body-sm text-muted-foreground">
              Runs OCR over the captured pages and adds an invisible text layer, so
              the scan can be searched and copied from.
            </span>
          </span>
          <Switch
            checked={searchable}
            onCheckedChange={(checked) => onChange({ searchable: checked })}
            aria-label="Make it searchable"
            data-testid="scan-searchable"
          />
        </label>
      </OptionField>

      {searchable && (
        <OptionField label="Text language" hint="Which language pack to recognise">
          <Select value={language} onValueChange={(value) => onChange({ language: value })}>
            <SelectTrigger data-testid="scan-language" className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </OptionField>
      )}

      <OptionField label="Page order" hint="One page per capture, top to bottom">
        <FileOrderList
          files={files}
          onFilesChange={onFilesChange}
          rowTestId="scan-row"
          icon={uiIcons.image}
          hint={
            <p data-testid="scan-order" className="text-body-sm text-muted-foreground">
              {files.length === 0
                ? "Capture or select pages — each becomes one page."
                : `${files.length} capture${files.length === 1 ? "" : "s"} queued — reorder with the arrows to change the page order.`}
            </p>
          }
        />
      </OptionField>

      <p data-testid="scan-note" className="text-body-sm text-muted-foreground">
        On a phone the browser offers your camera for this upload; on a desktop it
        opens the file picker. Searchable output is produced by the same OCR pass
        the OCR tool uses, so it is limited to 50 pages per scan — 20 for CJK
        scripts — and a capture with no legible text is rejected rather than
        returned blank.
      </p>
    </div>
  );
}
