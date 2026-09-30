/* Batch 7 (PDF Form Filler + PDF to Excel + Translate PDF) end-to-end verification:
   the field inventory read before anything is filled and the filled values proven
   by reading them back out of the flattened output, the ruled-table detector and
   its honest refusal of a table-less document, and the translator's contract.
   The translate section is key-aware: with OPENAI_API_KEY set (the driver sources
   .env, so the suite and the server always agree) it exercises the live model
   path — a real run whose output must differ from the English source — while
   without a key it asserts the honest 503 instead. The spec ↔ router coupling
   check from Batch 6 is repeated with the new paths counted in. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { writePng } from "./lib/png.mjs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURES = OUT + "fixtures/";
const FORM_PDF = FIXTURES + "form.pdf";
const TABLE_PDF = FIXTURES + "table.pdf";
const NOTFORM_PDF = FIXTURES + "notform.pdf";
const TRANSLATE_PDF = FIXTURES + "translate.pdf";
const PDF_FIXTURE = FIXTURES + "fixture.pdf";
const TEXTLESS_PNG = "/tmp/batch7-textless.png";
const TEXTLESS_PDF = "/tmp/batch7-textless.pdf";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch7";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9894", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9894/json/list")).json();
    const p = list.find((t) => t.type === "page");
    if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 1;
const pending = new Map();
const pageErrors = [];
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown")
    pageErrors.push(m.params.exceptionDetails.exception?.description ?? "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    pageErrors.push(m.params.args.map((a) => a.value ?? a.description ?? "?").join(" "));
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
};

await send("Page.enable"); await send("Runtime.enable"); await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `\n        actual   ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`}`);
};

async function waitFor(selector, tries = 70) {
  for (let i = 0; i < tries; i++) {
    await sleep(300);
    try { if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return; } catch {}
  }
  console.log("PAGE ERRORS at waitFor timeout:");
  for (const e of pageErrors) console.log("  " + e);
  throw new Error("no render: " + selector);
}
async function openThemed(url, selector, mode) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
  for (let attempt = 0; attempt < 2; attempt++) {
    await send("Page.navigate", { url });
    await sleep(1200);
    try { await evaluate("localStorage.clear()"); } catch {}
    await send("Page.reload");
    try { await waitFor(selector); break; } catch (e) { if (attempt === 1) throw e; }
  }
  await sleep(700);
}
async function uploadFiles(files, selector = '[data-testid="input-file"]') {
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
  await sleep(1500);
}
const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.click()`);
const type = (sel, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
const checked = (sel) => evaluate(`document.querySelector('${sel} [data-state="checked"], ${sel}[data-state="checked"]') !== null`);
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch7-${name}.png`, Buffer.from(r.data, "base64"));
}

const bytes = (path) => readFileSync(path);

// The live branch's no-text-layer input: a solid-gradient PNG (nothing for
// extraction to find) composed into a PDF through the images tool.
writePng(TEXTLESS_PNG, 600, 800, "solid");

/** The JSON error message, parsed before the response body is consumed. */
function errorMessage(raw, res) {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return "";
  try { return JSON.parse(raw.toString("utf8")).error ?? ""; } catch { return ""; }
}

async function post(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes(file)]), file.split("/").pop());
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const res = await fetch(`${API}/api${path}`, { method: "POST", body: form });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: raw,
    disposition: res.headers.get("content-disposition") ?? "",
    contentType: res.headers.get("content-type") ?? "",
    error: errorMessage(raw, res),
    json: () => { try { return JSON.parse(raw.toString("utf8")); } catch { return null; } } };
}

/* ── 1. FORM INSPECT: the inventory the panel is built from ──────────────── */
const inspect = await post("/pdf/pdf-form-inspect", FORM_PDF);
check("api form-inspect: 200", inspect.status, 200);
check("api form-inspect: five fields listed", inspect.json()?.fieldCount, 5);
const fieldNames = (inspect.json()?.fields ?? []).map((f) => f.name);
check("api form-inspect: the names the document really has",
      fieldNames, ["full name", "email", "newsletter", "meal preference", "ticket id"]);
const byName = Object.fromEntries((inspect.json()?.fields ?? []).map((f) => [f.name, f]));
check("api form-inspect: the checkbox reports unchecked", byName["newsletter"]?.checked, false);
check("api form-inspect: the dropdown reports its choices",
      byName["meal preference"]?.options, ["standard", "vegetarian", "vegan", "gluten-free"]);
