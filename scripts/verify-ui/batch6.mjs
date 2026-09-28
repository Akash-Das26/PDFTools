/* Batch 6 (Scan to PDF + HTML to PDF) end-to-end verification:
   the captured pages composed into one document, the optional OCR text layer
   proven by reading the text back out, the HTML conversion and its PDF/A export,
   and the container guards that stop the engine from "converting" something that
   is not what the tool claims (a plain text file named .html converts happily —
   through the *Writer* filter — unless the endpoint refuses it first). */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { writePng } from "./lib/png.mjs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURES = OUT + "fixtures/";
const PDF_FIXTURE = FIXTURES + "fixture.pdf";
const CAPTURE_A = "/tmp/batch6-capture-a.png";
const CAPTURE_B = "/tmp/batch6-capture-b.png";
const BLANK = "/tmp/batch6-blank.png";
const PAGE_PNG = "/tmp/batch6-page1.png";
const HTML_FILE = "/tmp/batch6-page.html";
const FAKE_HTML = "/tmp/batch6-not-html.html";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch6";
rmSync(PROFILE, { recursive: true, force: true });

const HTML_MARKUP =
  "<!doctype html><html><head><title>Batch 6</title></head><body>" +
  "<h1>Batch 6 HTML fixture</h1><p>Paragraph text for the converter.</p>" +
  "</body></html>";
writeFileSync(HTML_FILE, HTML_MARKUP);
writeFileSync(FAKE_HTML, "This is not HTML at all, just a sentence.\n");
// A flat capture: nothing for OCR to recognise, which is its own assertion.
writePng(CAPTURE_A, 600, 800, "solid");
writePng(CAPTURE_B, 600, 800, "solid");
writePng(BLANK, 600, 800, "solid");

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9893", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9893/json/list")).json();
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
  await sleep(1200);
}
const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.click()`);
const checked = (sel) => evaluate(`document.querySelector('${sel} [data-state="checked"], ${sel}[data-state="checked"]') !== null`);
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch6-${name}.png`, Buffer.from(r.data, "base64"));
}

const bytes = (path) => readFileSync(path);

/** The JSON error message, parsed before the response body is consumed. */
function errorMessage(raw, res) {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return "";
  try { return JSON.parse(raw.toString("utf8")).error ?? ""; } catch { return ""; }
}

/** POSTs captures as repeated `files` parts. */
async function scan(files, options = {}) {
  const form = new FormData();
  for (const file of files) form.append("files", new Blob([bytes(file)]), file.split("/").pop());
  for (const [key, value] of Object.entries(options)) form.append(key, String(value));
  const res = await fetch(`${API}/api/pdf/scan-to-pdf`, { method: "POST", body: form });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: raw,
    disposition: res.headers.get("content-disposition") ?? "",
    contentType: res.headers.get("content-type") ?? "",
    error: errorMessage(raw, res) };
}

async function html(file, options = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes(file)]), file.split("/").pop());
  for (const [key, value] of Object.entries(options)) form.append(key, String(value));
  const res = await fetch(`${API}/api/pdf/html-to-pdf`, { method: "POST", body: form });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: raw,
    disposition: res.headers.get("content-disposition") ?? "",
    contentType: res.headers.get("content-type") ?? "",
    error: errorMessage(raw, res) };
}

async function pdfInfo(data, name = "document.pdf") {
  const form = new FormData();
  form.append("file", new Blob([data]), name);
  const res = await fetch(`${API}/api/pdf/page-info`, { method: "POST", body: form });
  return await res.json();
}

async function extractText(data, name = "document.pdf") {
  const form = new FormData();
  form.append("file", new Blob([data]), name);
  const res = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: form });
  return { status: res.status, text: res.status === 200 ? await res.text() : "" };
}

/* ── 0. A capture with real text in it, made through the API ─────────────── */
const renderRes = await fetch(`${API}/api/pdf/pdf-to-images`, {
  method: "POST",
  body: (() => {
    const form = new FormData();
    form.append("file", new Blob([bytes(PDF_FIXTURE)]), "fixture.pdf");
    form.append("format", "png");
    form.append("pages", "1");
    form.append("width", "1200");
    return form;
  })(),
});
writeFileSync(PAGE_PNG, Buffer.from(await renderRes.arrayBuffer()));
check("setup: rendered a page of the fixture as a capture", renderRes.status, 200);

