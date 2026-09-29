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
| Dead code / dependencies | 2026-09-26 (knip + depcheck sweep) | Cleaned; 2 unused deps flagged, removal deliberately deferred (Open Item 14) | |
| Security | never | — | |
| API/spec consistency | never (deep audit) — spec ↔ router coupling has been machine-checked bidirectionally by the suites since batch6 (2026-09-27) | — | |
| Accessibility | 2026-09-26 (WCAG contrast, pixel-measured) | Measured accent tokens pass post-fix; `on-tertiary-container` still unmeasured (Open Item 9); `contrast.mjs` runs informational since | |
| Performance | never | — | |
| Docs/code reconciliation | 2026-09-27 (README claim-by-claim audit) | Substance holds; 6 documentation-only flags, all fixed same day | |

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

## 2026-09-26 — Repo cleanup/reorg audit (aborted attempt)
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
