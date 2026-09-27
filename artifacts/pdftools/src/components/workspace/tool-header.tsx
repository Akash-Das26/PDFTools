import { Link } from "wouter";
import type { Tool } from "@workspace/api-client-react";
import { iconForTool } from "@/lib/icons";
import { ACCENT_TILE, categoryMeta } from "@/lib/tool-categories";
import { cn } from "@/lib/utils";

/**
 * Workspace tool header — breadcrumb, icon tile, title, description and wire
 * status.
 *
 * The icon and its accent come from the *same* registry and token map the
 * landing card uses, which is how "one icon per tool, identical on card and
 * workspace header" is enforced in the type system rather than by convention.
 *
 * Note on the reference: its header tile is `bg-primary-fixed
 * text-primary-container` and its subtitle is a client-side/WASM claim. Here the
 * tile uses the tool's own accent token (so an Edit tool is tertiary and an AI
 * tool is `secondary-hover`), and the subtitle is the catalog description —
 * the same string shown on the card.
 */
export function ToolHeader({ tool }: { tool: Tool }) {
  const Icon = iconForTool(tool);
  const category = categoryMeta(tool.category);

  const statusChip =
    tool.status === "implemented"
      ? { dot: "bg-success", label: "Backend ready" }
      : tool.status === "partial"
        ? { dot: "bg-warning", label: "Partial support" }
        : { dot: "bg-muted-foreground", label: "Backend pending" };

  return (
    <div className="flex flex-col gap-space-xs">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-space-xs text-label-sm text-muted-foreground"
      >
        <Link href="/" className="transition-colors hover:text-foreground">
          PDFTools
        </Link>
        <span>/</span>
        <span>{category.label}</span>
        <span>/</span>
        <span className="font-medium text-foreground">{tool.name}</span>
      </nav>

      <div className="mt-space-xs flex items-center justify-between gap-space-md">
        <div className="flex min-w-0 items-center gap-space-md">
          <div
            data-testid="workspace-tool-icon"
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
              ACCENT_TILE[category.accent],
            )}
          >
            <Icon className="h-[26px] w-[26px]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-headline-lg tracking-tight text-foreground">
              {tool.name}
            </h1>
            <p className="text-body-sm text-muted-foreground">
              {tool.description}
            </p>
          </div>
        </div>

        <div
          data-testid="wire-status"
          data-status={tool.status}
          className="hidden shrink-0 items-center gap-space-xs rounded-lg bg-surface-container px-space-sm py-space-xs text-code-sm text-muted-foreground sm:flex"
        >
          <span className={cn("h-2 w-2 rounded-full", statusChip.dot)} />
          <span>{statusChip.label}</span>
        </div>
      </div>
    </div>
  );
}