/* ── 1. Scan: pages, options, guards ────────────────────────────────────── */
const twoPages = await scan([CAPTURE_A, CAPTURE_B]);
check("api scan-to-pdf (two captures): 200", twoPages.status, 200);
check("api scan-to-pdf: answers with a PDF", twoPages.contentType.includes("application/pdf"), true);
check("api scan-to-pdf: a multi-capture scan is named scan.pdf", twoPages.disposition.includes("scan.pdf"), true);
check("api scan-to-pdf: one page per capture", (await pdfInfo(twoPages.bytes)).pageCount, 2);

const onePage = await scan([CAPTURE_A]);
check("api scan-to-pdf (one capture): named after the capture",
      onePage.disposition.includes("batch6-capture-a.pdf"), true);
check("api scan-to-pdf: one capture is one page", (await pdfInfo(onePage.bytes)).pageCount, 1);

const a4Scan = await scan([CAPTURE_A], { pageSize: "a4", margin: "0" });
const a4Info = await pdfInfo(a4Scan.bytes);
check("api scan-to-pdf (a4): the page-size option reaches the composer",
      [Math.round(a4Info.pages[0].width), Math.round(a4Info.pages[0].height)], [595, 842]);

const marginScan = await scan([CAPTURE_A], { margin: "40" });
check("api scan-to-pdf (fit, 40pt margin): the margin is applied",
      Math.round((await pdfInfo(marginScan.bytes)).pages[0].width), 680);

// pdf-parse frames every extraction with `-- N of M --` page markers, so an
// image-only scan still extracts 200 — the assertion is that nothing lives
// behind the marker.
const plainText = await extractText(onePage.bytes);
check("api scan-to-pdf: a plain scan still extracts (marker only)", plainText.status, 200);
check("api scan-to-pdf: a plain scan carries no text beyond the page marker",
      plainText.text.replace(/^-- \d+ of \d+ --$/gm, "").trim(), "");

const searchable = await scan([PAGE_PNG], { searchable: "true" });
check("api scan-to-pdf (searchable): 200", searchable.status, 200);
check("api scan-to-pdf (searchable): filename says so",
      searchable.disposition.includes("-searchable.pdf"), true);
const searchableText = await extractText(searchable.bytes);
check("api scan-to-pdf (searchable): the text layer is real and searchable",
      searchableText.status === 200 && searchableText.text.includes("verification fixture"), true);
console.log(`        recognised: ${JSON.stringify(searchableText.text.split("\n")[0]?.slice(0, 60))}`);

const noText = await scan([BLANK], { searchable: "true" });
check("api scan-to-pdf (searchable, text-free capture): refused, not returned blank", noText.status, 422);
check("api scan-to-pdf: the refusal names the reason",
      noText.error.includes("No text could be recognised"), true);

const pdfAsCapture = await scan([PDF_FIXTURE]);
check("api scan-to-pdf: a PDF is rejected with the image message", pdfAsCapture.status, 400);
check("api scan-to-pdf: the message names the offending file",
      pdfAsCapture.error.includes("is not a JPG or PNG image"), true);

const noFiles = await fetch(`${API}/api/pdf/scan-to-pdf`, { method: "POST", body: new FormData() });
check("api scan-to-pdf: a request with no captures is rejected", noFiles.status, 400);

const badSize = await scan([CAPTURE_A], { pageSize: "a3" });
check("api scan-to-pdf: an unknown page size is rejected", badSize.status, 400);

/* ── 2. HTML: conversion, PDF/A, guards ─────────────────────────────────── */
const htmlRes = await html(HTML_FILE);
check("api html-to-pdf: 200", htmlRes.status, 200);
check("api html-to-pdf: answers with a PDF", htmlRes.contentType.includes("application/pdf"), true);
check("api html-to-pdf: named after the upload", htmlRes.disposition.includes("batch6-page.pdf"), true);
const htmlText = await extractText(htmlRes.bytes);
check("api html-to-pdf: the markup's text is in the PDF",
      htmlText.text.includes("Batch 6 HTML fixture"), true);
