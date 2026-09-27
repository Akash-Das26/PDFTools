import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const BASE = "http://127.0.0.1:5173";
const OUT = new URL(".", import.meta.url).pathname;
const FIXTURE = OUT + "fixtures/fixture.pdf";
const API = "http://127.0.0.1:8080";
// The whole-catalog panel walk needs a real image for images-to-pdf.
const PNG_FIXTURE = "/tmp/verify-ui-mark.png";
const PROFILE = "/tmp/pdfcheck-ui-profile";

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--remote-debugging-port=9222",
  "--user-data-dir=" + PROFILE,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:9222/json/list")).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("Chrome DevTools endpoint never came up");
}

const ws = new WebSocket(await targetWs());
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});

let nextId = 1;
const pending = new Map();
const pageLogs = [];
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  } else if (msg.method === "Runtime.exceptionThrown") {
    pageLogs.push(
      "EXCEPTION: " +
        (msg.params.exceptionDetails.exception?.description ??
          msg.params.exceptionDetails.text),
    );
  } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
    pageLogs.push(
      "CONSOLE ERROR: " + (msg.params.args ?? []).map((a) => a.value).join(" "),
    );
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      "evaluate failed: " +
        (result.exceptionDetails.exception?.description ??
          JSON.stringify(result.exceptionDetails)),
    );
  }
  return result.result.value;
}

/**
 * Navigate and poll until the page has actually rendered.
 * A fixed sleep is flaky here: the first request also warms Vite's module
 * graph, so a cold start can take well over the previous 3s budget.
 */
async function goto(url, settle = 1500, selector = "[data-testid]" , tries = 60) {
  await send("Page.navigate", { url });
  for (let i = 0; i < tries; i++) {
    await sleep(400);
    try {
      if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) {
        await sleep(settle);
        return;
      }
    } catch { /* mid-navigation */ }
  }
  throw new Error(`page never rendered ${selector} at ${url}`);
}

async function shot(name) {
  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

/** Set the theme deterministically rather than assuming the toggle's state. */
async function setTheme(mode) {
  const current = await evaluate(
    `document.documentElement.classList.contains('dark') ? 'dark' : 'light'`,
  );
  if (current !== mode) {
    await evaluate(`document.querySelector('[data-testid="theme-toggle"]').click()`);
    await sleep(800);
  }
  const actual = await evaluate(
    `document.documentElement.classList.contains('dark') ? 'dark' : 'light'`,
  );
  if (actual !== mode) throw new Error(`could not switch theme to ${mode}`);
}

const results = [];
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ pass, label, actual, expected });
}

async function upload(nodeSelector = '[data-testid="input-file"]', files = [FIXTURE]) {
  const doc = await send("DOM.getDocument");
  const node = await send("DOM.querySelector", {
    nodeId: doc.root.nodeId,
    selector: nodeSelector,
  });
  if (!node.nodeId) throw new Error(`file input not found: ${nodeSelector}`);
  await send("DOM.setFileInputFiles", { nodeId: node.nodeId, files });
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 2400,
  deviceScaleFactor: 1,
  mobile: false,
});

/* ═══════════════════════ 1. LANDING — STRUCTURE ══════════════════════ */

await goto(`${BASE}/`, 1500, 'a[data-testid^="card-tool-"]');

const dom = await evaluate(`(() => {
  const sections = [...document.querySelectorAll('[data-section]')];
  const cards = s => s.querySelectorAll('a[data-testid^="card-tool-"]').length;
  return {
    sectionIds: sections.map(s => s.dataset.section),
    headings: sections.map(s => s.querySelector('h2')?.textContent?.trim()),
    badges: sections.map(s => s.querySelector('[data-testid^="count-"]')?.textContent?.trim()),
    cardsPerSection: sections.map(cards),
    totalCards: document.querySelectorAll('a[data-testid^="card-tool-"]').length,
    pills: [...document.querySelectorAll('[data-testid^="pill-"]')].map(p => p.textContent.trim()),
    nav: [...document.querySelectorAll('[data-testid^="nav-"]')].map(n => n.textContent.trim()),
    cardNames: [...document.querySelectorAll('a[data-testid^="card-tool-"] h3')].map(h => h.textContent.trim()),
    pendingBadges: document.querySelectorAll('[data-testid^="badge-pending-"]').length,
    popularBadges: [...document.querySelectorAll('a[data-testid^="card-tool-"] span')]
      .map(s => s.textContent.trim()).filter(t => t === 'Popular').length,
    quickDropzone: !!document.querySelector('[data-testid="quick-dropzone"]'),
    valueStrip: !!document.querySelector('[data-testid="count-organize"]'),
    searchBar: !!document.querySelector('[data-testid="tool-search"]'),
    headerSearch: !!document.querySelector('[data-testid="header-search"]'),
    themeToggle: !!document.querySelector('[data-testid="theme-toggle"]'),
    sectionsStickyAbsent: true,
  };
})()`);

