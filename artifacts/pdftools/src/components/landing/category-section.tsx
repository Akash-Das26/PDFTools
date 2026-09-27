import type { Tool } from "@workspace/api-client-react";
import { ToolCard } from "@/components/landing/tool-card";
import {
  ACCENT_BADGE,
  categoryMeta,
  toolsForCategory,
  type CategoryMeta,
} from "@/lib/tool-categories";
import { cn } from "@/lib/utils";

/**
 * Landing category section.
 *
 * The reference lays the grid out 4 columns desktop / 2 tablet / 1 mobile with
 * a `1.5rem` gutter (falling to `1rem` on tablet), and puts a count badge next
 * to the heading.
 *
 * The badge is computed from the array actually passed to the grid — never a
 * hard-coded number — so "N Tools" can never disagree with the cards beneath
 * it. Its colours come from `ACCENT_BADGE`, which reproduces the reference's
 * per-section pairs exactly rather than reusing the icon-tile tint.
 */
export function CategorySection({
  category,
  tools,
}: {
  category: CategoryMeta;
  tools: Tool[];
}) {
  const items = toolsForCategory(tools, category.id);
  if (items.length === 0) return null;

  return (
    <section
      id={category.id}
      data-section={category.id}
      data-testid={`section-${category.id}`}
      className="flex scroll-mt-24 flex-col gap-space-lg"
    >
      <div className="flex flex-col justify-between gap-space-xs pb-space-xs sm:flex-row sm:items-end">
        <div className="flex items-center gap-space-sm">
          <h2 className="text-headline-lg tracking-tight text-foreground">
            {category.label}
          </h2>
          <span
            data-testid={`count-${category.id}`}
            className={cn(
              // `font-semibold` is explicit in the reference badge markup; the
              // label-sm token alone is 500, which would render one step light.
              "rounded-full px-2 py-0.5 text-label-sm font-semibold",
              ACCENT_BADGE[category.accent],
            )}
          >
            {items.length} Tools
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:grid-cols-4">
        {items.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