check("api html-to-pdf: plain output carries no PDF/A marker", htmlRes.bytes.includes(Buffer.from("pdfaid")), false);

const htmlPdfa = await html(HTML_FILE, { pdfa: "2b" });
check("api html-to-pdf (pdfa=2b): output carries the PDF/A marker",
      htmlPdfa.bytes.includes(Buffer.from("pdfaid")), true);

const badPdfa = await html(HTML_FILE, { pdfa: "9z" });
check("api html-to-pdf: an unknown PDF/A level is rejected", badPdfa.status, 400);

// Same bytes, .htm extension: the accept list is two extensions, not one.
const htmRes = await fetch(`${API}/api/pdf/html-to-pdf`, {
  method: "POST",
  body: (() => {
    const form = new FormData();
    form.append("file", new Blob([Buffer.from(HTML_MARKUP)]), "page.htm");
    return form;
  })(),
});
check("api html-to-pdf: .htm is accepted as well as .html", htmRes.status, 200);

const fakeRes = await html(FAKE_HTML);
check("api html-to-pdf: a plain text file named .html is rejected", fakeRes.status, 422);
check("api html-to-pdf: the message says no markup was found",
      fakeRes.error.includes("no markup was found"), true);

const pdfToHtml = await html(PDF_FIXTURE);
check("api html-to-pdf: a PDF is rejected", pdfToHtml.status, 400);
check("api html-to-pdf: the message names the accepted extensions",
      pdfToHtml.error.includes(".html and .htm"), true);

/* ── 3. Catalog and the spec ↔ router coupling ──────────────────────────── */
const tools = await (await fetch(`${API}/api/tools`)).json();
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
check("catalog: scan-to-pdf is implemented", byId["scan-to-pdf"].status, "implemented");
check("catalog: scan-to-pdf points at its route", byId["scan-to-pdf"].route, "/api/pdf/scan-to-pdf");
check("catalog: scan-to-pdf asks the browser for the camera", byId["scan-to-pdf"].capture, "environment");
check("catalog: html-to-pdf is implemented", byId["html-to-pdf"].status, "implemented");
check("catalog: html-to-pdf points at its route", byId["html-to-pdf"].route, "/api/pdf/html-to-pdf");
check("catalog: html-to-pdf advertises only what it can take",
      byId["html-to-pdf"].accept, [".html", ".htm"]);
check("catalog: Convert to PDF is complete (6 implemented)",
      tools.filter((t) => t.category === "convert-to" && t.status === "implemented").length, 6);
check("catalog: implemented count is 22", tools.filter((t) => t.status === "implemented").length, 22);
check("catalog: pending count is 9", tools.filter((t) => t.status === "pending").length, 9);
check("catalog: still 32 tools", tools.length, 32);