check("api form-inspect: the read-only field is marked", byName["ticket id"]?.readOnly, true);
check("api form-inspect: the prefilled value is reported", byName["ticket id"]?.value, "EVT-2026-0001");

const noFields = await post("/pdf/pdf-form-inspect", NOTFORM_PDF);
check("api form-inspect: a fieldless PDF is refused", noFields.status, 422);
check("api form-inspect: the refusal says the document has no fields",
      noFields.error.includes("no form fields"), true);

/* ── 2. FORM FILLER: fill, flatten, and read the values back ─────────────── */
const fill = await post("/pdf/pdf-form-filler", FORM_PDF, {
  values: JSON.stringify({ "full name": "Ada Lovelace", email: "ada@example.com", newsletter: true, "meal preference": "vegetarian" }),
  flatten: "true",
});
check("api form-filler: 200", fill.status, 200);
check("api form-filler: answers with a PDF", fill.contentType.includes("application/pdf"), true);
check("api form-filler: named after the upload, marked filled-flat",
      fill.disposition.includes("form-filled-flat.pdf"), true);

// The proof that filling worked: after flatten the values are page content, so
// extract-text reads them back as ordinary text.
async function extractTextOf(data) {
  const form = new FormData();
  form.append("file", new Blob([data]), "document.pdf");
  const res = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: form });
  return { status: res.status, text: await res.text() };
}
const flatText = await extractTextOf(fill.bytes);
check("api form-filler: the filled name is in the flattened output",
      flatText.text.includes("Ada Lovelace"), true);
check("api form-filler: the dropdown answer survives as page text",
      flatText.text.includes("vegetarian"), true);

// Field count drops to zero after flatten — probed ground truth from this session.
async function inspectStatus(data) {
  const form = new FormData();
  form.append("file", new Blob([data]), "document.pdf");
  const res = await fetch(`${API}/api/pdf/pdf-form-inspect`, { method: "POST", body: form });
  return { status: res.status, json: res.status === 200 ? await res.json() : null };
}
const flatInspect = await inspectStatus(fill.bytes);
check("api form-filler: flatten removes the fields", flatInspect.status, 422);

// The checkbox proof: a check mark is drawn as vector paths, not text, so the
// flattened output's proof is the no-flatten round-trip — the filled state must
// survive a save/reload and be reported by a fresh inspection.
const noFlatten = await post("/pdf/pdf-form-filler", FORM_PDF, {
  values: JSON.stringify({ email: "grace@example.com", newsletter: true }),
  flatten: "false",
});
check("api form-filler (no flatten): 200", noFlatten.status, 200);
const editableInspect = await inspectStatus(noFlatten.bytes);
check("api form-filler (no flatten): still an editable form with its fields",
      editableInspect.json?.fieldCount, 5);
const editableByName = Object.fromEntries((editableInspect.json?.fields ?? []).map((f) => [f.name, f]));
check("api form-filler (no flatten): the typed email survives in the field",
      editableByName["email"]?.value, "grace@example.com");
check("api form-filler (no flatten): the checked box survives the round-trip",
      editableByName["newsletter"]?.checked, true);
const editableText = await extractTextOf(noFlatten.bytes);
check("api form-filler (no flatten): values live in the field, not yet on the page",
      editableText.text.includes("grace@example.com"), false);

const unknownField = await post("/pdf/pdf-form-filler", FORM_PDF, {
  values: JSON.stringify({ "adress": "typo" }),
});
check("api form-filler: an unknown field name is refused", unknownField.status, 422);
check("api form-filler: the refusal names the fields the form does have",
      unknownField.error.includes("\"full name\"") && unknownField.error.includes("adress"), true);

const badChoice = await post("/pdf/pdf-form-filler", FORM_PDF, {
  values: JSON.stringify({ "meal preference": "meat" }),
});
check("api form-filler: a choice the dropdown lacks is refused", badChoice.status, 400);
check("api form-filler: the refusal lists the real choices",
      badChoice.error.includes("vegetarian") && badChoice.error.includes("meat"), true);

const badType = await post("/pdf/pdf-form-filler", FORM_PDF, {
  values: JSON.stringify({ "full name": true }),
});
check("api form-filler: a boolean sent to a text field is refused", badType.status, 400);

const notJson = await post("/pdf/pdf-form-filler", FORM_PDF, { values: "hello" });
check("api form-filler: values that are not JSON are refused", notJson.status, 400);

