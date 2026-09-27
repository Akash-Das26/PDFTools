import { useTheme } from "next-themes";
import { uiIcons } from "@/lib/icons";
import { cn } from "@/lib/utils";

/**
 * Light/dark toggle.
 *
 * Renders the glyph matching the *reference's* convention: the button shows the
 * mode you would switch to (`Moon` while light, `Sun` while dark) — matching
 * `landing_tool_grid_categorized_sections`, whose button is `light_mode` with
 * aria-label "Toggle dark mode".
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? uiIcons.sun : uiIcons.moon;

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors",
        "hover:bg-surface-container hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
