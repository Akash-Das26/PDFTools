# PDFTools — UI Non-Regression Rules

These rules exist because this app has ~30 tools sharing a handful of
templates. A change made for one tool silently breaks or diverges from the
other 29 unless it's checked against this list first. Read this before
touching anything in `artifacts/pdftools`, and check every PR against it
before merging.

---

## 1. Design tokens are locked — don't improvise

The canonical tokens live in **`precision_pdf_utility` (light) and its
embedded `dark-*` values (dark)** — from the Stitch export. Do not:
- Introduce a new hex value for primary/secondary/success/warning/destructive
  anywhere. If a screen needs a color not in the token set, that's a sign the
  token set needs updating (as a deliberate, reviewed change) — not a license
  to hardcode `#some-new-color` inline.
- Use arbitrary Tailwind values (`text-[#xxxxxx]`, `bg-[#xxxxxx]`) for brand
  colors. Use the named token (`text-primary`, `bg-surface-container`, etc.)
  so a future palette change updates everywhere at once.
- Mix in colors from an alternate/unused theme file. (This exact bug shipped
  once already: the `obsidian_slate` theme leaked a salmon `#ffb4ab` accent
  into a dark screen that was supposed to use the real brand red `#DC2626`.
  `obsidian_slate` has been deleted — if a new alternate theme exploration
  gets added later, it must be clearly marked unused and never merged into a
  real screen's classes.)

Reference: colors, typography, spacing, radii — see
`PDFTools-Frontend-Design.md`, Section 2.

---

## 2. One icon per tool, everywhere, forever

Every tool has exactly one `lucide-react` icon. That icon must be identical
on:
- its landing-page card
- its sidebar/nav entry (if applicable)
- its tool workspace page header
- any reference to it from another screen (e.g. "Next Suggested Workflows")

Before adding or editing a tool, grep the codebase for its name and confirm
every existing reference uses the same icon. (This exact bug shipped once:
Compress PDF used three different icons — `zoom_in_map`, `tune`, and
`compress` — across three screens. Now standardized on `compress`
everywhere.)

---

## 3. Every tool must appear on the landing page — no orphans

If a tool has a workspace page, it must have a card on the landing grid, in
the correct category, and the category's tool count must match the actual
number of cards. Before merging any new tool:
- [ ] Landing page has a card for it
- [ ] Card is in the right category section
- [ ] Category's "N Tools" badge is updated
- [ ] Card links to the correct route

(This exact bug shipped once: Compress PDF had two full workspace screens
built but no landing-page card, making it unreachable.)

---

## 4. New tools reuse an existing template — don't invent a fourth layout

There are exactly two approved tool-workspace layouts:
- **Generic stepper flow** (Upload → Configure → Download, single column,
  used by most simple tools — rotate, watermark, page numbers, etc.)
- **Split-pane / page-picker** (canvas or thumbnail grid on the left,
  configuration on the right — used by tools needing visual page selection:
  remove, extract, organize, rotate-per-page, crop)

A new tool picks whichever of these two fits. It does not get a bespoke
third layout unless there's a genuine, reviewed reason no existing template
works — and if that happens, the new layout becomes a third approved
template that other similar tools should then also adopt, not a one-off.

---

## 5. Every tool workspace needs all five interaction states

Before a tool ships, confirm it has a designed and implemented:
1. Empty (no file yet)
2. File selected (preview + Configure step unlocked)
3. Configuring (options visible, primary CTA active)
4. Processing (progress bar, inputs disabled)
5. Complete (download-ready + "process another" reset)

A tool that only handles the happy path (skips loading/error states) is not
done, even if the demo works.

---

## 6. Component reuse — don't fork a Radix primitive

Check `artifacts/pdftools/src/components` before writing a new component.
If a Card, Dropzone, PageThumbnail, or ProgressBar-like component already
exists, extend or reuse it. Do not write a second version with slightly
different props because it was faster than reading the existing one — this
is exactly how the icon and landing-page-orphan bugs above happened: pieces
built in isolation without checking what already existed.

---

## 7. Light and dark theme are both mandatory, always

Any new screen or component must be checked in both themes before merging.
"I'll add dark mode later" is not acceptable — dark-only or light-only
components immediately look broken next to the rest of the app, and "later"
tends to mean "never, until a user reports it."

---

## 8. Before merging any UI change, confirm:

- [ ] No new hardcoded color hex values (Rule 1)
- [ ] Icon matches everywhere the tool is referenced (Rule 2)
- [ ] Tool appears on the landing page in the right category (Rule 3)
- [ ] Layout matches one of the two approved templates (Rule 4)
- [ ] All five interaction states are implemented (Rule 5)
- [ ] Reused existing components where they exist (Rule 6)
- [ ] Verified in both light and dark theme (Rule 7)
- [ ] `FEATURES.md` (if present) is updated to reflect the change

If a change can't check every box, it's not ready to merge — flag what's
missing rather than merging with a silent gap.
