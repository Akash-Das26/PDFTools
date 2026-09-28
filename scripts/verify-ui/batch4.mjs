/* Batch 4 (Convert category) end-to-end verification:
   JPG/PNG to PDF, PDF to JPG, PDF to PDF/A and PDF to Markdown through their
   real routes, panel-field parity with the zod schemas, the format default that
   makes PDF-to-Markdown actually produce Markdown, and the landing/section
   state for the Convert categories. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURE = OUT + "fixtures/fixture.pdf";
const MARK_PNG = "/tmp/batch4-mark.png";
const MARK_PNG2 = "/tmp/batch4-mark2.png";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch4";
rmSync(PROFILE, { recursive: true, force: true });
// 4×4 PNG — a real image for images-to-pdf (a 1×1 would be an odd page size).
writeFileSync(
  MARK_PNG,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAFUlEQVR4nGP8z8Dwn4EIwESMolGFAAqpAgVJ0H0MAAAAAElFTkSuQmCC",
    "base64",
  ),
);
// A second, differently sized image so the reorder assertions can tell the two
// rows apart by name. (A hand-written IDAT will not do: pdf-lib rejects a PNG
// whose zlib stream is corrupt, which is exactly how the first version of this
// fixture failed — generated with a real encoder instead.)
writeFileSync(
  MARK_PNG2,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEklEQVR42mO4o6b2Hx9mGBkKAP8CicFFwifrAAAAAElFTkSuQmCC",
    "base64",
  ),
);

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9890", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9890/json/list")).json();
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
  writeFileSync(`${OUT}batch4-${name}.png`, Buffer.from(r.data, "base64"));
}

const fileBytes = new Uint8Array(readFileSync(FIXTURE));
const pngBytes = new Uint8Array(readFileSync(MARK_PNG));
const pdfPart = () => {
  const form = new FormData();
  form.append("file", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
  return form;
};

/* ── 0. Direct-API ground truth ───────────────────────────────────────────── */
const imagesForm = new FormData();
imagesForm.append("files", new Blob([pngBytes], { type: "image/png" }), "mark.png");
imagesForm.append("pageSize", "a4");
imagesForm.append("orientation", "portrait");
imagesForm.append("margin", "24");
const imagesRes = await fetch(`${API}/api/pdf/images-to-pdf`, { method: "POST", body: imagesForm });
check("api images-to-pdf (a4 portrait): 200", imagesRes.status, 200);
check("api images-to-pdf: content-disposition names images.pdf",
      (imagesRes.headers.get("content-disposition") ?? "").includes("images.pdf"), true);

const nonImage = new FormData();
nonImage.append("files", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
const nonImageRes = await fetch(`${API}/api/pdf/images-to-pdf`, { method: "POST", body: nonImage });
check("api images-to-pdf: a PDF is rejected with the per-file message", nonImageRes.status, 400);
check("api images-to-pdf: message names the offending file",
      (await nonImageRes.json()).error.includes("is not a JPG or PNG image"), true);

const p2iForm = pdfPart();
p2iForm.append("format", "jpg");
p2iForm.append("quality", "70");
p2iForm.append("width", "800");
const p2iRes = await fetch(`${API}/api/pdf/pdf-to-images`, { method: "POST", body: p2iForm });
check("api pdf-to-images (jpg 800px): 200", p2iRes.status, 200);
// The fixture is a six-page document, so the whole-document answer is a ZIP.
check("api pdf-to-images: a multi-page document answers as a ZIP",
      (p2iRes.headers.get("content-type") ?? "").includes("zip"), true);

const onePageForm = pdfPart();
onePageForm.append("format", "jpg");
onePageForm.append("pages", "1");
const onePageRes = await fetch(`${API}/api/pdf/pdf-to-images`, { method: "POST", body: onePageForm });
check("api pdf-to-images: a one-page selection answers as an image",
      (onePageRes.headers.get("content-type") ?? "").includes("image/"), true);

const pdfaForm = pdfPart();
pdfaForm.append("conformance", "2U");
const pdfaRes = await fetch(`${API}/api/pdf/pdf-to-pdfa`, { method: "POST", body: pdfaForm });
check("api pdf-to-pdfa (2U): 200", pdfaRes.status, 200);
check("api pdf-to-pdfa: filename carries the level",
      (pdfaRes.headers.get("content-disposition") ?? "").includes("-pdfa-2u.pdf"), true);

const badLevel = pdfPart();
badLevel.append("conformance", "9Z");
const badLevelRes = await fetch(`${API}/api/pdf/pdf-to-pdfa`, { method: "POST", body: badLevel });
check("api pdf-to-pdfa: unknown level rejected", badLevelRes.status, 400);

const mdForm = pdfPart();
mdForm.append("format", "md");
const mdRes = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: mdForm });
check("api extract-text (md): 200", mdRes.status, 200);
check("api extract-text: content type is markdown",
      (mdRes.headers.get("content-type") ?? "").includes("text/markdown"), true);
