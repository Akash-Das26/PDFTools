import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

/**
 * a11y.mjs — the accessibility walkthrough the 2026-09-29 audit said had never
 * been performed (AUDIT.md Accessibility, Open Item 24).
 *
 * Two passes, both against the real app in headless Chrome over raw CDP:
 *
 *   1. Accessible-name census — every <button>, [role="button"] and link on
 *      the landing page, a stepper workspace (compress) and the page-picker
 *      workspace (remove-pages, before AND after upload) must resolve an
 *      accessible name: aria-label, aria-labelledby, visible text, or (weak,
 *      reported but not failed) title. This is the check that would have
 *      caught the "1 unlabeled button" the audit counted by source reading.
 *
 *   2. Keyboard walkthrough of the page-picker — real key events through the
 *      browser input pipeline (CDP Input.dispatchKeyEvent, not synthetic
 *      JS events): focus a page checkbox, select with Space, move with the
 *      arrow keys, reorder with Alt+Arrow, reach the hover-overlay micro
 *      actions with Tab, rotate and remove a page with Enter, and watch the
 *      live "N pages" summary update. Tab-only reachability of every control
 *      is the point: the overlay buttons are opacity-0 until hover/focus.
 *
 * Exit code is nonzero on any failure, so it can gate like the other suites.
 */

const BASE = "http://127.0.0.1:5173";
const OUT = new URL(".", import.meta.url).pathname;
const FIXTURE = OUT + "fixtures/fixture.pdf";
const PROFILE = "/tmp/pdfcheck-ui-profile-a11y";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new", "--remote-debugging-port=9777", "--user-data-dir=" + PROFILE,
  "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9777/json/list")).json();
    const p = list.find((t) => t.type === "page");
    if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 1; const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false,
});

async function goto(url, selector, settle = 1200) {
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) { await sleep(settle); return; } } catch {}
  }
  throw new Error("no render: " + selector);
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

/* Wait for a selector WITHOUT navigating — after an in-place upload the SPA
   has already re-rendered; a goto would reset it to the upload phase. */
async function waitFor(selector, tries = 90) {
  for (let i = 0; i < tries; i++) {
    await sleep(400);
    try { if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) { await sleep(1200); return; } } catch {}
  }
  throw new Error("no render: " + selector);
}

async function upload(selector = '[data-testid="input-file"]', files = [FIXTURE]) {
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
  if (!node.nodeId) throw new Error(`file input not found: ${selector}`);
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
}

/* Real key events through the browser input pipeline. */
const MOD_ALT = 1;
async function key(keyName, code, vk, { modifiers = 0, text, type = "rawKeyDown" } = {}) {
  await send("Input.dispatchKeyEvent", { type, key: keyName, code, windowsVirtualKeyCode: vk, modifiers, text });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName, code, windowsVirtualKeyCode: vk, modifiers });
  await sleep(120);
}
const tab = () => key("Tab", "Tab", 9);
// Enter must be dispatched as type "keyDown" WITH text "\r": probed against
// this Chrome build on a bare <button> (0/0/0/1 across rawKeyDown±text and
// keyDown±text), only that combination triggers the button's default
// Enter-to-click activation — the produced character is what routes the event
// through the default-action path, and rawKeyDown skips it. Confirmed in-app
// with a capture-phase logger: the keydown lands on the button un-prevented
// but synthesizes no click unless the "\r" text rides along.
const enter = () => key("Enter", "Enter", 13, { type: "keyDown", text: "\r" });
const space = () => key(" ", "Space", 32);
const arrowRight = () => key("ArrowRight", "ArrowRight", 39);
const altLeft = () => key("ArrowLeft", "ArrowLeft", 37, { modifiers: MOD_ALT });

