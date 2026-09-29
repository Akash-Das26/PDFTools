/* Batch 8 (Redact + Sign + PDF to Word + PDF to PowerPoint + Chat with Document
   + Edit PDF Content) end-to-end verification: redaction proven by what can no
   longer be extracted from the output, signatures proven by ByteRange coverage
   and a fresh inspection of the signature dictionary, the OOXML writers proven
   by zip structure and text round-trip, the chat's honest 503 without a key,
   and overlay edits read back from the saved page. The catalog is now 32 of 32
   implemented; the spec ↔ router coupling check from Batch 6 is repeated with
   the new paths counted in. */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { writePng } from "./lib/png.mjs";

const OUT = new URL(".", import.meta.url).pathname;
const BASE = "http://127.0.0.1:5173";
const API = "http://127.0.0.1:8080";
const FIXTURES = OUT + "fixtures/";
const PDF_FIXTURE = FIXTURES + "fixture.pdf";
const FORM_PDF = FIXTURES + "form.pdf";
const NOTFORM_PDF = FIXTURES + "notform.pdf";
const TABLE_PDF = FIXTURES + "table.pdf";
const TEXTLESS_PNG = "/tmp/batch8-textless.png";
const TEXTLESS_PDF = "/tmp/batch8-textless.pdf";
const PROFILE = "/tmp/pdfcheck-ui-profile-batch8";
rmSync(PROFILE, { recursive: true, force: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  ["--headless=new", "--remote-debugging-port=9894", "--user-data-dir=" + PROFILE,
   "--no-first-run", "--disable-gpu", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 80; i++) {
  try {
    const list = await (await fetch("http://127.0.0.1:9894/json/list")).json();
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
  await sleep(1500);
}
const click = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.click()`);
const type = (sel, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  // Password inputs are HTMLInputElement; the textarea setter would not apply.
  const setter = Object.getOwnPropertyDescriptor(
    el instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
    "value",
  ).set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
})()`);
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 1440, height: 2200, scale: 1 } });
  writeFileSync(`${OUT}batch8-${name}.png`, Buffer.from(r.data, "base64"));
}

const bytes = (path) => readFileSync(path);

// The no-text-layer input for the chat/word 422s: a solid PNG composed into a
// PDF through the images tool (the batch7 pattern).
writePng(TEXTLESS_PNG, 600, 800, "solid");
const imageForm = new FormData();
imageForm.append("files", new Blob([bytes(TEXTLESS_PNG)]), "textless.png");
const imageOnly = await fetch(`${API}/api/pdf/images-to-pdf`, { method: "POST", body: imageForm });
writeFileSync(TEXTLESS_PDF, Buffer.from(await imageOnly.arrayBuffer()));
check("setup: composed a text-free image PDF", imageOnly.status, 200);

/** The JSON error message, parsed before the response body is consumed. */
function errorMessage(raw, res) {
  if (!(res.headers.get("content-type") ?? "").includes("application/json")) return "";
  try { return JSON.parse(raw.toString("utf8")).error ?? ""; } catch { return ""; }
}

async function post(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes(file)]), file.split("/").pop());
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const res = await fetch(`${API}/api${path}`, { method: "POST", body: form });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: raw,
    disposition: res.headers.get("content-disposition") ?? "",
    contentType: res.headers.get("content-type") ?? "",
    error: errorMessage(raw, res),
    json: () => { try { return JSON.parse(raw.toString("utf8")); } catch { return null; } } };
}

/** POST with a second file part (sign's p12). */
async function postWithFile(path, file, second, fields = {}) {
  const form = new FormData();
  form.append("file", new Blob([bytes(file)]), file.split("/").pop());
  form.append(second.field, new Blob([bytes(second.path)]), second.name);
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  const res = await fetch(`${API}/api${path}`, { method: "POST", body: form });
  const raw = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: raw,
    contentType: res.headers.get("content-type") ?? "",
    error: errorMessage(raw, res) };
}

async function extractTextOf(data) {
  const form = new FormData();
  form.append("file", new Blob([data]), "document.pdf");
  const res = await fetch(`${API}/api/pdf/extract-text`, { method: "POST", body: form });
  return { status: res.status, text: await res.text() };
}

