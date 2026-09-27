import { useState } from "react";
import { Link } from "wouter";
import { Logo } from "@/components/logo";
import { SearchDialog } from "@/components/search-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HEADER_NAV } from "@/lib/tool-categories";
import { uiIcons } from "@/lib/icons";

/**
 * Fixed site header — the reference's navigation shell.
 *
 *   fixed, 64px tall, translucent canvas with a backdrop blur and a bottom
 *   hairline; `max-w-7xl` content; logo + five nav entries left, search,
 *   theme toggle and avatar right.
 *
 * The nav is the reference's five entries in its order — Organize, Convert,
 * Edit, Security, AI — and each links to its landing section. "Convert" covers
 * both Convert-to and Convert-from, which are two sections but one nav entry.
 */
export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-surface-container-lowest/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-space-md px-gutter">
          <div className="flex items-center gap-space-lg">
            <Link href="/" aria-label="PDFTools home" data-testid="header-logo">
              <Logo />
            </Link>

            <nav
              className="hidden items-center gap-space-xs md:flex"
              aria-label="Tool categories"
            >
              {HEADER_NAV.map((entry) => (
                <a
                  key={entry.label}
                  href={entry.href}
                  data-testid={`nav-${entry.label.toLowerCase()}`}
                  className="rounded-lg px-space-sm py-space-xs text-label-md text-muted-foreground transition-colors hover:bg-surface-container-low hover:text-foreground"
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              data-testid="header-search"
              className="flex h-9 w-9 items-center justify-center gap-space-md rounded-lg border border-border bg-surface text-muted-foreground transition-colors hover:bg-surface-container-low hover:text-foreground md:w-56 md:justify-between md:px-space-sm md:text-left"
            >
              <span className="hidden items-center gap-space-xs md:flex">
                <uiIcons.search className="h-[18px] w-[18px]" />
                <span className="text-body-sm">Search tools...</span>
              </span>
              <uiIcons.search className="h-[18px] w-[18px] md:hidden" />
              <kbd className="hidden items-center rounded border border-border bg-surface-container-lowest px-space-xs py-0.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
                ⌘K
              </kbd>
            </button>

            <ThemeToggle />

            {/* Reference shows a static identity chip; there is no auth in this app. */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
              <uiIcons.check className="h-[18px] w-[18px] text-on-primary" />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Open navigation menu"
                  data-testid="mobile-nav-trigger"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground md:hidden"
                >
                  <uiIcons.chevronDown className="h-[18px] w-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {HEADER_NAV.map((entry) => (
                  <DropdownMenuItem key={entry.label} asChild>
                    <a href={entry.href}>{entry.label}</a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
