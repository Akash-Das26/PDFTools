import { OptionField } from "@/components/tool-options/parts";
import type { ToolOptionsProps } from "@/components/tool-options/types";
import { uiIcons } from "@/lib/icons";

/**
 * Remove Pages — summary panel.
 *
 * This tool has no endpoint options beyond the page list — the grid *is* the
 * configuration — so the panel's job is to state plainly what will happen to
 * the current selection rather than to offer a redundant control.
 */
export function RemovePagesOptions({ pagePlan }: ToolOptionsProps) {
  const removed = pagePlan?.removed ?? [];
  const remaining = pagePlan
    ? pagePlan.order.filter((page) => !removed.includes(page))
    : [];

  return (
    <OptionField label="Pages to remove">
      <div className="flex items-start gap-space-sm rounded-lg bg-surface p-space-md">
        <uiIcons.info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" />
        <div className="text-body-sm text-muted-foreground">
          <p>
            Use the checkbox on a page to select it for removal, then press
            Process. The page grid is the configuration for this tool, so there
            are no other options.
          </p>
          <p className="mt-space-xs" data-testid="remove-pages-summary">
            {removed.length === 0
              ? "No pages selected for removal yet."
              : `${removed.length} page${removed.length === 1 ? "" : "s"} selected for removal (${removed.join(", ")}); ${remaining.length} will remain.`}
          </p>
        </div>
      </div>
    </OptionField>
  );
}