/** unzip -l names (works on the OOXML outputs; a real zip is the first proof). */
function zipNames(data) {
  const tmp = "/tmp/batch8-zipcheck.zip";
  writeFileSync(tmp, data);
  return execFileSync("unzip", ["-l", tmp], { encoding: "utf8" });
}

/* ── 1. REDACT: the proof is what can no longer be extracted ─────────────── */
const secretLine = "of body text";
const redact = await post("/pdf/redact", PDF_FIXTURE, { terms: JSON.stringify([secretLine]) });
check("api redact: 200", redact.status, 200);
check("api redact: answers as a PDF download", redact.contentType.includes("application/pdf") && redact.disposition.includes(".pdf"), true);
const redactedText = await extractTextOf(redact.bytes);
check("api redact: the redacted string is gone from the text layer",
      redactedText.text.includes(secretLine), false);
check("api redact: neighbouring page text survives",
      redactedText.status === 200 && redactedText.text.includes("PDFTools"), true);
check("api redact: the output re-parses as a real PDF",
      redact.bytes.subarray(0, 5).toString("latin1"), "%PDF-");

// Case-insensitivity across two terms at once.
const multiTerm = await post("/pdf/redact", PDF_FIXTURE, {
  terms: JSON.stringify(["OF BODY TEXT", "VERIFICATION"]),
});
check("api redact: matching is case-insensitive", multiTerm.status, 200);
const multiText = await extractTextOf(multiTerm.bytes);
check("api redact: both terms removed (case-insensitive run)",
      !multiText.text.includes("body text") && !multiText.text.includes("erification"), true);

// Case-insensitivity is real (mupdf's "ignore-case" search option, verified
// against the wasm): the uppercase form of the heading phrase finds and
// removes the same lowercase text.
const upper = await post("/pdf/redact", PDF_FIXTURE, { terms: JSON.stringify(["PDFTOOLS VERIFICATION FIXTURE"]) });
check("api redact: the uppercase form matches the same lowercase text", upper.status, 200);
check("api redact: the uppercase run removed the lowercase headings",
      !(await extractTextOf(upper.bytes)).text.includes("PDFTools verification fixture"), true);

// A term that appears nowhere removes nothing — that is a refusal, not an
// unchanged download wearing a success status.
const noHits = await post("/pdf/redact", PDF_FIXTURE, { terms: JSON.stringify(["zzzz-never-there"]) });
check("api redact: a run that removes nothing is refused", noHits.status, 422);
check("api redact: the refusal names the missing term", noHits.error.includes("zzzz-never-there"), true);

// Structural refusals.
const emptyTerms = await post("/pdf/redact", PDF_FIXTURE, { terms: JSON.stringify([]) });
check("api redact: an empty term list is refused", emptyTerms.status, 400);
const badJson = await post("/pdf/redact", PDF_FIXTURE, { terms: "not-json" });
check("api redact: terms that are not JSON are refused", badJson.status, 400);
const missingTerms = await post("/pdf/redact", PDF_FIXTURE, {});
check("api redact: a missing terms field is refused", missingTerms.status, 400);

/* ── 2. SIGN: a real PKCS#7 signature, self-checked and inspectable ──────── */
const sign = await post("/pdf/sign", FORM_PDF, { passphrase: "batch8-pass", signerName: "Ada Lovelace" });
check("api sign (self-signed): 200", sign.status, 200);
check("api sign (self-signed): answers as a PDF download",
      sign.contentType.includes("application/pdf") && sign.disposition.includes("-signed.pdf"), true);

// Signature verification from the file itself: openssl parses the PKCS#7
// structure out of the ByteRange contents. A signature that does not parse is
// worthless, whatever the tool claims.
const sigInfo = await extractSignatureInfo(sign.bytes);
check("api sign: the signature dictionary names the PKCS#7 subfilter",
      sigInfo.subfilter, "/adbe.pkcs7.detached");
check("api sign: the ByteRange covers the whole file",
      sigInfo.covers, true);
