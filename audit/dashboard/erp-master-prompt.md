# Master Prompt: ERP Remediation and UI/UX Upgrade

> **How to use this file:**
> 1. Open your coding agent (Claude Code or similar) in `~/Documents/Work/tkxelbitbucket`. That folder must contain `erp-be/`, `erp-fe/`, `erp-audit-2026-10-06.md` and `erp-dashboards-roadmap.md`.
> 2. Paste everything below the line.
> 3. The agent works phase by phase and stops at every **🛑 checkpoint** for your approval.
>
> To resume in a later session, paste it again and add: *"Resume from the REMEDIATION_LOG.md files."*

---

## 0. Your role

You are a team of four working as one:

1. **Staff backend engineer:** Node/TypeScript, Express, Prisma, PostgreSQL.
2. **Application security engineer:** OWASP ASVS L2.
3. **Senior frontend engineer:** React, TypeScript, Tailwind, accessibility.
4. **DevOps engineer:** Docker, Bitbucket Pipelines, supply chain.

Your job is to **fix the findings** in the ERP audit and **deliver the UI/UX upgrade it specifies**. Work safely, one phase at a time, with tests for every change. You are fixing an existing production codebase, not rewriting it.

---

## 1. Ground truth

| Item | Value |
|---|---|
| Product | **ERP Platform**: Multi-Company Financial & Inventory Management System (General Ledger, Vouchers, Chart of Accounts, Trade Invoices, Stock Tracking). |
| Backend | `./backend`: Express 4.21, TypeScript 5.8, Prisma 6.19, PostgreSQL 16, Decimal.js, Zod, Vitest |
| Frontend | `./frontend`: Next.js 15.5, React 19, TypeScript 5.8, Mantine 9, TanStack Query v5, Tabler Icons, Calm Ledger Design System |
| Active branch | **`feature/inventory-professional`** (or feature branch off `master`). Base is `master`. |
| Audit & Remediation Plan | [`REMEDIATION_PLAN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/REMEDIATION_PLAN.md) and [`audit-report.html`](/Users/tk-lpt-1088/development/react/erp/ERP/audit-report.html). **This is the source of truth.** It defines 23 prioritized findings across 4 waves: Wave 0 (Hotfixes/U0), Wave 1 (Core Architecture & Security), Wave 2 (UI/UX & Accessibility), Wave 3 (Reliability & Testing). |
| Visual Design Standard | [`DESIGN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/DESIGN.md) ("Calm Ledger" visual standard: Ledger Blue `#1f56c7`, 32px compact controls, 36px table rows, white ground, navy sidebar, no decorative gradients). |
| Baseline | Monorepo builds cleanly with `npm run build` in both frontend and backend. |

**Before you write any code, read the remediation plan and project rules.** Where this prompt and the audit plan disagree, the project rules and remediation plan win.

---

## 2. Non-negotiable rules

### 2.1 Git and branches

1. **Never commit to, push to, or merge into `master`, `main` or `staging`.** Never force-push. Never rewrite history.
2. Create one branch per phase off the latest `master`, named exactly as the phase table in §4 says. Rebase or merge `master` into it if `master` moves.
3. Commit in small logical steps. Use Conventional Commit messages that cite finding IDs, for example `fix(security): scope CEFR status updates (BE-SEC-17)`.
4. **Pushing branches and opening pull requests requires my approval** at each phase checkpoint. Until I approve, everything stays local.
5. **Do not merge `chore/pause-sonar-quality-gate`.** Do not weaken, skip or delete existing tests, lint rules or quality gates to make something pass.

### 2.2 Verify before you fix

1. **Re-verify every finding on the current `master` first.** The audit was taken at FE `00c32c4` and BE `3f0da5a`, and code may have moved since.
2. Open the cited file and line. Confirm the problem still exists. Then fix it.
3. If a finding is already fixed or doesn't reproduce, mark it `not-reproduced` in the log with the reason, and move on.
4. If a fix needs a decision the audit doesn't settle, stop and ask me. Don't guess.

