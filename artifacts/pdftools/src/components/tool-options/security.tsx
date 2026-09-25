import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InfoNote, OptionField } from "./parts";
import { useOptionsReport, type ToolOptionsPanelProps } from "./types";

const PERMISSIONS: Array<{ key: string; label: string; description: string }> = [
  { key: "allowPrinting", label: "Allow printing", description: "Readers may print the document" },
  { key: "allowCopying", label: "Allow copying", description: "Readers may copy text and images" },
  { key: "allowModifying", label: "Allow editing", description: "Readers may change the content" },
  { key: "allowAnnotating", label: "Allow comments", description: "Readers may add annotations" },
  { key: "allowFillingForms", label: "Allow form filling", description: "Readers may complete form fields" },
];

export function ProtectOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [password, setPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    allowPrinting: true,
    allowCopying: true,
    allowModifying: true,
    allowAnnotating: true,
    allowFillingForms: true,
  });

  const report = useMemo(() => {
    const fields: Array<[string, string]> = [["password", password]];
    if (ownerPassword.trim()) fields.push(["ownerPassword", ownerPassword.trim()]);
    for (const permission of PERMISSIONS) {
      fields.push([permission.key, String(permissions[permission.key] ?? true)]);
    }

    return {
      fields,
      files: [],
      ready: password.length > 0,
      resultName: `${baseName}_protected.pdf`,
    };
  }, [baseName, ownerPassword, password, permissions]);
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-5">
      <OptionField label="Password" htmlFor="protect-password" hint="Required to open the file. Encryption uses AES-256.">
        <Input
          id="protect-password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          data-testid="input-password"
        />
      </OptionField>

      <OptionField
        label="Owner password (optional)"
        htmlFor="protect-owner-password"
        hint="Leave empty to use the same password as the owner password."
      >
        <Input
          id="protect-owner-password"
          type="password"
          autoComplete="new-password"
          placeholder="Owner password"
          value={ownerPassword}
          onChange={(event) => setOwnerPassword(event.target.value)}
        />
      </OptionField>

      <div className="space-y-3">
        <Label className="block">Reader permissions</Label>
        {PERMISSIONS.map((permission) => (
          <div key={permission.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{permission.label}</p>
              <p className="text-xs text-muted-foreground">{permission.description}</p>
            </div>
            <Switch
              checked={permissions[permission.key] ?? true}
              onCheckedChange={(checked) =>
                setPermissions((current) => ({ ...current, [permission.key]: checked }))
              }
              data-testid={`switch-${permission.key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UnlockOptions({ baseName, onChange }: ToolOptionsPanelProps) {
  const [password, setPassword] = useState("");

  const report = useMemo(
    () => ({
      fields: password ? ([["password", password]] as Array<[string, string]>) : [],
      files: [],
      ready: true,
      resultName: `${baseName}_unlocked.pdf`,
    }),
    [baseName, password],
  );
  useOptionsReport(onChange, report);

  return (
    <div className="space-y-4">
      <OptionField
        label="Current password"
        htmlFor="unlock-password"
        hint="Leave empty for PDFs that only restrict printing or copying."
      >
        <Input
          id="unlock-password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter the PDF password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          data-testid="input-unlock-password"
        />
      </OptionField>
      <InfoNote>The password is used once to decrypt your file and is never stored.</InfoNote>
    </div>
  );
}
