import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const REF = "file://" + new URL("../../", import.meta.url).pathname + "stitch_pdftools_web_application_ui";
const OUT = new URL(".", import.meta.url).pathname;
const PROFILE = "/tmp/pdfcheck-ui-profile-cmp";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--remote-debugging-port=9444",
  "--user-data-dir=" + PROFILE,
  "--no-first-run",
  "--disable-gpu",
  "--hide-scrollbars",
  "--allow-file-access-from-files",
  "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9444/json/list")).json();
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
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "eval error");
  return r.result.value;
};
const shot = async (name) => {
  const { data } = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(`${OUT}${name}.png`, Buffer.from(data, "base64"));
};

/** Navigate, then poll until a selector exists (and Tailwind/CDN has settled). */
async function gotoAndWait(url, selector, extraSettle = 1200, tries = 60) {
  await send("Page.navigate", { url });
  for (let i = 0; i < tries; i++) {
    await sleep(500);
    try {
      const found = await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);
      if (found) { await sleep(extraSettle); return true; }
    } catch { /* context may be mid-navigation */ }
  }
  throw new Error(`timeout waiting for ${selector} at ${url}`);
}

await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 2400, deviceScaleFactor: 1, mobile: false });

/* Tailwind 4 emits opacity modifiers as `color-mix(in oklab, …)`, which Chrome
   serialises as `oklab(L a b / A)`. The reference uses plain `rgba()`. They are
   the same colour, so normalise both to "rgb(r,g,b)@alpha" before comparing. */
const NORM = `const norm = (css) => {
  if (!css) return css;
  const m = /^oklab\\(\\s*([-0-9.e]+)\\s+([-0-9.e]+)\\s+([-0-9.e]+)\\s*(?:\\/\\s*([-0-9.e%]+)\\s*)?\\)$/.exec(css);
  if (m) {
    const L = +m[1], A = +m[2], B = +m[3];
    const alpha = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4]);
    const l_ = L + 0.3963377774 * A + 0.2158037573 * B;
    const m_ = L - 0.1055613458 * A - 0.0638541728 * B;
    const s_ = L - 0.0894841775 * A - 1.2914855480 * B;
    const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
    const lin = [
       4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s,
    ];
    const srgb = lin.map((c) => {
      const g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, g)) * 255);
    });
    return 'rgb(' + srgb.join(', ') + ')@' + alpha;
  }
  const r = /^rgba?\\(\\s*([0-9.]+)[,\\s]+([0-9.]+)[,\\s]+([0-9.]+)\\s*(?:[,/]\\s*([0-9.%]+)\\s*)?\\)$/.exec(css);
  if (r) {
    const alpha = r[4] === undefined ? '1' : (r[4].endsWith('%') ? String(parseFloat(r[4]) / 100) : r[4]);
    return 'rgb(' + [+r[1], +r[2], +r[3]].join(', ') + ')@' + alpha;
  }
  return css;
};`;

