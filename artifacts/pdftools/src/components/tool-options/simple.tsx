import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InfoNote, OptionField, PageSelectionField } from "./parts";
import { useOptionsReport, type ToolOptionsPanelProps } from "./types";

export function MergeOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const report = useMemo(
    () => ({ fields: [], files: [], ready: true, resultName: `${baseName}_merged.pdf` }),
    [baseName],
  );
  useOptionsReport(onChange, report);
  return <InfoNote>Files are merged in the order shown above.</InfoNote>;
}

export function CompareOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const report = useMemo(
    () => ({ fields: [], files: [], ready: true, resultName: `${baseName}_comparison.md` }),
    [baseName],
  );
  useOptionsReport(onChange, report);
  return (
    <InfoNote>
      Select exactly two PDFs. We extract the text from both and report what was added and removed,
      with the page each line came from. Layout-only changes are not shown.
    </InfoNote>
  );
}

export function SummarizeOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const report = useMemo(
    () => ({ fields: [], files: [], ready: true, resultName: `${baseName}_summary` }),
    [baseName],
  );
  useOptionsReport(onChange, report);
  return <InfoNote>AI will read the document and produce a concise summary with key takeaways.</InfoNote>;
}

export function RepairOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const report = useMemo(
    () => ({ fields: [], files: [], ready: true, resultName: `${baseName}_repaired.pdf` }),
    [baseName],
  );
  useOptionsReport(onChange, report);
  return (
    <InfoNote>
      We rebuild the document structure and recover whatever content is still intact. The download is
      flagged when the file had to be salvaged rather than read cleanly.
    </InfoNote>
  );
}

export function PdfToPdfAOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [conformance, setConformance] = useState<"1B" | "2B" | "2U" | "3B" | "3U">("3B");

  const report = useMemo(
    () => ({
      fields: [["conformance", conformance]] as Array<[string, string]>,
      files: [],
      ready: true,
      resultName: `${baseName}_pdfa-${conformance.toLowerCase()}.pdf`,
    }),
    [baseName, conformance],
  );
  useOptionsReport(onChange, report);

  const options = [
    { value: "3B", label: "PDF/A-3B (recommended)" },
    { value: "3U", label: "PDF/A-3U" },
    { value: "2B", label: "PDF/A-2B" },
    { value: "2U", label: "PDF/A-2U" },
    { value: "1B", label: "PDF/A-1B" },
  ] as const;

  return (
    <div className="space-y-4">
      <OptionField label="Conformance level">
        <RadioGroup value={conformance} onValueChange={(value) => setConformance(value as typeof conformance)}>
          {options.map((option) => (
            <div key={option.value} className="flex items-center space-x-2">
              <RadioGroupItem value={option.value} id={`pdfa-${option.value}`} />
              <Label htmlFor={`pdfa-${option.value}`} className="cursor-pointer font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </OptionField>
      <InfoNote>
        PDF/A is the ISO archiving standard. Fonts and other content that the standard forbids are not
        rewritten — validate the result with a PDF/A checker before archiving.
      </InfoNote>
    </div>
  );
}

export function DuplicatePagesOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [pages, setPages] = useState("");
  const [copies, setCopies] = useState("1");
  const [placement, setPlacement] = useState<"after" | "end">("after");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [
      ["copies", copies],
      ["placement", placement],
    ];
    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: Number(copies) >= 1 && Number(copies) <= 20,
      resultName: `${baseName}_duplicated.pdf`,
    };
  }, [baseName, copies, pages, placement]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <OptionField label="Copies per page" htmlFor="dup-copies">
          <Input
            id="dup-copies"
            type="number"
            min="1"
            max="20"
            value={copies}
            onChange={(event) => setCopies(event.target.value)}
          />
        </OptionField>
        <OptionField label="Where to put them">
          <RadioGroup value={placement} onValueChange={(value) => setPlacement(value as typeof placement)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="after" id="dup-after" />
              <Label htmlFor="dup-after" className="cursor-pointer font-normal">
                Next to the original
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="end" id="dup-end" />
              <Label htmlFor="dup-end" className="cursor-pointer font-normal">
                Append at the end
              </Label>
            </div>
          </RadioGroup>
        </OptionField>
      </div>

      <PageSelectionField value={pages} onChange={setPages} id="dup-pages" testId="input-pages" />
    </div>
  );
}

