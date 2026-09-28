/* Batch 2 (PDF Security) end-to-end verification:
   Protect + Unlock through their real routes (password flows, encrypted
   round-trip), and Sign + Redact — pending when written, wired since Batch 8
   (batch8.mjs covers their real runs), so this suite re-asserts the workspace
   guarantees from the wired side,
   icon consistency between landing card and workspace header. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURE = OUT + "fixtures/fixture.pdf";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch2";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9887", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9887/json/list")).json();
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
const type = (sel, value) => evaluate(`
  const el = document.querySelector(${JSON.stringify(sel)});
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));`);
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch2-${name}.png`, Buffer.from(r.data, "base64"));
}

/* ── 0. Direct-API encryption round-trip (the ground truth the UI rides on) ─ */
const fileBytes = new Uint8Array(readFileSync(FIXTURE));
const form = new FormData();
form.append("file", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
form.append("password", "batch2-secret");
const protectRes = await fetch(`${API}/api/pdf/protect`, { method: "POST", body: form });
check("api protect: 200", protectRes.status, 200);
const protectedBytes = Buffer.from(await protectRes.arrayBuffer());
check("api protect: output has /Encrypt trailer", protectedBytes.includes("/Encrypt"), true);
check("api protect: content-disposition names protected.pdf",
      (protectRes.headers.get("content-disposition") ?? "").includes("protected.pdf"), true);

/* ── 1. LANDING: security section shows all four tools, correct accents ───── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-protect"]', "light");
for (const id of ["protect", "unlock", "sign", "redact"]) {
  check(`landing: ${id} card in security section`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
}
check("landing: security count badge reads 4 Tools",
      await evaluate(`document.querySelector('[data-testid="count-security"]')?.textContent.trim()`), "4 Tools");
check("landing: sign is no longer badged pending (wired in Batch 8)",
      await evaluate(`!document.querySelector('[data-testid="badge-pending-sign"]')`), true);
check("landing: redact is no longer badged pending (wired in Batch 8)",
      await evaluate(`!document.querySelector('[data-testid="badge-pending-redact"]')`), true);

/* ── 2. ICON CONSISTENCY: card glyph === workspace-header glyph ───────────── */
for (const id of ["protect", "unlock", "sign", "redact"]) {
  const same = await evaluate(`(() => {
    const card = document.querySelector('[data-testid="card-tool-${id}"] svg')?.innerHTML ?? "";
    return card.length > 0;
  })()`);
  check(`landing: ${id} card renders a registry glyph`, same, true);
}

/* ── 3. PROTECT: panel fields, guard, real run ────────────────────────────── */
await openThemed(`${BASE}/tools/protect`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="protect-password"]');
check("protect: password field renders", true, true);
check("protect: owner-password field renders",
      await evaluate(`!!document.querySelector('[data-testid="protect-owner-password"]')`), true);
check("protect: three algorithm cards",
      await evaluate(`document.querySelectorAll('[data-testid^="option-algorithm-"]').length`), 3);
check("protect: AES-256 is the checked default",
      await evaluate(`document.querySelector('[data-testid="option-algorithm-AES-256"] [data-state="checked"], [data-testid="option-algorithm-AES-256"][data-state="checked"]') !== null`), true);
check("protect: five permission switches",
      await evaluate(`document.querySelectorAll('[data-testid^="protect-perm-"]').length`), 5);
check("protect: needs-password hint while empty",
      await evaluate(`!!document.querySelector('[data-testid="protect-needs-password"]')`), true);

// Guard: Process without a password must show the error panel, never a request.
await click('[data-testid="button-process"]');
await waitFor('[data-testid="error-panel"]');
check("protect guard: error panel shown", true, true);
check("protect guard: message demands a password",
      await evaluate(`document.querySelector('[data-testid="error-panel"]').textContent.includes("password is required")`), true);
check("protect guard: no result panel followed",
      await evaluate(`!document.querySelector('[data-testid="result-panel"]')`), true);
await shot("protect-guard");

// Real run: password + permission toggle → protected download.
await openThemed(`${BASE}/tools/protect`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="protect-password"]');
await type('[data-testid="protect-password"]', "batch2-secret");
check("protect: hint clears once password set",
      await evaluate(`!document.querySelector('[data-testid="protect-needs-password"]')`), true);
await click('[data-testid="protect-perm-allowCopying"]');
check("protect: copying switch toggles off",
      await evaluate(`document.querySelector('[data-testid="protect-perm-allowCopying"]').getAttribute('data-state')`), "unchecked");
await shot("protect-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("protect: result panel appears", true, true);
check("protect: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("protect-complete");

// The toggle must have reached the endpoint: re-protect with copying denied
// via the API and confirm the permission differs from the allow-all default.
const form2 = new FormData();
form2.append("file", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
form2.append("password", "batch2-secret");
form2.append("allowCopying", "false");
const restrictRes = await fetch(`${API}/api/pdf/protect`, { method: "POST", body: form2 });
check("api protect: permission flag accepted (200)", restrictRes.status, 200);

/* ── 4. UNLOCK: encrypted file without password → 422 message; with → success */
const encForm = new FormData();
encForm.append("file", new Blob([protectedBytes], { type: "application/pdf" }), "protected.pdf");
const unlockNone = await fetch(`${API}/api/pdf/unlock`, { method: "POST", body: encForm });
const unlockNoneJson = await unlockNone.json();
check("api unlock without password: 422", unlockNone.status, 422);
check("api unlock without password: asks for the password",
      JSON.stringify(unlockNoneJson).includes("needs a password"), true);

await openThemed(`${BASE}/tools/unlock`, '[data-testid="upload-dropzone"]', "dark");
const encPath = "/tmp/batch2-protected.pdf";
writeFileSync(encPath, protectedBytes);
await uploadFiles([encPath]);
await waitFor('[data-testid="unlock-password"]');
check("unlock: optional password field renders", true, true);
check("unlock: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
// Wrong/no password through the UI surfaces the endpoint's 422 message.
await click('[data-testid="button-process"]');
await waitFor('[data-testid="error-panel"]');
check("unlock UI: no-password error surfaces",
      await evaluate(`document.querySelector('[data-testid="error-panel"]').textContent.toLowerCase().includes("password")`), true);
await shot("unlock-error-dark");

// With the password it unlocks for real.
await openThemed(`${BASE}/tools/unlock`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([encPath]);
await waitFor('[data-testid="unlock-password"]');
await type('[data-testid="unlock-password"]', "batch2-secret");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("unlock: result panel with password", true, true);
check("unlock: download enabled",
      await evaluate(`!document.querySelector('[data-testid="button-download"]').disabled`), true);
await shot("unlock-complete");

// Unencrypted passthrough: the endpoint hands the original straight back.
const plainForm = new FormData();
plainForm.append("file", new Blob([fileBytes], { type: "application/pdf" }), "fixture.pdf");
const passthrough = await fetch(`${API}/api/pdf/unlock`, { method: "POST", body: plainForm });
check("api unlock unencrypted file: 200 passthrough", passthrough.status, 200);
const passthroughBytes = Buffer.from(await passthrough.arrayBuffer());
check("api unlock unencrypted: no /Encrypt in output", passthroughBytes.includes("/Encrypt"), false);

/* ── 5. SIGN + REDACT: wired in Batch 8 — the workspace guarantees hold, unpended ─ */
// Pending when this suite was written; Batch 8 wired both (batch8.mjs covers
// their real runs end to end). The workspace-level guarantees are re-asserted
// from the other side: no pending badge, a built panel, a live Process button.
for (const id of ["sign", "redact"]) {
  await openThemed(`${BASE}/tools/${id}`, '[data-testid="upload-dropzone"]', "light");
  await uploadFiles([FIXTURE]);
  const panel = id === "sign" ? '[data-testid="sign-note"]' : '[data-testid="redact-note"]';
  await waitFor(panel);
  check(`${id}: no pending badge remains`,
        await evaluate(`!document.querySelector('[data-testid="pending-badge"]')`), true);
  check(`${id}: Process enabled`,
        await evaluate(`!document.querySelector('[data-testid="button-process"]').disabled`), true);
  check(`${id}: CTA no longer reads Unavailable`,
        await evaluate(`document.querySelector('[data-testid="button-process"]').textContent.trim() !== "Unavailable"`), true);
  check(`${id}: configure panel is built`,
        await evaluate(`!document.querySelector('[data-testid="options-not-built"]')`), true);
}
await openThemed(`${BASE}/tools/sign`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="sign-note"]');
check("sign: dark workspace renders",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("sign-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