### 2.3 Tests and quality bar

Each phase is done only when all of these hold:

- `npm run type-check`, `npm run lint` and `npm test` all pass in every repo the phase touched.
- `npm run build` passes in erp-fe.
- **Coverage never drops below the baseline.**
- **Every security fix ships with a test that fails before the fix and passes after it.** Examples:
  - an HTTP test proving a LINE_MANAGER gets 403 on an out-of-scope employee
  - a test proving no response body contains `password_hash`
- **Every UI fix is verified in a running browser:**
  - light and dark mode
  - widths 375 px and 1280 px
  - keyboard only
  - plus a screenshot for the phase summary

### 2.4 Safety boundaries: never do these yourself

You may write code, migrations and scripts for the items below. **Running them against any real environment is mine to do:**

- Rotating passwords, JWT secrets or API keys.
- Purging or scrubbing production logs or production `access_audit_logs`.
- Running migrations, seeds or backfills against any database except a local or disposable one.
- Changing Bitbucket repository settings: default branch, branch protection, pipeline variables.
- Creating container registries, cloud resources or third-party accounts.
- Any change to OpenAI usage terms or a DPA.

Also:

- Never put real credentials, employee names or production hostnames in code, tests, fixtures or commit messages. Use obvious fakes.
- Never paste or log secrets. If you find one, stop and tell me where it is.

### 2.5 Cross-repo contracts

Some fixes change the API contract. For each of these, change the **backend first** and keep it backward compatible for one release where you can. Then update the **frontend in the same phase**, and list the contract change in both REMEDIATION_LOGs.

| Change | Finding |
|---|---|
| Logout call | FE-SEC-12 |
| Slim employee and department DTOs | BE-SEC-19, BE-SEC-25 |
| CEFR create default status `pending` | BE-SEC-18 |
| RFC 7807 errors | BE-ARC-11 |
| Pagination | BE-PERF-03 |
| Period-keyed assessments | BE-ARC-04 |
| Generated OpenAPI types | FE-ARC-09 |

### 2.6 Tracking

Create and maintain `REMEDIATION_LOG.md` at the root of **each** repo. Use one row per finding:

```
| ID | Sev | Status (todo / in-progress / fixed / not-reproduced / deferred / needs-decision) | Branch | Commit(s) | Test(s) proving it | Notes |
```

Update the log as you go. It is how you, and a future session, know where things stand.

---

## 3. Working loop for every phase

1. **Plan.** Do the following, then post the plan and continue unless the phase has a 🛑 at the start:
   - Pull `master` and create the phase branch.
   - List the phase's finding IDs.
   - Re-verify each one (§2.2).
   - Write a short plan: order of work, contract changes, risky steps.
2. **Fix.** Work finding by finding. Write the failing test, then the fix, then run the repo's checks. Commit.
3. **Verify.**
   - Run the full check suite in both repos.
   - For UI phases, start the dev server and check the screens in the browser (§2.3).
   - For migrations, run them against a **local disposable Postgres** (`docker run postgres:16`), seed it, run them, run them again to prove they're idempotent, and roll back where possible.
4. **Report and stop at 🛑.** Post a phase summary:
   - findings fixed, not reproduced, deferred, needing a decision
   - test and coverage numbers before and after
   - contract changes
   - screenshots (UI phases)
   - anything I must do by hand (§2.4)

   Then **wait for my approval** before pushing or starting the next phase.

---

## 4. Phases, in order

The audit's §11 (engineering) and §12 (UI) contain a detailed **copy-ready prompt for each phase**. Treat each one as that phase's task list. Every finding ID is defined in the audit with evidence and a fix.

There are two tracks:
- **Engineering:** P0 → P1 → P2 → P3.
- **UI:** UI-0 → UI-1 → UI-3 → UI-4 → UI-7 → UI-2 → UI-5 → UI-6 → UI-8.

Run them in the order of the table below. UI-2 must wait for P1, because it needs the URL routes.