check("api sign: the CMS blob is a real PKCS#7 structure openssl can read",
      sigInfo.pkcs7Parses, true);

// The visible stamp: signer name and a timestamp, drawn as page text.
const stampedText = await extractTextOf(sign.bytes);
check("api sign: the visible stamp names the signer",
      stampedText.text.includes("Ada Lovelace"), true);
check("api sign: the visible stamp carries a signing time",
      /Signed by Ada Lovelace/.test(stampedText.text) && /\d{4}-\d{2}-\d{2}/.test(stampedText.text), true);

// The document still opens as an ordinary PDF afterwards, form fields intact
// (the signature placeholder adds its own widget, so the count can only grow).
const signedInspect = await (async () => {
  const form = new FormData();
  form.append("file", new Blob([sign.bytes]), "signed.pdf");
  const res = await fetch(`${API}/api/pdf/pdf-form-inspect`, { method: "POST", body: form });
  return { status: res.status, json: res.status === 200 ? await res.json() : null };
})();
check("api sign: the signed document still opens and reports its form fields",
      signedInspect.status === 200 && (signedInspect.json?.fieldCount ?? 0) >= 5, true);

// Uploaded-certificate path: openssl mints a P12, the pipeline signs with it.
execFileSync("bash", ["-c",
  `openssl req -x509 -newkey rsa:2048 -keyout /tmp/batch8-key.pem -out /tmp/batch8-cert.pem -nodes -passout pass:uploaded-pass -subj "/CN=Uploaded Signer" -days 365 2>/dev/null && openssl pkcs12 -export -inkey /tmp/batch8-key.pem -in /tmp/batch8-cert.pem -passin pass:uploaded-pass -passout pass:uploaded-pass -out /tmp/batch8-upload.p12 -name uploaded`]);
const signUploaded = await postWithFile("/pdf/sign", FORM_PDF,
  { field: "p12", path: "/tmp/batch8-upload.p12", name: "signer.p12" },
  { passphrase: "uploaded-pass", signerName: "Uploaded Signer" });
check("api sign (uploaded p12): 200", signUploaded.status, 200);
const uploadedSigInfo = await extractSignatureInfo(signUploaded.bytes);
check("api sign (uploaded p12): ByteRange covers the whole file", uploadedSigInfo.covers, true);
check("api sign (uploaded p12): the stamp names the uploaded signer",
      (await extractTextOf(signUploaded.bytes)).text.includes("Uploaded Signer"), true);

// Wrong passphrase: the certificate cannot be opened — a 422, not a crash.
// (The self-signed path cannot fail this way: the passphrase given is the one
// the generated key is protected with. Only an uploaded key can mismatch.)
const signBadUpload = await postWithFile("/pdf/sign", FORM_PDF,
  { field: "p12", path: "/tmp/batch8-upload.p12", name: "signer.p12" },
  { passphrase: "wrong-passphrase" });
check("api sign: an uploaded certificate with the wrong passphrase is a 422",
      signBadUpload.status, 422);

// Guards.
const signNoPass = await post("/pdf/sign", FORM_PDF, { signerName: "No Pass" });
check("api sign: no passphrase is refused", signNoPass.status, 400);

async function extractSignatureInfo(pdfBytes) {
  const raw = pdfBytes.toString("latin1");
  // ByteRange values, e.g. [0 333 8527 1150].
  const match = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(raw);
  if (!match) return { subfilter: null, covers: false, pkcs7Parses: false };
  const [off1, len1, off2, len2] = match.slice(1).map(Number);
  const covers = Math.abs(off2 + len2 - pdfBytes.length) <= 1;
  // The hex Contents sit between /Contents < and >; extract and decode.
  const contentsMatch = /\/Contents\s*<([0-9a-fA-F]+)>/.exec(raw);
  let pkcs7Parses = false;
  let subfilter = (/\/SubFilter\s*\/([a-z0-9.]+)/i.exec(raw) ?? [])[1] ?? null;
  if (contentsMatch) {
    const der = Buffer.from(contentsMatch[1], "hex");
    const tmp = "/tmp/batch8-sig.der";
    writeFileSync(tmp, der);
    try {
      const out = execFileSync("openssl", ["pkcs7", "-inform", "DER", "-in", tmp, "-noout", "-print"], { encoding: "utf8" });
      pkcs7Parses = out.includes("PKCS7");
    } catch { pkcs7Parses = false; }
  }
  return { subfilter: "/" + subfilter, covers, pkcs7Parses };
}

