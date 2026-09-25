import { cn } from "@/lib/utils";

/**
 * Brand mark + wordmark.
 *
 * The wordmark is rendered in the `primary` token — the brief calls this out
 * explicitly ("red logo/wordmark (primary token, not blue)"). The previous
 * asset hard-coded `#2563EB`, so the mark is rebuilt here from tokens: the tile
 * paints `bg-primary`, the document fills `on-primary`, and its rules stroke
 * `primary`. No raw hex anywhere.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-testid="logo-mark"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none">
        <path d="M6 2.5h7.5L19 8v13.5H6z" className="fill-on-primary" />
        <path
          d="M13.5 2.5V8H19"
          className="stroke-primary"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <path
          d="M9 13h7M9 16.5h7"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-space-sm", className)}>
      <LogoMark />
      <span className="text-headline-md tracking-tight text-foreground">
        PDFTools
      </span>
    </span>
  );
}
