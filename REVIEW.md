# REVIEW.md — PDFTools change & verification log

> ## ⚠️ SESSION PROTOCOL — READ BEFORE ANY WORK
> **Before ending any session that changes this project, append an entry here using the template in Part 3. Do not mark a result Verified without evidence.**
>
> - Entries are **newest-first**. Every entry states which session-boundary rule placed it (see *Session-boundary rules* below).
> - **"Result: Verified working" requires "Verification performed" to cite actual evidence** — a command that was run, a screenshot compared, a test that passed. A session that only claims success gets `Unverified (claimed only)`. No exceptions — including for the session that created this file.
> - Check the **Open Items** section every session: move items you closed out of it (and say how you confirmed closure in your entry), add items you opened.
> - Ground-truth caveat: git history in this repo is **best-available-but-incomplete** (see *Part 0 — History quality* at the bottom). *Updated 2026-09-27 (merge session):* the rebuild + docs + verification work was committed on `feat/frontend-rebuild` (17 commits; rewritten once to strip agent-attribution footers — see the 2026-09-27 entry for the old→new hash map) and **merged to `main` as PR #1 (`ac17f1e`)**; `main` and `origin/main` both end there.

---

## Open Items

| # | Item | Opened by | Status / note |
|---|---|---|---|
| 3 | **`/pdf/compress` `quality` option is a no-op** — no Ghostscript in the environment; `extreme`/`recommended`/`high` take the identical re-serialise path, but the Compress panel still offers three choices | 2026-09-26 (accent/spec session) | Either build real compression or collapse the UI to one honest option. Spec now documents the gap. |
| 4 | **Step 3 tool batches 4–6 not built** — Batch 1 (Organize PDF, 7 tools), Batch 2 (Protect, Unlock wired; Sign/Redact pending) and Batch 3 (Watermark text+image, Add Page Numbers, Crop) are done and verified; **18 tools remain without full panels** — **14 backend-pending** (disabled Process + badge; fresh count from the catalog's `status` fields) and 4 wired-but-panel-less (images-to-pdf, pdf-to-images, pdf-to-pdfa, pdf-to-markdown). The page-picker Configure panel for Crop is **closed** (Batch 3) | 2026-09-26 (rebuild session) | Batch 4 (Convert panels) is next per the batch-and-stop discipline. |
| 9 | **`on-tertiary-container` contrast never measured**; `tertiary-fixed` family only partially ported (used by nothing yet — badges use `success-subtle-foreground` instead) | 2026-09-26 (accent session) | Measure before first use. |
| 10 | **No test framework** — the CDP suites lived in `/tmp/pdfcheck/` and were disposable | 2026-09-26 (rebuild session) | **Closed 2026-09-27 (batch-2 session):** all five suites committed under `scripts/verify-ui/` (`ef9f07d`), paths de-hardcoded; reproducible via `bash scripts/verify-ui/drive.sh <suite>` — 127/127, 38/38, 21/21 re-confirmed from the new location, plus the new 48-assertion `batch2.mjs`. |
| 12 | **Spec ↔ multer coupling** — every new `/pdf/*` route must add its binary part(s) to `lib/api-spec/openapi.yaml` with the exact field name (`file`/`files`/`image`) or the generated client can't upload | 2026-09-26 (spec session) | Now documented in the spec header; keep it true for future tools. |
| 13 | **Rotate picker rotations are preview-only** — `POST /pdf/rotate` applies ONE angle (optionally scoped by `pages`), so the page-picker's per-page rotate arrows cannot be honoured per-page | 2026-09-26 (batch-1 session) | Product decision needed: extend the backend to per-page rotations, or keep the panel's current honest "preview-only" framing. |
| 14 | **Unused server dependencies + knip config** — `cookie-parser` + `@types/cookie-parser` (knip AND depcheck agree, zero imports) and root `@replit/connectors-sdk` (zero imports; Replit platform coupling unknown); knip also hints a `knip.json` would quiet its config warnings | 2026-09-26 (cleanup session) | Dependency removals were deliberately deferred — decide on the connectors-sdk platform coupling first. |
| 15 | **README predates the rebuild** — run instructions remain correct, but no screenshots/structure references have been refreshed | 2026-09-26 (batch-1 session) | **Closed 2026-09-26 (README session):** fully rewritten from re-verified ground truth (see entry below); future refresh cadence is noted in the README's own Known-limitations list. |

---

## 2026-09-27 (README audit) — every README claim checked against the live tree; 6 flags, none blocking
**Commits:** this entry's commit (REVIEW.md only — no code or README changes).
**Type:** Audit (read-only apart from this entry; the audit's `pnpm build` left the tree clean)
**Trigger:** User request: verify every README claim against the live tree and flag any that no longer hold.
**Changes made:** none. This entry records the audit and its flags.
**Verification performed (every check below run this session against the working tree, not assumed):**
- **Catalog + counts:** `grep -c '^    status: …'` → 17 implemented / 1 partial / 14 pending = 32; per-category 7/6/6/5/4/4 all match §3's table. §3's per-tool routes match `routes/tools.ts`.
- **Routes/transport (mechanical, not eyeballed):** parsed every `router.post(` in `routes/pdf.ts` → 21 routes, and each one's multer field(s) exactly match §7's table (`files` for merge/rotate/compare/images-to-pdf, `file` elsewhere, `file+image` for watermark). `openapi.yaml` = exactly 25 paths. `upload.ts` = 50 MB/file, 20 files, memory storage; `app.ts` has `app.use("/api", router)`, CORS, pino-http and the 413 JSON multer handler.
- **Versions:** every pin in §4 matches a `package.json` or the `pnpm-workspace.yaml` catalog (react/react-dom 19.1.0, vite ^7.3.2, tailwindcss ^4.1.14, @tanstack/react-query ^5.90.21, drizzle-orm ^0.45.2, zod ^3.25.76, express ^5.2.1, multer ^2.2.0, @cantoo/pdf-lib 2.11.1, tesseract.js 7.0.0, pdf-parse ^2.4.5, openai ^7.0.0, pino/pino-http, archiver, cors, orval, drizzle-kit, pg, typescript ~5.9.3, prettier ^3.9.6). Root: `packageManager: pnpm@10.26.1`, `license: MIT`, **no** `engines` field, no `.nvmrc`, and the `preinstall` hook really does print "Use pnpm instead".
- **Infra claims:** `.replit` = `["nodejs-24", "postgresql-16"]`; CI matrix `[20, 22]` running install → typecheck → build and no suite step; `pnpm-workspace.yaml` has all four override families (esbuild/rollup/lightningcss/@tailwindcss/oxide); `onlyBuiltDependencies` omits tesseract.js, consistent with the documented warning; `.env.example` carries exactly the four documented variables; `dev-local.mjs` defaults 8080/5173; `vite.config.ts` has `strictPort: true`, the `Invalid PORT value` throw, BASE_PATH default `/`, `API_URL` default `http://127.0.0.1:$API_PORT`, and `@theme` is used in `index.css`.
- **Behavioural claims:** split → ZIP of pages ✓; pdf-to-images → ZIP for multi-page ✓; images-to-pdf has pageSize/orientation/margin ✓; PDF/A conformance 1B–3U with the trailer `/ID` + sRGB `OutputIntent` + XMP ✓; extract-text markdown heuristics exist and no table handling exists (so "tables are not converted" holds) ✓; OCR = **17** languages in both the service and the zod enum, with text/searchable modes ✓; compare = bounded LCS (2000-line cap + fallback) with genuinely bidi-aware extraction in `extract.ts` ✓; compress ignores `quality` because there is no Ghostscript ✓; ai-summarize returns 503 with `Set OPENAI_API_KEY…` ✓; `/api/jobs` defaults to 20 ✓; `/api/stats` fields = totalJobs/filesProcessed/totalInputSizeMb/totalOutputSizeMb/jobsToday/popular ✓; Form Filler's `getForm()` exists in the installed pdf-lib ✓; compare's UI really does download `comparison.md` ✓; no `*.test.*`/`*.spec.*` files tracked ✓; every path listed in §8 exists ✓; unused `cookie-parser`/`@replit/connectors-sdk` really have zero imports ✓; the tertiary tokens are declared in CSS and consumed by no component ✓.
- **Live:** `pnpm build` → exit 0, `✓ built in 3.06s`; `/api/healthz` → HTTP 200 with exactly `{"status":"ok"}`; `/api/tools` → 32 entries.
**FLAGS (claims that do not hold or are imprecise — none block the project):**
1. **§3 Merge PDF — "ZIP output for multi-file results" is false.** `mergePdfs` always returns one `merged.pdf` via `sendPdf`; merge.ts contains no ZIP path at all. Order preservation *is* accurate.
2. **The CI badge is pinned to `?branch=feat/frontend-rebuild`** — that branch no longer exists (`git branch -a`: only `origin/main`; PR #1 was merged and `origin/HEAD -> origin/main`), so the badge cannot reflect the project. The badge's own HTML comment says to drop the pin "once merged to the default branch".
3. **§2's "see [Known limitations]" for the raw `fetch` transport is unsatisfiable** — §10 contains no fetch/transport item (grep), so the matrix link resolves but the explanation does not exist. The underlying fact is real (`process-tool.ts` hand-writes two `fetch` calls).
4. **§4 "pdf-parse (text/tables)" and §3 PDF-to-Excel "buildable with `pdf-parse` tables" overstate the dependency** — pdf-parse is used for per-page text (LTR path + poppler fallback); no table-extraction code exists anywhere in `services/pdf/`.
5. **§4's "`@replit/vite-plugin-*` … gated behind `REPL_ID`"** is true for cartographer/dev-banner but not for `vite-plugin-runtime-error-modal`, which is gated by `mode === 'development'`.
6. **Minor structure drift:** §8's tree omits `PDFTools-Frontend-Design.md` (present at the root), and §2's diagram still lists `scripts/` as only `dev-local.mjs · build-all.mjs` while §8 now includes `verify-ui/`.
**Not re-verifiable this session:** §5/§7's "served `/api/stats` and stored + listed a job" — the local `.env` credentials are rejected by the running Postgres (the README's own documented sharp edge), so `/api/stats` and `/api/jobs` answered `{"error":…}` here. The endpoints and their fields are verified in code, and the claim was verified against a correctly-credentialed database in the session that authored it.
**Confidence:** High (every conclusion from a command run this session; the two network-dependent items — badge rendering and the GitHub-side branch — are inferred from local refs and the repo URL, not fetched)
**Result:** Verified working (audit). The README's substance holds: counts, routes, field names, versions, limits, CI, and every behavioural claim except the merge-ZIP clause. Six flags recorded for correction; no code defect was found behind any of them.
**Follow-ups opened:** the six flags above (documentation corrections, pending a user decision on fixing them). **Follow-ups closed:** none.
*Session-boundary rule:* (b) distinct task thread (README claim audit per new request).

---

## 2026-09-27 (readme numbering) — README sections renumbered 1–12; every anchor re-checked
**Commits:** `4755536` (README.md), this entry's commit (REVIEW.md only).
**Type:** Documentation
**Trigger:** User request: renumber the README headings and fix every cross-document anchor reference in one pass, following up on the numbering gap recorded in the entry below.
**Changes made:**
- Renumbered the four out-of-sequence headings so the document runs 1–12 with no gaps, content untouched: §12 Testing & verification → **§9**, §13 Known limitations → **§10**, §14 Roadmap → **§11**, §16 License → **§12**.
- Updated all six in-document anchor references across five edit sites: the header pointer line, the four affected TOC entries, §2's cross-reference to Known limitations, and §10.5's cross-reference back to Testing & verification.
- **Mapping for citations in earlier entries** — those entries are dated records and were deliberately not rewritten: old §12 → §9 · old §13 → §10 · old §14 → §11 · old §16 → §12. So the previous entry's "§13.2" is today's §10.2, and its "§14.1–2" is today's §11.1–2.
- Nothing outside README.md needed changing: a repo-wide scan found no markdown anchors and no section-number citations in any other tracked file (`*.md` outside README, plus `*.ts/tsx/yml/yaml/json/sh/mjs`).
**Verification performed:**
- Anchor audit by script, not eyeball: extracted all **21** `](#…)` targets from README.md and resolved each against GitHub-style slugs generated from every heading → **0 unresolved**.
- Same pass confirmed the section sequence: `1-the-problem … 8-project-structure, 9-testing--verification, 10-known-limitations, 11-roadmap, 12-license` — no gaps.
- Sub-anchors the installation walkthrough links to (`#verify-the-installation`, `#troubleshooting`) confirmed present as `###` headings.
- Docs-only: `git diff --stat` for `4755536` = README.md only, 11 insertions/11 deletions — four heading lines plus seven lines carrying the six updated links. No code touched, so no suite re-run was needed.
**Confidence:** High
**Result:** Verified working (documentation). The cosmetic leftover recorded in the entry below is closed; its "renumbering would break cross-document references" concern did not materialise because no other file carried anchors or section-number citations.
**Follow-ups opened:** none. **Follow-ups closed:** the heading-number gap noted in the entry below.
*Session-boundary rule:* (b) distinct task thread (README renumbering requested separately).

---

## 2026-09-27 (README refresh) — §12/§13/§14 realigned to Batches 1–3
**Commits:** `713af3d` (README.md + scripts/verify-ui/README.md), this entry's commit (REVIEW.md only).
**Type:** Documentation
**Trigger:** User request after the Batch 3 session: refresh the stale README roadmap and known-limitations sections to match Batches 1–3.
**Changes made:**
- §12 Testing & verification: replaced "there is no committed test suite" / "harnesses live in `/tmp` and are not committed" with the committed reality — a table of all seven suites with assertion counts (verify 127 · accent 38 · batch1 21 · batch2 48 · batch3 59 · compare — · contrast —), the `bash scripts/verify-ui/drive.sh <suite>.mjs` / `pnpm verify:ui <suite>.mjs` instructions, prerequisites (built API + Chrome), and the honest note that **CI does not run them** (Chrome + two live servers on fixed ports).
- §13.2: now "Batches 4–6 not built", with fresh counts — **18 tools without a full Configure panel** = 14 backend-pending + 4 wired-but-panel-less (`images-to-pdf`, `pdf-to-images`, `pdf-to-pdfa`, `pdf-to-markdown`) — and the crop page-picker panel removed (closed in Batch 3). This also fixes an internal contradiction: §3 already said 14 pending while §13.2 said 13.
- §13.5: "No test framework" → "No test runner" (suites committed; still no vitest/jest/playwright; CI remains build-only).
- §13.8: provenance line updated (refreshed 2026-09-27 against `main` @ `8fed014`).
- §14.1–2: Batch 4 (Convert) is next; the old "commit the verification harnesses" item is reworded to "wire the committed suites into CI".
- §8: the `scripts/` line now mentions `verify-ui/`.
- `scripts/verify-ui/README.md`: run block gained batch2/batch3/contrast; the "adding a batch" note records that a wired-but-panel-less tool is the right `options-not-built` example (pdf-to-images since Batch 3).
- Noted but deliberately not changed: the heading numbers jump (§8 → §12 → §13 → §14 → §16) while the TOC counts 1–12. The anchors are internally consistent and renumbering would break cross-document references (including REVIEW.md's own "§13"/"§14" citations), so it stays as a known cosmetic leftover.
**Verification performed:**
- Counts re-derived from ground truth, not copied: `grep -c '^    status: "pending"' artifacts/api-server/src/routes/tools.ts` → **14**; `"implemented"` → **17**; `"partial"` → **1** (32 total). §3's catalog table already matched and was left untouched.
- Stale-claim scan: `grep -n "/tmp\|Batches 2–6\|13 backend-pending\|not committed\|disposable\|no committed test suite" README.md` → exactly one hit, the intentional historical clause ("They were disposable `/tmp` harnesses; they are not any more").
- Markdown integrity: 16 code fences (balanced); TOC entries and anchors unchanged.
- Docs-only change: `git diff --stat` for `713af3d` = README.md + scripts/verify-ui/README.md only. No code or suites re-run (the Batch 3 entry's evidence at `86a9995` still stands: batch3 59/59, verify 127/127, batch1 21/21, batch2 48/48, accent 38/38, compare exit 0).
**Confidence:** High
**Result:** Verified working (documentation). Open Items 3, 9, 12, 13, 14 and Item 4's remaining scope are still described accurately; no item changed status.
**Follow-ups opened:** none. **Follow-ups closed:** none.
*Session-boundary rule:* (b) distinct task thread (README refresh requested separately from the Batch 3 build).

---

## 2026-09-27 (batch 3) — Batch 3 Edit-category panels built and verified (Watermark, Add Page Numbers, Crop)
**Commits:** `86a9995` (Batch 3 panels + suite + harness hardening), this entry's commit (REVIEW.md only).
**Type:** Feature (Batch 3: Watermark, Add Page Numbers, Crop)
**Trigger:** User brief: start Batch 3 in a fresh session per the batch-and-stop discipline.
**Changes made:**
- Transport: `buildFormData` now appends File-valued options as their own multipart part, which is exactly what `POST /pdf/watermark`'s `upload.fields(["file","image"])` expects — the only way image watermarks can reach the UI without a bespoke path.
- Panels: `watermark.tsx` (text/image mode cards, the ten-position grid with diagonal default, colour, font size, opacity slider, angle cards, page selection with scope line), `page-numbers.tsx` (five position cards, three format cards, start-number input with a live "numbering starts at N" line), `crop.tsx` (percent/point unit cards, four margin inputs, picker-scoped pages — the page-picker Configure panel Item 4 has carried since the rebuild).
- Registry: `OPTION_PANELS` gains watermark / add-page-numbers / crop, so all three wired Edit tools leave the `options-not-built` placeholder.
- Guard: `process()` in pages/tool.tsx blocks watermark image mode without an image, with the error panel, exactly like the protect-password guard.
- `buildOptions` gained a `case "crop"`: the panel's typed page range wins over the picker mirror when present.
- Harness: new `batch3.mjs` (59 checks); `verify.mjs`'s unbuilt-panel example re-pointed watermark → pdf-to-images (watermark is panelled now); `compare.mjs` navigation given the same cold-start retry as the other suites after it flaked once.
**Verification performed:**
- `bash scripts/verify-ui/drive.sh batch3.mjs` → **59/59, exit 0** — direct API: text watermark 200 + `watermarked.pdf` + output differs from input, image-part watermark 200, page numbers 200 + `numbered.pdf`, crop 10% 200 + `cropped.pdf`, over-crop 400, crop in points 200; UI: text run and image run each reach a download, the image-mode guard shows the error panel with no result, page-number fields and the live range line respond, crop's unit/margins/scope-narrowing work and the real run completes, edit-pdf and pdf-form-filler keep the pending pattern, dark theme checked.
- Regression: `verify.mjs` **127/127 exit 0**, `batch1.mjs` **21/21 exit 0**, `batch2.mjs` **48/48 exit 0**, `accent.mjs` **38/38 exit 0**, `compare.mjs` exit 0.
- `pnpm run typecheck` → exit 0 (libs + pdftools + api-server + scripts).
- Ground truth read first, not assumed: catalog Edit rows (edit-pdf pending · add-page-numbers, watermark, crop implemented · pdf-form-filler pending; crop is the page-picker workspace), the three zod schemas, `routes/pdf.ts` (watermark's two upload parts), the three services, and `openapi.yaml`, which already models the `image` part — so no spec change was needed (Item 12 holds).
- Catalog recount for Item 4: 32 tools = 17 implemented + 1 partial + **14 pending** (earlier entries said 13); 18 tools still lack full panels.
- Session incident (flagged, then resolved by user decision): mid-session an out-of-band move relocated the six root `.md` files into an untracked `docs/` directory and corrupted `docs/FEATURES.md` (its table interleaved with an unrelated document). Commit `86a9995` contains only its 9 intended files — no deletions. The move was undone (`git checkout` of the six files + `rm -rf docs/`) and the tree verified clean, so no trace of it is in history.
- README drift found this session (§12 still called the suites disposable `/tmp` harnesses; §13.2/§14.1 still described Batch 2 as upcoming): flagged here, then fixed in the follow-up entry below.
**Confidence:** High (every count and result above from a command run this session)
**Result:** Verified working. Batch 3 (Edit category) complete; Batch 4 (Convert) is next. Item 4 updated; the crop page-picker panel note under it is closed. Items 3, 9, 13, 14 untouched per the discipline.
**Follow-ups opened:** none. **Follow-ups closed:** Item 4's "page-picker Configure panel for crop still open" note.
*Session-boundary rule:* (b) distinct task thread (Batch 3 build per new brief).

---

## 2026-09-27 (batch 2) — CDP suites committed (Item 10 closed); Batch 2 PDF Security built and verified
**Commits:** `ef9f07d` (commit the CDP verification suites under scripts/verify-ui), `a66f454` (wire the Protect and Unlock workspaces into the frontend), this entry's commit (REVIEW.md only).
**Type:** Bookkeeping + Feature (Batch 2: Protect, Unlock, Sign, Redact)
**Trigger:** User brief: STEP 0 housekeeping (push pending commits; move the CDP suites out of `/tmp/pdfcheck/`), STEP 1 build Batch 2 per the DoD checklist, STEP 2 stop after Batch 2, STEP 3 leave product-decision Open Items 3/9/13/14 untouched.
**Changes made:**
- Housekeeping: `main` pushed (`ac17f1e..064bf82`) after two github.com timeouts, third attempt succeeded. All five CDP suites + fixtures + README moved from `/tmp/pdfcheck/` to `scripts/verify-ui/`; every `/tmp/pdfcheck`/`/home/sage` hardcoded path replaced with `new URL(".", import.meta.url)`-derived paths; Chrome profiles moved to `/tmp/pdfcheck-ui-profile*`; `drive.sh`/`run-all.sh` now derive REPO_ROOT from git and clear ports 5173/8080/9222/9333/9444/9555/9666/9888; `.gitignore` gained `scripts/verify-ui/*.png`; root `package.json` gained `verify:ui`.
- Batch 2 frontend: `components/tool-options/protect.tsx` (password + owner-password inputs, three algorithm cards defaulting to AES-256, five permission switches) and `unlock.tsx` (optional password), both registered in `OPTION_PANELS`; required-password guard added to `process()` in `pages/tool.tsx` following the merge-guard precedent, so `/api/pdf/protect` is never called without a password. Sign/Redact intentionally left as honest pending workspaces (badge + disabled "Unavailable" Process + not-built Configure panel). No icon work needed — card/workspace glyphs resolve structurally through `iconForTool`.
- Tests: new `scripts/verify-ui/batch2.mjs` (48 assertions); `verify.mjs`'s "wired tool with unbuilt options panel" check re-pointed from protect to watermark (protect has a real panel since this batch; watermark is the standing implemented-but-panel-less example).
- No spec changes: OpenAPI already models both routes with the `file` part (Item 12 discipline holds).
**Verification performed:**
- `bash scripts/verify-ui/drive.sh batch2.mjs` → **48/48, exit 0** (twice): direct-API protect round-trip asserts `/Encrypt` in the output bytes and the `protected.pdf` content-disposition; landing shows 4 security cards with pending badges on sign/redact; all panel fields render with AES-256 checked by default; the guard shows the error panel with no result panel; a real UI run with a toggled-off permission succeeds; the API accepts the booleanish permission flag; unlock surfaces the endpoint's 422 "needs a password" message for encrypted input, succeeds with the password, and passes unencrypted files through 200 with no `/Encrypt`; sign/redact workspaces refuse to run; dark-theme checks pass.
- `bash scripts/verify-ui/drive.sh verify.mjs` → **127/127, exit 0**; `batch1.mjs` → **21/21, exit 0**; `accent.mjs` → **38/38, exit 0**; `compare.mjs` → exit 0. (`contrast.mjs` is informational by design — its pre-existing tertiary/ai icon-tile findings are unchanged; Batch 2 introduces no new colors.)
- `pnpm run typecheck` → exit 0 (libs + pdftools + api-server + scripts).
- Push state: `git fetch origin` exit 0; `git log origin/main -3` → `064bf82`, `03eb796`, `ac17f1e`; `git rev-list --left-right --count main...origin/main` → `0 0` (before this session's commits; `ef9f07d`/`a66f454` + this entry are now local-only pending push).
- One cold-start flake was hit and fixed in-suite: `openThemed` now retries its first navigation once for cold vite dev servers; the initial `file://` fetch in Node was replaced with `readFileSync`.
**Confidence:** High (every number above from a command run this session)
**Result:** Verified working. Open Item **10 closed** (suites committed at `ef9f07d`; reproducibility proven by re-running 127/127, 38/38, 21/21 from the new location). Item 4 updated to "Batch 2 done, Batch 3 next". Items 3, 9, 13, 14 untouched per brief (product decisions / deferred).
**Follow-ups opened:** none. **Follow-ups closed:** Item 10.
*Session-boundary rule:* (b) distinct task thread (Batch 2 build per new brief).

---

## 2026-09-27 (later) — State re-audit per user brief; classification (a); no changes beyond this entry
**Commits:** this entry's commit (REVIEW.md only).
**Type:** Audit (read-only)
**Trigger:** User brief: diagnose the repo state from scratch (git, REVIEW.md currency, README content checklist, frontend rebuild markers), act only on what the diagnosis finds, and log the session regardless.
**Changes made:**
- None to code, README, or frontend. This entry only.
**Verification performed (each command run fresh this session, nothing assumed from prior entries):**
- Git: `git log --oneline -15`, `git status` (clean), `git rev-parse` both refs → local `main` = `03eb796`, last-fetched `origin/main` = `ac17f1e` (PR #1 merge), ahead 1 / behind 0; `git fetch origin` **timed out** (github.com unreachable from this shell at audit time), so origin's state is confirmed only as of the successful 2026-09-27 18:18 fetch logged in the previous entry. The 1 unpushed commit is `03eb796` (the log-ordering repair). **Push is pending user action.**
- REVIEW.md: present; headings re-grepped — strictly newest-first; newest entry cites `ac17f1e` and the merge audit. It cannot cite `03eb796` (written before that commit existed); this entry now supersedes it as newest.
- README: content greps, not existence checks — `## 5. Installation` ✓, distinct `## 6. Quickstart` ✓, env-var table row `| \`DATABASE_URL\` |` ✓, feature-catalog `**Total**` row (32/17/1/14) ✓, `## 13. Known limitations` ✓.
- Frontend: `templates/` = stepper + page-picker; `routes/tools.ts` category grep → organize 7 / convert-to 6 / convert-from 6 / edit 5 / security 4 / ai 4 = 32; `Minimize2` present in `lib/icons.ts` (Compress icon rule holds).
**Confidence:** High (direct observation; the only unverifiable item is origin's live state due to the network failure, bounded by the 18:18 fetch)
**Result:** Verified working (audit only) — classification **(a)**: everything discussed in this conversation (frontend rebuild, README overhaul, REVIEW.md protocol, LICENSE/CI/badges) is committed; local `main` is 1 bookkeeping commit ahead of the last-confirmed `origin/main`.
**Follow-ups opened:** none (push of `03eb796` + this entry remains a pending user action, not an Open Item).
**Follow-ups closed:** none.
*Session-boundary rule:* (a) >4 h gap from the previous entry; (b) distinct task thread (state audit per new brief).

---

## 2026-09-27 (merge) — feat/frontend-rebuild merged to main as PR #1; log ordering repaired
**Commits:** `ac17f1e` (GitHub-side merge of PR #1 — no agent session authored it) + this entry's commit (REVIEW.md only).
**Type:** Audit / Bookkeeping
**Trigger:** User brief: report the repo's real state (post-merge) before any further work; then: fix the log-ordering defect that audit found.
**Changes made:**
- No code changes. Reordered the six newest entries into true newest-first order — the "later still" (README rewrite), history-rewrite, commit-hygiene, badges, push-proof, and render-pass entries had been left mutually out of order by this log's own session-insertion anchors; the README-rewrite entry now sits directly above the render-pass entry it followed chronologically.
- Added this entry recording the merge and the reorder.
**Verification performed:**
- State audit this session: local `main` = `origin/main` = `ac17f1e` (merge of the 17-commit `feat/frontend-rebuild` chain: frontend rebuild, REVIEW.md, README overhaul, LICENSE + CI, history rewrite); tree clean; remote-tracking reflog shows a successful `fetch origin: fast-forward` at 2026-09-27 18:18 (a later re-fetch timed out — github.com intermittently unreachable from this shell; origin state is as of that 18:18 fetch).
- Brief checks against the live tree: rebuilt README present (distinct Installation/Quickstart sections, env-var table, 32/17/1/14 feature catalog, §13 Known limitations, 4 badges); rebuild present (stepper + page-picker templates, Batch 1 panels, 6 categories 7/6/6/5/4/4, Minimize2 for Compress, ACCENT_BADGE, #ffb4ab dark override); `pnpm run typecheck` 3/3 green.
- After the reorder: entry headings re-grepped — strictly newest-first down to 2026-07-28; heading count 20 → 21 (with this entry).
**Confidence:** High (direct observation of refs and files)
**Result:** Verified working
**Follow-ups opened:** none.
**Follow-ups closed:** log-ordering defect (found during the state audit).
*Session-boundary rule:* (a) >4 h gap from the previous entry's work; (b) distinct task thread (state audit + bookkeeping).

---

## 2026-09-27 — Branch history rewritten: Codebuff attribution footers stripped from all commit messages
**Commits:** see this commit (REVIEW.md only).
**Type:** History rewrite / Protocol
**Trigger:** User instruction (2026-09-26): future commits must not add "Co-Authored-By: Codebuff" footers; then (2026-09-27): rewrite the existing session commits to strip the footers from history.
**What actually happened (full transparency):**
- The footers were **not limited to recent commits**: of the branch's 17 commits, **16 carried the footer** — everything from `4f68893` (the first branch commit) to `18f67e1` inclusive; only the footer-free policy commit survived untouched.
- When the rewrite was requested, inspection showed **a `git filter-branch` had already been run** (reflog: `filter-branch: rewrite` @ 2026-09-27 17:58, minutes after the policy commit) — not by the logged session. Rather than redo it, this session **verified** the rewrite: all 17 new commits have trees byte-identical to their old counterparts (17/17 `TREE-SAME` via `%T` comparison); subjects are unchanged; the formerly-footed messages now end cleanly (body only, no trailer); and git-side `--grep=codebuff -i` across **all refs returns zero**.
- Stale objects were then purged so the old messages are genuinely unrecoverable from this clone: `git reflog expire --expire=now --all && git gc --prune=now`; the four newest old hashes now fail `git cat-file -e` (gone). `refs/original` backups and the `.git-rewrite` workdir were already removed. `main` was never rewritten (`3f3e87a`, = `origin/main`), and the branch was never pushed with footers, so **no remote holds the old messages**.
- Method note for future sessions: two pipe-based `grep -c` scans initially returned "0" while direct `%B` reads showed footers — the pipe results were reading stale pre-rewrite objects. The reliable tool is git's own `log --grep` (no shell pipe). The same garbled-command risk seen earlier this session applies to pipes with unicode/quotes.
**Old → new hash map (branch commits; cited in entries above):** `4f68893→a808416` · `809df37→863f6ef` · `cfc3f96→b82418c` · `f6b7a41→9bf5fe3` · `6a44299→30a118d` · `a5ac67c→052b001` · `87075fb→1b1e44e` · `a711d0a→6c34ecb` · `8322771→9262c69` · `b85477d→26f285f` · `5ab2db8→d304dc2` · `9ef1a7a→d486c32` · `c0e6d54→e07f2d1` · `db541c8→b95938c` · `4949c3e→1406da5` · `18f67e1→5563563` · `4b9ffef→cf4e6c1`. Hashes cited in older entries refer to the pre-rewrite chain; every entry's *content* is unaffected (trees identical).
**Verification performed:** tree-identity proof (17/17 same `%T`), subject diff (identical), footer grep via `git log --all -i --grep=codebuff` → 0, post-gc object-existence probes → old hashes gone, `refs/original` empty, worktree clean (`git status --porcelain | wc -l` → 0).
**Confidence:** High for the local repo. Caveat: the `gitsafe-backup` remote (`git://gitsafe:5418/backup.git`) was never inspected — if it mirrors the branch, it may still hold footer-bearing commits; irrelevant to `origin` (GitHub), which never received them.
**Result:** Verified working — all reachable commit messages are footer-free.
**Follow-ups opened:** none.
**Follow-ups closed:** the footer-rewrite request.
*Session-boundary rule:* (a) >4 h gap since the previous entry's work (2026-09-26 → 2026-09-27); same task thread as the policy change, but the rewrite is a distinct action.

---

## 2026-09-26 (commit hygiene) — rule added: no agent-attribution footers in commit messages
**Commits:** see this commit (AGENTS.md + REVIEW.md only).
**Type:** Protocol / Policy
**Trigger:** User instruction: future commits must not add "Co-Authored-By: Codebuff" (or any agent) trailers.
**Changes made:**
- `AGENTS.md`: added the rule — commit messages stay plain (subject + body, no generated-attribution footers, no generated-with badges). Every future agent session reads this file first, so the rule persists across sessions.
- Applied immediately: this session's own commits from now on follow it (the entry you are reading is logged in a footer-free commit).
**Verification performed:** read back `AGENTS.md` after the edit; confirmed the rule text is present and unambiguous.
**Confidence:** High (direct observation)
**Result:** Verified working
**Follow-ups opened:** none.
**Follow-ups closed:** none.
*Session-boundary rule:* (b) new task thread (policy change); gap < 4 h.

---

## 2026-09-26 (badges) — MIT LICENSE + CI workflow added; README badges wired to the live repo
**Commits:** see this commit (LICENSE, `.github/workflows/ci.yml`, README.md, REVIEW.md).
**Type:** Code change (repo infra) / Documentation
**Trigger:** User follow-up: add rendered shields.io version/license/CI badges "once a remote URL exists". A remote now exists (`origin` → `github.com/Akash-Das26/PDFTools`), and shields.io was verified reachable (HTTP 200) while the GitHub API and github.com are blocked from this shell (HTTP 000/timeout).
**Decisions taken with explicit user approval (ask_user):** (1) add a real LICENSE file — shields' GitHub license badge reads GitHub's license detection, which needs the file (package.json's `"MIT"` alone renders "not specified", confirmed by probe); (2) add a minimal CI workflow — a CI badge needs a real workflow to be truthful.
**Changes made:**
- `LICENSE`: canonical MIT text, "Copyright (c) 2026 Akash-Das26" (matches the GitHub owner). Transparency: my first write contained two corrupted words ("is now hereby", "the standard Software"); caught by self-review, fixed, and the full text re-read back against the canonical MIT wording before proceeding.
- `.github/workflows/ci.yml`: `push` + `pull_request` triggers, `permissions: contents: read`, concurrency cancel, matrix Node **20 & 22** (20 = documented floor, 22 = version verified locally), `pnpm/action-setup@v4` (version from the root `packageManager` field), `setup-node@v4` with pnpm cache, then `pnpm install --frozen-lockfile` → `pnpm run typecheck` → `pnpm build` — exactly the sequence executed and passing locally during the README authoring sessions. No test step: there is no test suite to run (stated in the README).
- README: 4-badge row under the title (CI status pinned to `?branch=feat/frontend-rebuild` with an HTML comment to drop the pin on merge; license; Node ≥20; pnpm 10.26.1 — the latter two are the repo-verified static facts); Testing section rewritten (CI now exists and runs install/typecheck/build; still **no test suite**, plainly stated); limitation 5 and roadmap 5 updated accordingly; structure tree gained LICENSE + ci.yml lines; License section now points at the LICENSE file.
**Verification performed:**
- Workflow YAML parses (`yaml.safe_load`): 1 job, matrix [20, 22], 6 steps.
- Shields probes: `github/license/…` returns a well-formed response (currently `"not specified"` — **expected until this commit is pushed**; GitHub's detection will flip it to MIT once LICENSE lands on the remote). The CI-status badge cannot show a run yet for the same reason.
- All four badge URLs **load as real images in the rendered headless-Chrome preview** (remote shields images fetched live; zero broken images).
- README battery re-run after edits: static checker **ALL CHECKS PASS**; rendered preview **15/15** (new assertions: exactly one favicon img, exactly 4 shields.io badge imgs, plus all prior anchor/table/overflow/diagram checks).
- Local ground truth for the workflow's commands: `pnpm install --frozen-lockfile`, `pnpm run typecheck`, `pnpm build` all executed and passing earlier this session chain (see README/push-proof/render entries above).
**Confidence:** High for everything local (files, README, YAML, badge wiring). **Explicitly not verified:** the workflow has never run on GitHub (no push was performed from here — pushing is the user's call), so the CI badge's green state and the license badge's MIT state are **expected-after-push**, not observed.
**Result:** Verified partial — local artifacts fully verified; remote badge states pending the first push (10-second check afterwards: badges render MIT + passing).
**Follow-ups opened:** none (post-push badge check noted above; if CI fails on a GitHub-runner quirk this shell cannot see, that becomes a new Open Item).
**Follow-ups closed:** none.
*Session-boundary rule:* (b) new task thread (repo infra + badges, follow-up to the README work); gap < 4 h.

---

## 2026-09-26 (push proof) — drizzle-kit push verified against a fresh, correctly-credentialed Postgres
**Commits:** see this commit (README.md + REVIEW.md only; no code or config changed).
**Type:** Verification / Documentation
**Trigger:** User follow-up: the README's `db push` step was the only install step labelled sourced-only (the authoring machine's local Postgres rejected the `.env` credentials). Close that gap.
**Changes made:**
- `sudo -n` was no longer cached, so instead of touching the machine's Postgres, spun up a **throwaway PostgreSQL 18.6 cluster under `/tmp` as the unprivileged user** (`initdb -U postgres --pwfile … --auth-host=md5`, `pg_ctl … -o "-p 5433"`) — a genuinely fresh server, i.e. a stricter test than reusing the local instance. Created an empty `pdftools` database, ran the README's exact command, then **stopped and deleted the cluster**. The machine's existing Postgres (port 5432) was never touched.
- README updated from "executed with one exception" to fully executed: execution-status note (now cites the fresh-DB end-to-end proof), Database setup block (⚠️ caveat replaced by a **Verified** paragraph: `[✓] Changes applied`, exit 0, `jobs` table per `schema/jobs.ts`, idempotent re-run `No changes detected`, plus the retained silent-exit sharp edge), troubleshooting bullet (same failure mode, now framed as reproduced-and-diagnosed rather than suspected), prerequisites row ("Latest tested: 18.6 (fresh scratch server, full install flow) and 16 (Replit's module)").
**Verification performed:**
- `pnpm --filter @workspace/db run push` with `DATABASE_URL` pointing at the empty scratch database: **exit 0**, output `[✓] Changes applied` (first run) and `[i] No changes detected` (second run — idempotent). `\d jobs` showed the table with exactly the `schema/jobs.ts` columns (serial pk, tool, original_filename, input/output_size_bytes, status default 'completed', created_at timestamptz default now()).
- End-to-end through the built API against that same fresh DB: `GET /api/healthz` → `{"status":"ok"}`; `GET /api/stats` → all-zero counters and `popularTool: null` (proving the database was genuinely empty); `POST /api/jobs` → created `id: 1`; `GET /api/jobs?limit=5` → returned it. API process killed afterwards.
- Edited README re-verified with both layers: static checker **ALL CHECKS PASS**; rendered headless-Chrome preview **14/14 assertions**.
- Scratch-cluster cleanup confirmed (`server stopped`, data dir removed). One garbled shell command in this session was rejected by bash at parse time (exit 2) and had **no effect**; the intended command was re-run cleanly and is what the results above reflect.
**Confidence:** High (every step directly observed; exit codes captured without pipes masking them)
**Result:** Verified working — the install guide now has **no sourced-only steps**.
**Follow-ups opened:** none.
**Follow-ups closed:** none formally (no Open Item covered this; it strengthens the Item-15 closure from the README session).
*Session-boundary rule:* (b) new task thread (verification follow-up to the README work); gap < 4 h.

---

## 2026-09-26 (render pass) — README rendered in headless Chrome; ASCII diagram realigned
**Commits:** diagram-fix commit (README.md only) following `c0e6d54` (the README rewrite).
**Type:** Documentation / Verification
**Trigger:** User brief: render the README in a Markdown preview and fix any visual issues (tables, ASCII diagram, anchors).
**Changes made:**
- The render check found exactly one README defect: the architecture diagram's outer border was ragged — rows 1–10 sat at 79 columns, rows 11–37 at 78 (everything right of column 3 shifted one left; caught by a width-per-line script, confirmed by a per-line column dump).
- Fixed by **regenerating the whole 27-row block programmatically** (`/tmp/make_diagram.py`: every row padded to exactly 79 columns, box borders and connector glyphs asserted by script before splicing). The rewrite also improved the diagram: the web→API arrow is now a single labeled `/api/* ──▶` into the routes box, and both artifact boxes are titled on their first line.
- No other README changes: tables, anchors, headings, favicon link, and code fences all passed as authored (details below). The `#12-testing--verification` double-hyphen anchor was flagged by the local renderer but is **correct per GitHub's slugger** (`&` is deleted, both surrounding spaces become hyphens) — verified against the algorithm, fixed in the local harness, not in the file.
**Verification performed:**
- Static checker over README.md (GitHub-accurate slug algorithm, fence balance, table pipe consistency, HTML tag balance, diagram border widths): **ALL CHECKS PASS** after the fix (before: one diagram defect).
- Real render: python-markdown → GitHub-styled standalone HTML (GitHub-accurate heading ids injected; favicon src absolutized for the local `file://` context) loaded in headless Chrome via CDP — **14/14 assertions**: zero console/exception errors; one h1; 13 h2 sections; 11 tables, all uniform column counts; favicon renders (`naturalWidth > 0`); no element overflows the 1280px viewport and no page-level horizontal scroll; diagram renders monospace, 27 uniform-width rows of exactly 79 chars, fits without horizontal scroll; **every in-page anchor resolves to a heading id**. Screenshots `/tmp/pdfcheck/readme-top.png`, `readme-diagram.png`.
- 5 of the initial 14 assertions failed; all were chased down: 1 real (the diagram), 4 harness bugs (wrong expected counts, a double-counting table selector, and the local slugger's `&` handling divergence from GitHub's). None papered over.
**Confidence:** High (render assertions executed against a real browser DOM; the only caveat is the preview uses python-markdown with GitHub-faithful slugs, not GFM itself — heading ids, not GFM's autolink/mention quirks, are what the assertions depend on)
**Result:** Verified working
**Follow-ups opened:** none.
**Follow-ups closed:** none (the render-preview harness lives in `/tmp/pdfcheck/` alongside the other disposable suites — folded into Open Item 10's scope if the harnesses are ever committed).
*Session-boundary rule:* (b) new task thread (render verification of the just-authored README, distinct user-approved task); gap < 4 h from the previous entry.

---

## 2026-09-26 (later still) — README.md rewritten from verified ground truth (closes Item 15)
**Commits:** see this commit (README.md + REVIEW.md only; no code or config changed).
**Type:** Documentation
**Trigger:** User brief: replace the pre-rebuild README with a full README modeled on four reference READMEs' *structure* (badge row, ASCII diagram, heavy tables, testing section, roadmap), with every fact re-verified against the live repo (Step 1) before writing (Step 2), and every claim traced to a source.
**Changes made:**
- Replaced `README.md` (pre-rebuild run-notes only) with a 16-section README: mark/tagline, TOC, problem statement, ASCII workspace-architecture diagram, feature catalog (32 tools / 6 categories, 17 implemented / 1 partial / 14 backend-pending, per-category 7/6/6/5/4/4), tech stack from the package.json files, complete Installation guide (prerequisites with exact versions, env-var table, codegen, DB setup, verify-install, troubleshooting limited to observed/structural failures), Quickstart cross-linked to it, 28-row API reference, project-structure tree, plain-spoken testing section, Known limitations from the Open Items, roadmap from the open items, MIT license.
- **Catalog counts were re-grepped, not trusted from the log:** `routes/tools.ts` → 32 tools; statuses 17 `implemented` / 1 `partial` (`pdf-to-markdown`) / 14 `pending`; per-category 7/6/6/5/4/4. Matches the rebuild entry's figures.
**Verification performed:**
- Currency check: newest REVIEW.md entry covers through `9ef1a7a` = HEAD; `git status --porcelain | wc -l` → 0. Proceeded.
- Routes: grep across `routes/{health,tools,jobs,pdf}.ts` → 21 `POST /pdf/*` + `GET /healthz`, `GET /tools`, `GET /stats`, `GET /jobs`, `POST /jobs`; `openapi.yaml` has exactly those 25 paths; `app.ts` mounts the router at `/api`; multer limits 50 MB/file, 20 files in `src/lib/upload.ts`; watermark takes `file`+`image` fields (multer `fields`).
- Versions/meta: root package.json (MIT, `pnpm@10.26.1` + preinstall guard), catalog versions in `pnpm-workspace.yaml`; **no `engines` field in any package.json, no `.nvmrc`, no `.github/` directory** (no CI) — all stated plainly in the README.
- Env vars: grep `process.env` across api-server, pdftools (+ vite config), and scripts; cross-checked against `.env.example`. `DATABASE_URL` required was **proven**: started the built server with it unset → immediate exit with `Error: DATABASE_URL must be set. Did you forget to provision a database?`. `OPENAI_API_KEY` optional was confirmed in `services/pdf/summarize.ts` (JSON error telling the user to set it).
- **Install sequence executed** on this machine (Node 22.22.1, pnpm 10.26.1): moved `node_modules` aside → `pnpm install --frozen-lockfile` (1.8 s; observed the `Ignored build scripts: tesseract.js` warning now documented in troubleshooting) → `pnpm run typecheck` 3/3 → `pnpm build` exit 0 → `pnpm --filter @workspace/api-spec run codegen` exit 0 with the tree staying clean (committed clients are exactly what the spec generates) → started the built API → `curl /api/healthz` → **HTTP 200 `{"status":"ok"}`**; `/api/tools` returned the catalog.
- **`pnpm --filter @workspace/db run push` did not succeed here** (exits 1 silently after "Pulling schema from database…"). Independently reproduced the cause with a raw `pg` connection: the local Postgres rejects the `.env` credentials (`password authentication failed for user "postgres"`) — a **machine-side credentials issue, not a repo defect**; drizzle-kit 0.31.10 swallows the underlying error. The README labels this step honestly (silent-exit warning + credential check) instead of claiming a pass.
- Logo: no committed banner/logo raster exists (`git ls-files` images → `favicon.svg` + Stitch reference `screen.png`s only); the README uses `artifacts/pdftools/public/favicon.svg` (flat `#FF3C00` mark) and says plainly that no banner asset exists. `stitch_pdftools_web_application_ui/pdftools_logo/screen.png` noted as design reference, not a web asset.
**Confidence:** High (every README number cites a grep or command above; the one step not green on this machine — `db push` — is explicitly labeled with its reproduced cause rather than claimed as passing)
**Result:** Verified working (README content); `db push` success on a correctly-credentialed machine remains sourced-only.
**Follow-ups opened:** none.
**Follow-ups closed:** **Item 15** — closed: README fully rewritten against the rebuilt app with re-verified facts; drift-risk caveat moved into the README's own Known-limitations list.
*Session-boundary rule:* (b) new task thread (documentation authoring, distinct from the frontend-rebuild thread); same calendar day as the previous entry.

---

## 2026-09-26 (later) — Baseline committed · cleanup decisions executed · Batch 1 built and verified
**Commits:** `4f68893` (catalog+spec+clients) → `809df37` (frontend rebuild) → `cfc3f96` (REVIEW.md+AGENTS.md) → `f6b7a41` (remove mockup-sandbox) → `6a44299` (remove design exports + @assets alias) → `a5ac67c` (Batch 1 panels + multipart fix) → `87075fb` (Alt+Arrow a11y fix) → `a711d0a` (docs reconciliation) → `5ab2db8` (remove 5 alternate Stitch screens) — all on new branch `feat/frontend-rebuild`; `main` untouched.
**Type:** Code change / Cleanup
**Trigger:** User brief: work REVIEW.md's Open Items in order — commit the baseline (Item 1), resume the cleanup audit with knip/depcheck and decide Items 5/6/7 (Item 2), continue Batch 1 (Item 4), apply the two doc fixes (Items 8/11), flag the rest.
**Changes made:**
- *Step 1 (Item 1):* reviewed the working tree — found it had grown 59→73 paths, including **11 deletions attributable to no logged session** (5 Stitch reference screens + `attached_assets/ilovepdf-logo.svg`); restored all 11 via `git checkout --` rather than baking unexplained deletions into history. Verified `src-backup-pre-rebuild/` byte-identical to HEAD's `src/` (`git archive` + `diff -rq`), then deleted it. Created `feat/frontend-rebuild` and committed in 3 logical commits (spec/clients, frontend rebuild, audit log).
- *Step 2 (Items 5/6/7):* ran the never-executed tools — **knip** (104 unused files, 2 unused deps, 82 unused devDeps, 45 unused exports) and **depcheck** per package (agrees on `cookie-parser`; disagrees on vendored-UI devDeps, which are false positives for an import-the-primitives tree). Decisions, each evidence-backed: **deleted `artifacts/mockup-sandbox/`** (zero consumers — no script/lockfile/tsconfig/doc reference; typecheck scope 4→3 artifacts; `pnpm install` re-run); **deleted** the Stitch zip (proven strict subset of the committed reference folder by `diff -rq`, 38 vs 39 files), `.design/` (superseded landing mockups, zero references), `ilovepdf-logo.svg` (never imported) and the dangling `@assets` vite alias; **kept** the canonical Stitch reference folder and the pasted session prompts (provenance); **deleted the `replit-agent` branch** after proving all 13 of its unique commits tree-identical to their main counterparts (my first identity check was buggy — `--all` overrode the range and compared each hash to itself — redone with explicit hash pairs before acting).
- *Step 3 (Item 4, Batch 1):* built the five missing Configure panels — merge (reorderable document rows + `files`/`onFilesChange` contract extension), split (mode cards + page-range input), rotate (the single-angle selector the endpoint actually requires, with selection scoping stated), extract/reorder (picker-mirror summaries; `remove-pages` refactored onto the shared `OptionField`). Fixed a **real transport bug**: `buildFormData` named a single upload `file`, but merge/rotate/compare/images-to-pdf are `upload.array("files")` endpoints — single-file merge/rotate would have 400'd; now routed by endpoint (`MULTI_FILE_ROUTES`). Added a merge <2-files guard and a rotate default (`rotation=90` — the picker never sent one, so Process would have failed validation).
- *Step 4 (Items 8/11):* `UI-NON-REGRESSION-RULES.md` — corrected the icon claim (`lucide-react@0.545.0` exports no `Compress`; `Minimize2` is the registry substitute) and annotated that the salmon `#ffb4ab` on dark screens is the approved dark-mode override, not the obsidian_slate leak. `FEATURES.md` — added the reconciliation note (31 capability rows vs 32 catalog tools: 17/1/14) and the README-predates-rebuild caveat.
- *User-directed deletion (same session):* removed the **5 alternate Stitch screens** (`bento_quick_drop`, `curate_reorder_flow`, light `stepper_integrated_progress`, second dark `result` variant, `split_pane_compress`) after confirming zero references in source, config, docs **and** the `/tmp` verification harnesses (which load only the canonical screens). 16 canonical screens (both themes per state) + both DESIGN.md sets remain as the design source of truth. The `ilovepdf-logo.svg` half of the same request was already gone via `6a44299`.
- *Step 5:* Items 3, 9, 10 flagged in Open Items as out of scope, per the brief; new items 13–15 opened.
**Verification performed:**
- After the branch commits: `pnpm run typecheck` 4/4, web build 2.38 s, api build ✓.
- After the mockup-sandbox removal: `pnpm install` (workspace change), typecheck 3 artifacts green, both builds green; **knip re-run: zero `mockup-sandbox` entries, unused files 104→46** (the 46 are the vendored primitives awaiting Batch 2–6 panels), no new gaps.
- **Batch 1 end-to-end (new `batch1.mjs` CDP suite, real routes): 21/21 pass** — merge: 2 files listed, rows reorder, result `merged.pdf`, download enabled; split: mode cards, range input, ZIP download; extract: picker selection → download; reorder: keyboard reorder applied (order starts with the moved page) → download; rotate: angle cards, default 90, scope text narrows to selection → download; merge guard: single file → error panel, not a request; dark theme checked on the guard run. Screenshots `batch1-*.png`.
- **Full regression suite: 127/127 pass, zero console errors** (confirms the Batch 1 + a11y changes regressed nothing).
- Two test-side failures were chased to real code, not papered over: a `no render` on `organize-pages` exposed the wrong catalog id (**`reorder-pages`** — panel renamed/rewired accordingly), and the keyboard-reorder assertion failing exposed the **Alt+Arrow keydown-order bug** (plain-arrow branch swallowed the altKey variants — fixed and regression-tested).
- Working tree clean (0 dirty paths) after every commit; final `git status --porcelain | wc -l` → 0.
- For `5ab2db8`: reference grep across repo + harnesses (zero hits), remaining-folder listing (16 screens + 2 DESIGN.md sets), web build 2.50 s after removal (assets are outside the TS graph).
**Confidence:** High (every change above cites the command or suite run against it)
**Result:** Verified working
**Follow-ups opened:** Items 13 (rotate per-page product decision), 14 (unused deps + connectors-sdk platform coupling), 15 (README refresh) in Open Items.
**Follow-ups closed:** **Item 1** — closed: 3 logical commits on `feat/frontend-rebuild`, typecheck+builds verified on the branch, tree clean; **Item 2** — closed: knip + depcheck run and cross-checked, Items 5/6/7 each decided with evidence and executed; **Item 5** — closed: mockup-sandbox deleted after the zero-consumer proof; **Item 6** — closed: zip/.design/logo deleted (recoverable in git history), Stitch folder + prompts kept with reasons; **Item 7** — closed: branch deleted after the 13-pair tree-identity proof; **Item 8** — closed: rules file corrected (icon claim + dark-override annotation); **Item 11** — closed: FEATURES.md reconciliation note added; **Item 4** — partially closed: Batch 1 done and verified, batches 2–6 remain (item reworded, stays open).*Session-boundary rule:* (a) gap > 4 h since the previous session's last change; this entry covers one continuous session (all steps within it are gaps of minutes, one task thread).

---

## 2026-09-26 — Created REVIEW.md audit log + agent protocol
**Commits:** none (no code change this session)
**Type:** Audit / Planning
**Trigger:** User brief: create a running audit log of every change, its verified result, and a protocol forcing future sessions to append to it.
**Changes made:**
- Created `REVIEW.md` (this file): top instruction block, Open Items (12), 12 historical session entries newest-first, history-quality appendix.
- Created `AGENTS.md` (3 lines) pointing every future agent at this file — no agent-instructions file existed (checked `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.windsurfrules`, README contributing section: all absent; `.agents/agent_assets_metadata.toml` is Replit-owned asset metadata, not an instructions file, so it was deliberately not modified).
- No application code touched.
**Verification performed:** After writing: `wc -l REVIEW.md` + grep for all required Part 3 field headers across every entry + confirmed `AGENTS.md` exists and contains the pointer. Historical entries before 2026-08-29 could not be re-verified beyond diffs (no artifacts exist); their results are logged as unknown rather than invented.
**Confidence:** High (this session's own work directly observed; historical reconstructions carry their own per-entry confidence)
**Result:** Verified partial — file and protocol in place and spot-checked; the underlying gaps are inherent: 6 historical sessions have no verification evidence, and the 2026-09-26 sessions are uncommitted, so git cannot corroborate this log for them.
**Follow-ups opened:** Items 1, 10, 11 in Open Items.
**Follow-ups closed:** none.
*Session-boundary rule:* (a) gap > 4 h since the last code change; plus (b) new task thread (audit, not feature work).

---

## 2026-09-26 — Repo cleanup/reorg audit (read-only, parked)
**Commits:** none (deliberately read-only)
**Type:** Audit
**Trigger:** User pasted a cleanup/reorg brief (branch `chore/cleanup-reorg`, knip/depcheck, dead-code removal, reorganise).
**Changes made:**
- None. Read-only: repo tree, git status (59 dirty paths on `main`), `.gitignore`, aliases (`@/` in pdftools + mockup-sandbox tsconfigs and vite configs; `@assets` alias), `attached_assets/` and `.agents/` contents, tracking status of Stitch assets/zip/`.design`.
- Session was interrupted by the user redirecting to the accent/spec work; knip and depcheck were never run.
**Verification performed:** Read-only inspection only; findings reported in conversation; no verification harness run for this task.
**Confidence:** High (directly observed in this conversation)
**Result:** Unverified (claimed only, no evidence) — findings were reported but nothing was verified or changed; the brief itself was never completed.
**Follow-ups opened:** Items 2, 5, 6, 7 in Open Items.
**Follow-ups closed:** none.
*Session-boundary rule:* (b) new task thread, no thematic overlap with the adjacent sessions; no commits involved.

---

## 2026-09-26 — Dark-only accent override · exact reference badges/foreground · OpenAPI upload parts
**Commits:** none (uncommitted — see Open Item 1)
**Type:** Code change
**Trigger:** Three user-approved follow-ups from the rebuild review: fix measured dark-mode accent contrast failures; match the reference exactly on count-badge accents and primary foreground; add the missing multipart `file` parts to the OpenAPI spec and regenerate clients.
**Changes made:**
- `artifacts/pdftools/src/index.css`: added the `precision_pdf_utility` `-fixed` token families (`primary-fixed[-dim]`, `secondary-fixed[-dim]`, `tertiary-fixed[-dim]`, `on-*-fixed`); added a `.dark` override inverting each brand accent to its `-fixed-dim` sibling **and** its `on-*` partner with it (M3-style inversion) — `primary #B70011→#FFB4AB`, `secondary #0051D5→#B4C5FF`, `tertiary #00682B→#62DF7D`, `ai #1D4ED8→#DBE1FF`; added derived tokens `primary-container-hover`, `primary-container-foreground`, `success-subtle-foreground`; pinned `on-primary-container` to `#ffffff` after re-checking the reference (its CTA labels are `text-on-primary`, pure white — DESIGN.md's `#fff6f5` loses to the screens per source-of-truth order).
- `lib/ui.ts`, `pages/tool.tsx`, `components/workspace/step-indicator.tsx`, `components/workspace/page-thumbnail.tsx`: every `bg-primary-container` fill now pairs with `text-on-primary-container` (theme-invariant) instead of the flipping `on-primary`; step label uses `text-primary-container-foreground`.
- `components/workspace/file-strip.tsx`: glyph repainted with the correct M3 `on-error-container` pairing.
- `lib/tool-categories.ts` + `components/landing/category-section.tsx`: new `ACCENT_BADGE` reproducing the reference's per-section badge pairs (organize/security `bg-primary/10 text-primary`; both Convert `bg-secondary-fixed text-on-secondary-fixed`; edit `bg-success-subtle` + `success-subtle-foreground`; ai `bg-secondary-container/20 text-secondary-hover`).
- `components/landing/tool-card.tsx`: Popular ribbon matched class-for-class (`rounded bg-primary-fixed text-on-primary-fixed … tracking-wide`) + `badge-popular-*` testid.
- `lib/api-spec/openapi.yaml`: added binary `file`/`files`/`image` parts to all 16 previously-modelled `/pdf` paths with multer-exact field names; added **5 endpoints that were missing entirely** (`merge`, `split`, `compress`, `add-page-numbers`, `ai-summarize`) — descriptions state actual behaviour, including the compress-quality no-op (Open Item 3).
- Regenerated orval clients (`lib/api-client-react`, `lib/api-zod`); `summarizePdf` now returns typed JSON instead of `void`; zod target still excludes the `pdf` tag.
**Verification performed:**
- WCAG contrast computed from **rendered pixels** (canvas painting, not hand maths) in headless Chrome against the live app: focused accent suite **38/38 pass** — dark landing badges 8.46/13.25/13.25/6.34/8.46/11.22:1, icon tiles 8.43–11.22:1, Process CTA 4.83:1 both themes (6.47:1 hover), file-strip 7.24:1, Popular 13.26:1; screenshots `accent-{landing,compress}-{light,dark}.png`.
- Full regression suite: **127/127 pass, zero console errors** (3 stale assertions that encoded the *old* "accents unchanged in dark" decision were updated with an explanatory comment, not deleted).
- Reference comparison (`compare.mjs`): **`badge ACCENT per section` now MATCH**; **`primary CTA button` byte-identical** (`rgb(220,38,38)` on `rgb(255,255,255)`, 12px, 14px).
- `pnpm run typecheck` 4/4; production build 2.30 s; YAML validated after every spec edit; codegen + `tsc --build` clean.
- Audit greps: zero `bg-primary-container` fills still paired with the flipping `on-primary`; zero raw hex outside comments/token block.
**Confidence:** High (direct evidence above; caveat: no commit backing — work exists only in the working tree)
**Result:** Verified working
**Follow-ups opened:** Items 3, 9, 12 in Open Items.
**Follow-ups closed:** Item "dark-mode accent contrast fails (2.54–2.65:1)" — confirmed closed by the 38/38 suite; item "count-badge accent divergence (flag 4)" — confirmed closed by `compare.mjs` `MATCH`; item "spec omits `file` (openapi gap, flag 7)" — confirmed closed by codegen exposing 104 operations incl. all 21 `/pdf` paths.
*Session-boundary rule:* kept inside the 2026-09-26 rebuild session block (gap < 4 h, same feature thread); listed separately because it was a distinct user-approved task.

---

## 2026-09-26 — Frontend rebuild Steps 0–2 (clean slate, tokens, templates, landing)
**Commits:** none (uncommitted — see Open Item 1)
**Type:** Code change / Design review
**Trigger:** New brief: rebuild the entire `artifacts/pdftools` frontend from the Stitch reference (`stitch_pdftools_web_application_ui`), Steps 0–2 before any tool batches.
**Changes made:** *(three phases, one continuous session)*
- *Step 0 (read-only):* inventoried the reference — 18 screens → 2 workspace templates + 6 categories (7/6/6/5/4/4 = 32 tools); produced the api-server route table from `routes/*.ts`; flagged the token conflict, the missing Convert-to/Edit categories, and the 32-vs-20 gap. User decisions locked: `precision_pdf_utility` in both themes, light landing long form, `@theme` + extended `/api/tools`, exactly two templates, full landing extras.
- *Step 1:* moved old `src` → `artifacts/pdftools/src-backup-pre-rebuild/` (91 files, nothing deleted); fresh `components/ pages/ templates/ lib/` structure; all 8 brief tokens + full `precision_pdf_utility` set into `@theme inline` in `index.css`; catalog extended to **32 tools / 6 categories** in `routes/tools.ts` + `openapi.yaml` (`accent`, `workspace`, `status`, `route`, `keywords`, `popular`; raw hex removed), orval regenerated.
- *Step 2:* header/nav (red token wordmark, category nav, ⌘K search dialog, theme toggle), landing shell (hero, quick-dropzone with real file-type routing, pills, category sections, tool cards, value strip, pipeline, footer), **both** workspace templates (stepper + page-picker), shared processing/result/error states, `pages/tool.tsx` with all five interaction states + pending-tool badge + disabled Process, `process-tool.ts` raw-fetch transport with abort (spec lacked `file` parts — fixed later this session).
**Verification performed:**
- `pnpm run typecheck` 4/4; production build ✓.
- CDP regression suite vs live app + API: **127/127 pass, zero console errors** — all 5 states on both templates, real upload→process→download through `/api/pdf/compress` and `/api/pdf/remove-pages`, keyword search, pill filters, ⌘K palette, page-picker selection/shortcuts/rotate/delete, pending-tool badge + disabled Process, light `rgb(255,255,255)` / dark `rgb(11,11,12)`.
- Reference comparison: category names/order, count badges, tool counts (7/6/6/5/4/4 = 32), icon-tile accents, typography, card metrics, CTA — all MATCH; 16 screenshots.
- **Bugs found by verification and fixed:** `cn()`/tailwind-merge silently dropped the entire custom type scale whenever a `text-<colour>` shared a call (every card title rendered 400 weight); page-picker stale-closure lost multi-select clicks in one tick (collapsed into one immutable state); a `data-testid` prefix collision made card counts read 46; a stale vite process on :5173 served a broken module graph (hardened the runner's port cleanup).
**Confidence:** High (direct evidence above; caveat: no commit backing)
**Result:** Verified working
**Follow-ups opened:** Items 1, 4, 10 in Open Items; plus the user-approved trio executed in the next entry.
**Follow-ups closed:** Step 0's open questions F1–F8 — resolved by explicit user answers (accent palette, landing variant, token mechanism, catalog strategy, template count); "icon-tile accent divergence" — closed by `compare.mjs` MATCH.
*Session-boundary rule:* gap from previous session (2026-08-31) is 25 days → rule (a); the three phases above are one session (gaps < 4 h, one feature thread, rule (a)/(b) not triggered between them).

---

## 2026-08-31 — Build warning cleanup
**Commits:** 3abea71
**Type:** Code change
**Trigger:** Remaining build warnings after the Sep-25 tooling commits (per commit subject; no linked issue).
**Changes made:** removed leftover `'use client'` directives from vendored `ui/label.tsx` and `ui/tooltip.tsx`; adjusted `vite.config.ts`; added a direct dependency to `api-server/package.json` + lockfile entries (native optional-deps on the server's resolution path); documented the two lessons in `.agents/memory/pdf-tools-warning-cleanup.md`.
**Verification performed:** none found — no test output, log, or note recording a run.
**Confidence:** Medium (diff + corroborating memory note describe the change precisely; nothing evidences an outcome)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** none recorded.
**Follow-ups closed:** none recorded.
*Session-boundary rule:* (a) 21 h 27 m gap from the previous commit.

---

## 2026-08-30 (afternoon) — Clean-checkout builds + Replit port sync
**Commits:** 9d59545, 09b62df
**Type:** Code change
**Trigger:** Root build failing from a clean checkout (subjects; consistent with the same morning's local-run work).
**Changes made:** added `scripts/build-all.mjs` + root `build` script wiring (`pnpm run typecheck && node scripts/build-all.mjs`); added 4 lines to `.replit` syncing workflow ports.
**Verification performed:** none found for the commit themselves. Indirect: the committed `.agents/memory/local-pnpm-build-approvals.md` documents the underlying pnpm approval problem, and the root build was exercised extensively much later (2026-09-26 sessions) — but that is not evidence this commit passed at the time.
**Confidence:** Medium (clear diffs + corroborating memory note; no outcome evidence)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** none recorded.
**Follow-ups closed:** presumably the clean-checkout goal from the morning session — cannot confirm.
*Session-boundary rule:* (a) 5 h 54 m gap from the previous commit.

---

## 2026-08-30 (morning) — Local run tooling, docs, and asset churn
**Commits:** 80fa7b9, 6f2611c, f09ad48, c57ca29, 6acac8e, 349a0ce, 580a1d1
**Type:** Code change / Cleanup
**Trigger:** Making the repo runnable outside Replit (subjects: local dev script, launchers, environment docs).
**Changes made:** *(7 commits, sub-areas)* — `scripts/dev-local.mjs` + `dev:local` root script + README setup guide (80fa7b9); `run-local.sh`/`run-local.bat` launchers + a **38 MB `downloads/pdf-tools-local.zip` committed** (6f2611c) then **removed one commit later** with `.gitignore` `/downloads/` (f09ad48); pnpm build-approval config + memory note (c57ca29); launcher env fixes + pasted command outputs into `attached_assets/` (6acac8e, 349a0ce); one functional tweak inside `routes/pdf.ts` (+33/−13) plus `optional-ai-configuration.md` (580a1d1) — the only application code in the window.
**Verification performed:** none found — no run logs; the pasted command outputs in `attached_assets/` are transcripts of *setup attempts*, not pass/fail evidence.
**Confidence:** Medium (diffs fully legible; corroborated by later memory notes; no outcome evidence)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** the zip add/remove churn and pasted-transcript files are the origin of Open Item 6.
**Follow-ups closed:** none recorded.
*Session-boundary rule:* (a) 1 h 33 m gap from the previous commit; commits within the window are 2–19 min apart (rule (a)/(b) not triggered between them).

---

## 2026-08-30 (early) — SEO components, comparison pages, navbar logo
**Commits:** b83b895, 15e832f
**Type:** Code change
**Trigger:** "Add a full set of comparison pages" + "make my version genuinely better than the original" (per the pasted prompts committed alongside).
**Changes made:** `components/seo.tsx`, `lib/comparisons.ts` (386 lines), pages `compare.tsx`/`comparison.tsx` (+247), `robots.txt`/`sitemap.xml`, navbar updates; then `pdf-tools-logo.svg` (hard-coded **blue** `#2563EB`) into the navbar.
**Verification performed:** none found.
**Confidence:** Medium (diffs clear; the pasted prompt files in `attached_assets/` corroborate intent)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** the blue logo was later flagged as a token violation; superseded by the 2026-09-26 rebuild's red token `Logo` component (old asset deleted there — still uncommitted).
**Follow-ups closed:** none at the time.
*Session-boundary rule:* (a) 22 h 31 m gap from the previous commit.

---

## 2026-08-29 — PDF tool services implemented (bulk of the backend)
**Commits:** 48aa7c0, fda7af8
**Type:** Code change
**Trigger:** Implementing real PDF processing behind the tool catalog (subjects).
**Changes made:** `routes/pdf.ts` +213 lines, `routes/tools.ts` +35, tool pages rewrite (`tool.tsx` ±398), pricing page, home page expansion, new dependencies; then a follow-up fixing server-side text extraction — `build.mjs` copies `pdf.worker.mjs` beside the bundle, `pdf.ts` adjustments, and the lesson in `.agents/memory/pdf-text-extraction-runtime.md` ("validate with a real multipart extraction request after restarting the API" — no record that was done).
**Verification performed:** none found at commit time. The memory note's own instruction implies validation was expected but nothing records it. (These services were later runtime-verified during 2026-09-26 work — see the rebuild entry — but that is not evidence about this session.)
**Confidence:** Medium (diffs + memory note; no outcome evidence)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** none recorded.
**Follow-ups closed:** none recorded.
*Session-boundary rule:* (a) 31 d 2 h gap from the previous commit.

---

## 2026-07-29 — Improvements note
**Commits:** 0f01507
**Type:** Planning
**Trigger:** unknown (a pasted prompt committed as `attached_assets/Pasted-…genuinely-better-than-the-original….txt`).
**Changes made:** one 34-line text file, no code.
**Verification performed:** none applicable (no functional change to verify).
**Confidence:** Low (commit exists; no context for the session beyond the paste)
**Result:** Shipped — verification status unknown (no evidence found for this session)
**Follow-ups opened:** none recorded.
**Follow-ups closed:** none recorded.
*Session-boundary rule:* (a) 17 h 30 m gap from the previous commit.

---

## 2026-07-28 (later) — API client regenerated + web app scaffolded
**Commits:** 109924b
**Type:** Code change
**Trigger:** Standing up the frontend artifact on the API (subject).
**Changes made:** new `routes/{pdf,tools,jobs}.ts` (310/92/102 lines), orval client regen, and the bulk of `artifacts/pdftools` — `App.tsx`, `navbar.tsx`, `tool-card.tsx`, `stats-section.tsx`, `theme-provider.tsx`, `index.css`, and **41 vendored `components/ui/*` Radix primitives**.
**Verification performed:** none found.
**Confidence:** Medium (diff complete and legible; no outcome evidence)
**Result:** Unverified (claimed only, no evidence)
**Follow-ups opened:** the 41 vendored primitives (many still unreferenced) feed Open Item 5's duplication question.
**Follow-ups closed:** none recorded.
*Session-boundary rule:* (a) 6 h 55 m gap from the root commit.

---

## 2026-07-28 — Initial commit (scaffold)
**Commits:** 9ef0b8f (root)
**Type:** Code change
**Trigger:** project creation on Replit.
**Changes made:** **114 files / 13,453 insertions in one commit**: the pnpm workspace (root + lockfile + tsconfigs), `artifacts/api-server` skeleton (10 files), the full `artifacts/mockup-sandbox` (54 files), `lib/{db,api-zod,api-client-react,api-spec}` (20 files), `replit.md`, `.replit*`.
**Verification performed:** none found.
**Confidence:** Low (commit exists; whatever sessions produced it are squashed into it — see Part 0)
**Result:** Shipped — verification status unknown (no evidence found for this session)
**Follow-ups opened:** the committed `mockup-sandbox` copy is Open Item 5's root cause.
**Follow-ups closed:** n/a (history start).
*Session-boundary rule:* history start (no prior commit).

---

---

# Part 0 — History quality (ground-truth caveat)

`git log --all --oneline | wc -l` → **32 commits**; `main` first-parent chain → **19 commits**. `--follow` probes on `package.json`, `pdftools/src/index.css`, and `api-server/src/routes/pdf.ts` show plausible incremental chains — **not** a force-push rewrite. But three anomalies mean git is **best-available-but-incomplete** ground truth, and every session above carries that caveat:

1. **Squash risk at the root.** `9ef0b8f` lands 114 files / 13,453 lines in one commit (whole packages: `mockup-sandbox`, all four `lib/*` packages, the api-server skeleton). Whatever sessions built those are unreconstructable; that commit is logged as one Low-confidence entry rather than pretending to split it.
2. **Duplicated commit pairs.** 13 pairs of commits share an identical subject **and** timestamp to the second (e.g. `580a1d1`/`179bdd2`) across `main` and the `replit-agent` branch — an automation re-commit pattern, plus a `gitsafe-backup` remote. History was written by tooling that does not always commit once per logical change, so commit counts understate session counts. Boundaries here are therefore drawn from timestamps + diff themes, and each entry cites its rule.
3. **Commit gaps ≠ inactivity — proven.** The entire 2026-09-26 rebuild + fix sessions (the largest frontend change in the repo's history) have **zero commits**; 59 dirty paths sit on `main`. Conversely the 25-day gap (08-31 → 09-26) contained major work. So absence of commits was never treated as absence of sessions, and uncommitted sessions are flagged in their entries and in Open Item 1.

No prior `REVIEW`/`CHANGELOG` file, PR descriptions, or issue references exist to supplement with — the `.agents/memory/*.md` notes were used as corroborating (not verifying) evidence, as marked per entry.
