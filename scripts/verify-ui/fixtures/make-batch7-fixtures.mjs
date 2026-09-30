/* Generates the ruled-table and AcroForm fixtures the Batch 7 suite fills and
   extracts. Run via `bash scripts/verify-ui/fixtures/make-batch7-fixtures.sh`,
   which executes this inside artifacts/api-server — the only workspace whose
   node_modules resolves @cantoo/pdf-lib. Outputs land in fixtures/ next to the
   committed Office fixtures. */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";

// @cantoo/pdf-lib resolves only from the api-server workspace, so the require
// is anchored at its package.json rather than at this file's location.
const require = createRequire(new URL("../../../artifacts/api-server/package.json", import.meta.url));
const { PDFDocument, StandardFonts, rgb } = require("@cantoo/pdf-lib");

const OUT = new URL(".", import.meta.url).pathname;

/* ── form.pdf: a fillable registration form ──────────────────────────────────
   text field (with a prefilled value), checkbox, dropdown, read-only field. */
const form = await PDFDocument.create();
const page = form.addPage([480, 340]);
const helv = await form.embedFont(StandardFonts.Helvetica);
page.drawText("Event registration", { x: 40, y: 296, size: 16, font: helv });

const pdfForm = form.getForm();
const fullName = pdfForm.createTextField("full name");
fullName.setText("");
fullName.addToPage(page, { x: 150, y: 246, width: 280, height: 22 });
page.drawText("Full name:", { x: 40, y: 250, size: 11, font: helv });

const email = pdfForm.createTextField("email");
email.addToPage(page, { x: 150, y: 210, width: 280, height: 22 });
page.drawText("Email:", { x: 40, y: 214, size: 11, font: helv });

const newsletter = pdfForm.createCheckBox("newsletter");
newsletter.addToPage(page, { x: 150, y: 180, width: 16, height: 16 });
page.drawText("Subscribe to the newsletter:", { x: 40, y: 181, size: 11, font: helv });

const meal = pdfForm.createDropdown("meal preference");
meal.addOptions(["standard", "vegetarian", "vegan", "gluten-free"]);
meal.addToPage(page, { x: 150, y: 140, width: 160, height: 22 });
page.drawText("Meal preference:", { x: 40, y: 144, size: 11, font: helv });

const ticketId = pdfForm.createTextField("ticket id");
ticketId.setText("EVT-2026-0001");
ticketId.enableReadOnly();
ticketId.addToPage(page, { x: 150, y: 100, width: 160, height: 22 });
page.drawText("Ticket (assigned):", { x: 40, y: 104, size: 11, font: helv });

writeFileSync(OUT + "form.pdf", Buffer.from(await form.save()));

/* ── table.pdf: two ruled grids on one page ──────────────────────────────────
   The detector builds its grid from drawn lines, so the fixture draws real
   rules. Two tables on one page exercises the ZIP-per-table output. */
const tdoc = await PDFDocument.create();
// Two ruled tables, ONE PER PAGE: the all-pages run then exercises the ZIP
// output while a `pages=2` run exercises the single-CSV download with its own
// assertable bytes. The detector builds its grid from drawn lines and CLIPS
// anything outside the outer rules, so every column needs both of its rules:
// three columns -> four verticals, with the text just inside each left rule.
const grid = (page, topY, cols, rows, rowH) => {
  for (let i = 0; i <= rows.length; i += 1) {
    const y = topY - i * rowH;
    page.drawLine({ start: { x: cols[0], y }, end: { x: cols[cols.length - 1], y }, thickness: 0.7, color: rgb(0, 0, 0) });
  }
  for (const x of cols) {
    page.drawLine({ start: { x, y: topY }, end: { x, y: topY - rows.length * rowH }, thickness: 0.7, color: rgb(0, 0, 0) });
  }
  rows.forEach((row, i) => {
    row.forEach((cell, c) => {
      page.drawText(cell, { x: cols[c] + 4, y: topY - i * rowH - rowH + 6, size: 11, font: helv });
    });
  });
};
const COLUMNS = [40, 190, 320, 480];
const tpage1 = tdoc.addPage([520, 420]);
grid(tpage1, 380, COLUMNS, [
  ["Item", "Qty", "Price"],
  ["Widget", "4", "19.99"],
  ["Gadget", "2", "5.50"],
  ["Sprocket", "10", "1.25"],
], 24);
const tpage2 = tdoc.addPage([520, 420]);
grid(tpage2, 380, COLUMNS, [
  ["Region", "Revenue", "Growth"],
  ["North", "120000", "4.5%"],
  ["South", "98000", "2.1%"],
], 24);
writeFileSync(OUT + "table.pdf", Buffer.from(await tdoc.save()));