const nothing = await post("/pdf/pdf-form-filler", FORM_PDF, { values: "{}" });
check("api form-filler: an empty fill is refused, not returned unchanged", nothing.status, 400);
check("api form-filler: the refusal asks for at least one value",
      nothing.error.includes("at least one"), true);

// A flattened fill is final: extract-text reads the values back as page text,
// and the checkbox proof is the no-flatten round-trip below, not the flatten.

/* ── 3. PDF TO EXCEL: ruled tables in, CSV out ───────────────────────────── */
const excel = await post("/pdf/pdf-to-excel", TABLE_PDF);
check("api pdf-to-excel: 200", excel.status, 200);
check("api pdf-to-excel: answers as a zip", excel.contentType.includes("application/zip"), true);

const noTables = await post("/pdf/pdf-to-excel", PDF_FIXTURE);
check("api pdf-to-excel: a document with no ruled tables is refused", noTables.status, 422);
check("api pdf-to-excel: the refusal explains the ruled-table limit",
      noTables.error.includes("ruled"), true);

// One table per page, so a page selection leaves a single table -> the
// single-CSV download with assertable bytes. Page 1 runs the default comma,
// page 2 a semicolon: between them the delimiter option is proven both ways.
// (The detector's row pivots sit on the rules, so a header row whose baseline
// hugs the top rule is not always returned — the assertions use body rows.)
const pageOne = await post("/pdf/pdf-to-excel", TABLE_PDF, { pages: "1" });
check("api pdf-to-excel (pages=1): 200", pageOne.status, 200);
check("api pdf-to-excel (pages=1): a single-table answer is a .csv download",
      pageOne.disposition.includes("table.csv"), true);
check("api pdf-to-excel (pages=1): the default comma separates the cells",
      pageOne.bytes.includes(Buffer.from("Widget,4,19.99")), true);
check("api pdf-to-excel (pages=1): the header row comes through with all columns",
      pageOne.bytes.includes(Buffer.from("Item,Qty,Price")), true);
const pageTwo = await post("/pdf/pdf-to-excel", TABLE_PDF, { pages: "2", delimiter: ";" });
check("api pdf-to-excel (pages=2): 200", pageTwo.status, 200);
check("api pdf-to-excel (pages=2): the semicolon option reaches the bytes",
      pageTwo.bytes.includes(Buffer.from("North;120000;4.5%")), true);
check("api pdf-to-excel (pages=2): the page-1 table is not in it",
      pageTwo.bytes.includes(Buffer.from("Widget")), false);
const allZip = await post("/pdf/pdf-to-excel", TABLE_PDF);
check("api pdf-to-excel: both tables come back zipped",
      allZip.disposition.includes("table-csv.zip"), true);

/* ── 4. TRANSLATE: key-aware — the real model with a key, honest 503 without ─ */
const hasAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
console.log(`        ai key: ${hasAiKey ? "present — exercising the live translate path" : "absent — asserting the honest 503"}`);

const translateBad = await post("/pdf/translate-pdf", TRANSLATE_PDF, { targetLanguage: "klingon" });
check("api translate: an unknown language is rejected before any model call", translateBad.status, 400);

