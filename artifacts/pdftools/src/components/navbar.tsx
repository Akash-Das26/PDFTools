import { Link } from "wouter";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";
import logoSvg from "@/assets/pdf-tools-logo.svg";

export function Navbar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoSvg} alt="PDF Tools" className="h-7 md:h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-3 md:gap-6">
          <Link
            href="/compare"
            className="text-xs md:text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            data-testid="link-compare"
          >
            Compare
          </Link>
          <Link
            href="/about"
            className="text-xs md:text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            data-testid="link-about"
          >
            About
          </Link>
          <Link
            href="/pricing"
            className="text-xs md:text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            data-testid="link-pricing"
          >
            Pricing
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            data-testid="button-theme-toggle"
          >
            {theme === "light" ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  );
}