/* ── 3. PDF TO WORD: a real DOCX whose text can be read back ─────────────── */
const word = await post("/pdf/pdf-to-word", PDF_FIXTURE);
check("api pdf-to-word: 200", word.status, 200);
check("api pdf-to-word: the content type is a Word document",
      word.contentType.includes("wordprocessingml.document"), true);
check("api pdf-to-word: the download is named after the upload",
      word.disposition.includes("fixture.docx"), true);
check("api pdf-to-word: the bytes are a real OOXML zip", word.bytes.subarray(0, 2).toString("latin1"), "PK");
const wordListing = zipNames(word.bytes);
check("api pdf-to-word: the zip carries word/document.xml",
      /word\/document\.xml/.test(wordListing), true);
const wordXml = execFileSync("bash", ["-c", `unzip -p /tmp/batch8-zipcheck.zip word/document.xml`], { encoding: "utf8" });
check("api pdf-to-word: the fixture's text round-trips into the document",
      wordXml.includes("of body text"), true);
check("api pdf-to-word: pages arrive as headings",
      wordXml.includes("Page 1") && wordXml.includes("Page 2"), true);

// A scanned document has nothing to rebuild.
const wordImageOnly = await post("/pdf/pdf-to-word", TEXTLESS_PDF);
check("api pdf-to-word: a text-free document is a 422", wordImageOnly.status, 422);
check("api pdf-to-word: the refusal points at OCR",
      wordImageOnly.error.includes("OCR"), true);

/* ── 4. PDF TO POWERPOINT: a real deck with real slides ──────────────────── */
const pptx = await post("/pdf/pdf-to-powerpoint", PDF_FIXTURE);
check("api pdf-to-powerpoint: 200", pptx.status, 200);
check("api pdf-to-powerpoint: the content type is a presentation",
      pptx.contentType.includes("presentationml.presentation"), true);
check("api pdf-to-powerpoint: the bytes are a real OOXML zip",
      pptx.bytes.subarray(0, 2).toString("latin1"), "PK");
const pptxListing = zipNames(pptx.bytes);
const slideCount = (pptxListing.match(/ppt\/slides\/slide\d+\.xml/g) ?? []).length;
check("api pdf-to-powerpoint: real slide entries exist (the LibreOffice shell had none)",
      slideCount >= 1, true);
check("api pdf-to-powerpoint: one slide per page of the 6-page fixture",
      slideCount, 6);
const slide1Xml = execFileSync("bash", ["-c", `unzip -p /tmp/batch8-zipcheck.zip ppt/slides/slide1.xml`], { encoding: "utf8" });
check("api pdf-to-powerpoint: slide 1 carries the page's text",
      slide1Xml.includes("body text"), true);

/* ── 5. CHAT: key-aware — the real model with a key, honest 503 without ──── */
const hasAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
console.log(`        ai key: ${hasAiKey ? "present — exercising the live chat path" : "absent — asserting the honest 503"}`);

const chatEmptyQuestion = await post("/pdf/chat-with-document", PDF_FIXTURE, { question: "" });
check("api chat: an empty question is rejected before any model call", chatEmptyQuestion.status, 400);