if (!hasAiKey) {
  const translate = await post("/pdf/translate-pdf", TRANSLATE_PDF, { targetLanguage: "french" });
  check("api translate: without a configured key the answer is 503", translate.status, 503);
  check("api translate: the 503 names the fix",
        translate.error.includes("OPENAI_API_KEY"), true);
  const emptyDoc = await post("/pdf/translate-pdf", NOTFORM_PDF, { targetLanguage: "french" });
  check("api translate: config is checked before extraction (no text, no key → still 503)", emptyDoc.status, 503);
} else {
  // The real thing. The assertion is that the output changed — the fixture's
  // known English wording must NOT survive — not that it matches any exact
  // wording a model might vary.
  const translate = await post("/pdf/translate-pdf", TRANSLATE_PDF, { targetLanguage: "french" });
  check("api translate (live): 200", translate.status, 200);
  const payload = translate.json() ?? {};
  check("api translate (live): at least one page translated, none failed",
        (payload.pages?.length ?? 0) >= 1 && payload.failedPages === 0, true);
  check("api translate (live): the target language is echoed", payload.targetLanguage, "french");
  check("api translate (live): the markdown carries the first page heading",
        String(payload.markdown ?? "").includes("## Page 1"), true);
  // Echo detection rides English FUNCTION words (" the ", " and ", " are ",
  // " with ", " of "): no French sentence contains them, while an echoed
  // English line is full of them. The old detector matched a body-text
  // substring the fixture repeated on EVERY page, so page 1's genuine English
  // wording made every relapse page look twice as bad and the majority rule
  // flaked; per-page-unique probe nouns (almanac, driftwood, …) plus this
  // detector fix the false-positive half. The tolerance half stays: the live
  // model provably relapses on INDIVIDUAL lines at random (probed: headings
  // always translate, a body line came back raw English on a different page
  // every run — the documented Item-25 noise), so a page-majority rule still
  // fails a pipeline that stopped translating while surviving one noisy page.
  const ENGLISH_MARKERS = [" the ", " and ", " are ", " with ", " of "];
  const pages = payload.pages ?? [];
  const echoPages = pages.filter((p) => {
    const t = " " + String(p.text ?? "").replace(/\s+/g, " ") + " ";
    return ENGLISH_MARKERS.some((m) => t.includes(m));
  }).length;
  check("api translate (live): the pipeline translates — echo pages stay a minority",
        pages.length >= 1 && echoPages * 2 <= pages.length, true);
  const pageText = String(payload.pages?.[0]?.text ?? "");
  console.log(`        translation, page 1 line 1: ${JSON.stringify(pageText.split("\n")[0]?.slice(0, 70))}`);
  // notform.pdf is only fieldless — it has plenty of text, so it translates
  // fine (200 is correct). The real no-text-layer case needs an image-only
  // PDF: compose one from a solid PNG through images-to-pdf, which (like every
  // multi-file route) takes its upload under `files`, not `file` — the same
  // field-name distinction the batch6 transport bug turned on.
  const imageForm = new FormData();
  imageForm.append("files", new Blob([bytes(TEXTLESS_PNG)]), "textless.png");
  const imageOnly = await fetch(`${API}/api/pdf/images-to-pdf`, { method: "POST", body: imageForm });
  writeFileSync(TEXTLESS_PDF, Buffer.from(await imageOnly.arrayBuffer()));
  check("api translate (live): setup — composed a text-free image PDF",
        imageOnly.status, 200);
  const emptyDoc = await post("/pdf/translate-pdf", TEXTLESS_PDF, { targetLanguage: "french" });
  check("api translate (live): a text-free document is a 422, not an empty translation", emptyDoc.status, 422);
}

/* ── 5. Catalog and the spec ↔ router coupling ───────────────────────────── */
const tools = await (await fetch(`${API}/api/tools`)).json();
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
for (const id of ["pdf-form-filler", "pdf-to-excel", "translate-pdf"]) {
  check(`catalog: ${id} is implemented`, byId[id]?.status, "implemented");
}
check("catalog: pdf-form-filler points at its route", byId["pdf-form-filler"].route, "/api/pdf/pdf-form-filler");
check("catalog: pdf-to-excel points at its route", byId["pdf-to-excel"].route, "/api/pdf/pdf-to-excel");
check("catalog: translate-pdf points at its route", byId["translate-pdf"].route, "/api/pdf/translate-pdf");
check("catalog: implemented count is 31", tools.filter((t) => t.status === "implemented").length, 31);
check("catalog: the one partial is pdf-to-markdown",
      tools.filter((t) => t.status === "partial").map((t) => t.id), ["pdf-to-markdown"]);
check("catalog: nothing pending any more", tools.filter((t) => t.status === "pending").length, 0);
check("catalog: still 32 tools", tools.length, 32);