check("section order", dom.sectionIds, ["organize","convert-to","convert-from","edit","security","ai"]);
check("section headings", dom.headings, ["Organize PDF","Convert to PDF","Convert from PDF","Edit PDF","PDF Security","AI Document Tools"]);
check("count badges", dom.badges, ["7 Tools","6 Tools","6 Tools","5 Tools","4 Tools","4 Tools"]);
check("cards per section", dom.cardsPerSection, [7,6,6,5,4,4]);
check("total cards = 32", dom.totalCards, 32);
check("badges equal rendered card count", dom.badges.map(b=>parseInt(b,10)), dom.cardsPerSection);
check("filter pills (reference order)", dom.pills, ["All Tools","Organize PDF","Convert to PDF","Convert from PDF","Edit PDF","Security","AI Document Tools"]);
check("header nav (reference order)", dom.nav, ["Organize","Convert","Edit","Security","AI"]);
// The pending count moves with every batch that wires a backend: 14 before
// Batch 5, 11 after Word/PowerPoint/Excel to PDF became implemented.
check("11 backend-pending cards badged", dom.pendingBadges, 11);
check("2 Popular ribbons", dom.popularBadges, 2);
check("hero quick-dropzone present", dom.quickDropzone, true);
check("landing search bar present", dom.searchBar, true);
check("header search trigger present", dom.headerSearch, true);
check("theme toggle present", dom.themeToggle, true);

/* ═══════════════════════ 2. LANDING — TOKENS ═════════════════════════ */

// Fresh load so no filter/dialog state from earlier steps can leak in.
await goto(`${BASE}/`, 1200, 'a[data-testid^="card-tool-"]');

const tokens = await evaluate(`(() => {
  const root = getComputedStyle(document.documentElement);
  const v = n => root.getPropertyValue(n).trim();
  const cls = (testid) => {
    const el = document.querySelector('[data-testid="'+testid+'"]');
    return el ? [...el.classList] : 'MISSING';
  };
  const logo = document.querySelector('[data-testid="logo-mark"]');
  return {
    logoFound: !!logo,
    primary: v('--primary'),
    primaryContainer: v('--primary-container'),
    primaryHover: v('--primary-hover'),
    secondary: v('--secondary'),
    secondaryContainer: v('--secondary-container'),
    secondaryHover: v('--secondary-hover'),
    tertiary: v('--tertiary'),
    tertiaryContainer: v('--tertiary-container'),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    logoBg: logo ? getComputedStyle(logo).backgroundColor : 'MISSING',
    logoClasses: logo ? [...logo.classList].join(' ') : 'MISSING',
    organizeTile: cls('tile-merge').join(' '),
    organizeAccent: document.querySelector('[data-testid="tile-merge"]')?.dataset.accent,
    compressTile: cls('tile-compress').join(' '),
    convertToTile: cls('tile-word-to-pdf').join(' '),
    convertFromTile: cls('tile-pdf-to-word').join(' '),
    editTile: cls('tile-edit-pdf').join(' '),
    securityTile: cls('tile-protect').join(' '),
    aiTile: cls('tile-ai-summarize').join(' '),
    badgeOrganize: cls('count-organize').join(' '),
    badgeAi: cls('count-ai').join(' '),
  };
})()`);