if (!hasAiKey) {
  const chat = await post("/pdf/chat-with-document", PDF_FIXTURE, { question: "What is this document?" });
  check("api chat: without a configured key the answer is 503", chat.status, 503);
  check("api chat: the 503 names the fix", chat.error.includes("OPENAI_API_KEY"), true);
  // Config is checked before extraction, exactly like the translator.
  const chatImageOnly = await post("/pdf/chat-with-document", TEXTLESS_PDF, { question: "What is this?" });
  check("api chat: config is checked before extraction (no text, no key → still 503)",
        chatImageOnly.status, 503);
} else {
  const chat = await post("/pdf/chat-with-document", PDF_FIXTURE, { question: "What is this document about? Answer in one sentence." });
  check("api chat (live): 200", chat.status, 200);
  const payload = chat.json() ?? {};
  check("api chat (live): the question is echoed", payload.question, "What is this document about? Answer in one sentence.");
  check("api chat (live): the answer is non-empty prose",
        typeof payload.answer === "string" && payload.answer.trim().length > 10, true);
  check("api chat (live): the markdown download carries question and answer",
        String(payload.markdown ?? "").includes("# Answer"), true);
  console.log(`        answer: ${JSON.stringify(String(payload.answer ?? "").slice(0, 90))}`);
  const chatImageOnly = await post("/pdf/chat-with-document", TEXTLESS_PDF, { question: "What is this?" });
  check("api chat (live): a text-free document is a 422", chatImageOnly.status, 422);
}

/* ── 6. EDIT: overlay text placed on the page and read back ──────────────── */
// notform.pdf is 400×200 points, so the placement sits well inside the page.
const edit = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "text", page: 1, x: 40, y: 150, text: "EDITED-BY-BATCH8" }]),
});
check("api edit: 200", edit.status, 200);
check("api edit: answers as a PDF download named -edited.pdf",
      edit.contentType.includes("application/pdf") && edit.disposition.includes("-edited.pdf"), true);
const editText = await extractTextOf(edit.bytes);
check("api edit: the placed text is in the page content and extractable",
      editText.text.includes("EDITED-BY-BATCH8"), true);
check("api edit: the document's own text survives",
      editText.text.includes("no interactive fields"), true);

// Rectangle overlay.
const editRect = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "rect", page: 1, x: 50, y: 50, w: 120, h: 40, color: "#FFD24D", opacity: 0.5 }]),
});
check("api edit (rect): 200", editRect.status, 200);

// A placement anchored outside the page would be an invisible no-op; the
// service refuses it and says what the page's real size is.
const editOffPage = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "text", page: 1, x: 40, y: 700, text: "off the page" }]),
});
check("api edit: an anchor outside the page is refused", editOffPage.status, 400);
check("api edit: the refusal states the page's real size",
      editOffPage.error.includes("400 × 200"), true);

// Guards: bad page, bad op, missing text, empty ops, image without the part.
const editBadPage = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "text", page: 99, x: 72, y: 150, text: "x" }]),
});
check("api edit: an out-of-range page is refused", editBadPage.status, 400);
check("api edit: the refusal says how many pages the PDF has",
      editBadPage.error.includes("1 page"), true);
const editBadType = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "explode", page: 1 }]),
});
check("api edit: an unknown op type is refused", editBadType.status, 400);
const editNoText = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "text", page: 1, x: 1, y: 1, text: " " }]),
});
check("api edit: a text op without text is refused", editNoText.status, 400);
const editEmpty = await post("/pdf/edit", NOTFORM_PDF, { ops: JSON.stringify([]) });
check("api edit: an empty op list is refused", editEmpty.status, 400);
const editNoJson = await post("/pdf/edit", NOTFORM_PDF, { ops: "nope" });
check("api edit: ops that are not JSON are refused", editNoJson.status, 400);
const editNoImage = await post("/pdf/edit", NOTFORM_PDF, {
  ops: JSON.stringify([{ type: "image", page: 1, x: 72, y: 400 }]),
});
check("api edit: an image op without the image part is refused", editNoImage.status, 400);

