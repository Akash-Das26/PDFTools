import type { ReactNode } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/**
 * Small shared pieces every Configure panel is built from, so the 32 panels
 * look and behave identically. Only Radix primitives already in the project
 * (radio-group, select, slider, switch, checkbox) are used beneath these.
 */

export function OptionField({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-headline-md text-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-label-sm text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export interface RadioOption {
  value: string;
  label: string;
  description: string;
}

/**
 * Card-style radio group, matching the reference's compression-profile
 * selector: three side-by-side cards where the checked one lifts to
 * `surface-container-lowest` with a shadow and a primary ring.
 */
export function OptionRadioGroup({
  name,
  value,
  options,
  onChange,
  columns = 3,
}: {
  name: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  columns?: 2 | 3;
}) {
  return (
    <RadioGroup
      name={name}
      value={value}
      onValueChange={onChange}
      data-testid={`option-${name}`}
      className={cn(
        "grid gap-space-md",
        columns === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2",
      )}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            data-testid={`option-${name}-${option.value}`}
            className={cn(
              "relative flex cursor-pointer flex-col gap-space-xs rounded-xl p-space-md transition-all",
              checked
                ? "bg-surface-container-lowest shadow-level-3 ring-2 ring-primary"
                : "bg-surface-container-low hover:bg-surface-container",
            )}
          >
            <RadioGroupItem
              value={option.value}
              aria-label={option.label}
              className={cn(
                "absolute right-space-md top-space-md",
                checked ? "border-primary text-primary" : "border-border-strong",
              )}
            />
            <span className="text-label-md text-foreground">{option.label}</span>
            <span className="pr-6 text-body-sm text-muted-foreground">
              {option.description}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
}
