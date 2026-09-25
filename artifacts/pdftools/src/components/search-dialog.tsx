import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CATEGORIES, categoryMeta } from "@/lib/tool-categories";
import { filterTools, useToolCatalog } from "@/lib/tool-catalog";
import { iconForTool, uiIcons } from "@/lib/icons";
import { ACCENT_GLYPH } from "@/lib/tool-categories";
import { cn } from "@/lib/utils";

/**
 * Command palette (`cmdk`, already a dependency).
 *
 * The reference header pairs its search control with a `⌘K` affordance, so the
 * header button and the global shortcut both open this dialog. It searches the
 * same three fields as the inline landing search — name, description and the
 * catalog's keyword synonyms — via one shared matcher.
 */
export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const { tools } = useToolCatalog();
  const [, navigate] = useLocation();

  // Global ⌘K / Ctrl+K.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const results = filterTools(tools, query);

  const select = (toolId: string) => {
    onOpenChange(false);
    setQuery("");
    navigate(`/tools/${toolId}`);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search tools by name, keyword, or action (e.g. compress, merge, shrink)..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
            <uiIcons.search className="h-5 w-5 text-muted-foreground" />
            <p className="text-body-sm text-muted-foreground">
              No tools matched your query
            </p>
          </div>
        </CommandEmpty>
        {CATEGORIES.map((category) => {
          const items = results.filter((tool) => tool.category === category.id);
          if (items.length === 0) return null;
          return (
            <CommandGroup key={category.id} heading={category.label}>
              {items.map((tool) => {
                const Icon = iconForTool(tool);
                return (
                  <CommandItem
                    key={tool.id}
                    value={`${tool.name} ${(tool.keywords ?? []).join(" ")}`}
                    onSelect={() => select(tool.id)}
                    data-testid={`command-tool-${tool.id}`}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        ACCENT_GLYPH[categoryMeta(tool.category).accent],
                      )}
                    />
                    <span>{tool.name}</span>
                    {tool.status === "pending" && (
                      <span className="ml-auto rounded-full bg-surface-container px-space-xs py-0.5 text-label-sm text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