/* ── notform.pdf: text only, no fields — the 422 path ──────────────────────── */
const flat = await PDFDocument.create();
const fpage = flat.addPage([400, 200]);
fpage.drawText("This document has no interactive fields at all.", { x: 40, y: 150, size: 12, font: helv });
fpage.drawText("It is here so the suite can prove the filler refuses it.", { x: 40, y: 130, size: 12, font: helv });
writeFileSync(OUT + "notform.pdf", Buffer.from(await flat.save()));

/* ── translate.pdf: the translation-stable input for batch7's live branch ────
   Six pages, each with its own three probe nouns and EIGHT DISTINCT body
   sentences: the first draft drew one repeated template per page, and the
   model treated the repetition as copy-through boilerplate — relapsing whole
   pages (probed 2026-09-30) — while the always-unique heading translated on
   every run. Natural, heterogeneous prose gives the model nothing to
   copy-through. The nouns only vary vocabulary; batch7's echo detector keys
   on English function words, which no French sentence contains. */
const TRANSLATE_PROBES = [
  ["almanac", "benevolent", "cartography"],
  ["driftwood", "estuary", "fennel"],
  ["gossamer", "harbor", "meadow"],
  ["lantern", "orchard", "granite"],
  ["beacon", "willow", "tempest"],
  ["compass", "thicket", "glacier"],
];
const TRANSLATE_LINES = [
  (w1, w2, w3, n) => `The ${w1} sits on the top shelf of the study, past the ${w2}.`,
  (w1, w2, w3, n) => `A single ${w3} was recorded near the northern ridge in ${1900 + n}.`,
  (w1, w2, w3, n) => `Every ${w2} in the collection carries a handwritten number.`,
  (w1, w2, w3, n) => `The catalogue lists one ${w1} and two ${w3} specimens from the same donor.`,
  (w1, w2, w3, n) => `Nobody in the village remembers where the ${w2} came from.`,
  (w1, w2, w3, n) => `In autumn the ${w3} changes colour almost overnight, or so the story goes.`,
  (w1, w2, w3, n) => `A careful drawing of the ${w1} appears on page ${n} of the appendix.`,
  (w1, w2, w3, n) => `The museum labels each ${w2} by hand before the season opens.`,
];
const tdoc2 = await PDFDocument.create();
TRANSLATE_PROBES.forEach((probes, p) => {
  const tp = tdoc2.addPage([520, 420]);
  tp.drawText(`Translation verification document — page ${p + 1}`, { x: 40, y: 376, size: 14, font: helv });
  for (let line = 0; line < TRANSLATE_LINES.length; line += 1) {
    tp.drawText(TRANSLATE_LINES[line](probes[0], probes[1], probes[2], p + 1), {
      x: 40, y: 340 - line * 24, size: 11, font: helv,
    });
  }
});
writeFileSync(OUT + "translate.pdf", Buffer.from(await tdoc2.save()));

console.log("batch7 fixtures written:", ["form.pdf", "table.pdf", "notform.pdf", "translate.pdf"].map((n) => OUT + n).join(", "));
