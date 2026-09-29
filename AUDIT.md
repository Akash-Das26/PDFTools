# AUDIT.md — PDFTools deep-audit record

> ## ⚠️ SESSION PROTOCOL — READ BEFORE ANY WORK
> **After any session whose primary purpose is a deep audit (per the definition below), append an entry here using the template, and update the coverage table. Routine sessions that don't meet that definition belong in REVIEW.md only, not here.**
>
> - **What qualifies as a deep audit:** a session whose primary purpose was to comprehensively check one area of the project against a reference or standard — not a session that happened to touch multiple files while building something. The test: did it produce a **verdict** (matches/doesn't match, safe/unsafe, clean/has issues) covering a **defined scope**, rather than just a list of changes made? If unsure, it does not qualify.
> - Entries are **newest-first**, mirroring REVIEW.md. Each entry **points back** to the REVIEW.md entry for that session (by date and commit) — this file categorizes findings and states the verdict; it does not duplicate the narrative.
> - **Hard rule (same standard as REVIEW.md):** every finding and verdict must trace to actual evidence from that audit session — a comparison performed, a tool actually run, a file actually checked. An audit whose verdict cannot be traced to a method is logged as **"Verdict: unverifiable retroactively"** rather than backfilled with invented confidence. Do not invent a finding or a severity for an entry that did not record one; if the source entry lacks detail, say so and lower the confidence.

---

## Coverage table

| Area | Last audited | Verdict | Overdue? |
|---|---|---|---|
| UI/design conformance | never (deep audit) — standing `compare.mjs` reference suite runs MATCH checks every session since 2026-09-26 | — | |
| Dead code / dependencies | 2026-09-29 (re-audit; first was 2026-09-26) | Item 14 unchanged; knip now errors on drizzle config; vendored-file count 46→58 | |
| Security | 2026-09-29 (adversarial audit) | No secrets in tree or history; 18 advisories (10 prod, multer worst); no rate limiting; CORS wide-open | |
| API/spec consistency | 2026-09-29 (adversarial re-check, supersedes standing-suite-only status) | Clean: 36/36 routes ↔ paths, every binary field present | |
| Accessibility | 2026-09-29 (first deep audit) | Keyboard + aria strong in page workspaces; 1 unlabeled button; tertiary token measured 13.16:1 (closes Item 9's measurement) | |
| Performance | 2026-09-29 (first audit) | Bundle 610 KB / 117 KB CSS (no code-split); memoryStorage model bounded per request but does not scale | |
| Reliability & error handling | 2026-09-29 (first audit) | NOT production-safe: unhandled pdfjs rejections crash the process on malformed input; silent-200 family; 500-vs-4xx mislabelling | |
| Docs/code reconciliation | 2026-09-29 (re-audit) | README holds; FEATURES.md carried a self-contradicting header + stale AI provider row (both corrected) | |

No audit cadence has been agreed for any area, so no entry is marked overdue.

---

## 2026-09-27 — README claim-by-claim audit
**Corresponding REVIEW.md entry:** 2026-09-27 (README audit) — "every README claim checked against the live tree; 6 flags, none blocking" (REVIEW.md-only commit; follow-up fixes in the same day's "README corrections" session, `6c27275`).
**Audit type:** Docs/code reconciliation
**Scope:** Every factual claim in README.md (catalog counts, per-tool routes, multer field names, versions, infra claims, behavioural claims) against the live tree. Out of scope: code correctness behind the docs; the two network-dependent claims (badge rendering, GitHub-side branch state) were inferred from local refs only.
**Method:** Mechanical checks run fresh, not eyeballed: `grep -c` status counts (17/1/14 = 32; per-category 7/6/6/5/4/4); every `router.post(` in `routes/pdf.ts` parsed and cross-checked against §7's multer fields; `openapi.yaml` path count (25); version pins vs every `package.json` + the pnpm-workspace catalog; `.replit`/CI-workflow/`pnpm-workspace.yaml`/`vite.config.ts` infra claims; behavioural claims (ZIP outputs, PDF/A trailer pieces, OCR language count, bounded-LCS compare, 503 wording, jobs/stats fields) checked in code; `pnpm build` + live `/api/healthz` and `/api/tools`.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Low | §3 Merge PDF claimed "ZIP output for multi-file results" — `merge.ts` has no ZIP path; always one `merged.pdf` | Fixed 2026-09-27 (`6c27275`) |
| Low | CI badge pinned to the deleted `feat/frontend-rebuild` branch — could never report on `main` | Fixed 2026-09-27 |
| Low | §2's transport cross-reference pointed at a Known-limitations item that does not exist | Fixed 2026-09-27 |
| Low | `pdf-parse` described as "(text/tables)" / Excel "buildable with `pdf-parse` tables" — no table-extraction code exists anywhere | Fixed 2026-09-27 |
| Low | "Replit plugins gated behind `REPL_ID`" — true for two of three; `runtime-error-modal` is dev-mode-gated | Fixed 2026-09-27 |
| Low | Structure tree omitted `PDFTools-Frontend-Design.md`; §2 diagram lagged §8 on `verify-ui/` | Fixed 2026-09-27 |
| — | §5/§7's stored-a-job claim not re-verifiable this session (local Postgres rejected `.env` credentials); verified in code and against a correctly-credentialed DB in its authoring session | Not re-verifiable (logged, not guessed) |
**Verdict:** The README's substance holds — counts, routes, field names, versions, limits, CI, and every behavioural claim except the merge-ZIP clause; six documentation-only flags recorded, no code defect behind any of them.
**Confidence:** High — every conclusion from a command run that session; the two network items are explicitly bounded as inferred.

---

## 2026-09-27 — Commit-message hygiene audit (footer-rewrite verification)
**Corresponding REVIEW.md entry:** 2026-09-27 — "Branch history rewritten: Codebuff attribution footers stripped from all commit messages" (REVIEW.md-only commit).
**Audit type:** Other (git history / commit-message hygiene)
**Scope:** Every commit message reachable from all refs in this clone, against the 2026-09-26 no-attribution-footers policy. Out of scope: the uninspected `gitsafe-backup` remote; commit *content* (trees were proven untouched, not audited).
**Method:** A `git filter-branch` had already been run outside the logged session, so the session verified rather than redid it: tree identity for all 17 branch commits via `%T` comparison (17/17 `TREE-SAME`); subject diff (identical); footer search via `git log --all -i --grep=codebuff` (git's own grep — two pipe-based `grep -c` scans had returned false 0s by reading stale objects, which is itself recorded as a method lesson); post-`gc` object-existence probes on the old hashes; `refs/original` and `.git-rewrite` absence; worktree cleanliness.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| High (at audit time) | 16 of the branch's 17 commits carried the `Co-Authored-By: Codebuff` footer — not the handful first assumed | Fixed (rewrite verified this session) |
| Medium | Pipe-based `grep -c` scans returned false zeros from stale pre-rewrite objects; direct `%B` reads showed footers | Fixed same session (method recorded: use `git log --grep`) |
| Low | `gitsafe-backup` remote never inspected — if it mirrors the branch it may still hold footer-bearing commits (irrelevant to `origin`, which never received them) | Open (standing caveat) |
**Verdict:** All reachable commit messages are footer-free; stale objects purged so the old messages are unrecoverable from this clone; no remote holds them.
**Confidence:** High for the local repo — every step directly observed; the remote caveat is explicitly carried, not resolved.

---

## 2026-09-26 — README rendering conformance
**Corresponding REVIEW.md entry:** 2026-09-26 (render pass) — "README rendered in headless Chrome; ASCII diagram realigned" (diagram-fix commit following `c0e6d54`).
**Audit type:** Other (docs rendering conformance)
**Scope:** README.md's *rendered* fidelity — tables, ASCII architecture diagram, anchors, favicon, overflow — against GitHub-flavoured rendering semantics. Out of scope: content accuracy (audited separately on 2026-09-27).
**Method:** Static checker (GitHub-accurate slug algorithm, fence balance, table pipe consistency, HTML tag balance, per-line diagram widths) plus a real render: python-markdown → GitHub-styled HTML loaded in headless Chrome via CDP, 14 assertions. 5 initial failures were chased: 1 real defect, 4 harness bugs — none papered over.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Low | Architecture diagram border ragged (rows 1–10 at 79 columns, 11–37 at 78) — caught by a width-per-line script | Fixed same session (block regenerated programmatically) |
| Low (harness) | Four local-harness bugs (wrong expected counts, double-counting selector, local slugger's `&` divergence from GitHub's) | Fixed same session, in the harness, not the file |
**Verdict:** Verified — static checker ALL CHECKS PASS and 14/14 render assertions after the one real fix; the `#12-testing--verification` double-hyphen anchor flagged locally is correct per GitHub's slugger.
**Confidence:** Medium-High — render assertions executed against a real browser DOM; the preview is python-markdown with GitHub-faithful slugs, not GFM itself (only heading-id behaviour is load-bearing).

---

## 2026-09-26 — knip / depcheck dead-code and unused-dependency sweep
**Corresponding REVIEW.md entry:** 2026-09-26 (later) — "Baseline committed · cleanup decisions executed · Batch 1 built and verified", Step 2 (Items 5/6/7 decisions; commits `4f68893`→`5ab2db8` chain on `feat/frontend-rebuild`).
**Audit type:** Dead code / dependencies
**Scope:** Unused files, dependencies, devDependencies and exports across the workspace; unreferenced design assets; duplicate branches. Out of scope (deliberately): vendored UI primitives awaiting batch panels (known-consumers-later); the connectors-sdk platform-coupling decision (Open Item 14).
**Method:** Both tools actually run for the first time — knip (files/deps/exports) and depcheck per package, cross-checked against each other; every deletion backed by a zero-consumer proof (`diff -rq` subset proof for the Stitch zip, reference greps across source+docs+harnesses, typecheck-scope change 4→3 artifacts); the `replit-agent` branch deleted only after all 13 unique commits proved tree-identical to main counterparts via explicit hash pairs (an earlier `--all` self-comparison bug was caught and redone); knip re-run after removals to confirm no new gaps (unused files 104→46).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Low | 104 unused files (46 after cleanup — the vendored primitives awaiting Batch 2–6 panels) | Fixed same session (mockup-sandbox, Stitch zip, `.design/`, logo removed; reference folder + prompts kept with reasons) |
| Low | `cookie-parser` + `@types/cookie-parser` unused (knip AND depcheck agree) | Deferred — Open Item 14 |
| Low | Root `@replit/connectors-sdk` unused; platform coupling unknown | Deferred — Open Item 14 |
| Low (false positives) | 82 "unused devDeps" per knip are the vendored-primitives pattern (import-the-primitives tree); depcheck cross-check agreed they are not real gaps | Documented, no action |
| Info | 45 unused exports; `replit-agent` branch's 13 commits tree-identical to main | Documented / branch deleted |
**Verdict:** Clean, net of two unused deps flagged for deferred removal (pending the connectors-sdk decision) and the documented vendored-primitives false positives.
**Confidence:** High — tools run and re-run with before/after numbers; every deletion cites its proof. (The session also carried Batch 1 build work; this entry covers only its audit pillar.)

---

## 2026-09-26 — FEATURES.md-vs-repo reconciliation
**Corresponding REVIEW.md entry:** 2026-09-26 (later), Step 4 / Item 11 (commit `a711d0a`); kept in sync through the later batch sessions (see REVIEW.md's batch entries).
**Audit type:** Docs/code reconciliation
**Scope:** FEATURES.md's capability rows against the tool catalog in `routes/tools.ts`.
**Method:** Per the source entry: row-count and status comparison against the catalog's 17 implemented / 1 partial / 14 pending. The REVIEW entry records the *outcome* (a reconciliation note added to the file) rather than a row-by-row table, so per-row detail cannot be reconstructed — per Step 1, that limitation is stated rather than papered over.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Low | FEATURES.md's 31 capability rows vs the catalog's 32 tools (the partial tool is counted differently) | Documented in the file itself (reconciliation note), same session |
| Low | File predated the frontend rebuild (stale-UI caveat) | Documented; the rebuild itself landed in the same session chain |
**Verdict:** Reconciled via an explicit in-file divergence note rather than silent edits; the file has been kept in sync alongside subsequent batches.
**Confidence:** Medium — the divergence and the remedy are recorded, but the source entry does not carry a per-row comparison table, so the audit's depth cannot be fully re-verified retroactively.

---

## 2026-09-26 — WCAG contrast conformance (accent tokens, both themes)
**Corresponding REVIEW.md entry:** 2026-09-26 — "Dark-only accent override · exact reference badges/foreground · OpenAPI upload parts" (uncommitted at the time; see Open Item 1's era).
**Audit type:** Accessibility
**Scope:** WCAG contrast of the UI's accent-bearing elements (landing badges, icon tiles, Process CTA, file strip, Popular ribbon) in light and dark themes. Out of scope: every non-accent surface; `on-tertiary-container` (never measured — still open).
**Method:** Contrast computed from **rendered pixels** (canvas painting in headless Chrome against the live app), not hand maths — a focused 38-assertion suite (`accent.mjs`), plus the reference-comparison suite for badge parity. This is also the origin of the standing informational `contrast.mjs` WCAG suite (reports ratios; exit code never gates).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | Dark-mode accent contrast failed WCAG at 2.54–2.65:1 (pre-fix) | Fixed same session — `-fixed`/`-fixed-dim` inversion tokens; post-fix dark badges 8.46–13.25:1, CTA 4.83:1 (6.47:1 hover), 38/38 |
| Low | `on-tertiary-container` contrast never measured; `tertiary-fixed` family only partially ported | Open — Open Item 9 ("measure before first use") |
**Verdict:** Measured accent surfaces pass post-fix with the measured ratios recorded; the tertiary token remains unmeasured and is the standing gap.
**Confidence:** High — pixel-measured against the live app, with the numbers in the source entry.

---

## 2026-09-26 — Git history-quality audit (Part 0's anomaly analysis)
**Corresponding REVIEW.md entry:** 2026-09-26 — "Created REVIEW.md audit log + agent protocol" (Part 0 appendix; REVIEW.md-only commit).
**Audit type:** Other (history quality / provenance)
**Scope:** Whether git history can serve as ground truth for session reconstruction. Out of scope: anything on the uninspected `gitsafe-backup` remote.
**Method:** `git log --all --oneline | wc -l` (32) vs main first-parent count (19); `--follow` probes on three representative files; timestamp/pair analysis of duplicated commits; cross-checks against the `.agents/memory/` notes as corroborating (not verifying) evidence.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | 13 duplicated commit pairs share subject and timestamp to the second across `main` and `replit-agent` — an automation re-commit pattern; commit counts understate session counts | Open (standing caveat — governs how every log entry draws session boundaries) |
| Low | Squash risk at the root: `9ef0b8f` lands 114 files / 13,453 lines in one commit; the sessions that built it are unreconstructable | Documented (that commit is logged as one Low-confidence entry) |
| Info | Commit gaps ≠ inactivity, proven both ways (the largest frontend change has zero commits; a 25-day gap contained major work) | Open (standing caveat) |
**Verdict:** Git is **best-available-but-incomplete** ground truth; session boundaries are drawn from timestamps + diff themes and each entry cites its rule. This caveat is binding on REVIEW.md and AUDIT.md alike.
**Confidence:** High — the anomalies are mechanically observed and the analysis method is recorded.

---

## 2026-09-29 — Security (adversarial production-readiness pass)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session).
**Audit type:** Security
**Scope:** Dependency vulnerabilities (prod + dev trees), secrets in tree and history, upload-route validation (size/type/filename), CORS breadth, zod coverage of user input, temp-file cleanup on success and failure, rate limiting. Out of scope: load testing, penetration testing beyond local probes, the `gitsafe-backup` remote (never inspected; standing caveat from the hygiene audit).
**Method:** `pnpm audit --prod` and `pnpm audit --json` across the workspace; `git log --all -p -S` secret sweeps (sk-or-, `AIza…30`, pasted-key pattern) plus a tracked-file regex scan; read `upload.ts`, `app.ts`, `routes/pdf.ts` (all 36 registrations), `shared.ts` (sanitize/send), `office.ts` (only service writing uploads to disk) and tested the extension logic against traversal shapes; greps for rate-limit constructs, `unhandledRejection` handlers, `mkdtemp`-without-`finally`.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| High | **multer 2.2.0 (lockfile-pinned) carries 4 advisories, 2 HIGH DoS directly on the upload path** (file-descriptor leak on aborted uploads; crafted-multipart-field DoS), + moderate orphaned-disk-write + low fileFilter race. Live on every upload route. Fix exists upstream (≥2.4.0) — log-only per read-only rule | Open → Open Item |
| Medium | **No rate limiting anywhere** (`grep rate.limit\|429` over `src/` → zero): unbounded 50 MB×20-file processing per client | Open → Open Item |
| Medium | **CORS wide-open** (`app.use(cors())`, default allow-all origins) — tolerable for a stateless dev tool, not for production | Open → Open Item |
| Medium | **fast-uri 3.1.4** (4 HIGH SSRF/host-confusion advisories) — transitive via `@scalar/openapi-parser`; reachable only on the spec-validation/docs path, not on user request flow | Open (bundled with dependency item) |
| Medium | **image-size 1.2.1** (2 HIGH infinite-loop DoS) — transitive via pptxgenjs, but **verified unreachable**: no `addImage` call exists (`grep addImage` → zero) and `edit.ts` sniffs magic bytes itself and embeds via pdf-lib; latent, becomes live the day image embedding lands | Open (bundled) |
| Medium | `qs` 2 moderate array/DoS advisories via express query parsing — reachable on any query string | Open (bundled) |
| Low | Dev-tree-only advisories (esbuild Windows-only file read, etc.): 8 of the 18 | Open (bundled) |
| Info | **No hardcoded secrets** — tracked-file regex scan zero; history `git log -S` clean (all `sk-or-` hits are the code literal/docs; zero `AIza…`, zero pasted-key pattern); `.env` gitignored | — |
| Info | **Upload validation solid**: 50 MB/file + 20 files enforced with JSON 413/400 mapping; every tool route parses options through zod (`withOptions`); filenames sanitized (`sanitizeFileName` strips path components + control chars + quotes); office service's `extensionOf` is regex-anchored + whitelist-checked — no traversal | — |
| Info | **Temp cleanup correct**: all three tmpdir users (compress, extract, office) remove workdirs in `finally`, covering failure paths | — |
**Verdict:** Not production-hardened: no secrets and good input/filename hygiene, but the upload parser itself carries live HIGH DoS advisories, there is no rate limiting, and CORS is allow-all. Dependency refresh (lockfile-level) closes the bulk of it.
**Confidence:** High — every advisory read from `pnpm audit --json`, every validation claim read in source, every negative claim (secrets, rate limits) a grep run this session.

---

## 2026-09-29 — Reliability & error handling
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session).
**Audit type:** Reliability / error handling
**Scope:** Crash-resistance on malformed/corrupted/encrypted inputs across representative routes; unhandled rejections; health check. Out of scope: every route × every fuzz case (a representative 8-route matrix was used).
**Method:** **Live probe** (one-shot script, deleted after): built a corrupted PDF (valid header+trailer, garbage middle), a truncated PDF, a text file named `.pdf`, and an encrypted PDF produced by the app's own `/pdf/protect`; fired all four × 8 single-file routes + merge through the real built server; captured statuses, then the server's exit state and stderr. Static: greps for `unhandledRejection` handlers (none) and floating promises; every route's `try/catch`+`failTool` structure read.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| **High** | **A single malformed PDF can kill the API process.** Every pdfjs-based call (extract-text, page-info) on the corrupted/truncated fixture fires an unhandled `FormatError: Command token too long: 128` rejection (pdfjs 5.4.296's own class) — 6 rejections for 6 malformed calls, zero `process.on("unhandledRejection")` handlers in `src/`. Under Node ≥15 defaults the process **exits** (observed: `api exited code=1` mid-matrix, all subsequent requests refused); it survives only under `--unhandled-rejections=warn`. No process manager/restart policy is defined in-repo | Open → Open Item |
| Medium | **Silent 200 family:** split, crop, watermark and merge return **200 with a recovered 1-page PDF** from the corrupted 6-page fixture — no warning, no disclosure that content was lost. Recovery is a feature; hiding it is not | Open → Open Item |
| Medium | **text-as-pdf answered 500** on split/compress/crop/extract-text/page-info/watermark — client error (4xx) mislabelled as server fault | Open → Open Item |
| Low | extract-text returns generic 500 (not the honest 422) on encrypted input, unlike page-info/crop/watermark which 422 cleanly | Open → Open Item |
| Info | Health check exists: `GET /api/healthz` → 200 `{"status":"ok"}` (zod-parsed in `routes/health.ts`) | — |
| Info | Encrypted inputs otherwise handled well: honest 422 with unlock guidance on 4 routes | — |
**Verdict:** The error-handling architecture (per-route try/catch → failTool) is real and mostly good — but one unhandled pdfjs rejection class defeats it entirely: a corrupt upload is a remote, unauthenticated, one-request process kill. Not production-safe until that is closed.
**Confidence:** High — the crash was reproduced twice live (default mode: process death; warn mode: full rejection log), with the rejection class and count tied to exact requests.

---

## 2026-09-29 — Dead code & dependencies (re-audit)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session); original sweep: 2026-09-26.
**Audit type:** Dead code / dependencies
**Scope:** knip + depcheck re-run (Open Item 14 re-verification); `console.log`/`debugger` in production paths.
**Method:** `npx knip --no-progress` (workspace), `npx depcheck artifacts/api-server --json`; `grep -rn "console\.\|debugger"` over `artifacts/api-server/src`.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | **knip errors at start** (`Error loading lib/db/drizzle.config.ts (DATABASE_URL …)`) — the dead-code tool cannot run cleanly without a provisioned DB, so CI-ability is broken | Open → Open Item |
| Low | Vendored-unused file count regressed 46 → 58 (knip); all still the import-the-primitives pattern awaiting batch panels | Documented (pattern unchanged) |
| Low | Open Item 14 exactly as it was: `cookie-parser` + `@types/cookie-parser` flagged by depcheck; connectors-sdk coupling undecided — no new unused deps accumulated in the api-server | Open — Item 14 stands |
| Info | Zero `console.log`/`debugger` in the api-server production source | — |
**Verdict:** Essentially unchanged since the 2026-09-26 sweep — no new dead deps — but knip's DB-config error means the tool itself is not cleanly runnable, which the original audit did not face.
**Confidence:** High — both tools run this session, outputs parsed.

---

## 2026-09-29 — API/spec consistency (fresh cross-check)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session); standing machine check: batch6.mjs since 2026-09-27.
**Audit type:** API/spec consistency
**Scope:** Every registered `/pdf/*` route vs every `openapi.yaml` path, both directions, including Open Item 12's binary-field-naming rule for **all** routes (the standing suite asserts set equality; this pass also verified per-route multer field names inside the multipart schemas).
**Method:** Node script (run this session, output captured): `routes/pdf.ts` parsed multi-line-aware for `router.post` + `upload.single/array/fields` field names; `openapi.yaml` path blocks extracted by line ranges; mutual set-compare + per-route field membership. First scripted pass produced 33 false mismatches from its own single-line regex — discarded, method corrected, second pass validated by construction (36/36 found on both sides before field checks).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| — | 36 multer routes ↔ 36 spec paths, zero missing in either direction; every binary field (`file`, `files`, `image`, `p12`, `capture`) present in its route's multipart schema | — |
**Verdict:** Clean. Open Item 12's rule holds for every route, not just the previously machine-checked set-equality.
**Confidence:** High — bidirectional count equality (36=36) was established before field-level checks, eliminating the false-negative class that invalidated the first pass.

---

## 2026-09-29 — Accessibility (first deep audit)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session); prior art: 2026-09-26 WCAG contrast audit (AUDIT.md).
**Audit type:** Accessibility
**Scope:** Keyboard navigation in both workspace templates, icon-only button labelling, alt text, focus visibility, and Open Item 9's never-measured `on-tertiary-container` contrast. Out of scope: full WCAG 2.2 conformance, screen-reader testing.
**Method:** Source census (button/aria-label/tabIndex/alt counts per workspace file), keyboard-handler inspection, focus-visible grep; contrast computed by the WCAG formula ((L1+0.05)/(L2+0.05)) from the exact token hexes in `index.css` (`on-tertiary-container #e7ffe4` on `tertiary-container #008438` → 13.16:1) and dark-theme override check (the `.dark` block re-points tertiary at the 10.44:1 pairing).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | `file-strip.tsx`'s icon+text "Replace document" button carries **no accessible name mechanism issue** — it has visible text, so labelled — but the **page-picker template has 5 buttons with only 2 aria-labels**; the unlabelled three are text-bearing (back/process-class controls), so the real gap is the pattern's inconsistency, not an unusable control | Open → Open Item (bundle with a11y hardening) |
| Info | Keyboard support is real and verified in source: `page-thumbnail.tsx` implements full `onKeyDown` (Enter/Space select, Alt+Arrows reorder/rotate — the Alt+Arrow bug fixed 2026-09-26 lives here); all 5 thumbnail buttons have aria-labels; the thumbnail `<img>` has alt text | — |
| Info | `:focus-visible` global style present (`index.css` line 422) | — |
| Info | **Open Item 9's measurement is now done: `on-tertiary-container` = 13.16:1** on `tertiary-container` (light) — passes; the token is currently used by **zero** components, and the dark theme overrides the tertiary family with the 10.44:1 pairing | Item 9's measurement half closed in REVIEW.md |
**Verdict:** Genuinely keyboard-first where it matters (page workspaces) with measured-contrast tokens; the accessibility debt is small and specific (a handful of text-bearing buttons rely on visible text alone), not structural.
**Confidence:** Medium — source-verified and formula-computed, but no screen-reader or live keyboard walkthrough was performed (read-only audit; running the dev server for an interactive pass was out of scope this session).

---

## 2026-09-29 — Performance (first audit)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session).
**Audit type:** Performance
**Scope:** Production bundle size/composition; backend memory model at the advertised upload ceiling. Out of scope: load testing, latency benchmarking.
**Method:** `ls -l` of the production build output; source inspection of `upload.ts` (memoryStorage) plus the buffer-copy points in `shared.ts` (`Buffer.from(data)` in sendBuffer) and the double-buffer compress path (reserialise + gs candidate both held).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | **Memory model does not scale to the advertised limits:** multer memoryStorage loads every upload fully into RAM (20×50 MB = up to ~1 GB per request wave), and response building adds at least one full copy (`sendBuffer`'s `Buffer.from(data)`); compress holds reserialised + Ghostscript candidates simultaneously. Fine for a single-user tool; multi-user deployment will OOM before any queue protects it (and there is no queue/rate limit — see the Security entry) | Open → Open Item |
| Low | Frontend bundle: single 610 KB JS chunk (185 KB gzip) + 117 KB CSS, no code-splitting — the pdfjs/page-picker machinery ships on the landing page too. Responsive, but the largest-payload warning fired at build | Open → Open Item (bundle item) |
| Info | No dev dependencies leak into the production bundle (vite build output contains app code only; esbuild stays server-side dev-only) | — |
**Verdict:** Honest for its design point (single-user tool): bundle is acceptable if unoptimised, and the backend is bounded per request — but the in-memory pipeline plus no rate limiting means "20 files × 50 MB" is a per-connection, not a system, capability.
**Confidence:** Medium — measurements direct from build artifacts and source, but no runtime memory profiling was performed (read-only session).

---

## 2026-09-29 — Documentation accuracy (harsh pass)
**Corresponding REVIEW.md entry:** 2026-09-29 (production-readiness audit session); prior README audit 2026-09-27 (AUDIT.md).
**Audit type:** Docs/code reconciliation
**Scope:** README.md, FEATURES.md, UI-NON-REGRESSION-RULES.md claims that could round partial capabilities up to finished, under the current (post-Batch-8) code. Out of scope: re-checking the 2026-09-27 README audit's already-fixed six flags.
**Method:** Targeted greps of every claim touching AI provider, limits, rate/queue behaviour, tool counts; FEATURES.md read against the current catalog; cross-checked against source (`ai.ts`, `upload.ts`, `routes/tools.ts`).
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| Medium | **FEATURES.md contradicts itself:** the header note says "**31 implemented · 1 partial · 0 pending**" while line 9 still reads "**19 implemented, 2 partial, 12 not implemented**" — the stale intro directly undercuts the file's own correction | Fixed this session (header updated to cite the count with its provenance) |
| Low | FEATURES.md's AI Summarizer row names "OpenAI (gpt-5-mini / openrouter)" — since the live-key sessions the project actually runs Gemini via `OPENAI_BASE_URL`/`OPENAI_MODEL`, and that flexibility is now a documented feature | Fixed this session (row points at the env-configurable provider) |
| Low | **Translate fidelity is model-dependent:** flash-lite snapshots were observed echoing the English source on 4 of 6 pages under load (live-key session's probe) — FEATURES/README describe the JSON contract and caps but not that output quality rides on the chosen model snapshot | Documented this session as a FEATURES.md Known Limitations entry (citing the audit), not a code fix |
| Info | README's "50 MB per file, 20 files max" claim is accurate (`upload.ts`); README makes **no** rate-limiting or queueing claim, so none needed correcting — but it also does not disclose the memory-storage model, which the Performance entry now covers as a gap rather than a false claim | — |
| Info | UI-NON-REGRESSION-RULES.md: no new recurring risk pattern surfaced this audit (the crash class is a one-time integration defect, not a standing rule candidate) — file left untouched per the brief | — |
**Verdict:** README holds under re-scrutiny; FEATURES.md carried a genuine self-contradiction and two stale AI claims — all three corrected this session; one model-fidelity limitation added where a tool's real behaviour is weaker than the docs' implication.
**Confidence:** High — every claim checked against source by grep this session; the corrections are in the same commit as this audit's REVIEW.md entry.
**Corresponding REVIEW.md entry:** 2026-09-26 — "Repo cleanup/reorg audit (read-only, parked)" (no commits; deliberately read-only).
**Audit type:** Dead code / dependencies
**Scope:** As briefed: branch strategy (`chore/cleanup-reorg`), knip/depcheck dead-code removal, repo reorganisation.
**Method:** None executed beyond read-only inspection (tree, git status — 59 dirty paths, `.gitignore`, aliases, `attached_assets/`, asset tracking status). **knip and depcheck were never run**; the session was interrupted by a user redirect, and the brief was never completed. The sweep was later executed properly by the 2026-09-26 entry above.
**Findings:**
| Severity | Finding | Status |
|---|---|---|
| — | No findings recorded — nothing was executed and nothing was verified | Superseded by the completed sweep (same day) |
**Verdict:** Unverifiable retroactively — the audit claimed nothing, ran nothing, and was abandoned; logged here only so the gap is visible (and closed by the later entry, not papered over).
**Confidence:** Low — read-only observations only, by its own record.
