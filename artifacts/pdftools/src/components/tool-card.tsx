import { Link } from "wouter";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canonical landing tool card (precision_pdf_utility "Tool Cards (Discovery
 * Grid)"): rounded-xl shell, hairline border, 40px icon tile tinted with the
 * category's theme color, headline-sm title, one-line body-sm description.
 * One icon per tool everywhere (UI-NON-REGRESSION-RULES §2) — the icon comes
 * from lib/icons.ts and is never overridden here.
 */
interface ToolCardProps {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tints the icon tile: primary | secondary | success | warning */
  tone?: "primary" | "secondary" | "success" | "warning";
  /** Rendered as a muted "coming soon" card that is not clickable. */
  disabled?: boolean;
}

const toneClasses: Record<NonNullable<ToolCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
};

export function ToolCard({ id, name, description, icon: Icon, tone = "primary", disabled = false }: ToolCardProps) {
  const inner = (
    <>
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-105", toneClasses[tone])}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{name}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
      {disabled && <span className="mt-3 inline-block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Coming soon</span>}
    </>
  );

  const shell = "group block rounded-xl border border-border bg-card p-6 shadow-xs hover:shadow-md hover:border-foreground/20 transition-all text-left";

  if (disabled) {
    return (
      <div className={cn(shell, "opacity-80 cursor-default")} data-testid={`card-tool-${id}-disabled`}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={`/tools/${id}`} className={cn(shell, "card-hover")} data-testid={`card-tool-${id}`}>
      {inner}
    </Link>
  );
}