export function CompressOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [quality, setQuality] = useState<"extreme" | "recommended" | "high">("recommended");

  const report = useMemo(
    () => ({
      fields: [["quality", quality]] as Array<[string, string]>,
      files: [],
      ready: true,
      resultName: `${baseName}_compressed.pdf`,
    }),
    [baseName, quality],
  );
  useOptionsReport(onChange, report);

  const options = [
    { value: "extreme", label: "Extreme (smallest file)" },
    { value: "recommended", label: "Recommended (balanced)" },
    { value: "high", label: "High quality (larger file)" },
  ];

  return (
    <OptionField label="Compression quality">
      <RadioGroup value={quality} onValueChange={(value) => setQuality(value as typeof quality)}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={`compress-${option.value}`} />
            <Label htmlFor={`compress-${option.value}`} className="cursor-pointer font-normal">
              {option.label}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </OptionField>
  );
}

export function SplitOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [splitType, setSplitType] = useState<"all" | "pages">("all");
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [["splitType", splitType]];
    if (splitType === "pages" && pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files: [],
      ready: splitType === "all" || pages.trim().length > 0,
      resultName: splitType === "all" ? `${baseName}_split.zip` : `${baseName}_pages.pdf`,
    };
  }, [baseName, pages, splitType]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-4">
      <OptionField label="Split mode">
        <RadioGroup value={splitType} onValueChange={(value) => setSplitType(value as typeof splitType)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="split-all" />
            <Label htmlFor="split-all" className="cursor-pointer font-normal">
              Split into individual pages
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="pages" id="split-pages" />
            <Label htmlFor="split-pages" className="cursor-pointer font-normal">
              Extract specific pages
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      {splitType === "pages" && (
        <PageSelectionField
          value={pages}
          onChange={setPages}
          id="pages-input"
          testId="input-pages"
          emptyMeansAll={false}
          hint="Comma separated pages, e.g. 1,3,5."
        />
      )}
    </div>
  );
}

export function AddPageNumbersOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [position, setPosition] = useState<string>("bottom-center");
  const [startNumber, setStartNumber] = useState("1");
  const [format, setFormat] = useState<"1" | "Page 1" | "1/N">("1");

  const report = useMemo(
    () => ({
      fields: [
        ["position", position],
        ["startNumber", startNumber],
        ["format", format],
      ] as Array<[string, string]>,
      files: [],
      ready: true,
      resultName: `${baseName}_numbered.pdf`,
    }),
    [baseName, format, position, startNumber],
  );
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Position">
        <RadioGroup value={position} onValueChange={setPosition}>
          {[
            { value: "bottom-center", label: "Bottom center" },
            { value: "bottom-right", label: "Bottom right" },
            { value: "bottom-left", label: "Bottom left" },
            { value: "top-center", label: "Top center" },
            { value: "top-right", label: "Top right" },
          ].map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <RadioGroupItem value={value} id={`pn-${value}`} />
              <Label htmlFor={`pn-${value}`} className="cursor-pointer font-normal">
                {label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </OptionField>

      <div className="grid grid-cols-2 gap-4">
        <OptionField label="Starting number" htmlFor="pn-start">
          <Input
            id="pn-start"
            type="number"
            min="1"
            value={startNumber}
            onChange={(event) => setStartNumber(event.target.value)}
          />
        </OptionField>
        <OptionField label="Format">
          <RadioGroup value={format} onValueChange={(value) => setFormat(value as typeof format)}>
            {(["1", "Page 1", "1/N"] as const).map((value) => (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem value={value} id={`pnf-${value}`} />
                <Label htmlFor={`pnf-${value}`} className="cursor-pointer font-mono text-sm font-normal">
                  {value}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </OptionField>
      </div>
    </div>
  );
}