| Order | Phase | Repo(s) and branch | Key findings (the audit has the full list) | Exit criteria |
|---|---|---|---|---|
| 1 | **P0 Stop the bleeding** | BE `fix/phase0-security`<br>FE `fix/phase0-security`<br>both `ci/phase0` | BE-SEC-01, 02, 03, 04, 05, 06, 12, 16, 17, 18, 19; BE-SEC-20 (revoke on password change); FE-SEC-01, 02, 03, 11, 12; FE-ARC-02; FE-OPS-01; **A11Y-01** | <ul><li>No API response or audit-log write contains a password hash.</li><li>Every behavioral and CEFR handler is scope-checked.</li><li>No self-approval for any role.</li><li>Tokens are redacted from logs.</li><li>Logout revokes the server session.</li><li>`password123` and demo codes are absent from `dist/`.</li><li>CSP and headers are in place.</li><li>The confirm dialog no longer fires on Enter.</li><li>Error boundaries are in place.</li><li>Only `master` deploys production.</li></ul> 🛑 |
| 2 | **UI-0 Stop misleading UI** | FE `ui/phase0` | UX-03, 04, 07, 08, 09; FE-ARC-06; DS-03; A11Y-05, 09, 10; VIS-07 | ErrorState, EmptyState and LoadingState are in use. No fake bell. Labelled forms. 🛑 |
| 3 | **P1 Production foundations** | BE and FE `feat/phase1-foundations` | <ul><li>Auth: BE-SEC-07, 08, 09, 10, 13, 20, 21, 24, 25, 26</li><li>Architecture: BE-ARC-05, 11</li><li>Quality and ops: BE-QA-01, 02; BE-OPS-01, 02, 03; BE-DATA-04</li><li>Frontend: FE-ARC-01, 03, 04, 05, 08; FE-SEC-05, 06, 07, 13; FE-QA-01, 02</li><li>Frontend ops: FE-OPS-02, 04, 05, 06</li><li>UX: UX-01, UX-10</li></ul> | <ul><li>URL routes per section, with one `canAccess`.</li><li>Initial JS under 200 kB gzipped.</li><li>Non-root, digest-pinned images.</li><li>An RBAC matrix test (role × route) against real Postgres.</li><li>An audit-events table.</li><li>A period state machine.</li><li>RFC 7807 errors.</li><li>One CI pipeline, with migrations as a gated step.</li></ul> 🛑 |
| 4 | **UI-1 Prism tokens + Light/Dark/System** | FE `ui/phase1-prism-tokens` | VIS-01; DS-02, 04, 06; A11Y-02, 04, 06 | <ul><li>`tokens.css` matches audit §10.7 exactly.</li><li>Light, dark and system modes work.</li><li>A test confirms every token pair meets the WCAG ratios in §10.2.</li><li>A lint rule ratchets hard-coded colors down.</li></ul> 🛑 |
| 5 | **UI-3 Component library** | FE `ui/phase3-components` | A11Y-03, 08, 11, 12, 13; DS-05, 07; VIS-03, 04, 05 | <ul><li>Radix-based overlays and menus.</li><li>One of each primitive.</li><li>Type and icon sweep done; no information below 12 px.</li></ul> 🛑 |
| 6 | **UI-4 Chart system** | FE `ui/phase4-charts` | DS-01, 08; VIS-06; A11Y-07 | <ul><li>One palette module.</li><li>Fixed pillar colors.</li><li>ChartFrame with a table view and export.</li><li>Charts accessible.</li></ul> 🛑 |
| 7 | **P2 Appraisal integrity and architecture** | BE and FE `feat/phase2-correctness` | <ul><li>**BE-ARC-04 (critical)**</li><li>Architecture: BE-ARC-06, 07, 08, 09, 10, 12, 13, 14</li><li>Data and performance: BE-DATA-01, 02, 03; BE-PERF-01, 02, 03</li><li>Backend: BE-ARC-01, 02, 03; BE-SEC-11, 22, 23, 27</li><li>Frontend: FE-ARC-07, 09, 10, 11, 12; FE-QA-03, 04; FE-DX-01..04</li></ul> | <ul><li>Assessments and scores are keyed by period.</li><li>Re-assessing in period 2 leaves period 1 untouched (test).</li><li>Locked periods are immutable (DB-enforced).</li><li>Scoring config is versioned.</li><li>Assessment write + recompute is atomic.</li><li>Lists are paginated.</li></ul> 🛑 **at the start** (data-migration plan) and at the end |
| 8 | **UI-7 Login, brand, onboarding** | FE `ui/phase7-brand` | VIS-02, 08 | Outlined wordmark, new login, manifest and icons. 🛑 |
| 9 | **UI-2 Shell, sidebar, progress bar** | FE `ui/phase2-shell` | UX-02, 05, 06; A11Y-14 | <ul><li>Sidebar with expanded, rail and mobile-drawer states (Ctrl/⌘+B).</li><li>3 px top progress bar.</li><li>PageHeader with `document.title`.</li><li>⌘K palette.</li></ul> 🛑 |
| 10 | **Dashboards D0–D4** (replaces UI-5) | <ul><li>BE `feat/d0-analytics-data` (D0 runs inside P2)</li><li>FE `ui/d1-dashboard-kit`</li><li>FE `ui/d2-home-dashboard`</li><li>FE `ui/d3-workforce`</li><li>FE `ui/d4-matrix-schedule`</li></ul> | VIS-09 + every phase in `erp-dashboards-roadmap.md` §6–§7 | <ul><li>**Data:** joining date, job title and grade history are added; `approved_at`/`approved_by` recorded.</li><li>**Analytics API:** the analytics endpoints are scoped and suppress groups under 3 people.</li><li>**Pages:** Home, Workforce, Skills matrix and Schedule are built from the D1 kit.</li><li>**Every chart** has a plain-language metric definition and a "View as table" option.</li></ul> 🛑 after each D-phase |
| 11 | **UI-6 Flows, reports, Setup** | FE `ui/phase6-flows` | audit §12 UI-6 | <ul><li>Assessment wizards with autosave.</li><li>Approvals split view.</li><li>React print route replacing `pdfGenerator` HTML strings.</li><li>Mobile tables.</li></ul> 🛑 |
| 12 | **UI-8 Motion, a11y QA, visual regression** | FE `ui/phase8-qa` | audit §12 UI-8 | <ul><li>axe in CI with 0 serious or critical issues.</li><li>Keyboard walkthroughs.</li><li>Screenshot baselines.</li><li>Performance budgets in CI.</li></ul> 🛑 |
| 12b | **Dashboards D5 Trends** | BE then FE `feat/d5-trends` | roadmap §7 D5 | Sparklines, deltas and trend lines come from **locked-period snapshots only**. The precondition is that BE-ARC-04 is merged. D6 QA merges into UI-8. 🛑 |
| 13 | **P3 Outbox, read models, scale** | BE `feat/phase3-outbox-read-models` | BE-OPS-04, 05; BE-SEC-14, 15; FE-QA-06, 07; FE-SEC-08, 09 + audit §11 Phase 3 prompt | <ul><li>Outbox and worker, dual-run against the synchronous path.</li><li>Projections.</li><li>OpenAPI artifact.</li><li>Tracing and SLOs.</li></ul> 🛑 |

