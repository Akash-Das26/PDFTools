import { LogoMark } from "@/components/logo";
import { HEADER_NAV } from "@/lib/tool-categories";

/** Footer — reference markup: hairline top border, surface band, wordmark left, category links right. */
export function SiteFooter() {
  return (
    <footer className="w-full border-t border-border bg-surface py-margin">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-space-md px-gutter md:flex-row">
        <div className="flex items-center gap-space-sm">
          <LogoMark className="h-6 w-6 opacity-75" />
          <span className="text-headline-sm text-on-surface-variant">PDFTools</span>
          <span className="text-body-sm text-muted-foreground">
            — Frictionless document utility.
          </span>
        </div>

        <div className="flex items-center gap-space-md">
          {HEADER_NAV.map((entry) => (
            <a
              key={entry.label}
              href={entry.href}
              className="text-body-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {entry.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
