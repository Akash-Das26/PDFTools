import { uiIcons } from "@/lib/icons";

/**
 * Inline landing search.
 *
 * Matches the reference: a 48px rounded-xl input with a leading search glyph
 * and trailing `ESC` / `⌘K` affordances, filtering the grid live as you type.
 * Placeholder text is verbatim from the reference.
 */
export function ToolSearchBar({
  value,
  onChange,
  onOpenPalette,
}: {
  value: string;
  onChange: (value: string) => void;
  onOpenPalette: () => void;
}) {
  return (
    <div className="relative w-full">
      <uiIcons.search className="pointer-events-none absolute left-space-md top-1/2 h-[22px] w-[22px] -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onChange("");
        }}
        data-testid="tool-search"
        aria-label="Search tools"
        placeholder="Search tools by name, keyword, or action (e.g. compress, merge, ocr)..."
        className="h-12 w-full rounded-xl bg-surface-container-lowest pl-12 pr-28 text-body-md text-foreground shadow-level-2 transition-all placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="absolute right-space-sm top-1/2 flex -translate-y-1/2 items-center gap-1">
        <span className="rounded bg-surface-container px-space-xs py-0.5 text-code-sm text-muted-foreground">
          ESC
        </span>
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label="Open command palette"
          className="rounded bg-surface-container px-space-xs py-0.5 text-code-sm text-muted-foreground hover:text-foreground"
        >
          ⌘K
        </button>
      </div>
    </div>
  );
}
