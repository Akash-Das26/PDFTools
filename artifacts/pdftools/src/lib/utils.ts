import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Class-name merge.
 *
 * IMPORTANT: the design system adds a custom typographic scale
 * (`text-headline-xl` … `text-code-sm`) on top of Tailwind's. `tailwind-merge`
 * cannot know those names, so it classifies `text-headline-sm` as a *text
 * colour* utility — the same group as `text-foreground` — and silently drops it
 * whenever both appear in one `cn()` call. The visible effect is that a heading
 * renders at the inherited 16px/400 instead of 16px/600, with no error anywhere.
 *
 * Registering the scale as a font-size group fixes that at the source, so every
 * component can keep combining `text-<scale>` with `text-<colour>` safely.
 */
const FONT_SIZE_SCALE = [
  "headline-xl",
  "headline-xl-mobile",
  "headline-lg",
  "headline-lg-mobile",
  "headline-md",
  "headline-sm",
  "body-lg",
  "body-md",
  "body-sm",
  "label-md",
  "label-sm",
  "code-sm",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZE_SCALE }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
