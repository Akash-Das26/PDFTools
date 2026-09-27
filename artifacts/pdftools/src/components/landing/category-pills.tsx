import { CATEGORIES } from "@/lib/tool-categories";
import { cn } from "@/lib/utils";

/**
 * Category filter pills.
 *
 * The reference's row is `All Tools` followed by the six sections, active is
 * `bg-primary text-on-primary` with a small shadow, idle is a surface pill that
 * warms on hover, and the strip scrolls horizontally on narrow viewports.
 */
export function CategoryPills({
  active,
  onChange,
}: {
  active: string;
  onChange: (filter: string) => void;
}) {
  const options = [
    { id: "all", label: "All Tools" },
    ...CATEGORIES.map((category) => ({
      id: category.id,
      label: category.pillLabel,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filter tools by category"
      className="scrollbar-none flex w-full items-center gap-space-xs overflow-x-auto py-1"
    >
      {options.map((option) => {
        const isActive = option.id === active;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`pill-${option.id}`}
            onClick={() => onChange(option.id)}
            className={cn(
              "shrink-0 rounded-lg px-space-md py-space-xs text-label-md transition-all",
              isActive
                ? "bg-primary text-on-primary shadow-level-2"
                : "bg-surface text-muted-foreground hover:bg-surface-container hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
