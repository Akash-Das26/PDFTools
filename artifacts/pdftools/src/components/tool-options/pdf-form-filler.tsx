import { OptionField } from "@/components/tool-options/parts";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * PDF Form Filler — Configure panel for `POST /pdf/pdf-form-filler`.
 *
 * The tool page inspects the document on upload (`/pdf/pdf-form-inspect`, the
 * same post-upload fetch the page-picker's thumbnails use) and hands the field
 * inventory down through `fields`. Each field renders the control its own kind
 * calls for: a text input, a checkbox switch, or a native select of the
 * choices the field actually offers. Filling needs at least one value, which
 * is why Process stays disabled until the user has written something.
 *
 * The note states the two things a user would otherwise learn the hard way:
 * flatten (on by default) makes the answers permanent page content, and the
 * filler writes values — it does not redraw the form.
 */
export interface InspectedFormField {
  name: string;
  type: "text" | "checkbox" | "dropdown" | "optionlist" | "radio" | "signature" | "button";
  value?: string;
  checked?: boolean;
  selected?: string[];
  options?: string[];
  maxLength?: number;
  readOnly?: boolean;
}

const KIND_LABELS: Record<InspectedFormField["type"], string> = {
  text: "Text",
  checkbox: "Checkbox",
  dropdown: "Dropdown",
  optionlist: "List",
  radio: "Radio group",
  signature: "Signature",
  button: "Button",
};

export function PdfFormFillerOptions({
  options,
  onChange,
  fields = [],
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  /** The inspected inventory, parsed by the tool page from `form-inspect`. */
  fields?: InspectedFormField[];
}) {
  const values = safeParse(options.values);
  const flatten = options.flatten === undefined ? true : options.flatten === true || options.flatten === "true";
  const filledCount = Object.values(values).filter((v) => v !== "" && v !== false).length;
  const fillable = fields.filter((f) => f.type !== "signature" && f.type !== "button" && !f.readOnly);

  const setValue = (name: string, value: string | boolean) => {
    const next = { ...values, [name]: value };
    if (value === "" || value === false) delete next[name];
    onChange({ values: JSON.stringify(next) });
  };

  return (
    <div className="flex flex-col gap-space-lg">
      {fillable.length === 0 ? (
        <p data-testid="form-empty" className="text-body-sm text-muted-foreground">
          This document has no fillable fields — it may already be flattened.
        </p>
      ) : (
        fillable.map((field) => (
          <OptionField
            key={field.name}
            label={field.name}
            hint={`${KIND_LABELS[field.type]}${field.maxLength ? ` · up to ${field.maxLength} chars` : ""}`}
          >
            {field.type === "checkbox" ? (
              <label className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md">
                <span className="text-label-md text-foreground">Checked</span>
                <Switch
                  checked={values[field.name] === true}
                  onCheckedChange={(checked) => setValue(field.name, checked)}
                  aria-label={field.name}
                  data-testid={`form-field-${field.name}`}
                />
              </label>
            ) : field.options && field.options.length > 0 ? (
              <select
                data-testid={`form-field-${field.name}`}
                value={typeof values[field.name] === "string" ? (values[field.name] as string) : ""}
                onChange={(event) => setValue(field.name, event.target.value)}
                className="h-10 max-w-sm rounded-lg border border-border bg-surface px-space-md text-body-md text-foreground"
              >
                <option value="">Not selected</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                value={typeof values[field.name] === "string" ? (values[field.name] as string) : ""}
                maxLength={field.maxLength}
                placeholder={field.value ? `e.g. ${field.value}` : "Type the answer"}
                data-testid={`form-field-${field.name}`}
                onChange={(event) => setValue(field.name, event.target.value)}
                className="max-w-sm"
              />
            )}
          </OptionField>
        ))
      )}

      <OptionField label="Flatten" hint="Make the answers permanent">
        <label className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md">
          <span>
            <span className="block text-label-md text-foreground">Flatten after filling</span>
            <span className="block text-body-sm text-muted-foreground">
              Writes the values into the page so they can no longer be edited and the
              fields disappear. Off keeps the result an editable form.
            </span>
          </span>
          <Switch
            checked={flatten}
            onCheckedChange={(checked) => onChange({ flatten: checked })}
            aria-label="Flatten after filling"
            data-testid="form-flatten"
          />
        </label>
      </OptionField>

      <p data-testid="form-note" className="text-body-sm text-muted-foreground">
        <span>
          {filledCount === 0
            ? "Fill at least one field to process. Fields are read from the document, so what you see here is what the form really has."
            : `${filledCount} field${filledCount === 1 ? "" : "s"} filled. The output is named after the upload.`}
        </span>
      </p>
    </div>
  );
}

function safeParse(raw: unknown): Record<string, string | boolean> {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string | boolean> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "string" || typeof value === "boolean") out[key] = value;
      }
      return out;
    }
  } catch {
    // Reset to empty rather than crash the panel on a malformed draft.
  }
  return {};
}
