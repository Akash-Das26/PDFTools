# PDFTools — Frontend Design Specification

This document defines the design system and screen inventory for the PDFTools
frontend (`artifacts/pdftools`: React 19 + Vite + Radix UI + Tailwind CSS).
It's meant to be used two ways: as the brief you feed into **Stitch** (Google's
AI UI design tool) to generate/redesign screens, and as the source of truth
your team checks implementation against afterward.

---

## 1. Product Summary

PDFTools is a browser-based PDF toolkit (an iLovePDF-style utility app):
upload a PDF (or PDFs/images), pick an operation, configure it, and download
the result. Every tool follows the same three-step shape: **Upload → Configure
→ Download**. The design has to make that shape feel identical across ~30
different tools so the app reads as one coherent product, not 30 bolted-on
mini-apps.

**Primary users:** anyone needing a quick, no-signup PDF fix — students,
office workers, freelancers. Optimize for speed-to-task, not exploration.

---

## 2. Design System

### 2.1 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--primary` | #DC2626 (red-600) | Primary actions, active tool icon, brand accent — PDF-red, matches category convention (red = PDF, blue = Word, green = Excel) |
| `--primary-hover` | #B91C1C | Button hover state |
| `--secondary` | #2563EB (blue-600) | Word/Office-related tool icons, links |
| `--success` | #16A34A | Completed/download-ready states |
| `--warning` | #D97706 | File-size or password warnings |
| `--destructive` | #DC2626 | Delete/remove-page actions, errors |
| `--background` | #FFFFFF / #0B0B0C (dark) | Page background |
| `--surface` | #F8FAFC / #18181B (dark) | Cards, upload dropzones |
| `--border` | #E2E8F0 / #27272A (dark) | Card borders, dividers |
| `--foreground` | #0F172A / #F4F4F5 (dark) | Body text |
| `--muted-foreground` | #64748B / #A1A1AA (dark) | Secondary/helper text |

Light and dark themes both required (Radix + Tailwind CSS variables, using
the existing `next-themes` dependency already in the project).

### 2.2 Typography

- **Font:** Inter (system-ui fallback stack) — already common in Radix-based
  apps, free, excellent legibility at small sizes for file names/metadata.
- **Scale:** `text-3xl/bold` page titles → `text-xl/semibold` section
  headers → `text-base` body → `text-sm` helper/meta text → `text-xs` file
  size/timestamp labels.
- **Weight usage:** 600–700 for headings and CTAs only; body stays 400.

### 2.3 Spacing & Layout

- 8px base spacing unit (Tailwind default scale).
- Max content width: `max-w-5xl` for tool workspace pages, `max-w-7xl` for
  the tool-grid landing page.
- Card radius: `rounded-xl` (12px) throughout — dropzones, tool cards,
  result panels.
- Consistent 24px card padding on desktop, 16px on mobile.

### 2.4 Core Components (Radix primitives already in the project)

| Component | Radix primitive | Notes |
|---|---|---|
| Tool card | `Card` (custom) | Icon + name + one-line description, used on landing grid |
| Upload dropzone | Custom + `Progress` | Drag-and-drop, click-to-browse, shows filename/size once dropped |
| File list | Custom list + `Checkbox` | For multi-file tools (merge, image-to-PDF); drag-reorder |
| Page thumbnail grid | Custom + `Checkbox`/`Toggle` | For remove/extract/organize/rotate/crop — visual page picker is the single most-reused component across ~8 tools |
| Tool options panel | `RadioGroup`, `Select`, `Slider`, `Switch` | Per-tool config (rotation angle, compression level, watermark opacity) |
| Progress/processing state | `Progress` + `Toast` (sonner) | Shown during server processing |
| Result panel | `Card` + `Button` | Download button, "process another file" reset action |
| Nav | `NavigationMenu` or simple sidebar | Category-grouped tool list (Organize, Convert, Edit, Security, AI) |
| Command palette | `cmdk` (already a dependency) | Quick "jump to tool" search, `⌘K` |

### 2.5 Iconography

- `lucide-react` (already a dependency). One consistent icon per tool,
  reused identically on the landing card, the sidebar nav entry, and the
  tool page header, so users learn the icon-to-tool mapping once.

---

## 3. Screen Inventory

| # | Screen | Purpose |
|---|---|---|
| 1 | **Landing / Tool Grid** | Hero + search + tool cards grouped by category (Organize PDF, Convert to PDF, Convert from PDF, Edit, Security, AI Tools) |
| 2 | **Tool Workspace (generic template)** | Shared 3-step layout: Upload → Configure → Download. Every one of the ~30 tools reuses this template with a swapped-in "Configure" panel |
| 3 | **Page-picker Workspace (variant)** | For tools needing per-page selection (remove/extract/organize/rotate/crop): thumbnail grid replaces/extends the Configure step |
| 4 | **Processing State** | Full-panel loading state with progress bar + cancel option |
| 5 | **Result / Download** | Success state, download button, file size before/after (for compress), "start another" CTA |
| 6 | **Error State** | Corrupt file, password-protected file needing unlock first, file-too-large — same panel shape as Result, different tone |
| 7 | **History (if persisted via @workspace/db)** | Recent conversions, re-download within retention window |
| 8 | **Settings** | Theme toggle, default output preferences |

Category groups for the landing grid (matches iLovePDF's own IA, which users
already have a mental model for):
- **Organize PDF** — Merge, Split, Remove pages, Extract pages, Organize, Rotate
- **Convert to PDF** — Word/PPT/Excel/JPG/HTML to PDF, Scan to PDF
- **Convert from PDF** — PDF to Word/PPT/Excel/JPG/Markdown, PDF to PDF/A
- **Edit PDF** — Edit, Add page numbers, Add watermark, Crop, PDF Forms
- **PDF Security** — Protect, Unlock, Sign, Redact
- **AI Tools** — AI Summarizer, Translate, Compare PDF

---

## 4. Interaction States (define for every tool template)

Every tool workspace must design all five states, not just the happy path:
1. **Empty** — dropzone only, no file yet
2. **File selected** — filename, size, thumbnail preview, Configure step unlocked
3. **Configuring** — tool-specific options visible, primary CTA active
4. **Processing** — progress bar, disabled inputs
5. **Complete** — download-ready, with a clear "process another" reset

---

## 5. Responsive Behavior

- Landing grid: 4 columns desktop → 2 columns tablet → 1 column mobile.
- Tool workspace: single-column, full-width on mobile; dropzone and options
  panel side-by-side (60/40 split) on desktop ≥1024px.
- Page-picker thumbnail grid: 6 columns desktop → 3 columns mobile,
  horizontally scrollable on very small screens if needed.

---

## 6. Accessibility Notes

- All dropzones must have a keyboard-accessible "Browse files" fallback button.
- Page-picker thumbnails need visible focus rings and are operable via
  keyboard (arrow keys + space to toggle selection).
- Color is never the only signal for state (pair success/error color with an
  icon and text label).
- Minimum 4.5:1 contrast for body text in both themes.

---

## 7. Using This Spec with Stitch

Feed Stitch the companion prompt (provided separately) one screen at a time
— start with the Landing/Tool Grid, then the generic Tool Workspace template,
then the Page-picker variant — rather than asking for all ~8 screens in one
generation. Carry the color/typography tokens from Section 2 into every
follow-up prompt so Stitch keeps screens visually consistent. Export each
approved screen to code or Figma and hand it to the frontend implementation
step, mapping Stitch's output components back to the Radix primitives in
Section 2.4 rather than introducing a new component library.
