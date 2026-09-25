import type { ToolOptionsProps } from "@/components/tool-options/types";
import { OptionField } from "@/components/tool-options/parts";
import { uiIcons } from "@/lib/icons";

/**
 * Organize Pages.
 *
 * Runs through `POST /pdf/reorder-pages`, which takes the new order as a
 * comma-separated `order` field. The grid (drag, move up/down, delete) is the
 * configuration; the panel mirrors the resulting order and calls out removed
 * pages so the rebuild is never a surprise.
 */
export function OrganizePagesOptions({ pagePlan }: ToolOptionsProps) {
  const order = pagePlan?.order ?? [];
  const removed = pagePlan?.removed ?? [];
  const kept = order.filter((page) => !removed.includes(page));

  return (
    <OptionField label="New page order">
      <div className="flex items-start gap-space-sm rounded-lg bg-surface p-space-md">
        <uiIcons.info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" />
        <div className="text-body-sm text-muted-foreground">
          <p>
            Drag pages (or use the arrows on each card) to set the order; the
            delete control drops a page from the output entirely.
          </p>
          <p className="mt-space-xs" data-testid="organize-pages-summary">
            {kept.length === 0
              ? "No pages remain in the output — remove the deletion to rebuild."
              : `${kept.length} page${kept.length === 1 ? "" : "s"} will be rebuilt in this order: ${kept.join(", ")}.`}
            {removed.length > 0 &&
              ` Dropped: ${removed.join(", ")}.`}
          </p>
        </div>
      </div>
    </OptionField>
  );
}
