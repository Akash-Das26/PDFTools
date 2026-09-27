/* Batch 3 (Edit category) end-to-end verification:
   Watermark (text + image through the real two-part route), Add Page Numbers
   and Crop through their real routes, panel-field parity with the zod
   schemas, the image-part guard, picker scoping for crop, and the honest
   pending pattern for Edit PDF Content / PDF Form Filler. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURE = OUT + "fixtures/fixture.pdf";
const MARK_PNG = "/tmp/batch3-mark.png";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch3";
rmSync(PROFILE, { recursive: true, force: true });
// 1×1 PNG — big enough for embedPng, small enough to inline.
writeFileSync(
  MARK_PNG,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9889", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9889/json/list")).json();
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
    console.log("root len:", await evaluate(`document.getElementById("root")?.innerHTML.length ?? -1`));
    console.log("body:", await evaluate(`document.body.innerText.slice(0, 500)`));
  } catch (e) { console.log("eval dead:", e.message); }
  throw new Error("no render: " + selector);
}
async function openThemed(url, selector, mode) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
  // Cold vite dev servers occasionally refuse the first navigation; retry once.
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
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch3-${name}.png`, Buffer.from(r.data, "base64"));
}

const fileBytes = new Uint8Array(readFileSync(FIXTURE));
const pdfPart = () => {
  const form = new FormData();
  form.append("file", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
  return form;
};

/* ── 0. Direct-API ground truth for the three wired endpoints ─────────────── */
const wmRes = await fetch(`${API}/api/pdf/watermark`, { method: "POST", body: pdfPart() });
check("api watermark: 200", wmRes.status, 200);
const wmBytes = Buffer.from(await wmRes.arrayBuffer());
check("api watermark: content-disposition names watermarked.pdf",
      (wmRes.headers.get("content-disposition") ?? "").includes("watermarked.pdf"), true);
check("api watermark: output differs from input", wmBytes.equals(Buffer.from(fileBytes)), false);

const wmiForm = pdfPart();
wmiForm.append("type", "image");
wmiForm.append("image", new Blob([readFileSync(MARK_PNG)], { type: "image/png" }), "mark.png");
const wmiRes = await fetch(`${API}/api/pdf/watermark`, { method: "POST", body: wmiForm });
check("api watermark image part: 200", wmiRes.status, 200);

const pnForm = pdfPart();
pnForm.append("startNumber", "5");
pnForm.append("format", "1/N");
const pnRes = await fetch(`${API}/api/pdf/add-page-numbers`, { method: "POST", body: pnForm });
check("api add-page-numbers: 200 with startNumber=5, format=1/N", pnRes.status, 200);
check("api add-page-numbers: content-disposition names numbered.pdf",
      (pnRes.headers.get("content-disposition") ?? "").includes("numbered.pdf"), true);

const cropForm = pdfPart();
cropForm.append("top", "10"); cropForm.append("right", "10");
cropForm.append("bottom", "10"); cropForm.append("left", "10");
const cropRes = await fetch(`${API}/api/pdf/crop`, { method: "POST", body: cropForm });
check("api crop 10% margins: 200", cropRes.status, 200);
check("api crop: content-disposition names cropped.pdf",
      (cropRes.headers.get("content-disposition") ?? "").includes("cropped.pdf"), true);

const overForm = pdfPart();
overForm.append("top", "50"); overForm.append("bottom", "50");
overForm.append("left", "50"); overForm.append("right", "50");
const overRes = await fetch(`${API}/api/pdf/crop`, { method: "POST", body: overForm });
check("api crop leaving nothing: 400", overRes.status, 400);

const ptForm = pdfPart();
ptForm.append("unit", "pt");
ptForm.append("top", "20"); ptForm.append("left", "20");
const ptRes = await fetch(`${API}/api/pdf/crop`, { method: "POST", body: ptForm });
check("api crop in points: 200", ptRes.status, 200);

/* ── 1. LANDING: edit section shows all five tools, correct accents ───────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-watermark"]', "light");
for (const id of ["edit-pdf", "add-page-numbers", "watermark", "crop", "pdf-form-filler"]) {
  check(`landing: ${id} card in edit section`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
}
check("landing: edit count badge reads 5 Tools",
      await evaluate(`document.querySelector('[data-testid="count-edit"]')?.textContent.trim()`), "5 Tools");
check("landing: edit-pdf shows backend-pending badge",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-edit-pdf"]')`), true);
check("landing: pdf-form-filler shows backend-pending badge",
      await evaluate(`!!document.querySelector('[data-testid="badge-pending-pdf-form-filler"]')`), true);

/* ── 2. WATERMARK: text mode fields, real text run, image run, guard ──────── */
await openThemed(`${BASE}/tools/watermark`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="watermark-text"]');
check("watermark: text mode is the checked default",
      await evaluate(`document.querySelector('[data-testid="option-type-text"] [data-state="checked"], [data-testid="option-type-text"][data-state="checked"]') !== null`), true);
check("watermark: ten position cards with diagonal default",
      await evaluate(`document.querySelectorAll('[data-testid^="option-position-"]').length`), 10);
check("watermark: diagonal position checked",
      await evaluate(`document.querySelector('[data-testid="option-position-diagonal"] [data-state="checked"], [data-testid="option-position-diagonal"][data-state="checked"]') !== null`), true);
check("watermark: angle defaults to auto",
      await evaluate(`document.querySelector('[data-testid="option-rotation-auto"] [data-state="checked"], [data-testid="option-rotation-auto"][data-state="checked"]') !== null`), true);
