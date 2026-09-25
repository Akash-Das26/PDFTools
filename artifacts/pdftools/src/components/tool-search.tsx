import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOL_CATEGORY_GROUPS } from "@/lib/tool-categories";

export interface ToolSearchProps {
  /** Search text (controlled by the parent so it can filter the grid). */
  query: string;
  onQueryChange: (value: string) => void;
  /** Active pill filter: "all" or a group `filter` value. */
  filter: string;
  onFilterChange: (value: string) => void;
  className?: string;
}

/**
 * Landing search + category pill filter row, matching the Stitch
 * `landing_tool_grid_categorized_sections` search component: 12px-radius input
 * with focus ring in primary, and rounded-lg pills (active = primary fill).
 */
export function ToolSearch({ query, onQueryChange, filter, onFilterChange, className }: ToolSearchProps) {
  const pills = useMemo(
    () => [{ filter: "all", label: "All Tools" }, ...TOOL_CATEGORY_GROUPS.map((g) => ({ filter: g.filter, label: g.label }))],
    [],
  );

  return (
    <div className={cn("w-full max-w-4xl mx-auto flex flex-col gap-4 items-center", className)}>
      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search tools by name, keyword, or action (e.g. compress, merge, ocr)..."
          data-testid="tool-search"
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-card text-foreground border border-border shadow-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-base transition-all"
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto w-full py-1 justify-start md:justify-center scrollbar-none">
        {pills.map((pill) => {
          const active = filter === pill.filter;
          return (
            <button
              key={pill.filter}
              type="button"
              onClick={() => onFilterChange(pill.filter)}
              data-testid={`pill-${pill.filter}`}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground hover:bg-accent border border-border",
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