check("api extract-text: filename ends .md",
      (mdRes.headers.get("content-disposition") ?? "").includes(".md"), true);
const mdBody = await mdRes.text();
check("api extract-text: markdown carries page headings", /^## Page 1 of \d+/m.test(mdBody), true);

const txtForm = pdfPart();
const txtRes = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: txtForm });
check("api extract-text defaults to plain text",
      (txtRes.headers.get("content-type") ?? "").includes("text/plain"), true);

/* ── 1. LANDING: convert sections, counts, pending badges ─────────────────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-images-to-pdf"]', "light");
for (const id of ["images-to-pdf", "pdf-to-images", "pdf-to-pdfa", "pdf-to-markdown"]) {
  check(`landing: ${id} card renders`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
}
check("landing: convert-to count reads 6 Tools",
      await evaluate(`document.querySelector('[data-testid="count-convert-to"]')?.textContent.trim()`), "6 Tools");
check("landing: convert-from count reads 6 Tools",
      await evaluate(`document.querySelector('[data-testid="count-convert-from"]')?.textContent.trim()`), "6 Tools");
// word-to-pdf moved to implemented in Batch 5 and html-to-pdf in Batch 6, so
// the still-pending Convert example is pdf-to-word; the list below grows.
check("landing: pdf-to-word still badged pending",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-pdf-to-word"]')`), true);
check("landing: edit-pdf still badged pending",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-edit-pdf"]')`), true);
check("landing: no wired Convert tool is badged pending",
      await evaluate(`["images-to-pdf","word-to-pdf","ppt-to-pdf","excel-to-pdf","pdf-to-images","pdf-to-pdfa","pdf-to-markdown"].some((id) => !!document.querySelector('[data-testid="badge-pending-' + id + '"]'))`), false);

/* ── 2. IMAGES TO PDF: panel fields, conditional orientation, real run ────── */
await openThemed(`${BASE}/tools/images-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([MARK_PNG, MARK_PNG2]);
await waitFor('[data-testid="images-to-pdf-margin"]');
check("images-to-pdf: fit is the checked default", await checked('[data-testid="option-pageSize-fit"]'), true);
check("images-to-pdf: orientation hidden while fit",
      await evaluate(`!document.querySelector('[data-testid="option-orientation-portrait"]')`), true);
check("images-to-pdf: order line counts the queued images",
      await evaluate(`document.querySelector('[data-testid="images-to-pdf-order"]').textContent.includes("2 images queued")`), true);
check("images-to-pdf: one reorder row per image",
      await evaluate(`document.querySelectorAll('[data-testid^="images-to-pdf-row-"]').length`), 2);
check("images-to-pdf: row 0 is the first uploaded image",
      await evaluate(`document.querySelector('[data-testid="images-to-pdf-row-0"]').textContent.includes("mark.png")`), true);
await click('[data-testid="button-file-up-1"]');
check("images-to-pdf: up arrow swaps the rows",
      await evaluate(`document.querySelector('[data-testid="images-to-pdf-row-0"]').textContent.includes("mark2.png")`), true);
await click('[data-testid="option-pageSize-a4"]');
await waitFor('[data-testid="option-orientation-portrait"]');
check("images-to-pdf: orientation appears for a fixed page size", true, true);
await click('[data-testid="option-orientation-landscape"]');
await type('[data-testid="images-to-pdf-margin"]', "30");
await shot("images-to-pdf-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("images-to-pdf: real run produces a result", true, true);
check("images-to-pdf: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("images-to-pdf-complete");

// Remove is asserted on a fresh load: after a successful run the Configure step
// is no longer mounted, so the rows would not exist to click.
await openThemed(`${BASE}/tools/images-to-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([MARK_PNG, MARK_PNG2]);
await waitFor('[data-testid="images-to-pdf-row-1"]');
await click('[data-testid="button-file-remove-0"]');
await sleep(500);
check("images-to-pdf: remove drops a row",
      await evaluate(`document.querySelectorAll('[data-testid^="images-to-pdf-row-"]').length`), 1);
check("images-to-pdf: order line follows the removal",
      await evaluate(`document.querySelector('[data-testid="images-to-pdf-order"]').textContent.includes("1 image queued")`), true);

/* ── 3. PDF TO JPG: format cards, JPG-only quality, width, real run ──────── */
await openThemed(`${BASE}/tools/pdf-to-images`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="pdf-to-images-width"]');
check("pdf-to-images: jpg is the checked default", await checked('[data-testid="option-imageFormat-jpg"]'), true);
check("pdf-to-images: quality shown for JPG",
      await evaluate(`!!document.querySelector('[data-testid="pdf-to-images-quality"]')`), true);
await click('[data-testid="option-imageFormat-png"]');
await sleep(400);
check("pdf-to-images: quality hidden for PNG",
      await evaluate(`!document.querySelector('[data-testid="pdf-to-images-quality"]')`), true);
await click('[data-testid="option-imageFormat-jpg"]');
await type('[data-testid="pdf-to-images-quality"]', "60");
await type('[data-testid="pdf-to-images-width"]', "640");
check("pdf-to-images: note states the render/ZIP contract",
      await evaluate(`document.querySelector('[data-testid="pdf-to-images-note"]').textContent.includes("ZIP")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-images: real run produces a result", true, true);
check("pdf-to-images: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("pdf-to-images-complete");

/* ── 4. PDF TO PDF/A: conformance cards, honest note, real run ───────────── */
await openThemed(`${BASE}/tools/pdf-to-pdfa`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="pdf-to-pdfa-note"]');
check("pdf-to-pdfa: five conformance cards",
      await evaluate(`document.querySelectorAll('[data-testid^="option-conformance-"]').length`), 5);
check("pdf-to-pdfa: 3B is the checked default", await checked('[data-testid="option-conformance-3B"]'), true);
check("pdf-to-pdfa: note discloses the structural scope",
      await evaluate(`document.querySelector('[data-testid="pdf-to-pdfa-note"]').textContent.includes("veraPDF")`), true);
await click('[data-testid="option-conformance-2U"]');
check("pdf-to-pdfa: switching level checks 2U", await checked('[data-testid="option-conformance-2U"]'), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-pdfa: real run produces a result", true, true);
check("pdf-to-pdfa: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("pdf-to-pdfa-complete");

/* ── 5. PDF TO MARKDOWN: md is the default, honest partial note, real run ── */
await openThemed(`${BASE}/tools/pdf-to-markdown`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="pdf-to-markdown-pages"]');
check("pdf-to-markdown: Markdown is the checked default (not the server's txt)",
      await checked('[data-testid="option-markdownFormat-md"]'), true);
check("pdf-to-markdown: note discloses partial support",
      await evaluate(`document.querySelector('[data-testid="pdf-to-markdown-note"]').textContent.includes("tables are not")`), true);
check("pdf-to-markdown: header chip reads Partial support",
      await evaluate(`document.body.innerText.includes("Partial support")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-markdown: real run produces a result", true, true);
check("pdf-to-markdown: the download is really a .md file",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".md")`), true);
check("pdf-to-markdown: result content type is markdown, not text/plain",
      await evaluate(`document.querySelector('[data-testid="result-panel"]').innerText.includes("text/markdown")`), true);
await shot("pdf-to-markdown-complete");

/* Dark theme check on the newest panel. */
await openThemed(`${BASE}/tools/pdf-to-images`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="pdf-to-images-width"]');
check("pdf-to-images: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("pdf-to-images-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
