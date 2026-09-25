import type { ToolOptionsProps } from "@/components/tool-options/types";
import { OptionField } from "@/components/tool-options/parts";
import { uiIcons } from "@/lib/icons";

/**
 * Extract Pages.
 *
 * Runs through `POST /pdf/split` with `splitType: "pages"`, where the page
 * list is the picker's selection. Like Remove Pages, the grid is the
 * configuration; the panel mirrors what will happen and guards the empty
 * case (the tool page blocks processing until at least one page is picked,
 * so this shows what to do rather than a second error path).
 */
export function ExtractPagesOptions({ pagePlan }: ToolOptionsProps) {
  const selected = pagePlan?.selected ?? [];
  const removed = pagePlan?.removed ?? [];
  const active = selected.filter((page) => !removed.includes(page));

  return (
    <OptionField label="Pages to extract">
      <div className="flex items-start gap-space-sm rounded-lg bg-surface p-space-md">
        <uiIcons.info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-primary" />
        <div className="text-body-sm text-muted-foreground">
          <p>
            Tick the pages to keep — they are pulled into a new document of
            their own, in page order. Everything unticked stays in the original
            file, untouched.
          </p>
          <p className="mt-space-xs" data-testid="extract-pages-summary">
            {active.length === 0
              ? "No pages selected yet — the grid above is the selection."
              : `${active.length} page${active.length === 1 ? "" : "s"} will be extracted (${active.join(", ")}).`}
          </p>
        </div>
      </div>
    </OptionField>
  );
}
