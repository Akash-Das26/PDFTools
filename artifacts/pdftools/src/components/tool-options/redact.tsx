import { useState } from "react";
import { OptionField } from "@/components/tool-options/parts";

/**
 * Redact — Configure panel for `POST /pdf/redact`.
 *
 * One input: the terms to remove, one per line (sent as a JSON array). The
 * note states the two facts that make this tool trustworthy: matches are
 * literal (case-insensitive, no patterns), and removal is real — the text is
 * deleted from the file, not painted over.
 */
export function RedactOptions({
  options,
  onChange,
}: {
  options: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState(
    typeof options.terms === "string" ? options.terms : "",
  );

  const commit = (value: string) => {
    setDraft(value);
    const terms = value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    onChange({ terms: JSON.stringify(terms) });
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <OptionField label="Terms to remove" hint="One per line">
        <textarea
          data-testid="redact-terms"
          value={draft}
          onChange={(event) => commit(event.target.value)}
          rows={5}
          placeholder={"42-1337-ALPHA\ngrace@example.com"}
          className="w-full max-w-xl rounded-lg border border-border bg-surface-container-lowest p-space-md font-mono text-code-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </OptionField>

      <p data-testid="redact-note" className="text-body-sm text-muted-foreground">
        Removal is permanent: the text is deleted from the file and a black box
        drawn where it was — not a rectangle painted over it. Matching is
        literal and case-insensitive, so check spelling; terms that appear
        nowhere are reported before anything is downloaded.
      </p>
    </div>
  );
}
