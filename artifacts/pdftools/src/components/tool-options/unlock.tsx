import { OptionField } from "@/components/tool-options/parts";
import { Input } from "@/components/ui/input";
import type { ToolOptionsProps } from "@/components/tool-options/types";

/**
 * Unlock PDF — Configure panel for `POST /pdf/unlock`.
 *
 * Mirrors `UnlockPdfOptions` in @workspace/api-zod: a single optional
 * `password` field. The backend distinguishes the two failure cases (422 with
 * "This PDF needs a password" when none was sent, "That password didn't unlock
 * this PDF" when it was wrong), and returns the original file untouched when
 * the document was never encrypted — so the panel asks for the password but
 * never demands one.
 */
export function UnlockOptions({ options, onChange }: ToolOptionsProps) {
  const password = typeof options.password === "string" ? options.password : "";

  return (
    <OptionField
      label="Document password"
      hint="Only if the file is encrypted"
      htmlFor="unlock-password"
    >
      <Input
        id="unlock-password"
        type="password"
        value={password}
        placeholder="Leave empty if the file opens without one"
        autoComplete="off"
        data-testid="unlock-password"
        onChange={(event) => onChange({ password: event.target.value })}
        className="max-w-sm"
      />
    </OptionField>
  );
}
