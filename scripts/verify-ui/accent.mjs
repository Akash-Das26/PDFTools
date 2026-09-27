import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const OUT = new URL(".", import.meta.url).pathname;
const PROFILE = "/tmp/pdfcheck-ui-profile-accent";
const FIXTURE = OUT + "fixtures/fixture.pdf";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--remote-debugging-port=9666",
    "--user-data-dir=" + PROFILE,
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9666/json/list")).json();
    const p = list.find((t) => t.type === "page");
    if (p?.webSocketDebuggerUrl) {
      wsUrl = p.webSocketDebuggerUrl;
      break;
    }
  } catch {}
  await sleep(250);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2200, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, pass, actual, expected });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : `\n        actual   ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`}`);
};

async function waitFor(selector, tries = 70) {
  for (let i = 0; i < tries; i++) {
    await sleep(300);
    try {
      if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return;
    } catch {}
  }
  throw new Error("no render: " + selector);
}

async function goto(url, selector) {
  await send("Page.navigate", { url });
  await waitFor(selector);
}

/* Deterministic theme: navigate, wipe any persisted next-themes choice, then
   reload under an emulated `prefers-color-scheme`. Avoids relying on the
   toggle, which carries localStorage state between runs. */
async function openThemed(url, selector, mode) {
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-color-scheme", value: mode }],
  });
  await send("Page.navigate", { url });
  await sleep(1200);
  try {
    await evaluate("localStorage.clear()");
  } catch {}
  await send("Page.reload");
  await waitFor(selector);
  await sleep(700);
}

async function upload(selector = '[data-testid="input-file"]') {
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector });
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [FIXTURE] });
  await sleep(1200);
}

/* Canvas helper: paint a possibly-translucent colour OVER an opaque base and
   read the result, so `bg-primary/10` is measured as actually painted. */
const HELPERS = `
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { ctx.clearRect(0,0,1,1); ctx.fillStyle = css;
    ctx.fillRect(0,0,1,1); const d = ctx.getImageData(0,0,1,1).data;
    return [d[0], d[1], d[2], d[3] / 255]; };
  const hex = ([r,g,b]) => '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
  const paint = (over, base) => { const b = rgba(base); const o = rgba(over);
    return [0,1,2].map(i => Math.round(o[i] * o[3] + b[i] * (1 - o[3]))); };
  const lum = ([r,g,b]) => { const f = c => { c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
`;

const LANDING = `(() => {
  ${HELPERS}
  const root = getComputedStyle(document.documentElement);
  const v = n => root.getPropertyValue(n).trim();
  const card = document.querySelector('a[data-testid^="card-tool-"]');
  const cardBg = getComputedStyle(card).backgroundColor;
  const out = { theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    cardBg: hex(rgba(cardBg)),
    tokens: { primary: v('--primary'), secondary: v('--secondary'), tertiary: v('--tertiary'),
              ai: v('--secondary-hover'), onPrimary: v('--on-primary'),
              primaryContainer: v('--primary-container'), onPrimaryContainer: v('--on-primary-container'),
              successSubtleFg: v('--success-subtle-foreground') },
    badges: {}, tiles: {} };
  for (const cat of ['organize','convert-to','convert-from','edit','security','ai']) {
    const el = document.querySelector('[data-testid="count-' + cat + '"]');
    const cs = getComputedStyle(el);
    const painted = paint(cs.backgroundColor, cardBg);
    out.badges[cat] = { bg: hex(painted), fg: hex(rgba(cs.color)), radius: cs.borderRadius,
      ratio: ratio(rgba(cs.color), painted) };
  }
  for (const accent of ['primary','secondary','tertiary','ai']) {
    const el = document.querySelector('[data-accent="' + accent + '"]');
    const cs = getComputedStyle(el);
    const painted = paint(cs.backgroundColor, cardBg);
    out.tiles[accent] = { bg: hex(painted), fg: hex(rgba(cs.color)), ratio: ratio(rgba(cs.color), painted) };
  }
  const pop = document.querySelector('[data-testid^="badge-popular-"]');
  if (pop) { const cs = getComputedStyle(pop);
    out.popular = { bg: hex(rgba(cs.backgroundColor)), fg: hex(rgba(cs.color)),
      ratio: ratio(rgba(cs.color), rgba(cs.backgroundColor)), radius: cs.borderRadius,
      tracking: cs.letterSpacing }; }
  return out;
})()`;

async function shot(name) {
  const r = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 },
  });
  writeFileSync(`${OUT}${name}.png`, Buffer.from(r.data, "base64"));
}

function reportLanding(label, r) {
  console.log(`\n── ${label} (${r.theme}) — card surface ${r.cardBg} ──`);
  console.log(`   tokens: primary ${r.tokens.primary}  secondary ${r.tokens.secondary}  tertiary ${r.tokens.tertiary}  ai ${r.tokens.ai}`);
  console.log(`           on-primary ${r.tokens.onPrimary}   success-subtle-foreground ${r.tokens.successSubtleFg}`);
  console.log("   count badges (rendered fill + text):");
  for (const [k, b] of Object.entries(r.badges))
    console.log(`     ${k.padEnd(12)} ${b.fg} on ${b.bg}  ${String(b.ratio).padStart(6)}:1  ${b.ratio >= 4.5 ? "PASS" : "FAIL"}`);
  console.log("   icon tiles:");
  for (const [k, t] of Object.entries(r.tiles))
    console.log(`     ${k.padEnd(12)} ${t.fg} on ${t.bg}  ${String(t.ratio).padStart(6)}:1  ${t.ratio >= 4.5 ? "PASS" : "FAIL"}`);
  if (r.popular) console.log(`   Popular badge ${r.popular.fg} on ${r.popular.bg} ${r.popular.ratio}:1 radius ${r.popular.radius} tracking ${r.popular.tracking}`);
  return r;
}

// ── Light landing ────────────────────────────────────────────────────────────
await openThemed(`${BASE}/`, 'a[data-testid^="card-tool-"]', "light");
const light = reportLanding("LANDING", await evaluate(LANDING));
await shot("accent-landing-light");

for (const [cat, b] of Object.entries(light.badges))
  check(`light badge ${cat} >= 4.5:1`, b.ratio >= 4.5, true);
for (const [acc, t] of Object.entries(light.tiles))
  check(`light tile ${acc} >= 4.5:1`, t.ratio >= 4.5, true);
check("light primary is #b70011", light.tokens.primary.toLowerCase(), "#b70011");
check("light badge convert-to uses secondary-fixed (pale chip)", light.badges["convert-to"].bg, "#dbe1ff");
check("light badge edit uses success-subtle (pale chip)", light.badges["edit"].bg, "#dcfce7");
check("light Popular badge is primary-fixed", light.popular?.bg, "#ffdad6");

// ── Dark landing ─────────────────────────────────────────────────────────────
await openThemed(`${BASE}/`, 'a[data-testid^="card-tool-"]', "dark");
const dark = reportLanding("LANDING", await evaluate(LANDING));
await shot("accent-landing-dark");

check("dark theme applied", dark.theme, "dark");
for (const [cat, b] of Object.entries(dark.badges))
  check(`dark badge ${cat} >= 4.5:1`, b.ratio >= 4.5, true);
for (const [acc, t] of Object.entries(dark.tiles))
  check(`dark tile ${acc} >= 4.5:1`, t.ratio >= 4.5, true);
check("dark primary flipped to primary-fixed-dim", dark.tokens.primary.toLowerCase(), "#ffb4ab");
check("dark on-primary flipped to on-primary-fixed", dark.tokens.onPrimary.toLowerCase(), "#410002");
check("dark secondary flipped to secondary-fixed-dim", dark.tokens.secondary.toLowerCase(), "#b4c5ff");
check("dark tertiary flipped to tertiary-fixed-dim", dark.tokens.tertiary.toLowerCase(), "#62df7d");
check("dark ai accent flipped to secondary-fixed", dark.tokens.ai.toLowerCase(), "#dbe1ff");
check("primary-container did NOT flip", dark.tokens.primaryContainer.toLowerCase(), "#dc2626");
check("edit badge keeps its dark foreground in dark mode", dark.badges.edit.fg, "#00682b");

// ── Compress workspace, dark: CTA + step label + file strip ──────────────────
await openThemed(`${BASE}/tools/compress`, '[data-testid="upload-dropzone"]', "dark");
await upload();
const WORK = `(() => {
  ${HELPERS}
  const cta = document.querySelector('[data-testid="button-process"]');
  const cs = getComputedStyle(cta);
  const stepLabel = document.querySelector('[class*="text-primary-container-foreground"]');
  const strip = document.querySelector('[class*="text-on-error-container"]');
  const card = document.querySelector('a[data-testid^="card-tool-"]');
  const base = card ? getComputedStyle(card).backgroundColor : getComputedStyle(document.body).backgroundColor;
  const step = stepLabel ? getComputedStyle(stepLabel) : null;
  const st = strip ? getComputedStyle(strip) : null;
  return {
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    cta: { disabled: cta.disabled, bg: hex(rgba(cs.backgroundColor)), fg: hex(rgba(cs.color)),
           ratio: ratio(rgba(cs.color), rgba(cs.backgroundColor)),
           classes: [...cta.classList].filter(c => c.startsWith('bg-') || c.startsWith('text-')) },
    stepLabel: step ? { fg: hex(rgba(step.color)), ratio: ratio(rgba(step.color), rgba(base)) } : null,
    strip: st ? { fg: hex(rgba(st.color)), bg: hex(rgba(getComputedStyle(strip).backgroundColor)),
                  ratio: ratio(rgba(st.color), rgba(getComputedStyle(strip).backgroundColor)) } : null,
  };
})()`;

const darkWork = await evaluate(WORK);
console.log(`\n── COMPRESS workspace (${darkWork.theme}) ──`);
console.log(`   Process CTA      ${darkWork.cta.fg} on ${darkWork.cta.bg}  ${darkWork.cta.ratio}:1`);
console.log(`   classes: ${darkWork.cta.classes.join(" ")}`);
if (darkWork.stepLabel) console.log(`   active step label ${darkWork.stepLabel.fg}  ${darkWork.stepLabel.ratio}:1`);
if (darkWork.strip) console.log(`   file-strip glyph  ${darkWork.strip.fg} on ${darkWork.strip.bg}  ${darkWork.strip.ratio}:1`);
await shot("accent-compress-dark");

check("dark CTA >= 4.5:1", darkWork.cta.ratio >= 4.5, true);
check("dark CTA label is white (matches reference) and not the flipped on-primary", darkWork.cta.fg, "#ffffff");
if (darkWork.stepLabel) check("dark active step label >= 4.5:1", darkWork.stepLabel.ratio >= 4.5, true);
if (darkWork.strip) check("file-strip glyph >= 4.5:1", darkWork.strip.ratio >= 4.5, true);

// ── Back to light for the same measurements ─────────────────────────────────
await openThemed(`${BASE}/tools/compress`, '[data-testid="upload-dropzone"]', "light");
await upload();
const lightWork = await evaluate(WORK);
console.log(`\n── COMPRESS workspace (${lightWork.theme}) ──`);
console.log(`   Process CTA      ${lightWork.cta.fg} on ${lightWork.cta.bg}  ${lightWork.cta.ratio}:1`);
await shot("accent-compress-light");
check("light CTA >= 4.5:1", lightWork.cta.ratio >= 4.5, true);
check("light CTA label is white, matching the reference exactly", lightWork.cta.fg, "#ffffff");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
const failed = results.filter((r) => !r.pass);
if (failed.length) console.log("FAILURES:\n" + failed.map((f) => `  - ${f.name}`).join("\n"));

ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length ? 1 : 0);
