# REVIEW.md — PDFTools change & verification log

> ## ⚠️ SESSION PROTOCOL — READ BEFORE ANY WORK
> **Before ending any session that changes this project, append an entry here using the template in Part 3. Do not mark a result Verified without evidence.**
>
> - Entries are **newest-first**. Every entry states which session-boundary rule placed it (see *Session-boundary rules* below).
> - **"Result: Verified working" requires "Verification performed" to cite actual evidence** — a command that was run, a screenshot compared, a test that passed. A session that only claims success gets `Unverified (claimed only)`. No exceptions — including for the session that created this file.
> - Check the **Open Items** section every session: move items you closed out of it (and say how you confirmed closure in your entry), add items you opened.
> - Ground-truth caveat: git history in this repo is **best-available-but-incomplete** (see *Part 0 — History quality* at the bottom). The 2026-09-26 sessions have **no commits at all**; their evidence lives in this log's citations, not in git.

---

## Open Items

| # | Item | Opened by | Status / note |
|---|---|---|---|
| 1 | **59 uncommitted changes on `main`** — the entire 2026-09-26 frontend rebuild + accent/spec work + regenerated clients exist only in the working tree, including the disposable backup `artifacts/pdftools/src-backup-pre-rebuild/` | 2026-09-26 (rebuild session) | Blocks the approved cleanup/reorg brief: `chore/cleanup-reorg` must not start from an uncommitted baseline. Commit to a branch first. |
| 2 | **Cleanup/reorg brief parked mid-audit** — read-only Step 1 findings were gathered (knip/depcheck not yet run; `attached_assets`, `stitch zip`, `mockup-sandbox`, `replit-agent` branch all flagged) | 2026-09-26 (cleanup audit) | Awaiting user go-ahead; audit was read-only, nothing moved or deleted. |
| 3 | **`/pdf/compress` `quality` option is a no-op** — no Ghostscript in the environment; `extreme`/`recommended`/`high` take the identical re-serialise path, but the Compress panel still offers three choices | 2026-09-26 (accent/spec session) | Either build real compression or collapse the UI to one honest option. Spec now documents the gap. |
| 4 | **Step 3 tool batches 1–6 not built** — 32-tool catalog shipped; 2 tools (compress, remove-pages) have real Configure panels; **14 tools are backend-pending** (disabled Process + badge); page-picker Configure panels for extract/organize/rotate still open | 2026-09-26 (rebuild session) | Batch 1 (Organize PDF) was staged next: all 7 tools have live routes. |
| 5 | **`artifacts/mockup-sandbox/` (~60 vendored `components/ui` files)** — unused by the app | 2026-09-26 (cleanup audit) | Needs human decision: delete or keep. |
| 6 | **Committed non-source artifacts** — `stitch_pdftools_web_application_ui/` (18 screens + design docs), `stitch_pdftools_web_application_ui_fixed.zip` (5.6 MB), `.design/screen1/`, `attached_assets/` (6 pasted prompts + an unused `ilovepdf-logo.svg`; the `@assets` vite alias dangles) | 2026-09-26 (cleanup audit) | Candidates: gitignore / move out of VCS / delete after review. |
| 7 | **`replit-agent` branch strictly behind `main`** (13 duplicated commit pairs; `git diff main replit-agent` shows only the Stitch assets missing) | 2026-09-26 (history audit) | Candidate for deletion after review. |
| 8 | **`UI-NON-REGRESSION-RULES.md` names a lucide icon the installed version doesn't ship** — `lucide-react@0.545.0` has no `Compress`; `Minimize2` is the standardised substitute | earlier UI session (pre-log) | Rules file needs a note so future sessions don't "fix" it back. |
| 9 | **`on-tertiary-container` contrast never measured**; `tertiary-fixed` family only partially ported (used by nothing yet — badges use `success-subtle-foreground` instead) | 2026-09-26 (accent session) | Measure before first use. |
| 10 | **No test framework** — the 127-assertion CDP regression harness + 38-assertion accent suite live in `/tmp/pdfcheck/` and are disposable | 2026-09-26 (rebuild session) | Consider committing them (e.g. `scripts/verify-ui/`) so verification is reproducible. |
| 11 | **Docs drift** — `FEATURES.md` (19 implemented / 2 partial / 12 not-implemented *capabilities*) vs the 32-tool catalog (17 implemented / 1 partial / 14 pending *tools*); README predates the rebuild | 2026-09-26 (audit) | Reconcile when the catalog settles. |
| 12 | **Spec ↔ multer coupling** — every new `/pdf/*` route must add its binary part(s) to `lib/api-spec/openapi.yaml` with the exact field name (`file`/`files`/`image`) or the generated client can't upload | 2026-09-26 (spec session) | Now documented in the spec header; keep it true for future tools. |

---

## 2026-09-26 — Created REVIEW.md audit log + agent protocol (this session)
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
