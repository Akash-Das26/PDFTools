import { spawn } from "node:child_process";
import { rmSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const PROFILE = "/tmp/pdfcheck-ui-profile-contrast";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new", "--remote-debugging-port=9555", "--user-data-dir=" + PROFILE,
  "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9555/json/list")).json();
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

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2000, deviceScaleFactor: 1, mobile: false });

async function goto(url, selector) {
  await send("Page.navigate", { url });
  for (let i = 0; i < 60; i++) {
    await sleep(400);
    try { if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return; } catch {}
  }
  throw new Error("no render: " + selector);
}

/* Compute WCAG relative luminance from the ACTUAL rendered pixels, by painting
   the two colours onto a canvas — this avoids hand-converting colour spaces. */
const measurement = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const toRgb = (css) => {
    ctx.clearRect(0,0,1,1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0,0,1,1);
    const d = ctx.getImageData(0,0,1,1).data;
    return [d[0], d[1], d[2]];
  };
  const lum = ([r,g,b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b);
  };
  const ratio = (a, b) => {
    const la = lum(toRgb(a)), lb = lum(toRgb(b));
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const root = getComputedStyle(document.documentElement);
  const v = (n) => root.getPropertyValue(n).trim();
  // Resolve the real, painted tile surfaces.
  const tile = document.querySelector('[data-testid^="tile-"]');
  const card = document.querySelector('a[data-testid^="card-tool-"]');
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  const cardBg = card ? getComputedStyle(card).backgroundColor : bodyBg;
  const tileBg = tile ? getComputedStyle(tile).backgroundColor : bodyBg;
  return {
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    bodyBg, cardBg, tileBg,
    tokens: { primary: v('--primary'), secondary: v('--secondary'), tertiary: v('--tertiary'), ai: v('--secondary-hover') },
    onCard: {
      primary: ratio(v('--primary'), cardBg),
      secondary: ratio(v('--secondary'), cardBg),
      tertiary: ratio(v('--tertiary'), cardBg),
      ai: ratio(v('--secondary-hover'), cardBg),
      foreground: ratio(v('--foreground'), cardBg),
      muted: ratio(v('--muted-foreground'), cardBg),
    },
    onTile: {
      primary: ratio(v('--primary'), tileBg),
      secondary: ratio(v('--secondary'), tileBg),
      tertiary: ratio(v('--tertiary'), tileBg),
      ai: ratio(v('--secondary-hover'), tileBg),
    },
  };
})()`;

await goto(`${BASE}/`, 'a[data-testid^="card-tool-"]');
await sleep(1200);
const light = await evaluate(measurement);

const isDark = await evaluate(`document.documentElement.classList.contains('dark')`);
if (!isDark) { await evaluate(`document.querySelector('[data-testid="theme-toggle"]').click()`); await sleep(1000); }
const dark = await evaluate(measurement);

const report = (label, r) => {
  console.log(`\n── ${label} (${r.theme}) ──`);
  console.log(`   page bg  ${r.bodyBg}   card surface ${r.cardBg}   icon tile ${r.tileBg}`);
  console.log(`   tokens: primary ${r.tokens.primary}  secondary ${r.tokens.secondary}  tertiary ${r.tokens.tertiary}  ai ${r.tokens.ai}`);
  console.log("   contrast on the card surface (WCAG 2.1, 4.5:1 required for text, 3:1 for graphics):");
  for (const [k, ratio] of Object.entries(r.onCard)) {
    const verdict = ratio >= 4.5 ? "PASS text+graphics" : ratio >= 3 ? "FAIL text, pass graphics" : "FAIL both";
    console.log(`     ${k.padEnd(11)} ${String(ratio).padStart(6)}:1   ${verdict}`);
  }
  console.log("   contrast on the tinted icon tile:");
  for (const [k, ratio] of Object.entries(r.onTile)) {
    const verdict = ratio >= 3 ? "ok for graphics" : "FAIL graphics too";
    console.log(`     ${k.padEnd(11)} ${String(ratio).padStart(6)}:1   ${verdict}`);
  }
};

report("LANDING", light);
report("LANDING", dark);

ws.close();
chrome.kill("SIGKILL");
