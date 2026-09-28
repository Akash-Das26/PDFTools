/* Proves batch7.mjs's live-translate branch end to end without a real key.
   A tiny mock speaks just enough of OpenAI's chat-completions shape for the
   service's client; OPENAI_BASE_URL (honoured by the openai SDK) and a fake
   OPENAI_API_KEY are exported into the environment, and drive.sh passes both
   through to the API server — .env sourcing only adds variables, it never
   clears ambient ones, so nothing is written to disk. batch7.mjs then runs
   with a key present, so the LIVE branch executes: 200, the JSON contract,
   markdown, the UI download name — while the keyless 503 assertions are
   skipped by the same branch. The mock translates by table: every fixture
   word becomes its French counterpart, so the output is genuinely different
   text. Nothing here runs unless invoked directly; drive.sh never calls it,
   so this file is inert in every normal verification run. */
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const OUT = new URL("..", import.meta.url).pathname;
const PORT = 8997;

const FRENCH = {
  PDFTools: "PDFTools", verification: "vérification", fixture: "gabarit",
  page: "page", Line: "Ligne", of: "de", body: "corps", text: "texte",
  on: "sur", this: "cette", The: "Le", document: "document", is: "est",
  a: "un", sample: "exemple", test: "test", and: "et", with: "avec",
  the: "le", for: "pour", from: "de", to: "à", in: "dans", it: "il",
};
const translateLine = (line) =>
  line.split(/(\s+)/).map((tok) => FRENCH[tok] ?? tok).join("") || "traduit";

let calls = 0;
const server = createServer((req, res) => {
  if (!req.url.includes("/chat/completions")) {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    calls += 1;
    let pageText = "";
    let number = 0;
    try {
      const parsed = JSON.parse(body);
      const user = parsed.messages?.find((m) => m.role === "user")?.content ?? "";
      const inner = JSON.parse(user);
      pageText = String(inner.text ?? "");
      number = Number(inner.number ?? 0);
    } catch {
      // fall through with empty page text — the service handles prose fallback
    }
    const translated = pageText
      .split(/\n/)
      .map(translateLine)
      .join("\n");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "mock-" + calls,
      object: "chat.completion",
      model: "mock-translate",
      choices: [{
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify({ number, text: translated }),
        },
      }],
    }));
  });
});
server.listen(PORT, () => console.log(`mock openai on :${PORT}`));

const run = spawn("bash", [OUT + "drive.sh", "batch7.mjs"], {
  // Both variables ride the environment: drive.sh sources .env (which does
  // not define either) and the ambient values survive into the API server.
  env: {
    ...process.env,
    OPENAI_API_KEY: "sk-mock-key-for-live-branch",
    OPENAI_BASE_URL: `http://127.0.0.1:${PORT}/v1`,
  },
  stdio: "inherit",
});
run.on("exit", (code) => {
  console.log(`\nmock handled ${calls} chat completion(s)`);
  server.close();
  process.exit(code);
});
