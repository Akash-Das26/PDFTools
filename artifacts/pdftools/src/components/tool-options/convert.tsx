import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { InfoNote, OptionField, PageSelectionField } from "./parts";
import { useOptionsReport, type ToolOptionsPanelProps } from "./types";

const MARGINS = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
] as const;

export function CropOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [unit, setUnit] = useState<"percent" | "pt">("percent");
  const [margins, setMargins] = useState<Record<string, string>>({
    top: "10",
    bottom: "10",
    left: "10",
    right: "10",
  });
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [["unit", unit]];
    for (const margin of MARGINS) fields.push([margin.key, margins[margin.key] || "0"]);
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    const hasMargin = MARGINS.some((margin) => Number(margins[margin.key]) > 0);

    return {
      fields,
      files: [],
      ready: hasMargin,
      resultName: `${baseName}_cropped.pdf`,
    };
  }, [baseName, margins, pages, unit]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Margin unit">
        <RadioGroup value={unit} onValueChange={(value) => setUnit(value as typeof unit)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="percent" id="crop-percent" />
            <Label htmlFor="crop-percent" className="cursor-pointer font-normal">
              Percent of the page
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pt" id="crop-pt" />
            <Label htmlFor="crop-pt" className="cursor-pointer font-normal">
              Points (1 pt = 1/72 inch)
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      <div className="grid grid-cols-2 gap-4">
        {MARGINS.map((margin) => (
          <OptionField key={margin.key} label={`${margin.label} margin`} htmlFor={`crop-${margin.key}`}>
            <Input
              id={`crop-${margin.key}`}
              type="number"
              min="0"
              step={unit === "percent" ? "1" : "5"}
              value={margins[margin.key]}
              onChange={(event) =>
                setMargins((current) => ({ ...current, [margin.key]: event.target.value }))
              }
              data-testid={`input-crop-${margin.key}`}
            />
          </OptionField>
        ))}
      </div>

      <PageSelectionField value={pages} onChange={setPages} id="crop-pages" />
    </div>
  );
}

export function PdfToImagesOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [format, setFormat] = useState<"jpg" | "png">("jpg");
  const [quality, setQuality] = useState([85]);
  const [width, setWidth] = useState("1200");
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [
      ["format", format],
      ["quality", String(quality[0] ?? 85)],
      ["width", width || "1200"],
    ];
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: Number(width) >= 100,
      resultName: `${baseName}_images.zip`,
    };
  }, [baseName, format, pages, quality, width]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Image format">
        <RadioGroup value={format} onValueChange={(value) => setFormat(value as typeof format)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="jpg" id="pti-jpg" />
            <Label htmlFor="pti-jpg" className="cursor-pointer font-normal">
              JPG (smaller files)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="png" id="pti-png" />
            <Label htmlFor="pti-png" className="cursor-pointer font-normal">
              PNG (lossless)
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      {format === "jpg" && (
        <OptionField label={`JPG quality: ${quality[0]}`}>
          <Slider value={quality} onValueChange={setQuality} min={40} max={100} step={5} />
        </OptionField>
      )}

      <OptionField label="Image width (pixels)" htmlFor="pti-width" hint="Between 100 and 4000 pixels.">
        <Input
          id="pti-width"
          type="number"
          min="100"
          max="4000"
          step="50"
          value={width}
          onChange={(event) => setWidth(event.target.value)}
          data-testid="input-image-width"
        />
      </OptionField>

      <PageSelectionField value={pages} onChange={setPages} id="pti-pages" hint="Several pages are returned as a ZIP." />
    </div>
  );
}