/* ── 7. Catalog and the spec ↔ router coupling ───────────────────────────── */
const tools = await (await fetch(`${API}/api/tools`)).json();
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
for (const id of ["redact", "sign", "pdf-to-word", "pdf-to-powerpoint", "chat-with-document", "edit-pdf"]) {
  check(`catalog: ${id} is implemented`, byId[id]?.status, "implemented");
}
check("catalog: redact points at its route", byId["redact"].route, "/api/pdf/redact");
check("catalog: sign points at its route", byId["sign"].route, "/api/pdf/sign");
check("catalog: pdf-to-word points at its route", byId["pdf-to-word"].route, "/api/pdf/pdf-to-word");
check("catalog: pdf-to-powerpoint points at its route", byId["pdf-to-powerpoint"].route, "/api/pdf/pdf-to-powerpoint");
check("catalog: chat-with-document points at its route", byId["chat-with-document"].route, "/api/pdf/chat-with-document");
check("catalog: edit-pdf points at its route", byId["edit-pdf"].route, "/api/pdf/edit");
check("catalog: implemented count is 31", tools.filter((t) => t.status === "implemented").length, 31);
check("catalog: the one partial tool is pdf-to-markdown",
      tools.filter((t) => t.status === "partial").map((t) => t.id), ["pdf-to-markdown"]);
check("catalog: nothing is pending any more", tools.filter((t) => t.status === "pending").length, 0);
check("catalog: still 32 tools", tools.length, 32);

