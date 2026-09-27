import { OptionField, OptionRadioGroup } from "@/components/tool-options/parts";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Protect PDF — Configure panel for `POST /pdf/protect`.
 *
 * Mirrors `ProtectPdfOptions` in @workspace/api-zod exactly: a required user
 * password, an optional owner password, the four algorithms the endpoint
 * supports (AES-256 is the endpoint's default), and the five permission
 * switches the schema coerces from booleanish form fields. The endpoint
 * rejects a request without a password (400), so the panel shows the same
 * requirement up front and the tool page blocks Process until it is set —
 * the merge-guard pattern, applied to a missing credential.
 */
const PERMISSIONS = [
  { key: "allowPrinting", label: "Printing", hint: "High-resolution printing" },
  { key: "allowCopying", label: "Copying", hint: "Copy text and images" },
  { key: "allowModifying", label: "Modifying", hint: "Edit content and assembly" },
  { key: "allowAnnotating", label: "Annotating", hint: "Comments and markup" },
  { key: "allowFillingForms", label: "Form filling", hint: "Fill interactive fields" },
] as const;

export function ProtectOptions({ options, onChange }: ToolOptionsProps) {
  const password = typeof options.password === "string" ? options.password : "";
  const ownerPassword =
    typeof options.ownerPassword === "string" ? options.ownerPassword : "";
  const algorithm =
    typeof options.algorithm === "string" ? options.algorithm : "AES-256";

  const permission = (key: (typeof PERMISSIONS)[number]["key"]) =>
    options[key] === undefined ? true : options[key] === true || options[key] === "true";

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField
        label="Password"
        hint="Required — needed to open the file"
        htmlFor="protect-password"
      >
        <Input
          id="protect-password"
          type="password"
          value={password}
          placeholder="Enter a password"
          autoComplete="new-password"
          data-testid="protect-password"
          onChange={(event) => onChange({ password: event.target.value })}
          className="max-w-sm"
        />
        {password.length === 0 && (
          <p data-testid="protect-needs-password" className="text-body-sm text-muted-foreground">
            A password is required to encrypt the document.
          </p>
        )}
      </OptionField>

      <OptionField
        label="Owner password"
        hint="Optional — controls permission changes"
        htmlFor="protect-owner-password"
      >
        <Input
          id="protect-owner-password"
          type="password"
          value={ownerPassword}
          placeholder="Defaults to the document password"
          autoComplete="new-password"
          data-testid="protect-owner-password"
          onChange={(event) => onChange({ ownerPassword: event.target.value })}
          className="max-w-sm"
        />
      </OptionField>

      <OptionField label="Encryption" hint="AES-256 is the recommended default">
        <OptionRadioGroup
          name="algorithm"
          value={algorithm}
          onChange={(value) => onChange({ algorithm: value })}
          options={[
            {
              value: "AES-256",
              label: "AES-256",
              description: "Strongest protection; opens in every modern reader.",
            },
            {
              value: "AES-128",
              label: "AES-128",
              description: "Strong encryption for older reader compatibility.",
            },
            {
              value: "RC4-128",
              label: "RC4-128",
              description: "Legacy cipher — only for very old readers.",
            },
          ]}
        />
      </OptionField>

      <OptionField label="Allowed actions" hint="What readers may do without the owner password">
        <div className="flex flex-col gap-space-sm">
          {PERMISSIONS.map(({ key, label, hint }) => (
            <label
              key={key}
              className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-md"
            >
              <span>
                <span className="block text-label-md text-foreground">{label}</span>
                <span className="block text-body-sm text-muted-foreground">{hint}</span>
              </span>
              <Switch
                checked={permission(key)}
                onCheckedChange={(checked) => onChange({ [key]: checked })}
                aria-label={label}
                data-testid={`protect-perm-${key}`}
              />
            </label>
          ))}
        </div>
      </OptionField>
    </div>
  );
}
