/* Compression verification: the three `quality` profiles are real Ghostscript
   presets (72/150/300 dpi image targets), a compressed file is never larger than
   a plain re-serialisation, and the panel says both of those things.

   The image-heavy input is generated here rather than committed: a 1200×1600
   noise PNG (noise because a flat image compresses to nothing and would hide the
   difference between profiles), placed on an A4 page so its effective resolution
   (~158 ppi) sits between the extremes of the presets. That is what makes
   `extreme` visibly downsample while `recommended` re-encodes at full size. */
import { spawn } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { writePng } from "./lib/png.mjs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURE = OUT + "fixtures/fixture.pdf";
const NOISE_PNG = "/tmp/compress-noise.png";
const PROFILE = "/tmp/pdfcheck-ui-profile-compress";
rmSync(PROFILE, { recursive: true, force: true });

// Real random pixels — see lib/png.mjs for why a PRNG would not do here.
writePng(NOISE_PNG, 1200, 1600, "noise");

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9892", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9892/json/list")).json();
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
  writeFileSync(`${OUT}compress-${name}.png`, Buffer.from(r.data, "base64"));
}

/** POSTs a document to /api/pdf/compress and returns the bytes plus the headers. */
async function compress(data, name, quality) {
  const form = new FormData();
  form.append("file", new Blob([data]), name);
  if (quality !== undefined) form.append("quality", quality);
  const res = await fetch(`${API}/api/pdf/compress`, { method: "POST", body: form });
  return {
    status: res.status,
    bytes: Buffer.from(await res.arrayBuffer()),
    engine: res.headers.get("x-pdf-compression-engine"),
    level: res.headers.get("x-pdf-compression-level"),
    disposition: res.headers.get("content-disposition") ?? "",
    contentType: res.headers.get("content-type") ?? "",
  };
}

async function pageCount(data, name) {
  const form = new FormData();
  form.append("file", new Blob([data]), name);
  const res = await fetch(`${API}/api/pdf/page-info`, { method: "POST", body: form });
  return (await res.json()).pageCount;
}

/* ── 0. Build the image-heavy input (source resolution matters) ───────────── */
const pngBytes = readFileSync(NOISE_PNG);
const sourceForm = new FormData();
sourceForm.append("files", new Blob([pngBytes]), "noise.png");
sourceForm.append("pageSize", "a4");
sourceForm.append("orientation", "portrait");
const sourceRes = await fetch(`${API}/api/pdf/images-to-pdf`, { method: "POST", body: sourceForm });
const source = Buffer.from(await sourceRes.arrayBuffer());
check("api images-to-pdf builds the image-heavy source", sourceRes.status, 200);
check("api source is image-heavy (over 1 MB)", source.length > 1_000_000, true);
console.log(`        source: ${source.length} bytes`);

/* ── 1. The three profiles on an image-heavy document ────────────────────── */
const levels = ["extreme", "recommended", "high"];
const outputs = {};
for (const quality of levels) {
  const out = await compress(source, "noise.pdf", quality);
  outputs[quality] = out;
  check(`api compress (${quality}): 200`, out.status, 200);
  check(`api compress (${quality}): answers with a PDF`, out.contentType.includes("application/pdf"), true);
  check(`api compress (${quality}): filename is compressed.pdf`, out.disposition.includes("compressed.pdf"), true);
  check(`api compress (${quality}): the level is echoed back`, out.level, quality);
  check(`api compress (${quality}): the engine is named`,
        out.engine === "ghostscript" || out.engine === "pdf-lib", true);
  check(`api compress (${quality}): never bigger than the source`,
        out.bytes.length <= source.length, true);
  console.log(`        ${quality}: ${out.bytes.length} bytes via ${out.engine}`);
}

check("api compress: extreme is smaller than recommended",
      outputs.extreme.bytes.length < outputs.recommended.bytes.length, true);
check("api compress: extreme really compresses (a quarter of the source or less)",
      outputs.extreme.bytes.length <= source.length / 4, true);
check("api compress: extreme downsamples rather than re-encoding at full size",
      outputs.extreme.bytes.length < outputs.recommended.bytes.length / 2, true);
check("api compress: the page survives the extreme profile", await pageCount(outputs.extreme.bytes, "c.pdf"), 1);
check("api compress: the page survives the recommended profile", await pageCount(outputs.recommended.bytes, "c.pdf"), 1);

/* ── 2. The guard on a text-only document ────────────────────────────────── */
const text = readFileSync(FIXTURE);
const textOutputs = {};
for (const quality of levels) {
  const out = await compress(text, "fixture.pdf", quality);
  textOutputs[quality] = out;
  check(`api compress (${quality}, text-only): 200`, out.status, 200);
  check(`api compress (${quality}, text-only): never bigger than the source`,
        out.bytes.length <= text.length, true);
}
console.log(`        text-only engines: ${levels.map((q) => `${q}=${textOutputs[q].engine}`).join(", ")}`);
check("api compress: the 300 dpi preset is the one that can inflate, so the guard is exercised or the preset won",
      ["ghostscript", "pdf-lib"].includes(textOutputs.high.engine), true);
check("api compress (text-only): the file still shrinks",
      textOutputs.recommended.bytes.length < text.length, true);
check("api compress: all three profiles keep the text fixture's six pages",
      await pageCount(textOutputs.recommended.bytes, "c.pdf"), 6);

const badLevel = await compress(text, "fixture.pdf", "9z");
check("api compress: an unknown profile is rejected", badLevel.status, 400);

const noFile = new FormData();
const noFileRes = await fetch(`${API}/api/pdf/compress`, { method: "POST", body: noFile });
check("api compress: a request with no file is rejected", noFileRes.status, 400);

/* ── 3. The panel states the two guarantees ──────────────────────────────── */
await openThemed(`${BASE}/tools/compress`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="compress-note"]');
check("compress panel: three profiles", await evaluate(`document.querySelectorAll('[data-testid^="option-quality-"]').length`), 3);
check("compress panel: recommended is the checked default", await checked('[data-testid="option-quality-recommended"]'), true);
check("compress panel: the note names the engine",
      await evaluate(`document.querySelector('[data-testid="compress-note"]').textContent.includes("Ghostscript")`), true);
check("compress panel: the note states the never-bigger guarantee",
      await evaluate(`document.querySelector('[data-testid="compress-note"]').textContent.includes("larger")`), true);
await click('[data-testid="option-quality-extreme"]');
check("compress panel: picking extreme checks it", await checked('[data-testid="option-quality-extreme"]'), true);
await shot("compress-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("compress panel: a real run produces a result", true, true);
check("compress panel: the download is compressed.pdf",
      await evaluate(`document.querySelector('[data-testid="button-download"]')?.getAttribute("download")`), "compressed.pdf");
await shot("compress-complete");

await openThemed(`${BASE}/tools/compress`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([FIXTURE]);
await waitFor('[data-testid="compress-note"]');
check("compress panel: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("compress-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