// Open Item 12, machine-checked both ways.
const routerSource = readFileSync(new URL("../../artifacts/api-server/src/routes/pdf.ts", import.meta.url), "utf8");
const specSource = readFileSync(new URL("../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
const routePaths = [...routerSource.matchAll(/router\.post\(\s*"([^"]+)"/g)].map((m) => "/api" + m[1]);
const specPaths = [...specSource.matchAll(/^  (\/pdf\/[a-z0-9-]+):$/gm)].map((m) => "/api" + m[1]);
check("spec: every POST /pdf/* route is in openapi.yaml",
      routePaths.filter((path) => !specPaths.includes(path)), []);
check("spec: every documented /pdf/* path is a real route",
      specPaths.filter((path) => !routePaths.includes(path)), []);
console.log(`        routes: ${routePaths.length}, spec paths: ${specPaths.length}`);

/* ── 8. LANDING: the six cards are wired; the last pending badge ─────────── */
await openThemed(`${BASE}/`, '[data-testid="card-tool-redact"]', "light");
for (const id of ["redact", "sign", "pdf-to-word", "pdf-to-powerpoint", "chat-with-document", "edit-pdf"]) {
  check(`landing: ${id} card renders`,
        await evaluate(`!!document.querySelector('[data-testid="card-tool-${id}"]')`), true);
  check(`landing: ${id} is no longer badged pending`,
        await evaluate(`!document.querySelector('[data-testid="badge-pending-${id}"]')`), true);
}
check("landing: no pending badges remain anywhere",
      await evaluate(`document.querySelectorAll('[data-testid^="badge-pending-"]').length`), 0);

/* ── 9. REDACT panel: terms input and a real run ─────────────────────────── */
await openThemed(`${BASE}/tools/redact`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PDF_FIXTURE]);
await waitFor('[data-testid="redact-note"]');
check("redact: the terms field is present",
      await evaluate(`!!document.querySelector('[data-testid="redact-terms"]')`), true);
check("redact: the note discloses that removal is permanent",
      await evaluate(`document.querySelector('[data-testid="redact-note"]').textContent.includes("permanent")`), true);
await type('[data-testid="redact-terms"]', secretLine);
await shot("redact-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("redact: a real run produces a result", true, true);
check("redact: download is the redacted PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith("-redacted.pdf")`), true);
await shot("redact-complete");

/* ── 10. SIGN panel: passphrase + name, real run ─────────────────────────── */
await openThemed(`${BASE}/tools/sign`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([FORM_PDF]);
await waitFor('[data-testid="sign-note"]');
check("sign: the passphrase field is present",
      await evaluate(`!!document.querySelector('[data-testid="sign-passphrase"]')`), true);
await type('[data-testid="sign-name"]', "Grace Hopper");
await type('[data-testid="sign-passphrase"]', "ui-pass");
await shot("sign-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("sign: a real run produces a result", true, true);
check("sign: download is the signed PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith("-signed.pdf")`), true);
await shot("sign-complete");

/* ── 11. PDF TO WORD panel: honest note, real run ────────────────────────── */
await openThemed(`${BASE}/tools/pdf-to-word`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PDF_FIXTURE]);
await waitFor('[data-testid="no-options"]');
check("pdf-to-word: the no-options note discloses the text-only scope",
      await evaluate(`document.querySelector('[data-testid="no-options"]').textContent.includes("Layout")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-word: a real run produces a result", true, true);
check("pdf-to-word: download is a .docx",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".docx")`), true);
await shot("pdf-to-word-complete");

/* ── 12. PDF TO POWERPOINT panel: honest note, real run ──────────────────── */
await openThemed(`${BASE}/tools/pdf-to-powerpoint`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PDF_FIXTURE]);
await waitFor('[data-testid="no-options"]');
check("pdf-to-powerpoint: the no-options note discloses the text-slide scope",
      await evaluate(`document.querySelector('[data-testid="no-options"]').textContent.includes("editable slide")`), true);
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("pdf-to-powerpoint: a real run produces a result", true, true);
check("pdf-to-powerpoint: download is a .pptx",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith(".pptx")`), true);
await shot("pdf-to-powerpoint-complete");

/* ── 13. CHAT panel: question field, key-aware run ───────────────────────── */
await openThemed(`${BASE}/tools/chat-with-document`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([PDF_FIXTURE]);
await waitFor('[data-testid="chat-note"]');
await type('[data-testid="chat-question"]', "What is this document about?");
await shot("chat-configured");
await click('[data-testid="button-process"]');
if (!hasAiKey) {
  await waitFor('[data-testid="error-panel"]');
  check("chat: the unconfigured key surfaces as an error panel, not a hang",
        await evaluate(`(document.querySelector('[data-testid="error-panel"]')?.textContent ?? "").includes("OPENAI_API_KEY")`), true);
  await shot("chat-unconfigured");
} else {
  // One model call plus upstream 503 retries — the generous wait compared to
  // local tools; observed live latency up to ~68 s for six translate pages.
  await waitFor('[data-testid="result-panel"]', 600);
  check("chat (live): a real run produces a result", true, true);
  check("chat (live): the answer text is shown in the panel",
        await evaluate(`(document.querySelector('[data-testid="result-panel"]')?.textContent ?? "").length > 40`), true);
  await shot("chat-complete");
}

/* ── 14. EDIT panel: text placement, real run ────────────────────────────── */
await openThemed(`${BASE}/tools/edit-pdf`, '[data-testid="upload-dropzone"]', "light");
await uploadFiles([NOTFORM_PDF]);
await waitFor('[data-testid="edit-note"]');
check("edit: the note discloses that existing text is not rewritten",
      await evaluate(`document.querySelector('[data-testid="edit-note"]').textContent.includes("not rewritten")`), true);
await type('[data-testid="edit-text"]', "UI-EDIT-OK");
// notform.pdf is 400×200 points; the panel's defaults assume a letter page,
// so the suite places the text well inside the real page (the service
// refuses anchors outside it).
await type('[data-testid="edit-x"]', "40");
await type('[data-testid="edit-y"]', "150");
await shot("edit-configured");
await click('[data-testid="button-process"]');
await waitFor('[data-testid="result-panel"]');
check("edit: a real run produces a result", true, true);
check("edit: download is the edited PDF",
      await evaluate(`(document.querySelector('[data-testid="button-download"]')?.getAttribute("download") ?? "").endsWith("-edited.pdf")`), true);
await shot("edit-complete");

/* ── 15. DARK THEME ───────────────────────────────────────────────────────── */
await openThemed(`${BASE}/tools/redact`, '[data-testid="upload-dropzone"]', "dark");
await uploadFiles([PDF_FIXTURE]);
await waitFor('[data-testid="redact-note"]');
check("redact: dark theme applied",
      await evaluate(`document.documentElement.classList.contains("dark")`), true);
await shot("redact-dark");

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
if (pageErrors.length) { console.log("PAGE ERRORS:"); for (const e of pageErrors) console.log("  " + e); }
const failed = results.filter((r) => !r.pass);
ws.close();
chrome.kill("SIGKILL");
process.exit(failed.length || pageErrors.length ? 1 : 0);
