import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCategoryMeta } from "@/lib/tool-categories";

interface CategorySectionProps {
  meta: ToolCategoryMeta;
  /** Number of tool cards actually rendered in this section. */
  count: number;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * Landing grid section header (canonical landing layout): icon chip + label +
 * "N tools" badge + hairline rule. The count is computed from rendered cards,
 * so it can never drift from what is visible (UI-NON-REGRESSION-RULES §3).
 */
export function CategorySection({ meta, count, children, className, id }: CategorySectionProps) {
  const Icon = meta.icon;
  const toneText =
    meta.tone === "secondary" ? "text-secondary" : meta.tone === "success" ? "text-success" : meta.tone === "warning" ? "text-warning" : "text-primary";
  const toneBg =
    meta.tone === "secondary" ? "bg-secondary/10" : meta.tone === "success" ? "bg-success-subtle" : meta.tone === "warning" ? "bg-warning-subtle" : "bg-primary/10";

  return (
    <section id={id} data-category={meta.filter} className={cn("scroll-mt-24", className)}>
      <div className="flex items-center gap-3 mb-5">
        <span className={cn("w-7 h-7 rounded-md flex items-center justify-center", toneBg, toneText)}>
          <Icon className="w-4 h-4" />
        </span>
        <h2 className="text-lg font-bold tracking-tight">{meta.label}</h2>
        <span className="text-xs font-medium text-muted-foreground" data-testid={`count-${meta.filter}`}>
          {count} {count === 1 ? "tool" : "tools"}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </section>
  );
}