check("token --primary = #B70011", tokens.primary, "#b70011");
check("token --primary-container = #DC2626", tokens.primaryContainer, "#dc2626");
check("token --primary-hover = #B91C1C", tokens.primaryHover, "#b91c1c");
check("token --secondary = #0051D5", tokens.secondary, "#0051d5");
check("token --secondary-container = #316BF3", tokens.secondaryContainer, "#316bf3");
check("token --secondary-hover = #1D4ED8", tokens.secondaryHover, "#1d4ed8");
check("token --tertiary = #00682B", tokens.tertiary, "#00682b");
check("token --tertiary-container = #008438", tokens.tertiaryContainer, "#008438");
check("light body bg #FFFFFF", tokens.bodyBg, "rgb(255, 255, 255)");
// Foreground aligns to `on-surface` (#0B1C30) — the value the reference screens
// actually render with, from the same precision_pdf_utility token set.
check("light body fg = on-surface #0B1C30", tokens.bodyColor, "rgb(11, 28, 48)");
check("logo mark present", tokens.logoFound, true);
check("logo mark bg = primary (red, not blue)", tokens.logoBg, "rgb(183, 0, 17)");
check("logo mark uses the primary token", /bg-primary/.test(tokens.logoClasses), true);
check("organize tile = bg-primary/10 text-primary", /bg-primary\/10/.test(tokens.organizeTile) && /text-primary/.test(tokens.organizeTile), true);
check("compress tile reuses organize accent", tokens.compressTile, tokens.organizeTile);
check("convert-to tile = bg-secondary/10 text-secondary", /bg-secondary\/10/.test(tokens.convertToTile) && /text-secondary/.test(tokens.convertToTile), true);
check("convert-from tile = bg-secondary/10 text-secondary", /bg-secondary\/10/.test(tokens.convertFromTile) && /text-secondary/.test(tokens.convertFromTile), true);
check("edit tile = bg-tertiary/10 text-tertiary", /bg-tertiary\/10/.test(tokens.editTile) && /text-tertiary/.test(tokens.editTile), true);
check("security tile = bg-primary/10 text-primary", /bg-primary\/10/.test(tokens.securityTile) && /text-primary/.test(tokens.securityTile), true);
check("ai tile = bg-secondary-container/20 text-secondary-hover", /bg-secondary-container\/20/.test(tokens.aiTile) && /text-secondary-hover/.test(tokens.aiTile), true);
// Colour utilities only — the custom type scale also starts with `text-`, so it
// has to be excluded or every typographic class looks like a colour conflict.
const SCALE = /^text-(headline|body|label|code)-/;
const colorTokens = (classes) => classes.split(' ')
  .filter((c) => /^(bg|text)-/.test(c) && !SCALE.test(c))
  .sort().join(' ');
check("count badge reuses the section's accent tokens", colorTokens(tokens.badgeOrganize), colorTokens(tokens.organizeTile));
check("ai count badge uses the ai accent tokens", colorTokens(tokens.badgeAi), "bg-secondary-container/20 text-secondary-hover");

await shot("landing-light");

/* ── Search ── */
await evaluate(`document.querySelector('[data-testid="tool-search"]').focus()`);
await send("Input.insertText", { text: "shrink" });
await sleep(900);
const searched = await evaluate(`(() => ({
  visible: [...document.querySelectorAll('a[data-testid^="card-tool-"] h3')].map(h => h.textContent.trim()),
  badges: [...document.querySelectorAll('[data-testid^="count-"]')].map(b => b.textContent.trim()),
}))()`);
check("keyword search 'shrink' -> Compress only", searched.visible, ["Compress PDF"]);
check("badge follows search", searched.badges, ["1 Tools"]);
// Clear the search box with Escape (the input's own handler) — `reset-search`
// only exists in the no-results state, so it is not the right control here.
await evaluate(`document.querySelector('[data-testid="tool-search"]').focus()`);
await send("Input.dispatchKeyEvent", {
  type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27,
});
await sleep(700);
check("Escape clears the search", await evaluate(`document.querySelectorAll('a[data-testid^="card-tool-"]').length`), 32);

/* ── Pills filter ── */
await evaluate(`document.querySelector('[data-testid="pill-edit"]').click()`);
await sleep(700);
const pillEdit = await evaluate(`[...document.querySelectorAll('[data-section]')].map(s => s.dataset.section)`);
check("Edit pill shows only the Edit section", pillEdit, ["edit"]);
await evaluate(`document.querySelector('[data-testid="pill-all"]').click()`);
await sleep(600);
check("All Tools pill restores all 6 sections", await evaluate(`document.querySelectorAll('[data-section]').length`), 6);