// Open Item 12: a route the API serves but the spec omits cannot be uploaded by
// the generated client, and a spec path with no route is a lie. Check both ways.
const routerSource = readFileSync(new URL("../../artifacts/api-server/src/routes/pdf.ts", import.meta.url), "utf8");
const specSource = readFileSync(new URL("../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const routePaths = [...routerSource.matchAll(/router\.post\(\s*"([^"]+)"/g)].map((m) => "/api" + m[1]);
const specPaths = [...specSource.matchAll(/^  (\/pdf\/[a-z0-9-]+):$/gm)].map((m) => "/api" + m[1]);
check("spec: every POST /pdf/* route is in openapi.yaml",
      routePaths.filter((path) => !specPaths.includes(path)), []);
check("spec: every documented /pdf/* path is a real route",
      specPaths.filter((path) => !routePaths.includes(path)), []);
console.log(`        routes: ${routePaths.length}, spec paths: ${specPaths.length}`);

/* ── 4. LANDING: Convert to PDF is fully wired ─────────────────────────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-scan-to-pdf"]', "light");
for (const id of ["scan-to-pdf", "html-to-pdf"]) {
  check(`landing: ${id} card renders`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
  check(`landing: ${id} is no longer badged pending`,
        await evaluate(`!document.querySelector('[data-testid="badge-pending-${id}"]')`), true);
}
check("landing: no Convert to PDF card is badged pending",
      await evaluate(`["images-to-pdf","word-to-pdf","ppt-to-pdf","excel-to-pdf","scan-to-pdf","html-to-pdf"].some((id) => !!document.querySelector('[data-testid="badge-pending-' + id + '"]'))`), false);
check("landing: pdf-to-word is still badged pending",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-pdf-to-word"]')`), true);
check("landing: convert-to count still reads 6 Tools",
      await evaluate(`document.querySelector('[data-testid="count-convert-to"]')?.textContent.trim()`), "6 Tools");
await shot("landing-convert-to");

/* ── 5. SCAN TO PDF panel: parity, conditional controls, real runs ──────── */
await openThemed(`${BASE}/tools/scan-to-pdf`, '[data-testid="upload-dropzone"]', "light");
check("scan-to-pdf: the upload input offers the camera",
      await evaluate(`document.querySelector('[data-testid="input-file"]')?.getAttribute("capture")`), "environment");
await uploadFiles([CAPTURE_A, CAPTURE_B]);
await waitFor('[data-testid="scan-note"]');
check("scan-to-pdf: three page-size cards", await evaluate(`document.querySelectorAll('[data-testid^="option-pageSize-"]').length`), 3);
check("scan-to-pdf: fit is the checked default", await checked('[data-testid="option-pageSize-fit"]'), true);
check("scan-to-pdf: orientation hidden while fit",
      await evaluate(`!document.querySelector('[data-testid="option-orientation-auto"]')`), true);
check("scan-to-pdf: searchable is off by default", await checked('[data-testid="scan-searchable"]'), false);
check("scan-to-pdf: the language picker is hidden until searchable",
      await evaluate(`!document.querySelector('[data-testid="scan-language"]')`), true);
check("scan-to-pdf: one reorder row per capture",
      await evaluate(`document.querySelectorAll('[data-testid^="scan-row-"]').length`), 2);
await click('[data-testid="option-pageSize-a4"]');
await waitFor('[data-testid="option-orientation-auto"]');
check("scan-to-pdf: orientation appears for a fixed page size", true, true);
await shot("scan-to-pdf-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("scan-to-pdf: a real run produces a result", true, true);
check("scan-to-pdf: download is a PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".pdf")`), true);
await shot("scan-to-pdf-complete");

// The searchable run: the switch reveals the language picker, and the run really
// goes through OCR (the capture has text, so the result carries a text layer).
await openThemed(`${BASE}/tools/scan-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PAGE_PNG]);
await waitFor('[data-testid="scan-searchable"]');
await click('[data-testid="scan-searchable"]');
await waitFor('[data-testid="scan-language"]');
check("scan-to-pdf: turning searchable on reveals the language picker", true, true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]', 200);
check("scan-to-pdf: a searchable run produces a result", true, true);
await shot("scan-to-pdf-searchable");

/* ── 6. HTML TO PDF panel: PDF/A field, honest note, real run ───────────── */
await openThemed(`${BASE}/tools/html-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([HTML_FILE]);
await waitFor('[data-testid="html-to-pdf-note"]');
check("html-to-pdf: four archival cards", await evaluate(`document.querySelectorAll('[data-testid^="option-pdfa-"]').length`), 4);
check("html-to-pdf: plain PDF is the checked default", await checked('[data-testid="option-pdfa-off"]'), true);
check("html-to-pdf: the note discloses the engine's limits",
      await evaluate(`document.querySelector('[data-testid="html-to-pdf-note"]').textContent.includes("JavaScript is not executed")`), true);
check("html-to-pdf: the note says a URL cannot be converted",
      await evaluate(`document.querySelector('[data-testid="html-to-pdf-note"]').textContent.includes("URL cannot")`), true);
await click('[data-testid="option-pdfa-1b"]');
await shot("html-to-pdf-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("html-to-pdf: a real run produces a result", true, true);
check("html-to-pdf: download is named after the upload",
      await evaluate(`document.querySelector('[data-testid="button-download"]')?.getAttribute("download")`), "batch6-page.pdf");
await shot("html-to-pdf-complete");

await openThemed(`${BASE}/tools/html-to-pdf`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([HTML_FILE]);
await waitFor('[data-testid="html-to-pdf-note"]');
check("html-to-pdf: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("html-to-pdf-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
