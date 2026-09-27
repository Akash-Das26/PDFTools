import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Theme provider.
 *
 * The reference design ships a light and a dark screen for every template, and
 * DESIGN.md mandates both themes ("Radix + Tailwind CSS variables, using the
 * existing `next-themes` dependency"). `next-themes` is what the vendored
 * `ui/sonner` already reads, so routing the app through it keeps toasts in step
 * with the active theme instead of needing a second, parallel mechanism.
 *
 * `attribute="class"` toggles `.dark` on <html>, which is what the token block
 * in `index.css` keys off.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
