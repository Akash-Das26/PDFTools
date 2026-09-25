import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { OptionField, PageSelectionField } from "./parts";
import { useOptionsReport, type ToolOptionsPanelProps } from "./types";

const POSITIONS = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "center", label: "Center" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "diagonal", label: "Diagonal" },
];

export function WatermarkOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [type, setType] = useState<"text" | "image">("text");
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [opacity, setOpacity] = useState([0.3]);
  const [position, setPosition] = useState("diagonal");
  const [color, setColor] = useState("#999999");
  const [scale, setScale] = useState([35]);
  const [pages, setPages] = useState("");

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [
      ["type", type],
      ["opacity", String(opacity[0] ?? 0.3)],
      ["position", position],
    ];
    const files: Array<[string, File]> = [];

    if (type === "text") {
      fields.push(["text", text.trim() || "CONFIDENTIAL"]);
      fields.push(["color", color]);
    } else if (image) {
      files.push(["image", image]);
      fields.push(["scale", String((scale[0] ?? 35) / 100)]);
    }

    if (pages.trim()) fields.push(["pages", pages.trim()]);

    return {
      fields,
      files,
      ready: type === "text" ? text.trim().length > 0 : image !== null,
      resultName: `${baseName}_watermarked.pdf`,
    };
  }, [baseName, color, image, opacity, pages, position, scale, text, type]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Watermark type">
        <RadioGroup value={type} onValueChange={(value) => setType(value as typeof type)}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="text" id="wm-type-text" />
            <Label htmlFor="wm-type-text" className="cursor-pointer font-normal">
              Text
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="image" id="wm-type-image" />
            <Label htmlFor="wm-type-image" className="cursor-pointer font-normal">
              Image (JPG or PNG)
            </Label>
          </div>
        </RadioGroup>
      </OptionField>

      {type === "text" ? (
        <>
          <OptionField label="Watermark text" htmlFor="watermark-text" hint="Latin characters (A–Z, 0–9) are supported.">
            <Input
              id="watermark-text"
              placeholder="CONFIDENTIAL"
              value={text}
              onChange={(event) => setText(event.target.value)}
              data-testid="input-watermark-text"
            />
          </OptionField>
          <OptionField label="Text colour" htmlFor="watermark-color">
            <div className="flex items-center gap-3">
              <input
                id="watermark-color"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent"
              />
              <Input value={color} onChange={(event) => setColor(event.target.value)} className="max-w-[9rem]" />
            </div>
          </OptionField>
        </>
      ) : (
        <>
          <OptionField label="Watermark image" htmlFor="watermark-image" hint="Transparent PNGs work best.">
            <Input
              id="watermark-image"
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              data-testid="input-watermark-image"
            />
          </OptionField>
          <OptionField label={`Image size: ${scale[0]}% of page width`}>
            <Slider value={scale} onValueChange={setScale} min={5} max={100} step={5} />
          </OptionField>
        </>
      )}

      <OptionField label={`Opacity: ${Math.round((opacity[0] ?? 0.3) * 100)}%`}>
        <Slider value={opacity} onValueChange={setOpacity} min={0.1} max={1} step={0.05} />
      </OptionField>

      <OptionField label="Position" htmlFor="watermark-position">
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger id="watermark-position" data-testid="select-watermark-position">
            <SelectValue placeholder="Choose a position" />
          </SelectTrigger>
          <SelectContent>
            {POSITIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </OptionField>

      <PageSelectionField value={pages} onChange={setPages} id="watermark-pages" />
    </div>
  );
}