const probe = (cfg) => `(() => {
  const S = ${JSON.stringify(cfg)};
  ${NORM}
  const px = (el, p) => el ? getComputedStyle(el)[p] : "n/a";
  const sections = [...document.querySelectorAll(S.section)];
  const firstCard = document.querySelector(S.card);
  const badgeOf = (s) => {
    const el = [...s.querySelectorAll('span')].find(x => /^\\d+ Tools$/.test(x.textContent.trim()));
    return el ?? null;
  };
  return {
    categoryNames: sections.map(s => { const h = s.querySelector('h2'); return h ? h.textContent.trim() : null; }),
    categoryOrder: sections.map(s => s.dataset.section ?? s.id),
    badges: sections.map(s => badgeOf(s) ? badgeOf(s).textContent.trim() : null),
    toolCounts: sections.map(s => s.querySelectorAll(S.card).length),
    toolNamesByCategory: sections.map(s => [...s.querySelectorAll(S.card)].map(c => {
      const h = c.querySelector('h3'); return h ? h.textContent.trim() : null;
    })),
    totalTools: document.querySelectorAll(S.card).length,
    navLabels: [...document.querySelectorAll(S.nav)].map(a => a.textContent.trim()),
    pillLabels: [...document.querySelectorAll(S.pill)].map(a => a.textContent.trim()),
    h1: (() => { const el = document.querySelector('h1'); return el ? {
      size: px(el,'fontSize'), weight: px(el,'fontWeight'), tracking: px(el,'letterSpacing'), color: px(el,'color')
    } : null; })(),
    h2: (() => { const el = document.querySelector(S.section + ' h2'); return el ? {
      size: px(el,'fontSize'), weight: px(el,'fontWeight'), tracking: px(el,'letterSpacing'), color: px(el,'color')
    } : null; })(),
    card: firstCard ? {
      radius: px(firstCard,'borderRadius'), padding: px(firstCard,'padding'),
      bg: px(firstCard,'backgroundColor'), display: px(firstCard,'display'),
    } : null,
    cardTitle: (() => { const el = document.querySelector(S.card + ' h3'); return el ? {
      size: px(el,'fontSize'), weight: px(el,'fontWeight'), tracking: px(el,'letterSpacing'), color: px(el,'color')
    } : null; })(),
    cardDesc: (() => { const el = document.querySelector(S.card + ' p'); return el ? {
      size: px(el,'fontSize'), lh: px(el,'lineHeight'), color: px(el,'color'), weight: px(el,'fontWeight')
    } : null; })(),
    badge: (() => {
      const sec = document.querySelector(S.section);
      const el = sec ? badgeOf(sec) : null;
      return el ? { bg: px(el,'backgroundColor'), color: px(el,'color'), radius: px(el,'borderRadius'),
                    size: px(el,'fontSize'), weight: px(el,'fontWeight') } : null;
    })(),
    badgeAccents: sections.map(s => { const el = badgeOf(s); return el ? { bg: norm(px(el,'backgroundColor')), fg: norm(px(el,'color')) } : null; }),
    tileBySection: sections.map(s => {
      const card = s.querySelector(S.card);
      const tile = card ? card.querySelector(S.tile) : null;
      return tile ? { bg: norm(px(tile,'backgroundColor')), fg: norm(px(tile,'color')),
                      w: px(tile,'width'), h: px(tile,'height'), radius: px(tile,'borderRadius') } : null;
    }),
    badgeType: (() => {
      const sec = document.querySelector(S.section);
      const el = sec ? badgeOf(sec) : null;
      return el ? { size: px(el,'fontSize'), weight: px(el,'fontWeight'), tracking: px(el,'letterSpacing') } : null;
    })(),
    tileRadiusRaw: (() => {
      const card = document.querySelector(S.card);
      const tile = card ? card.querySelector(S.tile) : null;
      return tile ? px(tile,'width') : null;
    })(),
    gridColumns: (() => { const el = document.querySelector(S.grid); return el ? px(el,'gridTemplateColumns') : null; })(),
    gridGap: (() => { const el = document.querySelector(S.grid); return el ? px(el,'columnGap') : null; })(),
    pageBg: getComputedStyle(document.body).backgroundColor,
  };
})()`;

const REF_CFG = {
  section: '[data-section]',
  card: 'a.tool-card',
  tile: 'div[class*="w-10"][class*="h-10"]',
  nav: 'nav a[data-path]',
  pill: '.cat-pill',
  grid: '[data-section] .grid',
};
const APP_CFG = {
  section: '[data-section]',
  card: 'a[data-testid^="card-tool-"]',
  tile: '[data-testid^="tile-"]',
  nav: '[data-testid^="nav-"]',
  pill: '[data-testid^="pill-"]',
  grid: '[data-testid^="section-"] > div.grid',
};

console.log("== reference landing ==");
await gotoAndWait(`${REF}/landing_tool_grid_categorized_sections/code.html`, 'a.tool-card', 2000);
const ref = await evaluate(probe(REF_CFG));
await shot("ref-landing");

console.log("== app landing ==");
await gotoAndWait(`${BASE}/`, 'a[data-testid^="card-tool-"]', 2000);
const app = await evaluate(probe(APP_CFG));
await shot("app-landing");

const lines = [];
const cmp = (label, a, b) => lines.push({ same: JSON.stringify(a) === JSON.stringify(b), label, ref: a, app: b });

cmp("category names", ref.categoryNames, app.categoryNames);
cmp("category order", ref.categoryOrder, app.categoryOrder);
cmp("category count badges", ref.badges, app.badges);
cmp("tools per category", ref.toolCounts, app.toolCounts);
cmp("TOTAL tools", ref.totalTools, app.totalTools);
cmp("header nav labels", ref.navLabels, app.navLabels);
cmp("filter pill labels", ref.pillLabels, app.pillLabels);
cmp("tool names per category", ref.toolNamesByCategory, app.toolNamesByCategory);
cmp("h2 section heading type", ref.h2, app.h2);
cmp("card title type", ref.cardTitle, app.cardTitle);
cmp("card description type", ref.cardDesc, app.cardDesc);
cmp("card radius/padding/display", { r: ref.card.radius, p: ref.card.padding, d: ref.card.display },
                                   { r: app.card.radius, p: app.card.padding, d: app.card.display });