export function ImagesToPdfOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [pageSize, setPageSize] = useState<"fit" | "a4" | "letter">("fit");
  const [orientation, setOrientation] = useState<"auto" | "portrait" | "landscape">("auto");
  const [margin, setMargin] = useState("24");

  const report = useMemo(
    () => ({
      fields: [
        ["pageSize", pageSize],
        ["orientation", orientation],
        ["margin", margin || "0"],
      ] as Array<[string, string]>,
      files: [],
      ready: true,
      resultName: `${baseName}_images.pdf`,
    }),
    [baseName, margin, orientation, pageSize],
  );
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Page size">
        <RadioGroup value={pageSize} onValueChange={(value) => setPageSize(value as typeof pageSize)}>
          {[
            { value: "fit", label: "Fit to each image" },
            { value: "a4", label: "A4" },
            { value: "letter", label: "US Letter" },
          ].map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`itp-${option.value}`} />
              <Label htmlFor={`itp-${option.value}`} className="cursor-pointer font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </OptionField>

      {pageSize !== "fit" && (
        <OptionField label="Orientation">
          <RadioGroup value={orientation} onValueChange={(value) => setOrientation(value as typeof orientation)}>
            {[
              { value: "auto", label: "Match each image" },
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ].map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={`itpo-${option.value}`} />
                <Label htmlFor={`itpo-${option.value}`} className="cursor-pointer font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </OptionField>
      )}

      <OptionField label="Margin (points)" htmlFor="itp-margin" hint="1 pt = 1/72 inch. Use 0 for a full-bleed page.">
        <Input
          id="itp-margin"
          type="number"
          min="0"
          max="200"
          value={margin}
          onChange={(event) => setMargin(event.target.value)}
        />
      </OptionField>
    </div>
  );
}

const OCR_LANGUAGE_GROUPS = [
  {
    label: "Latin & Cyrillic",
    languages: [
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
    ],
  },
  {
    label: "Chinese, Japanese & Korean",
    languages: [
      { value: "chi_sim", label: "Chinese (Simplified)" },
      { value: "chi_tra", label: "Chinese (Traditional)" },
      { value: "jpn", label: "Japanese" },
      { value: "kor", label: "Korean" },
    ],
  },
  {
    label: "Right-to-left",
    languages: [
      { value: "ara", label: "Arabic" },
      { value: "heb", label: "Hebrew" },
    ],
  },
  {
    label: "Indic",
    languages: [{ value: "hin", label: "Hindi" }],
  },
] as const;

const LANGUAGE_STORAGE_KEY = "ocr-language";
const MODE_STORAGE_KEY = "ocr-mode";
const FORMAT_STORAGE_KEY = "ocr-format";

const OCR_MODES = ["text", "searchable-pdf"] as const;
const OCR_FORMATS = ["txt", "md"] as const;
const OCR_LANGUAGE_VALUES = OCR_LANGUAGE_GROUPS.flatMap((group) => group.languages.map((option) => option.value));

/**
 * Last chosen value for an OCR preference, kept across sessions. The stored
 * value is validated against the current options so a stale entry (or
 * hand-edited storage) cannot reach the API and fail validation.
 */
function storedChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored && (allowed as readonly string[]).includes(stored)) return stored as T;
  } catch {
    // Storage can be unavailable (private mode, disabled); the default stands.
  }
  return fallback;
}

/** Best-effort write — a failed save only costs the memory, not this run. */
function persistChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, disabled).
  }
}