// Empty state: a query that matches nothing
await evaluate(`document.querySelector('[data-testid="tool-search"]').focus()`);
await send("Input.insertText", { text: "zzzzz" });
await sleep(800);
const empty = await evaluate(`(() => ({
  empty: !!document.querySelector('[data-testid="tools-empty"]'),
  reset: !!document.querySelector('[data-testid="reset-search"]'),
  sections: document.querySelectorAll('[data-section]').length,
}))()`);
check("no-match query shows the empty state", empty.empty && empty.reset, true);
check("no-match query hides all sections", empty.sections, 0);
await evaluate(`document.querySelector('[data-testid="reset-search"]').click()`);
await sleep(700);
check("Clear Search restores 32 cards", await evaluate(`document.querySelectorAll('a[data-testid^="card-tool-"]').length`), 32);

/* ── ⌘K palette ── */
await evaluate(`document.querySelector('[data-testid="header-search"]').click()`);
await sleep(700);
const palette = await evaluate(`(() => ({
  open: !!document.querySelector('[role="dialog"] input'),
  tools: document.querySelectorAll('[data-testid^="command-tool-"]').length,
}))()`);
check("⌘K palette opens", palette.open, true);
check("palette lists all 32 tools", palette.tools, 32);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(600);

/* ═══════════════════════ 3. DARK THEME LANDING ═══════════════════════ */

// Fresh load, then switch theme, so the dark capture is a clean read of the
// dark theme rather than a mutated light page.
await goto(`${BASE}/`, 1200, 'a[data-testid^="card-tool-"]');
await setTheme("dark");
await sleep(900);
const dark = await evaluate(`(() => {
  const root = getComputedStyle(document.documentElement);
  const v = n => root.getPropertyValue(n).trim();
  const cls = id => {
    const el = document.querySelector('[data-testid="'+id+'"]');
    return el ? [...el.classList].join(' ') : 'MISSING';
  };
  return {
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    surface: v('--surface'),
    border: v('--border'),
    muted: v('--muted-foreground'),
    primary: v('--primary'),
    secondary: v('--secondary'),
    tertiary: v('--tertiary'),
    cardBg: getComputedStyle(document.querySelector('a[data-testid^="card-tool-"]')).backgroundColor,
    cards: document.querySelectorAll('a[data-testid^="card-tool-"]').length,
    badges: [...document.querySelectorAll('[data-testid^="count-"]')].map(b => b.textContent.trim()),
    organizeTile: cls('tile-merge'),
    aiTile: cls('tile-ai-summarize'),
    tileCount: document.querySelectorAll('[data-testid^="tile-"]').length,
  };
})()`);
check("dark body bg #0B0B0C", dark.bodyBg, "rgb(11, 11, 12)");
check("dark body fg #F4F4F5", dark.bodyColor, "rgb(244, 244, 245)");
check("dark token --surface = #18181B", dark.surface, "#18181b");
check("dark token --border = #27272A", dark.border, "#27272a");
check("dark token --muted-foreground = #A1A1AA", dark.muted, "#a1a1aa");
check("dark card bg = surface", dark.cardBg, "rgb(24, 24, 27)");
/* These three assert the DARK-ONLY accent override. The light-mode hues are
   unreadable as accent text on the dark canvas (primary was 2.55:1 against
   #18181B, DESIGN.md requires 4.5:1), so dark inverts each accent to its
   precision_pdf_utility `-fixed-dim` sibling. The fill/CTA tokens
   (`primary-container`, `on-primary-container`) deliberately stay put —
   see the checks for those directly below. */
check("dark accent override: primary -> primary-fixed-dim", dark.primary, "#ffb4ab");
check("dark accent override: secondary -> secondary-fixed-dim", dark.secondary, "#b4c5ff");
check("dark accent override: tertiary -> tertiary-fixed-dim", dark.tertiary, "#62df7d");
check("dark: 32 cards", dark.cards, 32);
check("dark: 32 accent tiles", dark.tileCount, 32);
check("dark badges unchanged", dark.badges, ["7 Tools","6 Tools","6 Tools","5 Tools","4 Tools","4 Tools"]);
check("dark organize tile still bg-primary/10 text-primary", /bg-primary\/10/.test(dark.organizeTile) && /text-primary/.test(dark.organizeTile), true);
check("dark ai tile still secondary-container/20", /bg-secondary-container\/20/.test(dark.aiTile) && /text-secondary-hover/.test(dark.aiTile), true);

await shot("landing-dark");

/* ════════════════ 4. STEPPER TEMPLATE — COMPRESS ═══════════════════ */

await goto(`${BASE}/tools/compress`, 1200, '[data-testid="upload-dropzone"]');
await setTheme("light");
await sleep(700);