cmp("card surface colour", ref.card.bg, app.card.bg);
cmp("grid columns", ref.gridColumns, app.gridColumns);
cmp("grid column gap", ref.gridGap, app.gridGap);
cmp("badge size/weight/tracking", ref.badgeType, app.badgeType);
cmp("badge is a pill in both", /^\d+px$|^9999px$/.test(ref.badge.radius) && app.badge.radius !== "0px", true);
cmp("tile size + radius", ref.tileBySection.map(t => t && { w: t.w, h: t.h, r: t.radius }),
                          app.tileBySection.map(t => t && { w: t.w, h: t.h, r: t.radius }));
cmp("tile ACCENT per section", ref.tileBySection.map(t => t && { bg: t.bg, fg: t.fg }),
                               app.tileBySection.map(t => t && { bg: t.bg, fg: t.fg }));
cmp("badge ACCENT per section", ref.badgeAccents, app.badgeAccents);
cmp("page background", ref.pageBg, app.pageBg);
cmp("h1 type", ref.h1, app.h1);

console.log("\n=== REFERENCE vs APP — LANDING ===");
for (const l of lines) {
  console.log(`${l.same ? "MATCH" : "DIFF "}  ${l.label}`);
  if (!l.same) {
    console.log("        ref: " + JSON.stringify(l.ref));
    console.log("        app: " + JSON.stringify(l.app));
  }
}

/* ── Stepper workspace ── */
const wsProbe = `(() => {
  const px = (el, p) => el ? getComputedStyle(el)[p] : "n/a";
  const h1 = document.querySelector('h1');
  const primary = [...document.querySelectorAll('button')]
    .find(b => /compress/i.test(b.textContent) && b.className.includes('bg-'));
  const stepLabels = [...document.querySelectorAll('span')]
    .map(s => s.textContent.trim()).filter(t => /^Step \\d/.test(t));
  return {
    h1: h1 ? h1.textContent.trim() : null,
    h1Type: h1 ? { size: px(h1,'fontSize'), weight: px(h1,'fontWeight'), tracking: px(h1,'letterSpacing') } : null,
    nav: [...document.querySelectorAll('nav a, [data-testid^="nav-"]')].map(a => a.textContent.trim()),
    stepLabels,
    primaryBtn: primary ? { bg: px(primary,'backgroundColor'), color: px(primary,'color'),
                            radius: px(primary,'borderRadius'), size: px(primary,'fontSize') } : null,
  };
})()`;

console.log("\n== reference stepper workspace ==");
await gotoAndWait(`${REF}/tool_workspace_stepper_flow_compress_pdf/code.html`, 'h1', 2000);
const refWs = await evaluate(wsProbe);
await shot("ref-compress");

console.log("== app stepper workspace (configured state) ==");
await gotoAndWait(`${BASE}/tools/compress`, 'h1', 1500);
// The reference mock only ships the mid-flow screen, so put the app into the
// same state (file chosen) before measuring the primary CTA.
{
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: '[data-testid="input-file"]' });
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [OUT + "fixtures/fixture.pdf"] });
}
await sleep(1600);
const appWs = await evaluate(wsProbe);
const appSteps = await evaluate(`[1,2,3].map(i => document.querySelector('[data-testid="stepper-step-'+i+'"]')?.dataset.status)`);
await shot("app-compress-configured");

console.log("=== REFERENCE vs APP — STEPPER WORKSPACE ===");
for (const label of ["h1", "nav", "stepLabels", "h1Type"]) {
  const same = JSON.stringify(refWs[label]) === JSON.stringify(appWs[label]);
  console.log(`${same ? "MATCH" : "DIFF "}  workspace ${label}`);
  if (!same) {
    console.log("        ref: " + JSON.stringify(refWs[label]));
    console.log("        app: " + JSON.stringify(appWs[label]));
  }
}
console.log("        app step statuses after choosing a file: " + JSON.stringify(appSteps));
{
  const refBtn = refWs.primaryBtn;
  const appBtn = appWs.primaryBtn;
  const same = refBtn && appBtn && refBtn.bg === appBtn.bg && refBtn.radius === appBtn.radius && refBtn.size === appBtn.size;
  console.log(`${same ? "MATCH" : "DIFF "}  primary CTA button`);
  console.log("        ref: " + JSON.stringify(refBtn));
  console.log("        app: " + JSON.stringify(appBtn));
}

ws.close();
chrome.kill("SIGKILL");