export function OcrOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  // A `?ocr=mode,format,language` parameter is the shareable preset and wins
  // over stored preferences; it is validated the same way and the full current
  // choice is written back to the URL (replaceState) so copying the address
  // bar always shares this exact setup.
  const preset = useMemo(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("ocr");
      if (!raw) return null;
      const [modeP, formatP, languageP] = raw.split(",").map((part) => part.trim());
      return {
        mode: OCR_MODES.includes(modeP as (typeof OCR_MODES)[number]) ? (modeP as (typeof OCR_MODES)[number]) : undefined,
        format: OCR_FORMATS.includes(formatP as (typeof OCR_FORMATS)[number]) ? (formatP as (typeof OCR_FORMATS)[number]) : undefined,
        language: OCR_LANGUAGE_VALUES.includes(languageP as (typeof OCR_LANGUAGE_VALUES)[number]) ? (languageP as (typeof OCR_LANGUAGE_VALUES)[number]) : undefined,
      };
    } catch {
      return null;
    }
  }, []);

  const [mode, setMode] = useState<"text" | "searchable-pdf">(() =>
    preset?.mode ?? storedChoice(MODE_STORAGE_KEY, OCR_MODES, "text"),
  );
  const [format, setFormat] = useState<"txt" | "md">(() =>
    preset?.format ?? storedChoice(FORMAT_STORAGE_KEY, OCR_FORMATS, "txt"),
  );
  const [language, setLanguage] = useState<string>(() =>
    preset?.language ?? storedChoice(LANGUAGE_STORAGE_KEY, OCR_LANGUAGE_VALUES, "eng"),
  );
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [
      ["mode", mode],
      ["language", language],
    ];
    if (mode === "text") fields.push(["format", format]);
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: true,
      resultName: mode === "searchable-pdf" ? `${baseName}_ocr.pdf` : `${baseName}.${format}`,
    };
  }, [baseName, format, language, mode, pages]);
  useOptionsReport(onChange, report);

  // Keep the address bar in sync (without adding history entries) so a shared
  // link reproduces this exact configuration.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("ocr", [mode, format, language].join(","));
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // URL manipulation is best-effort; the choices still apply.
    }
  }, [format, language, mode]);

  return (
    <div className="space-y-5">
      <OptionField label="Output">
        <RadioGroup
          value={mode}
          onValueChange={(value) => {
            setMode(value as typeof mode);
            persistChoice(MODE_STORAGE_KEY, value);
          }}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="ocr-mode-text" />
            <Label htmlFor="ocr-mode-text" className="cursor-pointer font-normal">
              Text file
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="searchable-pdf" id="ocr-mode-pdf" />
            <Label htmlFor="ocr-mode-pdf" className="cursor-pointer font-normal">
              Searchable PDF (selectable text)
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      {mode === "text" && (
        <OptionField label="File format">
          <RadioGroup
            value={format}
            onValueChange={(value) => {
              setFormat(value as typeof format);
              persistChoice(FORMAT_STORAGE_KEY, value);
            }}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="txt" id="ocr-txt" />
              <Label htmlFor="ocr-txt" className="cursor-pointer font-normal">
                Plain text (.txt)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="md" id="ocr-md" />
              <Label htmlFor="ocr-md" className="cursor-pointer font-normal">
                Markdown (.md) with detected headings and lists
              </Label>
            </div>
          </RadioGroup>
        </OptionField>
      )}

      <OptionField label="Document language" htmlFor="ocr-language">
        <Select
          value={language}
          onValueChange={(value) => {
            setLanguage(value);
            persistChoice(LANGUAGE_STORAGE_KEY, value);
          }}
        >
          <SelectTrigger id="ocr-language" data-testid="select-ocr-language">
            <SelectValue placeholder="Choose a language" />
          </SelectTrigger>
          <SelectContent>
            {OCR_LANGUAGE_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.languages.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </OptionField>

      <PageSelectionField
        value={pages}
        onChange={setPages}
        id="ocr-pages"
        hint="Leave blank to recognise every page."
      />

      <InfoNote>
        OCR reads the page images with Tesseract, so it is much slower than text extraction and works
        best on clean, high-resolution scans. Up to 50 pages per run, or 20 for Chinese, Japanese, and
        Korean, which take longer per page.
      </InfoNote>
    </div>
  );
}

export function ExtractTextOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [format, setFormat] = useState<"txt" | "md">("txt");
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [["format", format]];
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: true,
      resultName: `${baseName}.${format}`,
    };
  }, [baseName, format, pages]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Export format">
        <RadioGroup value={format} onValueChange={(value) => setFormat(value as typeof format)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="txt" id="et-txt" />
            <Label htmlFor="et-txt" className="cursor-pointer font-normal">
              Plain text (.txt)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="md" id="et-md" />
            <Label htmlFor="et-md" className="cursor-pointer font-normal">
              Markdown (.md) with detected headings and lists
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      <PageSelectionField value={pages} onChange={setPages} id="et-pages" />
    </div>
  );
}
