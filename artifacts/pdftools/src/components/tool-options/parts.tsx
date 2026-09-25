import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function OptionField({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor} className="block">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/**
 * Shared page-selection field. Every tool that can target pages uses the same
 * syntax the server parses: "1,3,5-8".
 */
export function PageSelectionField({
  value,
  onChange,
  hint = "Comma separated pages or ranges, e.g. 1,3,5-8.",
  emptyMeansAll = true,
  id = "pages-input",
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  emptyMeansAll?: boolean;
  id?: string;
  testId?: string;
}) {
  return (
    <OptionField
      label={emptyMeansAll ? "Pages (optional)" : "Pages"}
      htmlFor={id}
      hint={emptyMeansAll ? `${hint} Leave empty to apply to every page.` : hint}
    >
      <Input
        id={id}
        placeholder="1,3,5-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid={testId ?? id}
      />
    </OptionField>
  );
}