const results = [];
function check(label, pass, detail = "") {
  results.push({ pass, label, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

/* The census: resolve an accessible name for every actionable element. */
const CENSUS = `(() => [...document.querySelectorAll('button, [role="button"], a[href]')].map((el) => {
  const label = el.getAttribute('aria-label') || '';
  const ids = el.getAttribute('aria-labelledby');
  const labelledby = ids ? ids.split(/\\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim() : '';
  const text = (el.textContent ?? '').trim().replace(/\\s+/g, ' ');
  const title = el.getAttribute('title') ?? '';
  const name = label || labelledby || text || title;
  const source = label ? 'aria-label' : labelledby ? 'aria-labelledby' : text ? 'text' : title ? 'title' : 'NONE';
  return { name, source, tag: el.tagName.toLowerCase(), testid: el.getAttribute('data-testid') ?? '', text: text.slice(0, 40) };
}))()`;

async function census(surface, minButtons = 1) {
  // The census crosses the CDP boundary as a JSON string and is parsed here:
  // this path was proven by an earlier raw-response dump where the plain
  // returnByValue serialization of the mapped array came back unusable.
  const asJson = await evaluate(`JSON.stringify(${CENSUS})`);
  const buttons = JSON.parse(asJson);
  const unnamed = buttons.filter((b) => b.source === "NONE");
  const titleOnly = buttons.filter((b) => b.source === "title");
  check(`${surface}: ${buttons.length} actionable elements, all with accessible names`,
    buttons.length >= minButtons && unnamed.length === 0,
    unnamed.length ? `UNNAMED: ${JSON.stringify(unnamed)}` : (titleOnly.length ? `title-only (weak): ${titleOnly.map((b) => b.testid || b.text).join(", ")}` : "ok"));
  return buttons;
}

/* ═══════ Pass 1 — accessible-name census across the three surfaces ═══════ */

console.log("\n── Census: landing ──");
await goto(`${BASE}/`, 'a[data-testid^="card-tool-"]');
const landingButtons = await census("landing", 5);

console.log("\n── Census: stepper workspace (compress, upload phase) ──");
await goto(`${BASE}/tools/compress`, '[data-testid="upload-dropzone"]');
await census("compress", 3);

console.log("\n── Census: page-picker workspace (remove-pages, upload phase) ──");
await goto(`${BASE}/tools/remove-pages`, '[data-testid="upload-dropzone"]');
await census("remove-pages (upload phase)", 3);

console.log("\n── Census: page-picker workspace (configured, thumbnails rendered) ──");
await upload();
await waitFor('[data-testid="page-card-1"]');
await census("remove-pages (configured)", 8);

/* ═══════ Pass 2 — keyboard walkthrough of the page-picker ═══════ */

console.log("\n── Keyboard walkthrough: page-picker ──");

const cardCount = await evaluate(
  `[...document.querySelectorAll('[data-testid^="page-card-"]')].length`,
);
check("thumbnails rendered for the fixture", cardCount >= 2, `${cardCount} cards`);

// 1. Focus the first page checkbox programmatically (the walkthrough's entry).
await evaluate(`document.querySelector('[data-testid="page-checkbox-1"]').focus()`);
check("focus lands on page 1's checkbox",
  (await evaluate(`document.activeElement?.dataset.testid`)) === "page-checkbox-1");
await shot("a11y-picker-focused");

// 2. Space selects page 1 — the checkbox's aria-checked must flip.
await space();
check("Space toggles page 1 and aria-checked updates",
  (await evaluate(`document.querySelector('[data-testid="page-checkbox-1"]')?.getAttribute('aria-checked')`)) === "true");

// 3. ArrowRight moves focus to the next page (focusPage, not the browser's
//    default — the handler decides).
await arrowRight();
check("ArrowRight moves focus to page 2's checkbox",
  (await evaluate(`document.activeElement?.dataset.testid`)) === "page-checkbox-2");

// 4. Alt+ArrowLeft reorders page 2 in front of page 1.
await altLeft();
const firstCard = await evaluate(
  `[...document.querySelectorAll('[data-testid^="page-card-"]')][0]?.dataset.testid`,
);
check("Alt+ArrowLeft reorders page 2 to the front", firstCard === "page-card-2", `first card is ${firstCard}`);
await shot("a11y-picker-reordered");

// 5. Tab reaches the hover-overlay micro-actions: drag handle → rotate ccw/cw
//    → delete, all without a pointer (opacity-0 but focusable; the
//    group-focus-within style reveals them).
await tab();
check("Tab from the checkbox reaches the drag handle",
  (await evaluate(`document.activeElement?.dataset.testid`)) === "page-drag-2",
  `active is ${await evaluate(`document.activeElement?.dataset.testid`)}`);
await tab();
const rotateBtn = await evaluate(`document.activeElement?.dataset.testid`);
check("Tab reaches the rotate counter-clockwise overlay button",
  rotateBtn === "page-rotate-ccw-2", `active is ${rotateBtn}`);
await enter();
check("Enter rotates the focused page (badge shows 270°)",
  (await evaluate(
    `[...document.querySelectorAll('[data-testid="page-card-2"] span')].some((s) => s.textContent === '270°')`,
  )) === true);

// 6. Enter on the delete button removes the page from the output.
await tab(); // rotate-cw
await tab(); // delete
check("Tab reaches the delete overlay button",
  (await evaluate(`document.activeElement?.dataset.testid`)) === "page-delete-2",
  `active is ${await evaluate(`document.activeElement?.dataset.testid`)}`);
await enter();
check("Enter marks the page removed (opacity-40)",
  (await evaluate(
    `document.querySelector('[data-testid="page-card-2"]')?.parentElement?.className.includes('opacity-40')`,
  )) === true);

// 7. The live "N pages" summary reflects the removal (visible on lg).
const visible = await evaluate(`document.querySelector('[data-testid="page-visible-count"]')?.textContent?.trim()`);
check("visible-page summary updates after removal", visible === `${cardCount - 1} pages`, `shows "${visible}"`);
await shot("a11y-picker-after-keyboard");

/* ═══════ summary ═══════ */
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.log("failures:");
  for (const f of failed) console.log(`  - ${f.label}${f.detail ? ` — ${f.detail}` : ""}`);
}
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length > 0 ? 1 : 0);
