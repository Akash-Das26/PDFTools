/* Batch 5 (Office → PDF) end-to-end verification:
   Word to PDF, PowerPoint to PDF and Excel to PDF through their real routes —
   the conversions themselves (text and page counts surviving the round trip),
   the PDF/A export levels, the fit-to-page option, and the input guards that
   stop the engine silently "converting" something that is not a document. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURES = OUT + "fixtures/";
const DOCX = FIXTURES + "office.docx";
const PPTX = FIXTURES + "office.pptx";
const XLSX = FIXTURES + "office.xlsx";
const MISLABELLED = FIXTURES + "office-mislabelled.docx";
const PDF_FIXTURE = FIXTURES + "fixture.pdf";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch5";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9891", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9891/json/list")).json();
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
  try {
    console.log("url:", await evaluate(`location.href`));
    console.log("body:", await evaluate(`document.body.innerText.slice(0, 400)`));
  } catch (e) { console.log("eval dead:", e.message); }
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
  writeFileSync(`${OUT}batch5-${name}.png`, Buffer.from(r.data, "base64"));
}

const bytes = (path) => readFileSync(path);
const docxBytes = bytes(DOCX);
const pptxBytes = bytes(PPTX);
const xlsxBytes = bytes(XLSX);

function form(name, data, extra = {}) {
  const f = new FormData();
  f.append("file", new Blob([data]), name);
  for (const [k, v] of Object.entries(extra)) f.append(k, String(v));
  return f;
}
const hasPdfaMarker = (buf) => buf.includes(Buffer.from("pdfaid"));

/** Reads the page count back through the API rather than guessing from bytes. */
async function pageCount(data, name) {
  const res = await fetch(`${API}/api/pdf/page-info`, { method: "POST", body: form(name, data) });
  return (await res.json()).pageCount;
}
/** Extracts text through the API, proving the conversion carried content. */
async function textOf(data, name = "converted.pdf") {
  const res = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: form(name, data) });
  return await res.text();
}

/* ── 0. Direct-API ground truth: the three conversions ────────────────────── */
const wordRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office.docx", docxBytes) });
const wordPdf = Buffer.from(await wordRes.arrayBuffer());
check("api word-to-pdf: 200", wordRes.status, 200);
check("api word-to-pdf: answers with a PDF",
      (wordRes.headers.get("content-type") ?? "").includes("application/pdf"), true);
check("api word-to-pdf: filename is office.pdf",
      (wordRes.headers.get("content-disposition") ?? "").includes("office.pdf"), true);
check("api word-to-pdf: plain output carries no PDF/A marker", hasPdfaMarker(wordPdf), false);
check("api word-to-pdf: converted document has one page", await pageCount(wordPdf, "word.pdf"), 1);
check("api word-to-pdf: the text layer is the document's own text",
      (await textOf(wordPdf, "word.pdf")).includes("Batch 5 Word fixture"), true);

const word1bRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office.docx", docxBytes, { pdfa: "1b" }) });
const word1bPdf = Buffer.from(await word1bRes.arrayBuffer());
check("api word-to-pdf (pdfa=1b): 200", word1bRes.status, 200);
check("api word-to-pdf (pdfa=1b): output carries the PDF/A marker", hasPdfaMarker(word1bPdf), true);
check("api word-to-pdf: the PDF/A export is a different file from the plain one",
      word1bPdf.length !== wordPdf.length, true);

const word2bRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office.docx", docxBytes, { pdfa: "2b" }) });
check("api word-to-pdf (pdfa=2b): output carries the PDF/A marker",
      hasPdfaMarker(Buffer.from(await word2bRes.arrayBuffer())), true);
const word3bRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office.docx", docxBytes, { pdfa: "3b" }) });
check("api word-to-pdf (pdfa=3b): output carries the PDF/A marker",
      hasPdfaMarker(Buffer.from(await word3bRes.arrayBuffer())), true);

const badLevel = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office.docx", docxBytes, { pdfa: "9z" }) });
check("api word-to-pdf: an unknown PDF/A level is rejected", badLevel.status, 400);

/* The engine converts a plain-text file named .docx into a PDF of that text and
   exits 0, so the endpoint sniffs the package instead of trusting the name. */
const mislabelledRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("office-mislabelled.docx", bytes(MISLABELLED)) });
check("api word-to-pdf: a mislabelled .docx is rejected", mislabelledRes.status, 422);
check("api word-to-pdf: the message names the damaged package",
      (await mislabelledRes.json()).error.includes("isn't a valid Word document"), true);

const pdfToWordRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: form("fixture.pdf", bytes(PDF_FIXTURE)) });
check("api word-to-pdf: a PDF sent to the Word tool is rejected", pdfToWordRes.status, 400);
check("api word-to-pdf: the message names the accepted extensions",
      (await pdfToWordRes.json()).error.includes(".doc and .docx"), true);

const noFile = new FormData();
const noFileRes = await fetch(`${API}/api/pdf/word-to-pdf`, { method: "POST", body: noFile });
check("api word-to-pdf: a request with no file is rejected", noFileRes.status, 400);

const pptRes = await fetch(`${API}/api/pdf/ppt-to-pdf`, { method: "POST", body: form("office.pptx", pptxBytes) });
const pptPdf = Buffer.from(await pptRes.arrayBuffer());
check("api ppt-to-pdf: 200", pptRes.status, 200);
check("api ppt-to-pdf: answers with a PDF",
      (pptRes.headers.get("content-type") ?? "").includes("application/pdf"), true);
check("api ppt-to-pdf: one slide becomes one page", await pageCount(pptPdf, "deck.pdf"), 1);
check("api ppt-to-pdf: the slide's text survives the conversion",
      (await textOf(pptPdf, "deck.pdf")).includes("Batch 5 slide fixture"), true);

const wordToPptRes = await fetch(`${API}/api/pdf/ppt-to-pdf`, { method: "POST", body: form("office.docx", docxBytes) });
check("api ppt-to-pdf: a Word file is rejected by the family check", wordToPptRes.status, 400);
check("api ppt-to-pdf: the message names the slide extensions",
      (await wordToPptRes.json()).error.includes(".ppt and .pptx"), true);

const excelRes = await fetch(`${API}/api/pdf/excel-to-pdf`, { method: "POST", body: form("office.xlsx", xlsxBytes) });
const excelPdf = Buffer.from(await excelRes.arrayBuffer());
check("api excel-to-pdf: 200", excelRes.status, 200);
check("api excel-to-pdf: answers with a PDF",
      (excelRes.headers.get("content-type") ?? "").includes("application/pdf"), true);
check("api excel-to-pdf: the 120-row sheet spills over several pages",
      await pageCount(excelPdf, "sheet.pdf"), 3);

const fitRes = await fetch(`${API}/api/pdf/excel-to-pdf`, { method: "POST", body: form("office.xlsx", xlsxBytes, { fitToPage: "true" }) });
const fitPdf = Buffer.from(await fitRes.arrayBuffer());
check("api excel-to-pdf (fitToPage=true): 200", fitRes.status, 200);
check("api excel-to-pdf (fitToPage=true): the sheet collapses to one page",
      await pageCount(fitPdf, "sheet.pdf"), 1);
check("api excel-to-pdf: the fitted PDF is smaller than the paginated one",
      fitPdf.length < excelPdf.length, true);

const fitOffRes = await fetch(`${API}/api/pdf/excel-to-pdf`, { method: "POST", body: form("office.xlsx", xlsxBytes, { fitToPage: "false" }) });
check("api excel-to-pdf (fitToPage=false): still paginates",
      await pageCount(Buffer.from(await fitOffRes.arrayBuffer()), "sheet.pdf"), 3);

const wordToExcelRes = await fetch(`${API}/api/pdf/excel-to-pdf`, { method: "POST", body: form("office.docx", docxBytes) });
check("api excel-to-pdf: a Word file is rejected by the family check", wordToExcelRes.status, 400);

/* ── 1. Catalog: the three cards are wired, the counts moved ──────────────── */
const tools = await (await fetch(`${API}/api/tools`)).json();
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
for (const [id, route] of [
  ["word-to-pdf", "/api/pdf/word-to-pdf"],
  ["ppt-to-pdf", "/api/pdf/ppt-to-pdf"],
  ["excel-to-pdf", "/api/pdf/excel-to-pdf"],
]) {
  check(`catalog: ${id} is implemented`, byId[id].status, "implemented");
  check(`catalog: ${id} points at ${route}`, byId[id].route, route);
}
// Batch 6 moved scan-to-pdf and html-to-pdf and Batch 7 the form filler,
// excel and translate, so the counts this suite pinned at 20/11 are now 25/6.
check("catalog: implemented count is 25",
      tools.filter((t) => t.status === "implemented").length, 25);