**For UI phases:** paste the audit's §12 *"Shared guardrails for every UI prompt"* block into your working context before you start. Treat §10 *ERP Prism* as binding: every hex code, gradient, type step, radius, elevation and motion token.

---

## 5. Phase-specific cautions

### P0: password hashes (BE-SEC-01)
- Fix the code paths and write `src/scripts/scrub-audit-log-secrets.ts`.
- Test the script only against local data.
- In your summary, tell me that I must run it on production, rotate every user's password, and purge logs containing tokens (BE-SEC-06).

### P0: logout (FE-SEC-12) and CEFR scope (BE-SEC-17)
- Change the backend first, then the frontend.
- Add a Playwright or integration test that proves the refresh token stops working after logout.

### P0: CI (FE-OPS-01)
- Only edit the pipeline YAML.
- Changing the Bitbucket default branch is mine to do. List it in the summary.

### P2: BE-ARC-04 is a data migration on appraisal history
🛑 **Before writing it**, show me a migration plan covering:
- new uniqueness keys
- how existing rows get their `appraisal_period_id`
- what happens to rows with a NULL period
- copy-forward rules at rollover
- the lock trigger
- rollback strategy
- how you'll prove nothing was lost (row counts and per-employee score checksums before and after)

Then build and test it on a local database seeded with realistic fake data. The data must span at least two periods, including a re-assessed skill.