// Open Item 12, machine-checked both ways (Batch 6 introduced this; the counts
// move with every batch and must keep matching).
const routerSource = readFileSync(new URL("../../artifacts/api-server/src/routes/pdf.ts", import.meta.url), "utf8");
const specSource = readFileSync(new URL("../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const routePaths = [...routerSource.matchAll(/router\.post\(\s*"([^"]+)"/g)].map((m) => "/api" + m[1]);
const specPaths = [...specSource.matchAll(/^  (\/pdf\/[a-z0-9-]+):$/gm)].map((m) => "/api" + m[1]);
check("spec: every POST /pdf/* route is in openapi.yaml",
      routePaths.filter((path) => !specPaths.includes(path)), []);
check("spec: every documented /pdf/* path is a real route",
      specPaths.filter((path) => !routePaths.includes(path)), []);
console.log(`        routes: ${routePaths.length}, spec paths: ${specPaths.length}`);

/* ── 6. LANDING: the three cards are wired; pending examples updated ─────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-pdf-form-filler"]', "light");
for (const id of ["pdf-form-filler", "pdf-to-excel", "translate-pdf"]) {
  check(`landing: ${id} card renders`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
  check(`landing: ${id} is no longer badged pending`,
        await evaluate(`!document.querySelector('[data-testid="badge-pending-${id}"]')`), true);
}
check("landing: pdf-to-word is no longer badged pending (wired in Batch 8)",
      await evaluate(`!document.querySelector('[data-testid="badge-pending-pdf-to-word"]')`), true);
check("landing: sign is no longer badged pending (wired in Batch 8)",
      await evaluate(`!document.querySelector('[data-testid="badge-pending-sign"]')`), true);

/* ── 7. FORM FILLER panel: inspection-driven inputs, real run ────────────── */
await openThemed(`${BASE}/tools/pdf-form-filler`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FORM_PDF]);
await waitFor('[data-testid="form-field-full name"]');
check("form-filler: the panel is built from the document's real fields",
      await evaluate(`!!document.querySelector('[data-testid="form-field-email"]') &&
                      !!document.querySelector('[data-testid="form-field-meal preference"]')`), true);
check("form-filler: flatten is on by default", await checked('[data-testid="form-flatten"]'), true);
await type('[data-testid="form-field-full name"]', "Ada Lovelace");
await type('[data-testid="form-field-email"]', "ada@example.com");
await click('[data-testid="form-field-newsletter"]');
await shot("form-filler-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("form-filler: a real run produces a result", true, true);
check("form-filler: download is the filled-flat PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith("-filled-flat.pdf")`), true);
await shot("form-filler-complete");

/* ── 8. PDF TO EXCEL panel: delimiter cards, real run ────────────────────── */
await openThemed(`${BASE}/tools/pdf-to-excel`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([TABLE_PDF]);
await waitFor('[data-testid="pdf-to-excel-note"]');
check("pdf-to-excel: three separator cards",
      await evaluate(`document.querySelectorAll('[data-testid^="option-delimiter-"]').length`), 3);
check("pdf-to-excel: the note discloses the ruled-table limit",
      await evaluate(`document.querySelector('[data-testid="pdf-to-excel-note"]').textContent.includes("ruled")`), true);
await shot("pdf-to-excel-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-excel: a real run produces a result", true, true);
check("pdf-to-excel: download is a CSV or a ZIP of them",
      await evaluate(`const n = document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? ""; n.endsWith(".csv") || n.endsWith(".zip")`), true);
await shot("pdf-to-excel-complete");

/* ── 9. TRANSLATE panel: language picker, key-aware run ─────────────── */
await openThemed(`${BASE}/tools/translate-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([TRANSLATE_PDF]);
await waitFor('[data-testid="translate-note"]');
check("translate: the note discloses that layout is not rebuilt",
      await evaluate(`document.querySelector('[data-testid="translate-note"]').textContent.includes("not rebuilt")`), true);
check("translate: the note says the result is a Markdown download",
      await evaluate(`document.querySelector('[data-testid="translate-note"]').textContent.includes("Markdown")`), true);
await shot("translate-configured");
await click('[data-testid="button-process"]');
if (!hasAiKey) {
  await waitFor('[data-testid="error-panel"]');
  check("translate: the unconfigured key surfaces as an error panel, not a hang",
        await evaluate(`(document.querySelector('[data-testid="error-panel"]')?.textContent ?? "").includes("OPENAI_API_KEY")`), true);
  await shot("translate-unconfigured");
} else {
  // One model call per page, plus upstream 503 retries — hence the generous
  // wait compared to local tools (observed live: 68 s for six pages).
  await waitFor('[data-testid="result-panel"]', 600);
  check("translate (live): a real run produces a result", true, true);
  check("translate (live): the download is named for the panel's language",
        await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").startsWith("translation-")`), true);
  await shot("translate-complete");
}

/* ── 10. DARK THEME ───────────────────────────────────────────────────────── */
await openThemed(`${BASE}/tools/pdf-form-filler`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([FORM_PDF]);
await waitFor('[data-testid="form-field-full name"]');
check("form-filler: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("form-filler-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
