---
name: Obsidian Slate
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#e6bdb8'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#ac8884'
  outline-variant: '#5c403c'
  surface-tint: '#ffb4ab'
  primary: '#ffb4ab'
  on-primary: '#690005'
  primary-container: '#dc2626'
  on-primary-container: '#fff6f5'
  inverse-primary: '#bf0715'
  secondary: '#b4c5ff'
  on-secondary: '#002a78'
  secondary-container: '#0053db'
  on-secondary-container: '#cdd7ff'
  tertiary: '#90cdff'
  on-tertiary: '#003450'
  tertiary-container: '#0078b2'
  on-tertiary-container: '#f3f8ff'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb4ab'
  on-primary-fixed: '#410002'
  on-primary-fixed-variant: '#93000b'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#cbe6ff'
  tertiary-fixed-dim: '#90cdff'
  on-tertiary-fixed: '#001e30'
  on-tertiary-fixed-variant: '#004b71'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: -0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style
The design system delivers a focused, high-density utility aesthetic engineered for document workflows and browser-side WebAssembly computation. Inspired by tools like Linear and Notion, the interface emphasizes extreme discipline: deep zinc blacks, architectural contrast, razor-thin hairline borders, and deliberate vermilion accents that signal execution and precision.

The emotional target is pure competence, security, and instantaneous speed. Visual noise is aggressively stripped away to let document canvases and toolbars stand out. Micro-interactions are snappy (under 150ms), borders define structural boundaries rather than heavy shadows, and discreet terminal-like cues (monospaced parameters, file hashes, processing readouts) reinforce local-first computing power.

## Colors
The palette leverages a stepped zinc hierarchy over a pure dark foundation, ensuring clear separation without visual clutter:

- **Canvas & Foundations:**
  - Base canvas (`surface-container-lowest` / background): `#0B0B0C`
  - Recessed cards & canvas wells (`surface-container-low`): `#121215`
  - Base container / panels (`surface` / `surface-container`): `#18181B`
  - Elevated controls & hovered rows (`surface-container-high`): `#27272A`
  - Popovers, tooltips, and floating sheets (`surface-container-highest`): `#3F3F46`

- **Borders & Dividers:**
  - Structural border: `#27272A`
  - Subtle divider / interactive border hover: `#3F3F46`

- **Typography & Content:**
  - High-emphasis text (`foreground`): `#F4F4F5`
  - Secondary/metadata text (`muted-foreground`): `#A1A1AA`
  - Tertiary / hotkey glyphs: `#71717A`

- **Functional Accents:**
  - Action Primary (`primary`): `#DC2626` (Red-600) with `#B91C1C` active state
  - Execution Secondary (`secondary`): `#2563EB` (Blue-600) for links, selection bounds, and WASM indicators
  - Status Indicators: Success `#16A34A`, Warning `#D97706`, Destructive `#DC2626`

## Typography
Typography enforces structural clarity and rapid visual scanning:

- **Display & Headings:** `Inter` set at tight tracking (`-0.02em` to `-0.03em`) and medium/semibold weights to evoke precision software tools rather than marketing pages.
- **Body & Controls:** `Inter` regular and medium weights for maximum legibility in dense data contexts (file lists, compression ratios, page numbers).
- **Code & Telemetry:** `JetBrains Mono` handles byte sizes, processing durations, DPI values, page ranges, and cryptographic signatures, cementing the terminal-grade utility tone.

## Layout & Spacing
The layout follows a strict high-density grid tailored for productivity:

- **Desktop (1024px+):** Fixed utility shell featuring a 240px collapsable left sidebar for tools, a dynamic central work canvas, and an optional 320px contextual inspector on the right. Content areas conform to a 12-column fluid structure within a maximum container width of `1440px`.
- **Tablet (768px - 1023px):** Sidebars collapse into icon-only rails (56px) or bottom drawer triggers; gutters adapt to `1rem` and section margins tighten to `1.5rem`.
- **Mobile (<768px):** Single-column vertical stream. Global margins contract to `1rem`. Secondary inspector panels convert into touch-friendly bottom sheets.
- **Rhythm:** Spacing derives strictly from a 4px/8px base system. Tight gaps (`space-xs` to `space-sm`) are preferred within toolbars and grouped chips to preserve screen real estate for PDF rendering.

## Elevation & Depth
Elevation is communicated primarily via **tonal layering** and **crisp 1px borders** rather than diffuse drop shadows:

- **Base Layer (Level 0):** Canvas background `#0B0B0C` sits deepest. Document viewports and dropped files rest here.
- **Surface Layer (Level 1):** Utility cards, panels, and sidebars use `#18181B` outlined with `1px solid #27272A`.
- **Raised Interactive Layer (Level 2):** Hovered cards, inputs, and active toolbar groups shift to `#27272A`.
- **Floating Overlays (Level 3):** Context menus, modals, and tooltips use `#27272A` or `#3F3F46` with a razor-thin border (`rgba(255, 255, 255, 0.08)`) and an ultra-subtle directional shadow (`0 8px 24px -4px rgba(0, 0, 0, 0.65)`).
- **WASM Activity Glow:** Active batch operations or background threads emit an inner or ring accent glow: `0 0 0 1px #2563EB, 0 0 12px -2px rgba(37, 99, 235, 0.4)`.

## Shapes
A unified radius scale bridges technical rigor with sleek handling:

- **Cards & Dropzones:** `rounded-xl` (12px / `0.75rem`) for high-level module containers and file upload dropzones.
- **Controls & Buttons:** `rounded-md` (6px to 8px / `0.5rem`) for standard buttons, text inputs, and select triggers.
- **Tags & Status Badges:** `rounded-sm` (4px / `0.25rem`) to maintain a clean, compact data-display look.
- **File Thumbnails & Previews:** `rounded-lg` (8px) with inset hairline border (`inset 0 0 0 1px rgba(255,255,255,0.06)`).

## Components

- **Primary Buttons:** Solid `#DC2626` background, `#F4F4F5` text, medium weight, subtle internal highlight on top border (`inset 0 1px 0 rgba(255,255,255,0.15)`). Hover transforms to `#B91C1C`. Focus rings use `0 0 0 2px #0B0B0C, 0 0 0 4px #DC2626`.
- **Secondary & Ghost Buttons:** Background `#18181B`, border `1px solid #27272A`, text `#F4F4F5`. On hover, background transitions to `#27272A` and border to `#3F3F46`.
- **Cards & Containers:** Background `#18181B`, 12px radius, 1px border in `#27272A`. Inner padding scales from `1rem` on mobile to `1.5rem` on desktop. Active drag-and-drop targets transition border to dashed `#DC2626` with a faint `rgba(220, 38, 38, 0.05)` backdrop.
- **Input Fields:** Flat `#121215` background, border `1px solid #27272A`, text `#F4F4F5`, placeholder `#71717A`. On focus, border illuminates with `#2563EB` or `#DC2626` (contextual) with zero default browser outline.
- **Chips & Badges:** Monospace text (`JetBrains Mono`, 11px), padding `2px 6px`, radius `4px`. Neutral tags use background `#27272A` with `#A1A1AA` text. WASM engine status chips utilize an active green ping dot (`#16A34A`).
- **File Previews & Reorder Grids:** Compact cards displaying page sequence number, aspect-ratio-locked thumbnail, file size, and quick-action icon overlays that appear on hover with instant opacity transitions (`100ms ease-out`).
- **Checkboxes & Radios:** 16px square/circle with `#121215` background and `1px solid #3F3F46`. Checked state fills `#DC2626` with a crisp `#F4F4F5` glyph mark.