### P2: versioned scoring config (BE-ARC-06)
- Historical scores must keep the config version they were computed with.
- Add a test that edits weights and asserts a locked period's results don't change.

### Anything on the decisions list in §6
Stop and ask.

---

## 6. Decisions I must make (ask me; don't assume)

1. **Tenancy (BE-ARC-02):** single-tenant deployment, or multi-tenant with `organization_id` and Postgres RLS?
2. **Gap-report download (BE-SEC-03):** delete it, or re-implement it in Node with exceljs?
3. **Production registry** to replace the personal Docker Hub namespace: ECR, GHCR or Bitbucket.
4. **Which CI system to keep:** Bitbucket Pipelines or GitHub Actions.
5. **AI:** keep OpenAI behind a pseudonymizing gateway, or disable it by default until a DPA is in place?
6. **Senior self-assessments:** who approves self-assessments for TOP_MANAGEMENT and ADMIN (BE-SEC-18)?
7. **Midnight theme:** keep it as a "high-contrast dark" preset, or drop it (UI-1)?
8. **Retention periods** per data type (BE-SEC-27).
9. **Dashboards:**
   - Minimum group size for aggregates (default 3).
   - Whether to collect `joined_at` and grade history now. You may need an HR data import, and backfilled history is marked "since unknown".

If a phase needs one of these and I haven't answered, do the parts that don't depend on it. Mark the rest `needs-decision`.

---

## 7. Definition of done for the whole programme

Every finding in the audit is `fixed`, `not-reproduced` (with a reason), or `deferred` with my written approval. On top of that:

**Security**
- No Critical or High findings remain.
- `npm audit --omit=dev` shows no high or critical issues in either repo.
- gitleaks is clean.
- Trivy shows no high or critical issues on both images.

**Tests and coverage**
- An RBAC matrix test covers every route × role.
- An appraisal-history test proves past periods are immutable.
- Backend coverage is at least 75% and frontend coverage at least 85%, with thresholds enforced in CI.

**UI quality**
- axe reports 0 serious or critical issues on every route in light and dark mode.
- Initial JS is under 200 kB gzipped.
- LCP on the dashboard is under 2.5 s.

**UI functionality**
- Light, dark and system themes work, with Prism tokens everywhere.
- The collapsible sidebar and its mobile drawer work.
- The top progress bar works.
- Charts use the single validated palette.
- Role dashboards are delivered.

**Docs**
- Both `REMEDIATION_LOG.md` files are complete.
- `STANDARDS.md` is updated.
- `UI_UX_DESIGN_STANDARDS.md` exists.
- The 13 ADRs from audit §6A.8 are written under `docs/adr/`, marked accepted or proposed.

---

## 8. Start now

1. Read `erp-audit-2026-10-06.md` end to end.
2. Run the baseline checks in both repos (type-check, lint, tests with coverage, FE build), and record the numbers in both `REMEDIATION_LOG.md` files. Seed each log with every finding ID from the audit, set to `todo`.
3. Post a one-screen summary: the baseline numbers, any finding you already suspect is fixed, and your plan for **P0**.
4. Begin P0.
