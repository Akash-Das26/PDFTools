import { Link } from "wouter";
import type { Tool } from "@workspace/api-client-react";
import { iconForTool, uiIcons } from "@/lib/icons";
import { ACCENT_CARD_HOVER, ACCENT_TILE, categoryMeta } from "@/lib/tool-categories";
import { cn } from "@/lib/utils";

/**
 * Landing tool card.
 *
 * Mirrors the reference card one-for-one: `p-space-lg rounded-xl surface card`,
 * a 40px accent-tinted icon tile, an optional "Popular" ribbon, a two-line
 * clamped description, and an "Open tool" footer whose arrow nudges right on
 * hover. The title and footer warm to the card's own accent.
 *
 * `Icon` comes from the catalog's icon name via the shared registry, so the
 * card and the workspace header render the identical glyph.
 *
 * Backend-pending tools stay fully clickable — their workspace renders a
 * disabled Process button plus a badge — but the card marks them so the user
 * knows before they commit.
 */
export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = iconForTool(tool);
  const { accent } = categoryMeta(tool.category);
  const hover = ACCENT_CARD_HOVER[accent];

  return (
    <Link
      href={`/tools/${tool.id}`}
      data-testid={`card-tool-${tool.id}`}
      data-title={tool.name}
      data-keywords={(tool.keywords ?? []).join(" ")}
      className="group relative flex flex-col justify-between rounded-xl bg-surface p-space-lg shadow-level-2 transition-all duration-200 hover:bg-surface-container-lowest hover:shadow-level-3"
    >
      <div>
        <div className="mb-space-md flex items-start justify-between">
          <div
            data-testid={`tile-${tool.id}`}
            data-accent={accent}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
              ACCENT_TILE[accent],
            )}
          >
            <Icon className="h-[22px] w-[22px]" />
          </div>

          {tool.popular && (
            /* Reference ribbon, class for class: `px-2 py-0.5 rounded
               bg-primary-fixed text-on-primary-fixed font-label-sm
               text-label-sm font-semibold tracking-wide` — note `rounded`
               (not `rounded-full`) and `primary-fixed`, which unlike
               `primary` does not invert in dark. */
            <span
              data-testid={`badge-popular-${tool.id}`}
              className="rounded bg-primary-fixed px-2 py-0.5 text-label-sm font-semibold tracking-wide text-on-primary-fixed"
            >
              Popular
            </span>
          )}

          {/* NOTE: this testid deliberately does NOT share the `card-tool-` prefix —
              a `[data-testid^="card-tool-"]` query must mean "one card", never a
              badge inside one. */}
          {tool.status === "pending" && (
            <span
              data-testid={`badge-pending-${tool.id}`}
              className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm text-muted-foreground"
            >
              Coming soon
            </span>
          )}
        </div>

        <h3
          className={cn(
            "text-headline-sm text-foreground transition-colors",
            hover,
          )}
        >
          {tool.name}
        </h3>
        <p className="mt-space-xs line-clamp-2 text-body-sm text-muted-foreground">
          {tool.description}
        </p>
      </div>

      <div
        className={cn(
          "mt-space-md flex items-center justify-between pt-space-xs text-muted-foreground transition-colors",
          hover,
        )}
      >
        <span className="text-label-sm font-medium">Open tool</span>
        <uiIcons.arrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