check("catalog: pending count is 6",
      tools.filter((t) => t.status === "pending").length, 6);
check("catalog: still 32 tools in total", tools.length, 32);

/* ── 2. LANDING: Convert-to section reflects the new wires ───────────────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-word-to-pdf"]', "light");
for (const id of ["word-to-pdf", "ppt-to-pdf", "excel-to-pdf"]) {
  check(`landing: ${id} card renders`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
  check(`landing: ${id} is no longer badged pending`,
        await evaluate(`!document.querySelector('[data-testid="badge-pending-${id}"]')`), true);
}
check("landing: html-to-pdf is no longer badged pending",
      await evaluate(`!document.querySelector('[data-testid="badge-pending-html-to-pdf"]')`), true);
check("landing: pdf-to-word is still badged pending",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-pdf-to-word"]')`), true);
check("landing: convert-to count still reads 6 Tools",
      await evaluate(`document.querySelector('[data-testid="count-convert-to"]')?.textContent.trim()`), "6 Tools");
await shot("landing-convert-to");

/* ── 3. WORD TO PDF: panel parity and a real run ─────────────────────────── */
await openThemed(`${BASE}/tools/word-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([DOCX]);
await waitFor('[data-testid="option-pdfa"]');
check("word-to-pdf: four archival cards", await evaluate(`document.querySelectorAll('[data-testid^="option-pdfa-"]').length`), 4);
check("word-to-pdf: plain PDF is the checked default", await checked('[data-testid="option-pdfa-off"]'), true);
check("word-to-pdf: the note names the conversion engine",
      await evaluate(`document.querySelector('[data-testid="word-to-pdf-note"]').textContent.includes("LibreOffice")`), true);
await click('[data-testid="option-pdfa-1b"]');
check("word-to-pdf: picking PDF/A-1b checks it", await checked('[data-testid="option-pdfa-1b"]'), true);
await shot("word-to-pdf-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("word-to-pdf: real run produces a result", true, true);
check("word-to-pdf: download is a PDF named after the upload",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "")`), "office.pdf");
await shot("word-to-pdf-complete");

/* ── 4. POWERPOINT TO PDF: panel parity and a real run ───────────────────── */
await openThemed(`${BASE}/tools/ppt-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PPTX]);
await waitFor('[data-testid="ppt-to-pdf-note"]');
check("ppt-to-pdf: plain PDF is the checked default", await checked('[data-testid="option-pdfa-off"]'), true);
check("ppt-to-pdf: the note states the whole deck is exported",
      await evaluate(`document.querySelector('[data-testid="ppt-to-pdf-note"]').textContent.includes("whole deck")`), true);
await click('[data-testid="option-pdfa-3b"]');
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("ppt-to-pdf: real run produces a result", true, true);
check("ppt-to-pdf: download is a PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".pdf")`), true);
await shot("ppt-to-pdf-complete");

/* ── 5. EXCEL TO PDF: fit-to-page switch and a real run ──────────────────── */
await openThemed(`${BASE}/tools/excel-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([XLSX]);
await waitFor('[data-testid="excel-fit-to-page"]');
check("excel-to-pdf: fit-to-page is off by default", await checked('[data-testid="excel-fit-to-page"]'), false);
check("excel-to-pdf: the note states the workbook's page setup applies",
      await evaluate(`document.querySelector('[data-testid="excel-to-pdf-note"]').textContent.includes("page setup")`), true);
await click('[data-testid="excel-fit-to-page"]');
await sleep(400);
check("excel-to-pdf: toggling the fit switch turns it on", await checked('[data-testid="excel-fit-to-page"]'), true);
await shot("excel-to-pdf-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("excel-to-pdf: real run produces a result", true, true);
check("excel-to-pdf: download is a PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".pdf")`), true);

/* Dark theme on the newest panel. */
await openThemed(`${BASE}/tools/excel-to-pdf`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([XLSX]);
await waitFor('[data-testid="excel-fit-to-page"]');
check("excel-to-pdf: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("excel-to-pdf-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
