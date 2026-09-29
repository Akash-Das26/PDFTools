/* Batch 1 (Organize PDF) end-to-end verification:
   merge, split, extract-pages, organize-pages, rotate through their real routes.
   compress + remove-pages were already covered by verify.mjs. */
import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const OUT = new URL(".", import.meta.url).pathname;
const PROFILE = "/tmp/pdfcheck-ui-profile-batch1";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9888", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9888/json/list")).json();
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
  throw new Error("no render: " + selector);
}
async function openThemed(url, selector, mode) {
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: mode }] });
  await send("Page.navigate", { url });
  await sleep(1200);
  try { await evaluate("localStorage.clear()"); } catch {}
  await send("Page.reload");
  await waitFor(selector);
  await sleep(700);
}
async function uploadFiles(files, selector = '[data-testid="input-file"]') {
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
  await sleep(1200);
}
const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.click()`);
const type = (sel, value) => evaluate(`
  const el = document.querySelector(${JSON.stringify(sel)});
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));`);
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch1-${name}.png`, Buffer.from(r.data, "base64"));
}

/* ── 1. MERGE: two files, reorder rows, process → merged.pdf ─────────────── */
await openThemed(`${BASE}/tools/merge`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([OUT + "fixtures/fixture.pdf", OUT + "fixtures/fixture2.pdf"]);
await waitFor('[data-testid="merge-row-0"]');
check("merge: both files listed", await evaluate(`document.querySelectorAll('[data-testid^="merge-row-"]').length`), 2);
check("merge: needs-two hint hidden at 2 files", await evaluate(`!document.querySelector('[data-testid="merge-needs-two"]')`), true);
await click('[data-testid="button-file-up-1"]');
check("merge: reorder swaps rows", await evaluate(`document.querySelector('[data-testid="merge-row-0"]').textContent.includes("fixture2")`), true);
await shot("merge-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("merge: result shows merged.pdf", await evaluate(`document.querySelector('[data-testid="result-panel"]').textContent.includes("merged")`), true);
check("merge: download enabled", await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("merge-complete");

/* ── 2. SPLIT: pages mode → range 1-2 → ZIP ──────────────────────────────── */
await openThemed(`${BASE}/tools/split`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([OUT + "fixtures/fixture.pdf"]);
await waitFor('[data-testid="option-splitType-all"]');
check("split: two mode cards", await evaluate(`document.querySelectorAll('[data-testid^="option-splitType-"]').length`), 2);
await click('[data-testid="option-splitType-pages"]');
await waitFor('[data-testid="pages-input"]');
await type('[data-testid="pages-input"]', "1-2");
check("split: range accepted", await evaluate(`document.querySelector('[data-testid="pages-input"]').value`), "1-2");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("split: produces download", await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("split-complete");

/* ── 3. EXTRACT PAGES: pick 2 of 6 → new doc of 2 ────────────────────────── */
await openThemed(`${BASE}/tools/extract-pages`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([OUT + "fixtures/fixture.pdf"]);
await waitFor('[data-testid="page-checkbox-1"]');
await click('[data-testid="page-checkbox-2"]');
await click('[data-testid="page-checkbox-4"]');
await waitFor('[data-testid="extract-pages-summary"]');
check("extract: summary mirrors selection", await evaluate(`document.querySelector('[data-testid="extract-pages-summary"]').textContent.includes("2 pages")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("extract: produces download", await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("extract-complete");

/* ── 4. ORGANIZE PAGES: move page 6 to front, delete none → rebuilt order ── */
await openThemed(`${BASE}/tools/reorder-pages`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([OUT + "fixtures/fixture.pdf"]);
await waitFor('[data-testid="page-checkbox-1"]');
// Reorder via the keyboard affordance the cards actually ship: focus page 6,
// then Alt+ArrowLeft five times walks it to the front of the order.
for (let i = 0; i < 5; i++) {
  await evaluate(`document.querySelector('[data-testid="page-checkbox-6"]').focus()`);
  await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }))`);
  await sleep(120);
}
await waitFor('[data-testid="organize-pages-summary"]');
check("organize: order starts with moved page", await evaluate(`document.querySelector('[data-testid="organize-pages-summary"]').textContent.includes("6, 1, 2")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("organize: produces download", await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("organize-complete");

/* ── 5. ROTATE: angle selector + selection scoping → rotated doc ─────────── */
await openThemed(`${BASE}/tools/rotate`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([OUT + "fixtures/fixture.pdf"]);
await waitFor('[data-testid="option-rotation-90"]');
check("rotate: three angle cards", await evaluate(`document.querySelectorAll('[data-testid^="option-rotation-"]').length`), 3);
check("rotate: default 90", await evaluate(`document.querySelector('[data-testid="option-rotation-90"]').getAttribute('data-state') === 'checked' || document.querySelector('[data-testid="option-rotation-90"] [data-state="checked"]') !== null`), true);
await click('[data-testid="option-rotation-180"]');
check("rotate: scope states all pages", await evaluate(`document.querySelector('[data-testid="rotate-scope"]').textContent.includes("all 6")`), true);
await click('[data-testid="page-checkbox-3"]');
await click('[data-testid="page-checkbox-5"]');
check("rotate: scope narrows to selection", await evaluate(`document.querySelector('[data-testid="rotate-scope"]').textContent.includes("2 selected pages (3, 5)")`), true);
// Per-page overrides (Open Item 13): rotating page 2 via the picker's own
// arrows must surface in the scope line — the same plan the request builder
// serialises into the `rotations` field.
await click('[data-testid="page-rotate-cw-2"]');
check("rotate: per-page arrow registers an override", await evaluate(`document.querySelector('[data-testid="rotate-scope"]').textContent.includes("2:90°")`), true);
await click('[data-testid="page-rotate-cw-2"]');
check("rotate: override accumulates to 180°", await evaluate(`document.querySelector('[data-testid="rotate-scope"]').textContent.includes("2:180°")`), true);
await shot("rotate-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("rotate: produces download", await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("rotate-complete");

/* ── 6. MERGE guard: single file must not reach the endpoint ─────────────── */
await openThemed(`${BASE}/tools/merge`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([OUT + "fixtures/fixture.pdf"]);
await waitFor('[data-testid="merge-needs-two"]');
check("merge: needs-two hint at 1 file", await evaluate(`document.querySelector('[data-testid="merge-needs-two"]').textContent.includes("at least one more")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="error-panel"]');
check("merge guard: error panel shown", true, true);
check("merge guard: message mentions two", await evaluate(`document.querySelector('[data-testid="error-panel"]').textContent.includes("Two PDFs or more")`), true);
check("dark theme applied on merge", await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("merge-guard-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