const c1 = await evaluate(`(() => ({
  steps: document.querySelectorAll('[data-testid^="stepper-step-"]').length,
  statuses: [1,2,3].map(i => document.querySelector('[data-testid="stepper-step-'+i+'"]')?.dataset.status),
  dropzone: !!document.querySelector('[data-testid="upload-dropzone"]'),
  browse: !!document.querySelector('[data-testid="button-browse-files"]'),
  process: !!document.querySelector('[data-testid="button-process"]'),
  wire: document.querySelector('[data-testid="wire-status"]')?.dataset.status,
  h1: document.querySelector('h1')?.textContent.trim(),
  iconClasses: [...document.querySelector('[data-testid="workspace-tool-icon"]').classList].join(' '),
}))()`);
check("stepper has 3 steps", c1.steps, 3);
check("empty: step 1 active, 2/3 queued", c1.statuses, ["active","queued","queued"]);
check("empty state = dropzone only", c1.dropzone && c1.browse, true);
check("no process button before a file", c1.process, false);
check("wire status = implemented", c1.wire, "implemented");
check("workspace title", c1.h1, "Compress PDF");
check("workspace icon classes = same accent tokens as the card", /bg-primary\/10/.test(c1.iconClasses) && /text-primary/.test(c1.iconClasses), true);
await shot("compress-light-empty");

await upload();
await sleep(1300);
const c2 = await evaluate(`(() => {
  const item = document.querySelector('[data-testid="option-quality-recommended"]');
  const radio = item?.querySelector('[role="radio"]');
  return {
    statuses: [1,2,3].map(i => document.querySelector('[data-testid="stepper-step-'+i+'"]')?.dataset.status),
    strip: document.querySelector('[data-testid="file-strip-name"]')?.textContent.trim(),
    configure: !!document.querySelector('[data-testid="workspace-configure"]'),
    presets: document.querySelectorAll('[data-testid^="option-quality-"]').length,
    recommendedState: radio?.getAttribute('data-state'),
    processLabel: document.querySelector('[data-testid="button-process"]')?.textContent.trim(),
    processDisabled: document.querySelector('[data-testid="button-process"]')?.disabled,
    replace: !!document.querySelector('[data-testid="button-replace-file"]'),
  };
})()`);
check("file selected: step 1 complete", c2.statuses[0], "complete");
check("file selected: step 2 active", c2.statuses[1], "active");
check("file selected: step 3 queued", c2.statuses[2], "queued");
check("file strip shows the filename", c2.strip, "fixture.pdf");
check("configure slot rendered", c2.configure, true);
check("3 compression presets", c2.presets, 3);
check("recommended preset checked", c2.recommendedState, "checked");
check("process button enabled", c2.processDisabled, false);
check("replace control present", c2.replace, true);
await shot("compress-light-configured");