check("watermark: opacity slider renders",
      await evaluate(`!!document.querySelector('[data-testid="watermark-opacity"]')`), true);
check("watermark: empty text hints the server default",
      await evaluate(`document.querySelector('[data-testid="watermark-text"]').placeholder.includes("CONFIDENTIAL")`), true);

await type('[data-testid="watermark-text"]', "BATCH3");
await shot("watermark-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("watermark: text run produces a result", true, true);
check("watermark: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("watermark-complete");

// Image mode: the panel's file input must reach the route's `image` part.
await openThemed(`${BASE}/tools/watermark`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="watermark-text"]');
await click('[data-testid="option-type-image"]');
await waitFor('[data-testid="watermark-image"]');
await uploadFiles([MARK_PNG], '[data-testid="watermark-image"]');
await waitFor('[data-testid="watermark-image-name"]');
check("watermark: chosen image is named in the panel",
      await evaluate(`document.querySelector('[data-testid="watermark-image-name"]').textContent.includes("mark.png")`), true);
check("watermark: image mode shows the size slider",
      await evaluate(`!!document.querySelector('[data-testid="watermark-scale"]')`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("watermark: image run produces a result", true, true);
await shot("watermark-image-complete");

// Guard: image mode without an image must show the error panel, never a request.
await openThemed(`${BASE}/tools/watermark`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="watermark-text"]');
await click('[data-testid="option-type-image"]');
await click('[data-testid="button-process"]');
await waitFor('[data-testid="error-panel"]');
check("watermark guard: error panel shown", true, true);
check("watermark guard: message asks for the image",
      await evaluate(`document.querySelector('[data-testid="error-panel"]').textContent.toLowerCase().includes("watermark image")`), true);
check("watermark guard: no result panel followed",
      await evaluate(`!document.querySelector('[data-testid="result-panel"]')`), true);
check("watermark: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("watermark-guard-dark");

/* ── 3. ADD PAGE NUMBERS: fields, live range line, real run ───────────────── */
await openThemed(`${BASE}/tools/add-page-numbers`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="page-numbers-start"]');
check("page numbers: five position cards, bottom-center default",
      await evaluate(`document.querySelectorAll('[data-testid^="option-position-"]').length`), 5);
check("page numbers: three format cards with plain-number default",
      await evaluate(`document.querySelectorAll('[data-testid^="option-format-"]').length`), 3);
check("page numbers: start input defaults to 1",
      await evaluate(`document.querySelector('[data-testid="page-numbers-start"]').value`), "1");
const rangeText = await evaluate(`document.querySelector('[data-testid="page-numbers-range"]').textContent`);
check("page numbers: range line states the starting number",
      /starts at 1|leave 1/.test(rangeText), true);
await type('[data-testid="page-numbers-start"]', "5");
await click('[data-testid="option-format-1/N"]');
check("page numbers: start 5 shifts the range line",
      await evaluate(`document.querySelector('[data-testid="page-numbers-range"]').textContent.includes("starts at 5")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("page numbers: real run produces a result", true, true);
check("page numbers: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("page-numbers-complete");

/* ── 4. CROP: page-picker panel, unit cards, margins, scoping, real run ───── */
await openThemed(`${BASE}/tools/crop`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="workspace-configure"]');
check("crop: percent is the checked default unit",
      await evaluate(`document.querySelector('[data-testid="option-unit-percent"] [data-state="checked"], [data-testid="option-unit-percent"][data-state="checked"]') !== null`), true);
for (const edge of ["top", "right", "bottom", "left"]) {
  check(`crop: ${edge} margin input renders`,
        await evaluate(`!!document.querySelector('[data-testid="crop-${edge}"]')`), true);
}
const scopeAll = await evaluate(`document.querySelector('[data-testid="crop-scope"]').textContent`);
check("crop: scope line counts every page",
      /Applies to all \d+ pages/.test(scopeAll) || /every page/.test(scopeAll), true);
await type('[data-testid="crop-top"]', "10");
await type('[data-testid="crop-right"]', "10");
await type('[data-testid="crop-bottom"]', "10");
await type('[data-testid="crop-left"]', "10");
await click('[data-testid="page-checkbox-1"]');
await sleep(600);
check("crop: picking one page narrows the scope line",
      await evaluate(`document.querySelector('[data-testid="crop-scope"]').textContent.includes("selected page")`), true);
await shot("crop-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("crop: real run produces a result", true, true);
check("crop: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("crop-complete");

/* ── 5. EDIT-PDF + PDF-FORM-FILLER: honest backend-pending workspaces ─────── */
for (const id of ["edit-pdf", "pdf-form-filler"]) {
  await openThemed(`${BASE}/tools/${id}`, '[data-testid="upload-dropzone"]', "light");
  await uploadFiles([FIXTURE]);
  await waitFor('[data-testid="pending-badge"]');
  check(`${id}: pending badge shown`, true, true);
  check(`${id}: Process disabled`,
        await evaluate(`document.querySelector('[data-testid="button-process"]').disabled`), true);
  check(`${id}: CTA reads Unavailable`,
        await evaluate(`document.querySelector('[data-testid="button-process"]').textContent.trim()`), "Unavailable");
  check(`${id}: configure panel marked not built`,
        await evaluate(`!!document.querySelector('[data-testid="options-not-built"]')`), true);
  await click('[data-testid="button-process"]');
  check(`${id}: disabled button performs no request (no error panel)`,
        await evaluate(`!document.querySelector('[data-testid="error-panel"]')`), true);
}

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