// Slow the network so the processing state is genuinely observable.
await send("Network.emulateNetworkConditions", {
  offline: false, latency: 1500, downloadThroughput: 100000, uploadThroughput: 100000,
});
await evaluate(`document.querySelector('[data-testid="button-process"]').click()`);
await sleep(700);
const proc = await evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="processing-panel"]'),
  percent: document.querySelector('[data-testid="processing-percent"]')?.textContent.trim(),
  label: document.querySelector('[data-testid="processing-label"]')?.textContent.trim(),
  cancel: !!document.querySelector('[data-testid="button-cancel"]'),
  progressBar: !!document.querySelector('[data-testid="processing-progress"]'),
}))()`);
check("processing state renders", proc.panel, true);
check("processing shows tool-specific status", proc.label, "Compressing streams...");
check("processing shows a percentage", typeof proc.percent === "string" && proc.percent.endsWith("%"), true);
check("progress bar present", proc.progressBar, true);
check("cancel button present", proc.cancel, true);
await shot("compress-light-processing");

await send("Network.emulateNetworkConditions", {
  offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
});
await sleep(3000);
const c3 = await evaluate(`(() => ({
  result: !!document.querySelector('[data-testid="result-panel"]'),
  delta: document.querySelector('[data-testid="result-delta"]')?.textContent.trim(),
  download: !!document.querySelector('[data-testid="button-download"]'),
  again: !!document.querySelector('[data-testid="button-process-another"]'),
  step3: document.querySelector('[data-testid="stepper-step-3"]')?.dataset.status,
}))()`);
check("complete state = result panel", c3.result, true);
check("compress reports a size delta", typeof c3.delta === "string" && c3.delta.includes("%"), true);
check("download button present", c3.download, true);
check("process-another present", c3.again, true);
check("complete: step 3 active", c3.step3, "active");
await shot("compress-light-complete");

// Reset returns to the empty state
await evaluate(`document.querySelector('[data-testid="button-process-another"]').click()`);
await sleep(700);
const reset = await evaluate(`(() => ({
  dropzone: !!document.querySelector('[data-testid="upload-dropzone"]'),
  result: !!document.querySelector('[data-testid="result-panel"]'),
}))()`);
check("process-another resets to empty", reset.dropzone && !reset.result, true);

await setTheme("dark");
await shot("compress-dark-empty");

/* ═════════════ 5. PAGE-PICKER TEMPLATE — REMOVE PAGES ═════════════ */

await goto(`${BASE}/tools/remove-pages`, 1200, '[data-testid="upload-dropzone"]');
await setTheme("light");
await sleep(700);

check("page-picker title", await evaluate(`document.querySelector('h1').textContent.trim()`), "Remove Pages");
check("page-picker empty state = dropzone", await evaluate(`!!document.querySelector('[data-testid="upload-dropzone"]')`), true);

await upload();
await sleep(3000);
const p1 = await evaluate(`(() => ({
  cards: document.querySelectorAll('[data-testid^="page-card-"]').length,
  labels: [...document.querySelectorAll('[data-testid^="page-label-"]')].map(l => l.textContent.trim()),
  checkboxes: document.querySelectorAll('[data-testid^="page-checkbox-"]').length,
  thumbs: document.querySelectorAll('[data-testid^="page-card-"] img').length,
  selectAll: document.querySelector('[data-testid="page-select-all"]')?.textContent.trim(),
  shortcuts: ['all','none','odd','even','invert'].map(m => !!document.querySelector('[data-testid="page-select-'+m+'"]')),
  density: ['S','M','L'].map(d => !!document.querySelector('[data-testid="page-density-'+d+'"]')),
  rotateAll: !!document.querySelector('[data-testid="page-rotate-all"]'),
  summary: document.querySelector('[data-testid="page-selected-summary"]')?.textContent.trim(),
  visible: document.querySelector('[data-testid="page-visible-count"]')?.textContent.trim(),
  configure: !!document.querySelector('[data-testid="workspace-configure"]'),
  wire: document.querySelector('[data-testid="wire-status"]')?.dataset.status,
}))()`);
check("6 page cards", p1.cards, 6);
check("page labels", p1.labels, ["Page 1","Page 2","Page 3","Page 4","Page 5","Page 6"]);
check("6 selection checkboxes", p1.checkboxes, 6);
check("thumbnails rendered from page-info", p1.thumbs, 6);
check("select-all shows live page count", p1.selectAll, "All (6)");
check("5 selection shortcuts", p1.shortcuts, [true,true,true,true,true]);
check("3 density controls", p1.density, [true,true,true]);
check("rotate-all control", p1.rotateAll, true);
check("selection starts empty", p1.summary, "0 selected");
check("visible count", p1.visible, "6 pages");
check("configure slot rendered", p1.configure, true);
check("page-picker wire status", p1.wire, "implemented");
await shot("remove-pages-light");

// Click six checkboxes in ONE tick — this is the stale-state regression test.
await evaluate(`[1,2,3,4,5,6].forEach(n => document.querySelector('[data-testid="page-checkbox-'+n+'"]').click())`);
await sleep(700);
const p2 = await evaluate(`(() => ({
  summary: document.querySelector('[data-testid="page-selected-summary"]')?.textContent.trim(),
  selected: document.querySelectorAll('[data-testid^="page-card-"][data-selected="true"]').length,
}))()`);
check("rapid multi-select: all 6 registered", p2.summary, "6 selected");
check("rapid multi-select: 6 cards selected", p2.selected, 6);

// Clear, then select two
await evaluate(`document.querySelector('[data-testid="page-select-none"]').click()`);
await sleep(500);
await evaluate(`['page-checkbox-2','page-checkbox-4'].forEach(id => document.querySelector('[data-testid="'+id+'"]').click())`);
await sleep(600);
const p3 = await evaluate(`(() => ({
  summary: document.querySelector('[data-testid="page-selected-summary"]')?.textContent.trim(),
  selected: document.querySelectorAll('[data-testid^="page-card-"][data-selected="true"]').length,
}))()`);
check("two selections register", p3.summary, "2 selected");
check("two cards marked selected", p3.selected, 2);

// Selection shortcuts
await evaluate(`document.querySelector('[data-testid="page-select-odd"]').click()`);
await sleep(500);
check("Odd selects 3 pages", await evaluate(`document.querySelector('[data-testid="page-selected-summary"]').textContent.trim()`), "3 selected");
await evaluate(`document.querySelector('[data-testid="page-select-even"]').click()`);
await sleep(500);
check("Even selects 3 pages", await evaluate(`document.querySelector('[data-testid="page-selected-summary"]').textContent.trim()`), "3 selected");
await evaluate(`document.querySelector('[data-testid="page-select-invert"]').click()`);
await sleep(500);
check("Invert flips to 3 pages", await evaluate(`document.querySelector('[data-testid="page-selected-summary"]').textContent.trim()`), "3 selected");
await evaluate(`document.querySelector('[data-testid="page-select-all"]').click()`);
await sleep(500);
check("All selects 6", await evaluate(`document.querySelector('[data-testid="page-selected-summary"]').textContent.trim()`), "6 selected");

// Rotate + delete + reorder
await evaluate(`document.querySelector('[data-testid="page-select-none"]').click()`);
await sleep(400);
await evaluate(`document.querySelector('[data-testid="page-rotate-cw-1"]').click()`);
await evaluate(`document.querySelector('[data-testid="page-rotate-cw-1"]').click()`);
await sleep(500);
check("rotate micro-action accumulates 180°", await evaluate(`document.querySelector('[data-testid="page-card-1"]').innerText.includes('180°')`), true);

await evaluate(`document.querySelector('[data-testid="page-delete-6"]').click()`);
await sleep(500);
const del = await evaluate(`(() => ({
  faded: document.querySelector('[data-testid="page-card-6"]').parentElement.className.includes('opacity-40'),
  visible: document.querySelector('[data-testid="page-visible-count"]')?.textContent.trim(),
  stillThere: !!document.querySelector('[data-testid="page-checkbox-6"]'),
}))()`);
check("delete dims the card but keeps it", del.faded, true);
check("delete drops the visible count to 5", del.visible, "5 pages");
check("delete keeps the page in the order (reversible)", del.stillThere, true);

// Select pages 1 and 2 and run the tool for real
await evaluate(`['page-checkbox-1','page-checkbox-2'].forEach(id => document.querySelector('[data-testid="'+id+'"]').click())`);
await sleep(500);
await evaluate(`document.querySelector('[data-testid="button-process"]').click()`);
await sleep(4500);
const p4 = await evaluate(`(() => ({
  result: !!document.querySelector('[data-testid="result-panel"]'),
  error: !!document.querySelector('[data-testid="error-panel"]'),
  errorText: document.querySelector('[data-testid="error-message"]')?.textContent.trim() ?? null,
  download: !!document.querySelector('[data-testid="button-download"]'),
  deltaAbsent: !document.querySelector('[data-testid="result-delta"]'),
  metaLabels: [...document.querySelectorAll('[data-testid="result-panel"] dt')].map(d => d.textContent.trim()),
}))()`);
check("remove-pages ran against the live route (result or error panel)", p4.result || p4.error, true);
check("remove-pages shows no size delta", p4.deltaAbsent, true);
check("remove-pages produces a download", p4.download, true);
if (p4.error) console.log("   NOTE remove-pages error:", p4.errorText);
await shot("remove-pages-light-complete");

/* ── Page picker in dark ── */
await goto(`${BASE}/tools/remove-pages`, 1200, '[data-testid="upload-dropzone"]');
await setTheme("dark");
await sleep(600);
await upload();
await sleep(3000);
const p5 = await evaluate(`(() => ({
  bodyBg: getComputedStyle(document.body).backgroundColor,
  cards: document.querySelectorAll('[data-testid^="page-card-"]').length,
  cardBg: getComputedStyle(document.querySelector('[data-testid="page-card-1"]')).backgroundColor,
  checkboxBg: getComputedStyle(document.querySelector('[data-testid="page-checkbox-1"]')).backgroundColor,
  headerIcon: [...document.querySelector('[data-testid="workspace-tool-icon"]').classList].join(' '),
}))()`);
check("page-picker dark body bg", p5.bodyBg, "rgb(11, 11, 12)");
check("page-picker dark 6 cards", p5.cards, 6);
check("page-picker dark card uses the dark canvas token", p5.cardBg, "rgb(11, 11, 12)");
check("page-picker dark keeps the accent", /bg-primary\/10/.test(p5.headerIcon), true);
await shot("remove-pages-dark");

/* ════════ 6. BACKEND-PENDING GUARANTEE (definition-of-done item 5) ════════ */

// A pending tool must never be runnable: disabled Process + a visible badge.
await goto(`${BASE}/tools/sign`, 1200, '[data-testid="upload-dropzone"]');
await setTheme("light");
await upload();
await sleep(1200);
const pendingTool = await evaluate(`(() => ({
  badge: !!document.querySelector('[data-testid="pending-badge"]'),
  badgeText: (document.querySelector('[data-testid="pending-badge"]')?.innerText ?? '').slice(0, 60),
  processDisabled: document.querySelector('[data-testid="button-process"]')?.disabled,
  processLabel: document.querySelector('[data-testid="button-process"]')?.textContent.trim(),
  wire: document.querySelector('[data-testid="wire-status"]')?.dataset.status,
}))()`);
check("pending tool shows the not-connected badge", pendingTool.badge, true);
check("pending tool: Process is disabled", pendingTool.processDisabled, true);
check("pending tool: CTA reads Unavailable", pendingTool.processLabel, "Unavailable");
check("pending tool wire status = pending", pendingTool.wire, "pending");
await shot("pending-tool-sign");

// A wired tool with an unbuilt options panel must refuse to run, so the endpoint
// is never called with silently-unset defaults. Until Batch 4 there was always a
// wired-but-panel-less tool to point at for that assertion; now that every wired
// tool has a panel, the stronger whole-catalog invariant replaces it: walk every
// implemented/partial tool and prove none of them falls back to the placeholder.
writeFileSync(
  PNG_FIXTURE,
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);
// Each tool gets a file its own accept list allows, so the walk proves the
// panel renders for a legitimately-selected document (Batch 5 added the three
// Office tools, whose panels only appear for .docx/.pptx/.xlsx uploads).
const WALK_FIXTURES = {
  "images-to-pdf": PNG_FIXTURE,
  "word-to-pdf": OUT + "fixtures/office.docx",
  "ppt-to-pdf": OUT + "fixtures/office.pptx",
  "excel-to-pdf": OUT + "fixtures/office.xlsx",
};
const wiredTools = (await (await fetch(`${API}/api/tools`)).json())
  .filter((tool) => tool.status === "implemented" || tool.status === "partial")
  .map((tool) => tool.id);
const placeholders = [];
const emptyConfigure = [];
const blocked = [];
for (const id of wiredTools) {
  await goto(`${BASE}/tools/${id}`, 500, '[data-testid="upload-dropzone"]');
  await upload('[data-testid="input-file"]', [WALK_FIXTURES[id] ?? FIXTURE]);
  await sleep(900);
  const state = await evaluate(`(() => {
    const configure = document.querySelector('[data-testid="workspace-configure"]');
    return {
      placeholder: !!document.querySelector('[data-testid="options-not-built"]'),
      configureText: (configure?.textContent ?? "").trim().length,
      disabled: !!document.querySelector('[data-testid="button-process"]')?.disabled,
    };
  })()`);
  if (state.placeholder) placeholders.push(id);
  if (state.configureText === 0) emptyConfigure.push(id);
  if (state.disabled) blocked.push(id);
}
check("no wired tool falls back to the not-built placeholder", placeholders, []);
check("every wired tool renders a Configure panel after upload", emptyConfigure, []);
check("every wired tool stays runnable after upload", blocked, []);
console.log(`        walked ${wiredTools.length} wired tools: ${wiredTools.join(", ")}`);

/* ═══════════════════════════ REPORT ═══════════════════════════ */

console.log("\n=== REFERENCE-FIDELITY ASSERTIONS ===");
let failed = 0;
for (const r of results) {
  if (r.pass) {
    console.log(`  PASS  ${r.label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.label}`);
    console.log(`        expected ${JSON.stringify(r.expected)}`);
    console.log(`        actual   ${JSON.stringify(r.actual)}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
if (pageLogs.length) {
  console.log("\n=== PAGE CONSOLE ERRORS ===");
  console.log([...new Set(pageLogs)].slice(0, 15).join("\n"));
} else {
  console.log("\nno page console errors or exceptions");
}
console.log("screenshots:", OUT);

ws.close();
chrome.kill("SIGKILL");
process.exit(failed === 0 ? 0 : 1);
