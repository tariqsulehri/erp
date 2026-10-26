# ERP Platform — Audit Remediation Plan

Audit date: 2026-10-26 · Baseline: commit f58a6b1 plus the uncommitted working tree · Previous audit: 2026-10-17 (57 / F)

Perspectives: Financial Analyst, Financial Solution Architect, Deployment Head, End User.

## Progress (updated 2026-10-26)

All five remediation phases are implemented in the working tree but not yet committed. Verified with:
- 46 backend tests, including database tests on a database built from scratch;
- type-check of both apps;
- frontend lint with 0 warnings;
- a production build;
- a browser pass over 30 screens.

| Phase | Fixed |
|---|---|
| 1 Ledger correctness | DATA-001, DATA-002, DATA-003, DATA-004, DATA-005, DATA-006, DATA-007, DATA-013, DATA-014, DATA-016 |
| 2 Access and audit trail | AUTH-001, AUTH-002, AUTH-004, DATA-008, DATA-009, DATA-011 (partly), DATA-015, ARCH-002 |
| 3 Deployment | OPS-001 (plus a fresh-install path), OPS-002, OPS-003, OPS-004, OPS-005, OPS-006, OPS-007, OPS-008, OPS-009, SEC-003, SEC-006, SEC-011, SEC-012 (HTTPS option), SEC-015, PERF-001, ARCH-003, ARCH-006, DEP-002, DEP-004, TEST-002 |
| 4 Reports | DATA-017, DATA-018 (Cash Book, Bank Book, Customer Ledger, Supplier Ledger, Aging, Day Book, Sales Tax, Stock Ledger), DATA-019, UIUX-014, UIUX-015, UIUX-016, UIUX-017, UIUX-018, UIUX-019 |
| 5 User experience | UIUX-001 to UIUX-012, QUAL-001 (lint is now a CI gate) |
| Tests and demo data | 347 backend tests across 21 files, covering every module and running against the working database. Each test file uses its own throw-away company, which is removed afterwards. `npm run seed:demo` loads realistic sample documents through the real services. Bugs found and fixed: cheque book creation (LPAD), posting to inactive or non-posting accounts in vouchers, missing voucher returned 500 instead of 404, uneven fiscal periods, the change-password lockout counting non-password errors, `?is_active=false` read as true, category move and cross-company deletes, customer/supplier codes after 9999, linked-account range checks, cloned accounts copying the opening balance, inactive default Branch, and stock-adjustment rounding drift between Inventory and stock value |

Still open:
- **SEC-001:** rotate and purge the secrets in git history. Owner action.
- **AUTH-005:** a branch dimension on vouchers for branch-level P&L.
- **DATA-010:** link returns to their original invoice.
- **Code quality and tests:** ARCH-004, ARCH-005, QUAL-005, QUAL-006 (code-prefix account classification in the Balance Sheet and P&L), QUAL-007, TEST-001 (more test coverage), PERF-002, PERF-003, PERF-004.
- **Dependencies:** DEP-003 (test and lint package upgrades), plus the remaining dependency issues that need major upgrades (zod v4, Next.js 16).
- **Data clean-up:** an opening-stock Journal Voucher, because the dev data has 4.39M of opening stock with no ledger entry.

## 1. Executive Summary

- **Overall score:** 56 / 100 — **Grade F** (any open Critical caps the grade at C). Change since last audit: **-1** (57 → 56).
- **Decision:** NO-GO for production financial use.
- **Findings:** 76 — 8 Critical, 22 High, 31 Medium, 15 Low.
- **By wave:** Wave 0: 8, Wave 1: 26, Wave 2: 22, Wave 3: 20.
- **Estimated remediation effort:** 206.5 hours (Quick Win 0.5 h, Moderate 4 h, Major 16 h).
- **Resolved since last audit:** SEC-002, DEP-001, SEC-004, SEC-005, QUAL-002, QUAL-003. **Still open:** SEC-001, SEC-003, ARCH-001, ARCH-002, ARCH-003, PERF-001, PERF-002, SEC-006, UIUX-001, UIUX-002, UIUX-003, UIUX-004, TEST-001, DEP-002, QUAL-001, ARCH-004, TEST-002.

Since the 17 Oct audit the team closed the biggest exposure (the API now requires sign-in, company access is verified, mock logins are gone, containers run as non-root, CVE versions are patched). Stock quantities and branch/warehouse access are now well protected. However, the general ledger and financial statements cannot yet be trusted: posted vouchers can be voided without reversal, the Balance Sheet stops balancing after the first year-end, and three costing paths make GL inventory drift from stock value. Operations cannot apply migrations or restore from backup. Recommended path: a 2-week stabilisation sprint (Wave 0 + core Wave 1), then a parallel run against the current books for one month-end close before go-live.

**Top risks**

- **SEC-001** (Critical) — Real production database password and the shared JWT/NextAuth secret remain recoverable from git history (commit f58a6b1 added deployment/.env.backend and .env.frontend with live values). `git show f58a6b1:deployment/.env.backend`
- **DATA-001** (Critical) — Any posted voucher can be voided in place: void() checks only that the status is not already Voided. `backend/src/modules/vouchers/voucher.service.ts:509`
- **DATA-002** (Critical) — Closing a fiscal year only updates status and lock fields; no closing entry moves Income/Expense balances to Retained Earnings. `backend/src/modules/fiscal-years/fiscal-year.service.ts:301`
- **DATA-003** (Critical) — Purchase posting debits Inventory at gross amount (before discount) while the stock movement is valued net of line discount, so every discounted purchase leaves GL Inventory permanently higher than stock value. `backend/src/modules/purchases/purchase-post.service.ts:199`
- **DATA-004** (Critical) — Sale cost of goods sold is frozen at the weighted-average cost when the draft was saved, not at posting. `backend/src/modules/sales/sale-post.service.ts:388`
- **DATA-005** (Critical) — Every stock-adjustment post upserts three hardcoded GL accounts (ON CONFLICT DO UPDATE SET name, account_type, is_deleted=false) and overwrites default_inventory_account_id and the adjustment accounts in posting settings. `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:587`

**Dimension scores**

| Dimension | Weight | Score |
|---|---:|---:|
| Architecture | 10 | 79 |
| Security | 15 | 62 |
| Auth | 15 | 60 |
| Data Integrity | 15 | 0 |
| Quality | 10 | 74 |
| Testing | 10 | 86 |
| Dependencies | 5 | 94 |
| Performance | 8 | 87 |
| Operations | 7 | 30 |
| UI/UX | 5 | 9 |

### Perspective Verdicts

- **Financial Analyst — Not Ready.** Calculation core is sound — posted-only filtering, Decimal sums, opening/period/closing Trial Balance, imbalance warnings. But opening balances vanish mid-year (DATA-014), year close posts no retained-earnings entry (DATA-002), opening balances are freely editable (DATA-015), and the COA balance disagrees with reports (DATA-016). Required books (Cash/Bank Book, Customer/Supplier Ledger, aging, tax) are missing and nothing can be printed or exported.
- **Financial Solution Architect — Not Ready.** Good architecture choices: one locked transaction per document post, DB-enforced single stock holder, Decimal with HALF_UP rounding, snapshot of account code/name on GL lines. Integrity gaps: void-without-reversal (DATA-001), purchase discount and COGS timing break GL↔stock reconciliation (DATA-003/004), adjustment posting rewrites the chart of accounts (DATA-005), no Dr=Cr assertion on document posting (DATA-006), no role-based permissions or maker-checker (AUTH-001/002).
- **Deployment Head — Not Ready.** The production image cannot run migrations (OPS-001); 500 errors are not logged (OPS-002); no backup, restore or rollback (OPS-006); HTTP only (SEC-012); live secrets remain in git history (SEC-001); and the auth system, migrations, tests and CI are uncommitted (QUAL-004). Positives: startup env validation, health and DB-readiness endpoints, a safe admin seed, non-root containers.
- **End User (Accountant / Storekeeper) — Partially Ready.** Master-data and stock screens (Branches, Areas, Products, Transfers) look calm and professional. The daily document screens (Purchase, Sale, Journal) feel like a different, denser app, can clip fields at 1280px, and have no keyboard line entry or shortcuts. Approve posts without confirmation, and some errors look like empty lists.

### Module Readiness

| Module | Status | Why |
|---|---|---|
| Chart of Accounts | Amber | 10-digit codes enforced; balance sign bug (DATA-016); opening balances uncontrolled (DATA-015) |
| Vouchers & Approvals | Red | Void without reversal (DATA-001); float math (DATA-007); self-approval (AUTH-002); no role checks (AUTH-001) |
| Purchases & Returns | Red | Discount posted at gross (DATA-003); returns not linked to invoice (DATA-010) |
| Sales & Returns | Red | COGS frozen at draft (DATA-004); no Dr=Cr assertion (DATA-006) |
| Inventory (Transfers, Adjustments) | Amber | Quantities trustworthy; adjustments rewrite COA (DATA-005); value floored at zero |
| Fiscal Year & Closing | Red | No closing entry (DATA-002); weak TB pre-check (DATA-013); period match ambiguity (DATA-009) |
| Financial Reports | Red | Opening balance bug (DATA-014); required books missing (DATA-018); no export (UIUX-014) |
| Bank & Cheques | Amber | Cheque books fine; reconciliation tab is sample data (DATA-017) |
| Users & Access | Amber | Strong auth and scoping; no permission matrix (AUTH-001); cross-company user edits (AUTH-004) |
| Deployment & Operations | Red | No migrations in prod image, no logging, no backups (OPS-001/002/006) |

### Financial Reports Coverage

| Report | Status | Notes |
|---|---|---|
| Trial Balance (Opening / Period / Closing) | Present | Opening balance dropped when dated after Date From (DATA-014) |
| Ledger Report (single account) | Present | Picker limited to 200 accounts (UIUX-015); no drill-down (UIUX-017) |
| Profit And Loss | Present | No COGS / gross profit line; classifies by code prefix (QUAL-006) |
| Balance Sheet | Present | Breaks from year 2 — no retained earnings (DATA-002) |
| Purchase / Sales / Return Summaries | Present | Totals for current page only (UIUX-016) |
| Stock Summary | Partial | Warehouses only, current snapshot, no GL tie-out (DATA-019) |
| Dashboard KPIs | Partial | Counts only, no money KPIs (UIUX-018) |
| Bank Reconciliation | Fake | Hardcoded sample data (DATA-017) |
| Cash Book / Bank Book | Missing | Required by posting rules (DATA-018) |
| Customer Ledger / Supplier Ledger | Missing | Required by posting rules (DATA-018) |
| AR / AP Aging | Missing | Credit control and payables planning (DATA-018) |
| Day Book / Journal Register | Missing | Auditor requirement (DATA-018) |
| Stock Ledger & Valuation As Of Date | Missing | Needed for inventory audit (DATA-018 / DATA-019) |
| Sales Tax / VAT Report | Missing | Statutory filing (DATA-018) |
| Cash Flow Statement | Missing | Management reporting (DATA-018) |
| Prior-Period Comparatives | Missing | Management reporting (DATA-018) |
| Item-wise Sales & Gross Margin | Missing | Pricing and margin control (DATA-018) |
| Print / PDF / Excel / CSV export | Missing | No report can leave the system (UIUX-014) |

### Go-Live Readiness Checklist

| Item | Status | Ref |
|---|---|---|
| Secrets rotated and purged from git history | Missing | SEC-001 |
| Role-based permissions and maker-checker | Missing | AUTH-001, AUTH-002 |
| Posted-entry reversal instead of void | Missing | DATA-001 |
| Year-end closing to Retained Earnings | Missing | DATA-002 |
| GL Inventory = Stock Value reconciliation | Missing | DATA-003, DATA-004, DATA-019 |
| Opening balance import / balanced OB voucher | Partial | DATA-014, DATA-015 — fields exist, no bulk import (COA, parties, stock) |
| Required books & statutory reports | Partial | DATA-018 |
| Report print / export | Missing | UIUX-014 |
| Database migrations in deployment | Missing | OPS-001 |
| Backups, tested restore, rollback | Missing | OPS-006 |
| Error logging, monitoring, alerting | Missing | OPS-002, OPS-003 |
| TLS / HTTPS reverse proxy | Partial | SEC-012 |
| Environment separation (dev / staging / prod) | Missing | OPS-004, OPS-005 |
| CI gate (type-check, lint, tests, migrate diff) | Partial | TEST-002, QUAL-001 |
| Automated tests on posting, closing, reports | Partial | TEST-001 |
| Code committed and reviewed | Missing | QUAL-004 |
| Performance / load test (month-end volume) | Missing | PERF-001, PERF-003 |
| User guide & training material | Missing | OPS-009 |
| Parallel run vs current books (one month-end) | Missing | Recommended before cut-over |

### Recommended Go-Live Path

1. **Week 1 — Containment:** rotate and purge secrets (SEC-001); commit the working tree in reviewed PRs (QUAL-004); fix DATA-001, DATA-005, DATA-014; make migrations runnable in deployment (OPS-001).
2. **Week 2 — Ledger integrity:** DATA-002 (closing to Retained Earnings), DATA-003/004 (GL↔stock valuation), DATA-006/007 (Dr=Cr assertions), AUTH-001/002 (permissions, maker-checker), OPS-002/006 (logging, backups).
3. **Weeks 3–4 — Reporting & UX:** Customer/Supplier Ledgers, AR/AP Aging, Cash/Bank Book, Day Book, Tax report (DATA-018); print/export (UIUX-014); GL↔stock reconciliation report (DATA-019); document-screen consolidation and keyboard entry (UIUX-005/006).
4. **Before cut-over:** integration tests on posting/closing (TEST-001), HTTPS (SEC-012), opening-balance import, user guide, and a one-month parallel run reconciled against the current books.

## 2. Scope & Limitations

**Audited**

- backend/src/app.ts, middleware, http, config
- backend/src/routes (all)
- backend/src/modules: auth, users, vouchers, fiscal-years, reports, dashboard, accounts, purchases, purchase-returns, sales, sale-returns, stock-adjustments, stock-transfers, inventory, bank-accounts, bank-cheques
- backend/prisma/schema.prisma and migrations
- frontend/src/app/design-tokens.css, globals.css, components/ui, components/shell, components/reports
- Dockerfiles, docker-compose.yml, deployment/, .github/workflows/ci.yml, package manifests and lockfiles
- git history for committed secrets

**Sampled**

- frontend/src/components: vouchers, purchases, sales, returns, approvals, inventory, bank, customers, suppliers, stock-transfers, settings
- frontend/src/app/(dashboard) pages

**Skipped**

- .impeccable/ — design review screenshots
- audit/ kit and historical results — tooling
- Runtime behaviour — no servers started; findings are from code reading

**CommandsRun**

- frontend: local eslint (read-only) — 22 warnings, 14 react-hooks/exhaustive-deps
- git status / git show f58a6b1 (secret values masked)
- No type-check, tests or npm audit run (audit is read-only by default); CVE status taken from lockfile versions — unverified against advisories

Findings were confirmed by reading the code; runtime behaviour was not exercised. Dependency CVE status is based on lockfile versions and is unverified against advisories.

## 3. Project Rules Checked

- **PR-01** — Use simple business words and Title Case labels that non-native English speakers understand. _(PROJECT_RULES.md / CLAUDE.md)_
- **PR-02** — Date format, time zone, currency, decimals and separators come from general_settings; never hardcode currency text or formats. _(PROJECT_RULES.md (Shared Settings))_
- **PR-03** — inventory_stock_movements is the stock history source of truth; inventory_stock_balances is only a snapshot. _(CLAUDE.md)_
- **PR-04** — Do not hardcode database users, hosts, company IDs, currency symbols, fiscal years or account ranges in feature code. _(CLAUDE.md)_
- **PR-05** — Draft documents have no ledger or stock effect; posted documents are immutable and corrected only by reversal, return or adjustment. _(CLAUDE.md / PROJECT_RULES.md)_
- **PR-06** — Posting follows ACCOUNTING_POSTING_RULES.md; GL inventory and stock valuation must agree. _(ACCOUNTING_POSTING_RULES.md)_
- **PR-07** — vouchers.total_debit and total_credit store the sum of voucher lines and must always be equal. _(PROJECT_RULES.md:69)_
- **PR-08** — Cash Book, Bank Book, Customer Ledger and Supplier Ledger are required books. _(ACCOUNTING_POSTING_RULES.md:22)_
- **PR-09** — Schema changes and seeds belong in backend Prisma migrations. _(CLAUDE.md)_
- **PR-10** — Use backend .env values for configuration; no environment-specific values in code. _(CLAUDE.md)_
- **PR-11** — Users work in one Branch or one Warehouse; Admin and Top Management see all branches. _(CLAUDE.md / PROJECT_RULES.md)_
- **PR-12** — Access must be enforced in the backend with resolveAccessScope. _(CLAUDE.md)_
- **PR-13** — Every screen follows DESIGN.md (Calm Ledger) and the modular page-as-orchestrator pattern; no large single-file screens. _(CLAUDE.md / AGENTS.md)_
- **PR-14** — Required fields show *; amounts right-aligned; voucher forms keep actions on top with consistent line-item and summary areas. _(CLAUDE.md (UI Rules))_
- **PR-15** — Show features only when the backend and database save and validate them; no user action fails silently. _(PROJECT_RULES.md:66)_

## 4. Strengths

- Every API route now requires sign-in; tokens are re-checked against the database each request, and client-supplied company IDs are verified (403 otherwise) — `backend/src/app.ts:30, backend/src/http/company-context.ts:29, backend/src/modules/auth/auth.service.ts:92-107`
- Salted scrypt password hashing with constant-time compare and timing-safe unknown-user handling — `backend/src/modules/auth/password.ts:21-34`
- Branch / Warehouse scoping enforced in the backend on lists, details and posting — `backend/src/modules/inventory/stock-holder-access.ts:21-68`
- Single stock holder enforced in the database (CHECK + NULLS NOT DISTINCT unique) — `backend/prisma/migrations/20261020110000_add_branch_stock/migration.sql:22-30`
- Each document post is one locked transaction (FOR UPDATE + Draft check) — no double posting; negative stock checked against locked balance — `backend/src/modules/sales/sale-post.service.ts:156-175, :365-385`
- decimal.js with explicit HALF_UP rounding for money (2dp) and quantity (4dp) in document posting; reports sum in SQL/Decimal on Posted vouchers only — `backend/src/modules/sales/sale-post.service.ts:67-73, backend/src/modules/reports/trial-balance-report.service.ts:121`
- Complete Calm Ledger token system with light/dark parity, global focus ring, reduced-motion support, accessible SearchableSelect and focus-trapping ConfirmDialog — `frontend/src/app/design-tokens.css, frontend/src/components/ui/SearchableSelect.tsx:74-120`
- Startup env validation, liveness + database readiness endpoints, safe env-driven admin seed, non-root containers — `backend/src/config/env.ts:6-24, backend/src/routes/health.routes.ts:6-14, backend/prisma/seed-admin.ts:12-34`

## 5. Wave 0 — Emergency Containment

### [DATA-005] Every stock-adjustment post upserts three hardcoded GL accounts (ON CONFLICT DO UPDATE SET name, account_type, is_deleted=false) and overwrites default_inventory_account_id and the adjustment accounts in posting settings (Critical | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:587` (+ `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:12-37`, `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:626`)
- **Finding**: Every stock-adjustment post upserts three hardcoded GL accounts (ON CONFLICT DO UPDATE SET name, account_type, is_deleted=false) and overwrites default_inventory_account_id and the adjustment accounts in posting settings. User-configured accounts are reset on every post; renamed or deleted accounts are silently restored. Hardcoded account codes break project rules.
- **Evidence**:
  ```
  code: '0101300301', ...
  ON CONFLICT (company_id, code) DO UPDATE SET name = EXCLUDED.name, ... is_deleted = false
  ON CONFLICT (company_id) DO UPDATE SET default_inventory_account_id = EXCLUDED...
  ```
- **Breaks Rule**: PR-04
- **Blocked By**: none
- **Fix**: Remove the upserts from the posting path. Seed default adjustment accounts once (seed/onboarding) and read them from posting-account settings; fail with a clear message if not configured.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In stock-adjustment.service.ts delete the ensure-accounts/upsert logic called during posting. Read inventory, adjustment-gain and adjustment-loss account ids from posting account settings (as sale-support.service.ts does) and throw a business error 'Stock adjustment accounts are not set in Posting Account Settings' when missing. Move default account creation into the seed.

### [DATA-014] Account opening balance is dropped entirely from Trial Balance and Ledger when its opening-balance date falls after the report Date From (Critical | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/reports/trial-balance-report.service.ts:136` (+ `backend/src/modules/reports/ledger-report.service.ts:61`)
- **Finding**: Account opening balance is dropped entirely from Trial Balance and Ledger when its opening-balance date falls after the report Date From. Default Date From is 1 January, so a mid-year go-live date makes opening balances vanish from both the opening and closing columns.
- **Evidence**:
  ```
  const includeOpening = !account.openingBalanceDate || account.openingBalanceDate <= dateFrom;
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Include the opening balance when its date ≤ Date To: in the Opening column when before Date From, otherwise as a period movement line dated on the opening-balance date.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In trial-balance-report.service.ts and ledger-report.service.ts change the opening-balance inclusion rule: if openingBalanceDate <= dateFrom (or null) add to opening; else if openingBalanceDate <= dateTo add it to period debit/credit (by normal balance side) and, in the ledger, as a dated 'Opening Balance' row. Add tests for both cases.

### [SEC-001] Real production database password and the shared JWT/NextAuth secret remain recoverable from git history (commit f58a6b1 added deployment/.env.backend and .env.frontend with live values) (Critical | Security | Moderate | Confirmed)
- **Location**: `git show f58a6b1:deployment/.env.backend` (+ `git show f58a6b1:deployment/.env.frontend`, `REMEDIATION_PLAN.md:34-36`, `REMEDIATION_PLAN.md:92`)
- **Finding**: Real production database password and the shared JWT/NextAuth secret remain recoverable from git history (commit f58a6b1 added deployment/.env.backend and .env.frontend with live values). The working tree now uses placeholders and the files are git-ignored, but history was never purged. The untracked root REMEDIATION_PLAN.md also repeats the old DB password and the 64-char secret in plain text. Frontend and backend share the same secret, and the DB host is a public IP.
- **Evidence**:
  ```
  DATABASE_URL="postgresql://appuser:****@161.97.***.***:5432/erp_financial_db"
  JWT_SECRET=1Wq****   NEXTAUTH_SECRET=1Wq**** (same value)
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Rotate the DB password and both secrets now (use different values for JWT and NextAuth). Purge the files from history with git filter-repo before any push, redact the root REMEDIATION_PLAN.md, and restrict PostgreSQL port 5432 on the server to the application host only.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Redact every plaintext password and secret from REMEDIATION_PLAN.md (replace with ****). Do not print the values. Then list the exact git filter-repo command needed to remove deployment/.env.backend and deployment/.env.frontend from all history, but do not run it.

### [DATA-001] Any posted voucher can be voided in place: void() checks only that the status is not already Voided (Critical | Data Integrity | Moderate | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:509` (+ `backend/src/routes/vouchers.routes.ts:107`, `backend/src/modules/reports/trial-balance-report.service.ts:121`)
- **Finding**: Any posted voucher can be voided in place: void() checks only that the status is not already Voided. There is no voucher-type guard, no open-period/locked-year check, no role check and no reversal entry. Reports read only status='Posted', so voiding a sale/purchase/return/adjustment voucher silently removes it from the GL while the source document stays Posted and its stock movements remain. Closed-year figures can be rewritten. Sales, purchases and returns have no reversal flow at all.
- **Evidence**:
  ```
  if (voucher.status === 'Voided') throw businessError(...);
  const updated = await prisma.voucher.update({ where: { id }, data: { status: 'Voided', ... } });
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Allow Void only for Draft vouchers. For Posted vouchers add a Reverse action that posts a mirror voucher dated in an open period and links both. Block void/reverse of source-generated voucher types (SI, PI, SR, PR, SA, ST) from the voucher screen; those must be reversed from their source document.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In backend/src/modules/vouchers/voucher.service.ts change void() to reject any voucher whose status is not Draft. Add a reverse(id, reason, userId) method that, inside one prisma.$transaction, locks the voucher row, asserts it is Posted and is a manual voucher type, asserts the reversal date is in an open period using the shared posting-date helper, creates a new Posted voucher with debit and credit swapped on every line, and records reversed_by_voucher_id / reversal_of_voucher_id. Expose POST /vouchers/:id/reverse. Add tests.

### [DATA-003] Purchase posting debits Inventory at gross amount (before discount) while the stock movement is valued net of line discount, so every discounted purchase leaves GL Inventory permanently higher than stock value (Critical | Data Integrity | Moderate | Confirmed)
- **Location**: `backend/src/modules/purchases/purchase-post.service.ts:199` (+ `backend/src/modules/purchases/purchase-post.service.ts:249`, `backend/src/modules/purchases/purchase-post.service.ts:335`, `backend/src/modules/purchase-returns/purchase-return-post.service.ts:340`)
- **Finding**: Purchase posting debits Inventory at gross amount (before discount) while the stock movement is valued net of line discount, so every discounted purchase leaves GL Inventory permanently higher than stock value. Same pattern in purchase returns. Under IAS 2 trade discounts reduce inventory cost. The conflict originates in ACCOUNTING_POSTING_RULES.md.
- **Evidence**:
  ```
  const inventoryAmount = this.money(invoice.gross_amount);          // GL
  const lineCost = ...times(line.purchase_price).minus(line.discount_amount); // stock
  ```
- **Breaks Rule**: PR-06
- **Blocked By**: none
- **Fix**: Debit Inventory at the sum of net line costs (the same value written to stock movements). Treat freight/other charges consistently (capitalise into cost or expense, but the same way in both GL and stock). Update ACCOUNTING_POSTING_RULES.md.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In purchase-post.service.ts and purchase-return-post.service.ts compute the Inventory GL amount as the sum of the exact per-line costs written to inventory_stock_movements and remove the separate purchase-discount income line for line discounts. Update documents/ACCOUNTING_POSTING_RULES.md. Add a test asserting GL inventory debit equals sum of movement values for a discounted purchase.

### [DATA-004] Sale cost of goods sold is frozen at the weighted-average cost when the draft was saved, not at posting (Critical | Data Integrity | Moderate | Confirmed)
- **Location**: `backend/src/modules/sales/sale-post.service.ts:388` (+ `backend/src/modules/sales/sale-draft.service.ts:92`, `backend/src/modules/sales/sale-draft.service.ts:180`, `backend/src/modules/purchase-returns/purchase-return-post.service.ts:368`, `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:917`, `backend/src/modules/sale-returns/sale-return-draft.service.ts:181`)
- **Finding**: Sale cost of goods sold is frozen at the weighted-average cost when the draft was saved, not at posting. On posting, stock value is floored at zero (Decimal.max(0, ...)) while GL Inventory is credited with the full cost, so stock value and GL diverge. Header cost is rounded once over the total while lines are rounded individually (cent drift). Same zero floor in purchase returns and stock adjustments; sale returns are costed at current average, not original sale cost.
- **Evidence**:
  ```
  newValue = Decimal.max(0, oldValue.minus(lineCost))   // stock
  // GL credit Inventory = invoice.cost_amount (from draft time)
  ```
- **Breaks Rule**: PR-06
- **Blocked By**: none
- **Fix**: Compute each line's cost from the locked balance row at post time; set header cost and the GL COGS/Inventory amounts to the sum of line costs; replace the zero floor with an error; cost sale returns at the original sale line's cost when linked.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In sale-post.service.ts, inside the posting transaction after locking each balance row (sorted by item id), compute line cost = quantity × current average cost (Decimal, HALF_UP 2dp), update the sale line cost_amount, sum them for the header and use that sum for the COGS debit and Inventory credit. Replace Decimal.max(0, ...) with a thrown business error in sale, purchase-return and stock-adjustment posting. Add a test that interleaves a purchase between sale draft and post.

### [OPS-001] The production image cannot apply database migrations: the runner stage installs with --omit=dev (drops the prisma CLI and tsx) and starts node dist/server.js; deploy.sh refers to 'db push' and a pgvector step and never runs prisma migrate deploy (Critical | Operations | Moderate | Confirmed)
- **Location**: `backend/Dockerfile:30` (+ `backend/Dockerfile:45`, `deployment/deploy.sh:15-44`, `backend/package.json:17`)
- **Finding**: The production image cannot apply database migrations: the runner stage installs with --omit=dev (drops the prisma CLI and tsx) and starts node dist/server.js; deploy.sh refers to 'db push' and a pgvector step and never runs prisma migrate deploy. The 20 migrations — including the two new users/access and branch-stock migrations — and seed:admin cannot be run on the server.
- **Evidence**:
  ```
  RUN npm ci --omit=dev
  CMD ["node","dist/server.js"]
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add a one-off migrate service/job (image with prisma CLI) that runs `prisma migrate deploy` before the API starts, plus a compiled seed:admin step. Remove the pgvector/db push steps from deploy.sh.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a 'migrate' stage to backend/Dockerfile that keeps the prisma CLI and runs `npx prisma migrate deploy`. In deployment/docker-compose.yml add a migrate service that the backend depends_on with condition service_completed_successfully. Compile prisma/seed-admin.ts in the build and document `docker compose run --rm migrate node dist/prisma/seed-admin.js`. Remove db push/pgvector lines from deploy.sh.

### [DATA-002] Closing a fiscal year only updates status and lock fields; no closing entry moves Income/Expense balances to Retained Earnings (Critical | Data Integrity | Major | Confirmed)
- **Location**: `backend/src/modules/fiscal-years/fiscal-year.service.ts:301` (+ `backend/src/modules/reports/balance-sheet-report.service.ts:81`, `backend/src/modules/reports/balance-sheet-report.service.ts:134-150`)
- **Finding**: Closing a fiscal year only updates status and lock fields; no closing entry moves Income/Expense balances to Retained Earnings. The Balance Sheet computes profit only from the current fiscal-year start, so from the second year on Assets ≠ Liabilities + Equity by the total of all prior years' profit. Nothing in the codebase references retained earnings.
- **Evidence**:
  ```
  await tx.fiscalPeriod.updateMany({ ... data: { status: 'closed' } });
  await tx.fiscalYear.update({ ... data: { status: 'closed', closingCompletedAt: new Date() } });
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Add a Retained Earnings account to posting-account settings. On year close, post an immutable Closing voucher that zeroes every Income and Expense account into Retained Earnings. Until then, the Balance Sheet must show 'Retained Earnings (Prior Years)' = cumulative profit before the current fiscal-year start.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add retainedEarningsAccountId to posting account settings (Prisma migration + settings UI field). In fiscal-year.service.ts close(), inside the existing transaction, compute each Income and Expense account balance for the year in Decimal, post one Closing voucher (type CL) dated the year end that clears them into Retained Earnings, and store closing_voucher_id on the fiscal year. In balance-sheet-report.service.ts add prior-years retained earnings. Add an integration test: two years of activity, close year 1, Balance Sheet for year 2 has difference 0.

## 6. Wave 1 — Foundations: Access, Integrity, Reporting Correctness, Operations

### [DATA-006] Sales, purchases and returns post GL vouchers without asserting Σdebit = Σcredit or header total = Σlines; the header total is computed from document fields (High | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/sales/sale-post.service.ts:219-304` (+ `backend/src/modules/purchases/purchase-post.service.ts:206-279`, `backend/src/modules/sale-returns/sale-return-post.service.ts:206`, `backend/src/modules/purchase-returns/purchase-return-post.service.ts:219`)
- **Finding**: Sales, purchases and returns post GL vouchers without asserting Σdebit = Σcredit or header total = Σlines; the header total is computed from document fields. No database CHECK or trigger exists. A missing tax account with tax > 0 throws a plain Error (HTTP 500).
- **Evidence**:
  ```
  totalDebit: netAmount.plus(discountAmount).plus(costAmount)   // not summed from lines
  ```
- **Breaks Rule**: PR-07
- **Blocked By**: none
- **Fix**: Build lines first, sum them in Decimal, assert Dr = Cr and header = Σlines before insert; add a shared assertBalancedVoucher helper and a deferred constraint trigger on voucher_lines.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create backend/src/modules/vouchers/assert-balanced.ts exporting assertBalancedVoucher(lines) that sums debit and credit with decimal.js and throws businessError when unequal. Call it in every *-post.service.ts and voucher.service.ts before inserting, and set vouchers.total_debit/total_credit from the sums. Replace plain Error for missing accounts with businessError.

### [DATA-008] Manual voucher type 'PI' uses the same PI-YYYY-NNNN number format as purchase invoices (High | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:15` (+ `backend/src/modules/vouchers/voucher.service.ts:321-335`, `backend/src/modules/purchases/purchase-draft.service.ts:7`, `backend/src/modules/purchases/purchase-post.service.ts:228`)
- **Finding**: Manual voucher type 'PI' uses the same PI-YYYY-NNNN number format as purchase invoices. A manual PI takes max(posted PI)+1, which can equal an unposted draft purchase's number; posting that purchase then fails on uq_voucher_number.
- **Evidence**:
  ```
  manual voucher types include 'PI' -> PI-YYYY-NNNN
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Remove source-document types (PI, SI, SR, PR) from the manual voucher type list.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In voucher.service.ts remove 'PI' (and any other source-document prefixes) from the manual voucher types and from the frontend voucher type selector.

### [DATA-016] Chart of Accounts 'Current Balance' adds opening balance and movement without applying the account's debit/credit side, while reports negate credit-side opening balances (High | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/accounts/account-list.service.ts:574-576` (+ `backend/src/modules/reports/trial-balance-report.service.ts:17-19`)
- **Finding**: Chart of Accounts 'Current Balance' adds opening balance and movement without applying the account's debit/credit side, while reports negate credit-side opening balances. The COA screen disagrees with the Trial Balance for every liability, equity and income account with an opening balance.
- **Evidence**:
  ```
  openingBalance.plus(movementAmount)
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Reuse the reports' signedOpeningBalance helper; move it into a shared balance module used by both.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Move signedOpeningBalance from trial-balance-report.service.ts into backend/src/modules/accounts/account-balance.ts and use it in account-list.service.ts current-balance calculation. Add a test that COA balance equals Trial Balance closing for a credit-nature account.

### [DATA-017] The Bank Reconciliation tab runs on hardcoded sample data and a fixed month; 'Load Statement' only sets a message (High | Data Integrity | Quick Win | Confirmed)
- **Location**: `frontend/src/app/(dashboard)/bank/page.tsx:629-630` (+ `frontend/src/app/(dashboard)/bank/page.tsx:66`)
- **Finding**: The Bank Reconciliation tab runs on hardcoded sample data and a fixed month; 'Load Statement' only sets a message. Users would see fake reconciliation results as if real.
- **Evidence**:
  ```
  useState('2026-03'); useState(SAMPLE_RECON)
  ```
- **Breaks Rule**: PR-15
- **Blocked By**: none
- **Fix**: Hide the tab for go-live (Quick Win), then build it on a backend endpoint (statement import, match to bank-account ledger lines, reconciled flag).
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In frontend/src/app/(dashboard)/bank/page.tsx remove the Bank Reconciliation tab and the SAMPLE_RECON data. Leave a TODO referencing a backend reconciliation endpoint.

### [OPS-002] Server errors are never logged: the error handler returns 'Unexpected server error' for 500s without logging; there are no unhandledRejection/uncaughtException handlers; Prisma P2002/P2025 surface as 500 (High | Operations | Quick Win | Confirmed)
- **Location**: `backend/src/middleware/error-handler.ts:24-31` (+ `backend/src/server.ts:17-23`)
- **Finding**: Server errors are never logged: the error handler returns 'Unexpected server error' for 500s without logging; there are no unhandledRejection/uncaughtException handlers; Prisma P2002/P2025 surface as 500.
- **Evidence**:
  ```
  res.status(500).json({ message: 'Unexpected server error' })   // nothing logged
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add a structured logger (pino), log every 5xx with request id and user/company, add process handlers, map Prisma P2002 → 409 and P2025 → 404.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add pino and pino-http to the backend. Log errors in error-handler.ts with req.id, userId and companyId (no request bodies). Map Prisma P2002 to 409 and P2025 to 404. Register process.on('unhandledRejection') and ('uncaughtException') to log and exit.

### [OPS-004] The root docker-compose.yml (the one README tells people to use) cannot start in production mode: backend has NODE_ENV=production but no JWT_SECRET so startup exits; Postgres defaults to trust auth with an empty password published on 0.0.0.0:5432; the frontend receives unused DATABASE_URL/NEXT_PUBLIC_API_URL but not BACKEND_API_INTERNAL_URL, so it calls localhost:4000 inside the container (High | Operations | Quick Win | Confirmed)
- **Location**: `docker-compose.yml:9` (+ `docker-compose.yml:11`, `docker-compose.yml:26-30`, `docker-compose.yml:44-48`, `README.md:10-20`)
- **Finding**: The root docker-compose.yml (the one README tells people to use) cannot start in production mode: backend has NODE_ENV=production but no JWT_SECRET so startup exits; Postgres defaults to trust auth with an empty password published on 0.0.0.0:5432; the frontend receives unused DATABASE_URL/NEXT_PUBLIC_API_URL but not BACKEND_API_INTERNAL_URL, so it calls localhost:4000 inside the container.
- **Evidence**:
  ```
  POSTGRES_HOST_AUTH_METHOD: ${...:-trust}
  ports: "5432:5432"
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Make the root compose explicitly dev-only (password required, scram-sha-256, bind 127.0.0.1) and point production users to deployment/.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Rewrite root docker-compose.yml as a development stack: require POSTGRES_PASSWORD, remove the trust default, bind 127.0.0.1:5432, set NODE_ENV=development with JWT_SECRET from .env, give the frontend BACKEND_API_INTERNAL_URL=http://backend:4000/api/v1. Update README.

### [QUAL-004] Release hygiene risk: 130 uncommitted changes on the feature branch; the entire auth system, users module, two migrations, seed-admin, backend tests, CI workflow and frontend middleware are untracked (no review, no CI history, one disk failure from loss) (High | Quality | Quick Win | Confirmed)
- **Location**: `git status` (+ `.impeccable/review/`, `audit/`, `backend/src/middleware/auth.ts`, `backend/prisma/migrations/20261020100000_add_users_and_access/`)
- **Finding**: Release hygiene risk: 130 uncommitted changes on the feature branch; the entire auth system, users module, two migrations, seed-admin, backend tests, CI workflow and frontend middleware are untracked (no review, no CI history, one disk failure from loss). .impeccable/ review screenshots (≈229 PNG, 33 MB) are committed; audit/ (≈871 MB) is untracked and not ignored.
- **Evidence**:
  ```
  ?? backend/src/middleware/auth.ts
  ?? backend/prisma/migrations/20261020110000_add_branch_stock/
  ?? .github/
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Commit the work in reviewed PRs (auth+users, branch stock, CI/tests), remove .impeccable/review from git, and ignore audit/results and audit/branding.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Split the working tree into reviewable commits: (1) auth middleware, users and access + migration 20261020100000, (2) branch stock + migration 20261020110000, (3) tests and CI. Add .impeccable/review/ and audit/results/, audit/branding/ to .gitignore and git rm --cached them.

### [UIUX-015] Ledger Report account picker loads only the first 200 posting accounts and filters on the client (High | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/reports/LedgerReportPage.tsx:30-35`
- **Finding**: Ledger Report account picker loads only the first 200 posting accounts and filters on the client. Every customer and supplier has its own linked account, so most accounts become unselectable after a few hundred parties.
- **Evidence**:
  ```
  useAccountsList({ page: 1, limit: 200, is_posting: true })
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Use server-side search in the picker.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In LedgerReportPage.tsx replace the 200-row preload with a SearchableSelect that queries /accounts?search=...&is_posting=true&limit=20 as the user types (debounced).

### [AUTH-001] No role-based permission checks on financial actions (High | Auth | Moderate | Confirmed)
- **Location**: `backend/src/routes/vouchers.routes.ts:60-117` (+ `backend/src/routes/fiscal-years.routes.ts:88-140`, `backend/src/routes/settings.routes.ts:81`, `backend/src/routes/settings.routes.ts:102`, `backend/src/routes/settings.routes.ts:123`, `backend/src/http/access-context.ts:33`)
- **Finding**: No role-based permission checks on financial actions. The only backend role check is requireUserManager. Any signed-in user (including Viewer or Sales Staff) can approve, post and void vouchers, close/lock/unlock fiscal years and periods, and change company, general and posting-account settings, branches, warehouses, accounts and bank accounts.
- **Evidence**:
  ```
  export function requireUserManager(...)   // the only role gate in the backend
  ```
- **Breaks Rule**: PR-11
- **Blocked By**: none
- **Fix**: Add requirePermission(action) with a role×action matrix (e.g. post/approve: Accountant, Manager+; fiscal close/unlock and settings: Admin, Top Management) and apply it in every state-changing route. Hide matching UI actions from roles that lack them.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create backend/src/http/permissions.ts with a Permission enum (VoucherApprove, VoucherPost, VoucherReverse, FiscalClose, FiscalUnlock, SettingsManage, MasterDataManage, ReportsFinancialView) and a role→permissions map. Add requirePermission(p) middleware that reads the role from the auth context and returns 403. Apply it to vouchers, fiscal-years, settings, accounts, branches, warehouses, bank-accounts and reports routes. Add tests for 403 per role.

### [AUTH-004] Users are global across companies but managed per company (High | Auth | Moderate | Confirmed)
- **Location**: `backend/src/modules/users/user.service.ts:120-171` (+ `backend/src/modules/auth/auth.service.ts:111`)
- **Finding**: Users are global across companies but managed per company. Top Management in company A can change role, email, active status or reset the password of a user who also has access to company B. Promoting a user to top_management turns all their access rows in every company into ALL_BRANCHES.
- **Evidence**:
  ```
  update/resetPassword only check that the target user has access to the actor's company
  ```
- **Breaks Rule**: PR-11
- **Blocked By**: none
- **Fix**: Block identity changes (role, email, active, password) for users with access to companies the actor does not manage, or move role onto user_company_access. Prevent Top Management resetting other Top Management users.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In user.service.ts update() and resetPassword(), load all company access rows of the target user and throw 403 if any company is outside the actor's managed companies (Admin exempt). Prevent role escalation to top_management/admin by non-admins. Add tests.

### [DATA-015] Account opening balances can be edited at any time with no Dr = Cr check across accounts, no voucher and no lock after periods close (High | Data Integrity | Moderate | Confirmed)
- **Location**: `backend/src/modules/accounts/account-list.service.ts:375-392`
- **Finding**: Account opening balances can be edited at any time with no Dr = Cr check across accounts, no voucher and no lock after periods close. This directly changes historical reports.
- **Evidence**:
  ```
  data.openingBalance = new Prisma.Decimal(openingBalance)
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Capture opening balances through an Opening Balance voucher (or a locked opening-balance batch) that must balance; block edits once any period is closed.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add an Opening Balance entry screen and backend endpoint that posts a balanced 'OB' voucher dated the go-live date. Make account.openingBalance read-only once any period is closed and require total opening debits = credits.

### [ARCH-002] Document-number sequencing is fixed for sales, purchases, returns and transfers, but manual vouchers still have no lock and sort numbers as text, and stock adjustments lock only the last row (the first number of a year races) (High | Architecture | Moderate | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:321-335` (+ `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:847-860`, `backend/src/modules/sales/sale-draft.service.ts:26-29`)
- **Finding**: Document-number sequencing is fixed for sales, purchases, returns and transfers, but manual vouchers still have no lock and sort numbers as text, and stock adjustments lock only the last row (the first number of a year races). Every ORDER BY *_number DESC with 4-digit padding breaks after 9999: SI-2026-9999 sorts above SI-2026-10000, so 10000 is reissued and later inserts fail the unique constraint.
- **Evidence**:
  ```
  ORDER BY voucher_number DESC LIMIT 1   -- text sort, no lock
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Use a document_sequences table (company, type, year → next_number) incremented with UPDATE ... RETURNING inside the posting transaction, for every document type.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create a document_sequences table and a nextDocumentNumber(tx, companyId, type, year) helper using INSERT ... ON CONFLICT DO UPDATE SET next_number = next_number + 1 RETURNING next_number. Replace every MAX/ORDER BY number lookup in vouchers, sales, purchases, returns, transfers and adjustments.

### [UIUX-014] No print, PDF, Excel or CSV export on any financial report (High | UI/UX | Moderate | Confirmed)
- **Location**: `frontend/src/components/reports/`
- **Finding**: No print, PDF, Excel or CSV export on any financial report. Printing exists only for purchase and sales vouchers. Accountants cannot file, send or audit a Trial Balance, Ledger, P&L or Balance Sheet.
- **Evidence**:
  ```
  no print/export code in components/reports
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add a shared report print layout (company header, period, print date, user, page numbers) and CSV/Excel export for every report.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create frontend/src/components/reports/ReportPrintLayout.tsx with company name, report title, period, generated-by and page footer, and a useReportExport hook producing CSV (and XLSX via exceljs). Add Print and Export buttons to the Trial Balance, Ledger, P&L, Balance Sheet and summary reports.

### [AUTH-002] No maker-checker on voucher approval: approve() checks only approvalStatus === 'Pending' and never compares the approver with the creator or requester, so a user can approve their own voucher (High | Auth | Quick Win | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:528-585`
- **Finding**: No maker-checker on voucher approval: approve() checks only approvalStatus === 'Pending' and never compares the approver with the creator or requester, so a user can approve their own voucher.
- **Evidence**:
  ```
  if (voucher.approvalStatus !== 'Pending') throw businessError(...);
  ```
- **Breaks Rule**: none
- **Blocked By**: AUTH-001
- **Fix**: Reject approval when userId equals createdBy or approvalRequestedBy; require the VoucherApprove permission.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In voucher.service.ts approve() and reject(), throw businessError('You cannot approve a voucher you created or submitted.') when userId equals voucher.createdBy or voucher.approvalRequestedBy. Add a test.

### [DATA-007] Manual vouchers sum amounts with JavaScript floats and accept any precision (z.number()); balance is checked with a 0.001 tolerance, so 0.005 differences pass and un-rounded amounts are stored (High | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:166-197` (+ `backend/src/modules/vouchers/voucher.service.ts:489-494`, `backend/src/modules/vouchers/voucher.schema.ts:13-14`)
- **Finding**: Manual vouchers sum amounts with JavaScript floats and accept any precision (z.number()); balance is checked with a 0.001 tolerance, so 0.005 differences pass and un-rounded amounts are stored.
- **Evidence**:
  ```
  totalDebit += line.dr_amount; ...
  Math.abs(totalDebit - totalCredit) > 0.001
  ```
- **Breaks Rule**: PR-07
- **Blocked By**: DATA-006
- **Fix**: Validate amounts to 2 decimal places in the schema, sum with Decimal and require exact equality (reuse assertBalancedVoucher).
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In voucher.schema.ts validate dr_amount/cr_amount as non-negative with at most 2 decimal places. In voucher.service.ts replace float sums with decimal.js and call assertBalancedVoucher.

### [OPS-006] No backups, restore runbook or rollback: images default to :latest, deploy.sh runs `compose down` then `up -d` (downtime), takes no pg_dump before deploying, and there is no backup/restore document anywhere (High | Operations | Moderate | Confirmed)
- **Location**: `deployment/deploy.sh:8` (+ `deployment/deploy.sh:41-44`, `deployment/docker-compose.yml:5`, `deployment/docker-compose.yml:35`)
- **Finding**: No backups, restore runbook or rollback: images default to :latest, deploy.sh runs `compose down` then `up -d` (downtime), takes no pg_dump before deploying, and there is no backup/restore document anywhere.
- **Evidence**:
  ```
  image: ...:${APP_TAG:-latest}
  docker compose down && docker compose up -d
  ```
- **Breaks Rule**: none
- **Blocked By**: OPS-001
- **Fix**: Use immutable version tags, run pg_dump before every migration, schedule daily encrypted off-server backups with retention, write and rehearse a restore and rollback runbook.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Update deploy.sh: require APP_TAG (no latest), run pg_dump -Fc to a dated file before migrate, then `docker compose up -d` without down. Add deployment/BACKUP_AND_RESTORE.md with a daily cron backup, retention, off-site copy and tested restore steps, plus rollback to the previous tag.

### [AUTH-005] Financial reports (Trial Balance, Ledger, P&L, Balance Sheet) use only resolveCompanyId, not resolveAccessScope, and vouchers have no branch_id (High | Auth | Major | Confirmed)
- **Location**: `backend/src/routes/reports.routes.ts:16` (+ `backend/src/routes/reports.routes.ts:27`, `backend/src/routes/reports.routes.ts:38`, `backend/src/routes/reports.routes.ts:49`, `backend/prisma/schema.prisma:195-231`)
- **Finding**: Financial reports (Trial Balance, Ledger, P&L, Balance Sheet) use only resolveCompanyId, not resolveAccessScope, and vouchers have no branch_id. Branch and Warehouse users see company-wide financial statements, and branch-level P&L is impossible.
- **Evidence**:
  ```
  const companyId = resolveCompanyId(req);   // no access scope
  ```
- **Breaks Rule**: PR-12
- **Blocked By**: AUTH-001
- **Fix**: Gate financial reports behind a ReportsFinancialView permission now. Later, add branch_id to vouchers (set from the source document holder) and a Branch filter on all financial reports.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Apply requirePermission(ReportsFinancialView) to all routes in reports.routes.ts. Then add nullable branch_id to vouchers via migration, populate it in sale/purchase/return/adjustment posting from the document's branch, and add an optional branchId filter to the trial balance, ledger, P&L and balance sheet services.

### [DATA-018] Required ledgers and statutory reports are missing (High | Data Integrity | Major | Confirmed)
- **Location**: `backend/src/modules/reports/` (+ `documents/ACCOUNTING_POSTING_RULES.md:22`, `frontend/src/components/reports/`)
- **Finding**: Required ledgers and statutory reports are missing. ACCOUNTING_POSTING_RULES.md names Cash Book, Bank Book, Customer Ledger and Supplier Ledger as required; none exist. Also missing: AR/AP aging, Day Book/Journal register, Stock Ledger and stock value as of a date, Sales Tax/VAT report, Cash Flow statement, prior-period comparatives, item-wise sales/margin.
- **Evidence**:
  ```
  reports present: Ledger, Trial Balance, P&L, Balance Sheet, 4 document summaries, Stock Summary
  ```
- **Breaks Rule**: PR-08
- **Blocked By**: DATA-014, DATA-002
- **Fix**: Build in priority order: Customer/Supplier Ledger + AR/AP Aging, Cash Book/Bank Book, Day Book, Sales Tax report, Stock Ledger with as-of valuation, then Cash Flow and comparatives.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add backend report services and routes for Customer Ledger and Supplier Ledger (reuse ledger-report on the party's linked account), AR Aging and AP Aging (buckets 0-30/31-60/61-90/90+ from posted invoices minus receipts/payments), Cash Book and Bank Book (ledger on cash/bank accounts from settings), and Day Book (all posted vouchers in a date range). Add matching pages under frontend reports.

### [DATA-009] The posting-period check joins on fp.end_date + posting_cutoff_days >= date and takes LIMIT 1 with no ORDER BY, so a date in a closed period can match the previous open period's cutoff window (or the reverse) (Medium | Data Integrity | Quick Win | Likely)
- **Location**: `backend/src/modules/fiscal-years/posting-date.service.ts:16-24` (+ `backend/src/modules/sales/sale-post.service.ts:103-107`)
- **Finding**: The posting-period check joins on fp.end_date + posting_cutoff_days >= date and takes LIMIT 1 with no ORDER BY, so a date in a closed period can match the previous open period's cutoff window (or the reverse). The query is duplicated into every post service.
- **Evidence**:
  ```
  ... AND fp.end_date + posting_cutoff_days >= $date LIMIT 1
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Match the period that contains the date; apply the cutoff only as an extra allowance for the immediately preceding period. Use one shared helper everywhere.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Rewrite posting-date.service.ts to select the period where start_date <= date <= end_date and require it open; separately allow the cutoff grace only when posting into the previous period. Replace the copied SQL in all *-post.service.ts with calls to this helper. Add tests for boundary dates.

### [DATA-011] Audit-trail and concurrency gaps: manual voucher post reads then writes outside a transaction with no row lock; fiscal-year close/lock/unlock take no user id so locked_by_user_id is never set (Medium | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:477-507` (+ `backend/src/modules/fiscal-years/fiscal-year.service.ts:301`, `backend/src/modules/fiscal-years/fiscal-year.service.ts:350`, `backend/src/modules/fiscal-years/fiscal-year.service.ts:364`, `backend/prisma/schema.prisma:139`)
- **Finding**: Audit-trail and concurrency gaps: manual voucher post reads then writes outside a transaction with no row lock; fiscal-year close/lock/unlock take no user id so locked_by_user_id is never set.
- **Evidence**:
  ```
  post(): findFirst(...) then update(...) — no $transaction / FOR UPDATE
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Post inside a transaction with SELECT ... FOR UPDATE and a Draft-status guard; pass the acting user into fiscal-year actions and record who/when.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Wrap voucher.service.ts post() in prisma.$transaction, lock the row with SELECT ... FOR UPDATE, re-check status. Pass req user id into fiscal-year close/lock/unlock/period-close and persist it in locked_by_user_id / closed_by fields.

### [SEC-003] Fallback secrets remain outside production: the backend signs tokens with a public default JWT secret whenever NODE_ENV != production; the frontend falls back to 'dev-only-secret-placeholder-for-local-testing' (Medium | Security | Quick Win | Confirmed)
- **Location**: `backend/src/config/env.ts:4` (+ `backend/src/config/env.ts:13`, `frontend/src/lib/auth/auth.options.ts:103`, `frontend/src/app/api/v1/[...path]/route.ts:15`)
- **Finding**: Fallback secrets remain outside production: the backend signs tokens with a public default JWT secret whenever NODE_ENV != production; the frontend falls back to 'dev-only-secret-placeholder-for-local-testing'. A staging/demo server left on development accepts forged tokens.
- **Evidence**:
  ```
  JWT_SECRET: z.string().min(16).default(DEVELOPMENT_JWT_SECRET)
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Remove defaults; require secrets in every environment except test.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In backend/src/config/env.ts remove the JWT_SECRET default and require it unless NODE_ENV === 'test'. In frontend auth.options.ts and the api proxy route remove the fallback string and throw when NEXTAUTH_SECRET is missing.

### [ARCH-001] Prisma schema and migrations disagree: the schema declares GL indexes that no migration creates, and the branch-stock migration creates indexes, holder CHECK constraints and NULLS NOT DISTINCT uniques that the schema does not declare (Medium | Architecture | Quick Win | Confirmed)
- **Location**: `backend/prisma/schema.prisma:231` (+ `backend/prisma/schema.prisma:267`, `backend/prisma/migrations/20261020110000_add_branch_stock/migration.sql:22-30`)
- **Finding**: Prisma schema and migrations disagree: the schema declares GL indexes that no migration creates, and the branch-stock migration creates indexes, holder CHECK constraints and NULLS NOT DISTINCT uniques that the schema does not declare. The next `prisma migrate dev` will try to reconcile both sides and may drop the branch-stock constraints.
- **Evidence**:
  ```
  @@index(..., map: "idx_vouchers_company_status_date_id")  // no migration creates it
  ```
- **Breaks Rule**: PR-09
- **Blocked By**: none
- **Fix**: Add a migration creating the two GL indexes, represent the raw-SQL constraints in the schema (or document them as raw migrations), and gate CI on `prisma migrate diff --exit-code`.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url $SHADOW` and create a migration for the missing GL indexes. Add the branch-stock indexes to schema.prisma with matching map names. Add the migrate diff check to CI.

### [SEC-012] The deployment serves the app over plain HTTP on a public IP and issues 7-day backend tokens while the NextAuth session lasts 12 hours (Medium | Security | Moderate | Confirmed)
- **Location**: `deployment/docker-compose.yml:16` (+ `deployment/docker-compose.yml:48`, `frontend/src/lib/auth/auth.options.ts:73`)
- **Finding**: The deployment serves the app over plain HTTP on a public IP and issues 7-day backend tokens while the NextAuth session lasts 12 hours.
- **Evidence**:
  ```
  JWT_EXPIRES_IN: 7d     NEXTAUTH_URL=http://161.97.***.***:3070
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Put the app behind an HTTPS reverse proxy (Caddy/Nginx + Let's Encrypt), set secure cookies, and align JWT_EXPIRES_IN with the 12h session.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a Caddy service to deployment/docker-compose.yml terminating TLS for the frontend; bind frontend/backend ports to 127.0.0.1 only; set JWT_EXPIRES_IN=12h; set NEXTAUTH_URL to the https URL.

### [DATA-013] The fiscal-close 'Trial Balance Is Balanced' pre-check sums only the year's voucher lines (already balanced individually), ignores opening balances and uses Number, so it can never detect a real imbalance (Medium | Data Integrity | Quick Win | Confirmed)
- **Location**: `backend/src/modules/fiscal-years/fiscal-year.service.ts:634-637` (+ `backend/src/modules/fiscal-years/fiscal-year.service.ts:1052-1066`)
- **Finding**: The fiscal-close 'Trial Balance Is Balanced' pre-check sums only the year's voucher lines (already balanced individually), ignores opening balances and uses Number, so it can never detect a real imbalance.
- **Evidence**:
  ```
  Number(row.total_debit) ... === Number(row.total_credit)
  ```
- **Breaks Rule**: none
- **Blocked By**: DATA-014
- **Fix**: Call the real Trial Balance service (with opening balances) as of year end and compare closing debit and credit in Decimal.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In fiscal-year.service.ts replace the custom balance check with a call to the trial balance report service for the year range and compare totals with decimal.js .eq().

### [DATA-010] Sale and purchase returns are not linked to the original invoice, so a user can return more than was sold/bought to that party, at any price, without reference to the original cost (Medium | Data Integrity | Moderate | Confirmed)
- **Location**: `backend/src/modules/sale-returns/sale-return-validation.service.ts` (+ `backend/src/modules/purchase-returns/purchase-return-draft.service.ts`)
- **Finding**: Sale and purchase returns are not linked to the original invoice, so a user can return more than was sold/bought to that party, at any price, without reference to the original cost.
- **Evidence**:
  ```
  no sale_invoice_id / purchase_invoice_id column in the return migrations
  ```
- **Breaks Rule**: none
- **Blocked By**: DATA-004
- **Fix**: Add an optional source invoice link on returns, validate remaining returnable quantity and use the original line cost.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add nullable source_sale_id/source_sale_line_id to sale returns (and the purchase equivalent) via migration; when set, validate returned qty <= sold qty minus previous returns and copy the original unit cost.

### [SEC-011] Login throttling is per-email, in memory and unbounded: password spraying across many emails is not limited, anyone can lock any user out for 15 minutes, the map resets on restart and is not shared across replicas, and /auth/change-password has no limit (Medium | Security | Moderate | Confirmed)
- **Location**: `backend/src/middleware/login-attempt-limit.ts:3-6` (+ `backend/src/routes/auth.routes.ts:15-21`)
- **Finding**: Login throttling is per-email, in memory and unbounded: password spraying across many emails is not limited, anyone can lock any user out for 15 minutes, the map resets on restart and is not shared across replicas, and /auth/change-password has no limit.
- **Evidence**:
  ```
  const failedAttempts = new Map<string, ...>()   // keyed by email only
  ```
- **Breaks Rule**: none
- **Blocked By**: OPS-003
- **Fix**: Add a per-IP limiter (express-rate-limit with trust proxy and forwarded client IP), a shared store (DB/Redis), a size cap, and limit change-password.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add express-rate-limit to /auth/login and /auth/change-password keyed by client IP (set app.set('trust proxy', 1) and forward x-forwarded-for from the Next proxy). Keep the per-email lockout but cap the map size and evict expired entries.

## 7. Wave 2 — UI/UX, Accessibility, Report Usability & Performance

### [UIUX-005] The 12 document screens users spend most time on (Purchase, Sale, both Returns, Journal, Cash/Bank and Bank Receipt vouchers and their posted lists) bypass the Calm Ledger design system: bespoke <main style={{padding:10}}> layouts, inline-style tables and two parallel table-style factories (1,079 inline style={{ in the app) (High | UI/UX | Major | Confirmed)
- **Location**: `frontend/src/components/purchases/PurchaseVoucherPage.tsx:276` (+ `frontend/src/components/purchases/PostedPurchasesView.tsx:125`, `frontend/src/components/vouchers/JournalVoucherPage.tsx:286`, `frontend/src/components/purchases/PurchaseVoucherStyles.ts:21`, `frontend/src/components/vouchers/VoucherShared.ts:72`, `frontend/src/components/stock-transfers/StockTransferPage.tsx:328`)
- **Finding**: The 12 document screens users spend most time on (Purchase, Sale, both Returns, Journal, Cash/Bank and Bank Receipt vouchers and their posted lists) bypass the Calm Ledger design system: bespoke <main style={{padding:10}}> layouts, inline-style tables and two parallel table-style factories (1,079 inline style={{ in the app). Purchase/Sales use PurchaseToolbar, vouchers use VoucherPageHeader, and the newer Stock Transfer/Adjustment screens use PageHeader + .page-shell — three different patterns, and the newest modules follow DESIGN.md better than the 'Purchase pattern' AGENTS.md tells new modules to copy.
- **Evidence**:
  ```
  <main style={{ padding: 10, ... }}>   // vs PageHeader + .page-shell in StockTransferPage
  ```
- **Breaks Rule**: PR-13
- **Blocked By**: none
- **Fix**: Build one shared DocumentPage + LinesPanel + DocumentSummary from components/ui and migrate the 12 screens using DESIGN.md's checklist; update AGENTS.md so the reference pattern is the one that matches DESIGN.md.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create frontend/src/components/ui/DocumentPage.tsx (PageHeader with actions on top, .page-shell, header form using .form-grid, lines panel using data-table, summary area). Migrate PurchaseVoucherPage first, removing PurchaseVoucherStyles.ts inline styles, then apply the same to Sales, Returns and Vouchers. Keep behavior identical; run type-check.

### [UIUX-003] Fixed pixel header grids clip at the 1280px desktop target: with Location shown, the purchase header needs ≈1,077px but the parent card has overflow:hidden and ≈992px is available with the sidebar open, so the right-most fields are cut off (High | UI/UX | Moderate | Likely)
- **Location**: `frontend/src/components/purchases/components/PurchaseHeaderForm.tsx:114` (+ `frontend/src/components/purchases/components/PurchaseHeaderForm.tsx:97`, `frontend/src/components/vouchers/CashBankVoucherPage.tsx:396`, `frontend/src/components/vouchers/BankReceiptVoucherPage.tsx:338`, `frontend/src/components/vouchers/JournalVoucherPage.tsx:311`, `frontend/src/components/purchases/PurchaseVoucherPage.tsx:294`)
- **Finding**: Fixed pixel header grids clip at the 1280px desktop target: with Location shown, the purchase header needs ≈1,077px but the parent card has overflow:hidden and ≈992px is available with the sidebar open, so the right-most fields are cut off. Same inline gridTemplateColumns pattern in all voucher headers.
- **Evidence**:
  ```
  gridTemplateColumns: 'minmax(230px,…) minmax(170px,…) minmax(180px,…) 145px minmax(320px,…)'
  ```
- **Breaks Rule**: PR-13
- **Blocked By**: UIUX-005
- **Fix**: Use the shared .form-grid with --form-cols (collapses at 900px); no inline gridTemplateColumns.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace the inline gridTemplateColumns in PurchaseHeaderForm.tsx and the voucher header grids with className="form-grid" and style={{ '--form-cols': 4 }}; remove overflow:hidden from the workspace card.

### [UIUX-006] No keyboard line entry on any voucher: no Enter-to-add-line, no Enter-to-next-field, no Save/Process shortcut (High | UI/UX | Moderate | Confirmed)
- **Location**: `frontend/src/components/purchases/components/PurchaseLineEntry.tsx:66-69` (+ `frontend/src/components/vouchers/JournalVoucherLineTable.tsx`, `frontend/src/components/vouchers/CashBankVoucherLineTable.tsx`)
- **Finding**: No keyboard line entry on any voucher: no Enter-to-add-line, no Enter-to-next-field, no Save/Process shortcut. The only onKeyDown handlers are in SearchableSelect, Tabs, ConfirmDialog and search boxes. Heavy data entry is mouse-driven.
- **Evidence**:
  ```
  no onKeyDown on line-entry inputs
  ```
- **Breaks Rule**: none
- **Blocked By**: UIUX-005
- **Fix**: Enter on the last line field adds/updates the line and returns focus to Item; Ctrl/Cmd+S saves draft; Alt+N adds a line. Show shortcuts in button tooltips.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a useLineEntryKeyboard hook in frontend/src/components/shared/ that handles Enter (add line, focus first field), Ctrl/Cmd+S (save draft) and Alt+N (new line). Wire it into PurchaseLineEntry and every *LineTable component.

### [PERF-002] Stock transfer and stock adjustment list endpoints LEFT JOIN lines and GROUP BY every matching document before LIMIT (fixed for sales, purchases and returns) (Medium | Performance | Quick Win | Confirmed)
- **Location**: `backend/src/modules/stock-transfers/stock-transfer.service.ts:295-306` (+ `backend/src/modules/stock-adjustments/stock-adjustment.service.ts:320-331`)
- **Finding**: Stock transfer and stock adjustment list endpoints LEFT JOIN lines and GROUP BY every matching document before LIMIT (fixed for sales, purchases and returns).
- **Evidence**:
  ```
  LEFT JOIN ..._lines l ... GROUP BY t.id ... LIMIT $n
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Page the headers first, then count lines only for the page rows (as sale-list.service.ts does).
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Rewrite the list queries in stock-transfer.service.ts and stock-adjustment.service.ts to select the page of headers in a CTE with LIMIT/OFFSET and compute line counts with a correlated subquery for those rows only, following sale-list.service.ts:145-149.

### [PERF-003] Posting transactions for sales, purchases, returns and adjustments use Prisma's default 5-second interactive transaction timeout and insert voucher lines one at a time (~4 statements per line); large invoices will time out and roll back (Medium | Performance | Quick Win | Confirmed)
- **Location**: `backend/src/modules/sales/sale-post.service.ts:156` (+ `backend/src/modules/stock-transfers/stock-transfer.service.ts:11`)
- **Finding**: Posting transactions for sales, purchases, returns and adjustments use Prisma's default 5-second interactive transaction timeout and insert voucher lines one at a time (~4 statements per line); large invoices will time out and roll back. Only stock transfers set a timeout.
- **Evidence**:
  ```
  prisma.$transaction(async (tx) => { ... })   // default timeout 5000 ms
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Set { timeout, maxWait } on posting transactions and batch-insert voucher lines and movements.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a shared POSTING_TRANSACTION_OPTIONS = { timeout: 30000, maxWait: 10000 } and pass it to every posting $transaction. Replace per-line voucher_line inserts with createMany or a single multi-row INSERT.

### [UIUX-001] Shared fields now wrap inputs in <label>, but 15 raw line-item inputs and the line-item SearchableSelect have no accessible name (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/vouchers/JournalVoucherLineTable.tsx:81` (+ `frontend/src/components/vouchers/JournalVoucherLineTable.tsx:72`, `frontend/src/components/vouchers/CashBankVoucherLineTable.tsx:107-147`, `frontend/src/components/vouchers/BankReceiptVoucherLineTable.tsx:96-153`, `frontend/src/components/vouchers/SummaryBoxes.tsx:39`)
- **Finding**: Shared fields now wrap inputs in <label>, but 15 raw line-item inputs and the line-item SearchableSelect have no accessible name.
- **Evidence**:
  ```
  <input value={line.dr_amount} ... />   // no aria-label
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add aria-label combining the column and line number (e.g. 'Debit, Line 3') and pass ariaLabel to SearchableSelect.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In the voucher line-table components add aria-label={`${columnTitle}, Line ${index + 1}`} to every raw input and ariaLabel to SearchableSelect.

### [UIUX-007] Required, error and hint states are not exposed to assistive technology: the * is aria-hidden and inputs never get required/aria-required; aria-invalid/aria-describedby appear only twice in the codebase; hint text is not linked (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/ui/FieldLabel.tsx:19` (+ `frontend/src/components/ui/FormFields.tsx:55-63`)
- **Finding**: Required, error and hint states are not exposed to assistive technology: the * is aria-hidden and inputs never get required/aria-required; aria-invalid/aria-describedby appear only twice in the codebase; hint text is not linked.
- **Evidence**:
  ```
  <span aria-hidden>*</span>   // input has no aria-required
  ```
- **Breaks Rule**: PR-14
- **Blocked By**: none
- **Fix**: Pass required/aria-required through, link hint and error via useId + aria-describedby, add an error prop setting aria-invalid.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In FieldLabel.tsx and FormFields.tsx add required → aria-required, an error prop rendering a message with an id and setting aria-invalid, and aria-describedby linking hint and error ids (useId).

### [UIUX-008] Purchase/Sales/Returns message banner has no role, so success and error messages are not announced; errors show an invoice icon instead of an error icon (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/purchases/components/PurchaseMessageBanner.tsx:16` (+ `frontend/src/components/vouchers/VoucherLayout.tsx:48`)
- **Finding**: Purchase/Sales/Returns message banner has no role, so success and error messages are not announced; errors show an invoice icon instead of an error icon.
- **Evidence**:
  ```
  <div style={messageStyle(message.kind)}>
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Replace with the shared InlineAlert, as VoucherMessageBanner already does.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace PurchaseMessageBanner's div with InlineAlert (role=alert for errors, role=status for success) and use the danger icon for errors.

### [UIUX-009] Load failures render as friendly empty states ('No Units Yet — Add your first Unit') because pages read only { data = [], isLoading } (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/inventory/UomPage.tsx:57` (+ `frontend/src/components/inventory/UomPage.tsx:147-150`, `frontend/src/components/inventory/CategoriesPage.tsx:107`, `frontend/src/components/bank/ChequeBooksTab.tsx:417-418`, `frontend/src/components/inventory/ProductDetailPanel.tsx`)
- **Finding**: Load failures render as friendly empty states ('No Units Yet — Add your first Unit') because pages read only { data = [], isLoading }.
- **Evidence**:
  ```
  const { data = [], isLoading } = useUoms();
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Handle isError with a danger TableMessageRow and a Retry button.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In UomPage, CategoriesPage, ChequeBooksTab and ProductDetailPanel read isError and refetch; render <TableMessageRow tone="danger"> with a Retry button when isError.

### [UIUX-010] Approve Voucher posts to the ledger with no confirmation (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/approvals/ApprovalQueuePage.tsx:118-126` (+ `frontend/src/components/approvals/ApprovalQueuePage.tsx:287`, `frontend/src/components/vouchers/JournalVoucherPage.tsx:271`, `frontend/src/components/vouchers/JournalVoucherPage.tsx:303`)
- **Finding**: Approve Voucher posts to the ledger with no confirmation. In Journal Voucher the review-before-post dialog is dead code (reviewVoucher never called) and Process posts directly.
- **Evidence**:
  ```
  onClick={approveSelectedVoucher}  → approveVoucher.mutateAsync(...)
  ```
- **Breaks Rule**: PR-05
- **Blocked By**: none
- **Fix**: Add a ConfirmDialog for Approve and Process (show totals and posting date); wire or delete the JV review dialog.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In ApprovalQueuePage.tsx wrap approve in ConfirmDialog showing voucher number, date and total. In JournalVoucherPage.tsx call reviewVoucher before saveVoucher(true), or remove the unused review dialog code.

### [UIUX-011] Some numbers, dates and currency ignore settings: toLocaleString() on the dashboard, toLocaleDateString('en-US') in analytics, hardcoded currency_code 'PKR' defaults on Bank, Customers and Suppliers (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/app/(dashboard)/dashboard/page.tsx:235` (+ `frontend/src/app/(dashboard)/dashboard/page.tsx:381-384`, `frontend/src/components/shared/TransactionAnalyticsView.tsx:375`, `frontend/src/lib/date.ts:128`, `frontend/src/components/accounts/AccountTreeView.tsx:284`, `frontend/src/app/(dashboard)/bank/page.tsx:127`, `frontend/src/components/customers/CustomersPage.tsx:58`, `frontend/src/components/suppliers/SuppliersPage.tsx:59`)
- **Finding**: Some numbers, dates and currency ignore settings: toLocaleString() on the dashboard, toLocaleDateString('en-US') in analytics, hardcoded currency_code 'PKR' defaults on Bank, Customers and Suppliers.
- **Evidence**:
  ```
  currency_code: 'PKR'      .toLocaleDateString('en-US', ...)
  ```
- **Breaks Rule**: PR-02
- **Blocked By**: none
- **Fix**: Use the settings-driven formatCount/formatDate/formatMoney helpers and default currency from general settings.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace toLocaleString/toLocaleDateString calls listed with the shared formatting helpers that read general_settings, and replace hardcoded 'PKR' defaults with the company base currency from settings.

### [UIUX-017] No drill-down: the Ledger returns voucher_id but shows the number as plain text; Trial Balance, Balance Sheet and P&L lines do not open the account ledger (Medium | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/reports/LedgerReportTable.tsx:53-62`
- **Finding**: No drill-down: the Ledger returns voucher_id but shows the number as plain text; Trial Balance, Balance Sheet and P&L lines do not open the account ledger.
- **Evidence**:
  ```
  <td>{row.voucher_number}</td>
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Link voucher numbers to the voucher view and account rows to the Ledger Report with the same dates.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In LedgerReportTable.tsx render voucher_number as a Link to the voucher detail. In the trial balance, P&L and balance sheet tables link each account row to /reports/ledger?accountId=..&dateFrom=..&dateTo=..

### [UIUX-016] Purchase/Sales/Returns summary reports total only the current page (50 rows) — footer reads 'Totals For This Page' — with no grand total, and sum with Number() (Medium | UI/UX | Moderate | Confirmed)
- **Location**: `frontend/src/components/reports/ReportsWorkspace.tsx:444-450` (+ `frontend/src/components/reports/ReportsWorkspace.tsx:513`, `frontend/src/components/reports/ReportsWorkspace.tsx:549-554`, `frontend/src/components/reports/ReportsWorkspace.tsx:623`)
- **Finding**: Purchase/Sales/Returns summary reports total only the current page (50 rows) — footer reads 'Totals For This Page' — with no grand total, and sum with Number().
- **Evidence**:
  ```
  rows.reduce((s, r) => s + Number(r.net_amount), 0)   // 'Totals For This Page'
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Return grand totals from the backend (Decimal) with the paged rows and show both page and report totals.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a totals object (computed with SUM in SQL over the full filter) to the summary report endpoints and render it as the table footer in ReportsWorkspace.tsx.

### [PERF-001] The GL composite indexes for reports (company+status+date, company+account+voucher) exist only in schema.prisma, not in any migration, so a database built from migrations lacks them; Trial Balance, Ledger and Balance Sheet scan voucher_lines as data grows (Medium | Performance | Quick Win | Confirmed)
- **Location**: `backend/prisma/schema.prisma:231` (+ `backend/prisma/schema.prisma:267`)
- **Finding**: The GL composite indexes for reports (company+status+date, company+account+voucher) exist only in schema.prisma, not in any migration, so a database built from migrations lacks them; Trial Balance, Ledger and Balance Sheet scan voucher_lines as data grows.
- **Evidence**:
  ```
  map: "idx_voucher_lines_company_account_voucher"  // not created by migrations
  ```
- **Breaks Rule**: none
- **Blocked By**: ARCH-001
- **Fix**: Create the indexes in a migration (CREATE INDEX CONCURRENTLY for live DBs) and verify with EXPLAIN on the report queries.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add a migration that creates idx_vouchers_company_status_date_id and idx_voucher_lines_company_account_voucher matching schema.prisma. Run EXPLAIN ANALYZE on the trial balance query before and after.

### [DATA-019] Stock Summary is warehouse-only, current snapshot only (no as-of date) and is never reconciled to the GL Inventory account, although /branches/:id/stock-summary exists (Medium | Data Integrity | Moderate | Confirmed)
- **Location**: `frontend/src/components/reports/ReportsWorkspace.tsx:542-545` (+ `backend/src/modules/inventory/stock-summary.service.ts:5-12`)
- **Finding**: Stock Summary is warehouse-only, current snapshot only (no as-of date) and is never reconciled to the GL Inventory account, although /branches/:id/stock-summary exists. There is also no routine to rebuild inventory_stock_balances from inventory_stock_movements.
- **Evidence**:
  ```
  only warehouses offered in the holder selector
  ```
- **Breaks Rule**: PR-03
- **Blocked By**: DATA-003, DATA-004
- **Fix**: Add Branch/Warehouse holder choice, an as-of date computed from stock movements, a 'Stock Value vs Inventory Account' reconciliation report, and an admin rebuild-balances job.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Extend stock-summary.service.ts with an asOfDate parameter that aggregates inventory_stock_movements up to that date per holder. Add a reconciliation endpoint comparing Σ total_stock_value with the GL Inventory account balance. Add Branch to the holder selector in ReportsWorkspace.tsx.

### [UIUX-018] The dashboard shows counts only (accounts, vouchers) plus 'sum of total_debit by month' across all voucher types, labelled like revenue (Medium | UI/UX | Moderate | Confirmed)
- **Location**: `backend/src/modules/dashboard/dashboard.service.ts:20-74` (+ `frontend/src/app/(dashboard)/dashboard/page.tsx`)
- **Finding**: The dashboard shows counts only (accounts, vouchers) plus 'sum of total_debit by month' across all voucher types, labelled like revenue. No revenue, gross margin, receivables, payables, cash/bank or stock value KPIs for management.
- **Evidence**:
  ```
  SUM(total_debit) GROUP BY month   -- all voucher types
  ```
- **Breaks Rule**: none
- **Blocked By**: DATA-002, DATA-003, DATA-004
- **Fix**: Derive KPIs from ledger balances by account type (Revenue, COGS, Gross Margin %, Receivables, Payables, Cash & Bank) and stock value from balances, with period comparison.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In dashboard.service.ts add KPIs computed from posted voucher_lines grouped by account type for the current fiscal period and the prior period, plus Σ total_stock_value. Render as KPI tiles with change vs prior period on the dashboard page.

### [PERF-004] Sale posting locks stock balance rows in invoice line order while transfers lock by id; two concurrent sales with the same items in different order can deadlock (Low | Performance | Quick Win | Likely)
- **Location**: `backend/src/modules/sales/sale-post.service.ts:333-335` (+ `backend/src/modules/stock-transfers/stock-transfer.service.ts:550`)
- **Finding**: Sale posting locks stock balance rows in invoice line order while transfers lock by id; two concurrent sales with the same items in different order can deadlock.
- **Evidence**:
  ```
  for (const line of lines) { SELECT ... FOR UPDATE }
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Lock balance rows in a deterministic order (sorted by item id, holder id) in every posting service.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In sale-post.service.ts and the other post services, sort the lines by item_id before acquiring FOR UPDATE locks on inventory_stock_balances.

### [UIUX-012] Icon-only buttons without accessible names in posted-document views (close button has neither aria-label nor title; others rely on title only), and one 11px font below the 12px floor (Low | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/purchases/PostedPurchasesView.tsx:271` (+ `frontend/src/components/purchases/PostedPurchasesView.tsx:241`, `frontend/src/components/purchases/PostedPurchasesView.tsx:266`, `frontend/src/components/stock-transfers/StockTransferPage.tsx:538`)
- **Finding**: Icon-only buttons without accessible names in posted-document views (close button has neither aria-label nor title; others rely on title only), and one 11px font below the 12px floor.
- **Evidence**:
  ```
  <button onClick={onClose}><IconX/></button>
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Use the shared Button with aria-label and title; use --font-size-2xs.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add aria-label to every icon-only button in Posted*View components and replace fontSize '11px' with var(--font-size-2xs).

### [UIUX-004] Contrast mostly fixed (muted text 6.2:1) (Low | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/app/design-tokens.css:252` (+ `frontend/src/app/design-tokens.css:260`, `frontend/src/app/design-tokens.css:117`)
- **Finding**: Contrast mostly fixed (muted text 6.2:1). Remaining: --color-text-light #6b7787 is 4.21:1 on the page background; dark-theme primary/danger gradient top stops give 3.81:1 and 3.69:1 for white 13px labels.
- **Evidence**:
  ```
  --btn-primary-top: #4d7fe8 (dark)  → white 3.81:1
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Darken the dark-theme top stops to ≥ #3b6fe0 and restrict text-light to icons.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In design-tokens.css set the dark primary gradient top stop to #3b6fe0, the danger top stop to a value giving ≥4.5:1 with white, and darken --color-text-light to reach 4.5:1 on --color-bg.

### [UIUX-019] Report default 'today' uses the UTC date, so between midnight and 05:00 Pakistan time reports default to yesterday (Low | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/reports/LedgerReportHelpers.ts:15-17`
- **Finding**: Report default 'today' uses the UTC date, so between midnight and 05:00 Pakistan time reports default to yesterday.
- **Evidence**:
  ```
  new Date().toISOString().slice(0, 10)
  ```
- **Breaks Rule**: PR-02
- **Blocked By**: none
- **Fix**: Compute today in the settings time zone.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace toISOString().slice(0,10) in LedgerReportHelpers.ts with a todayInTimeZone(settings.timeZone) helper in lib/date.ts.

### [UIUX-013] Large lists cannot be sorted: only ProductList uses th-sort/aria-sort; Vouchers, Customers, Suppliers and posted document lists have no sorting (Low | UI/UX | Moderate | Confirmed)
- **Location**: `frontend/src/components/inventory/ProductList.tsx` (+ `frontend/src/components/vouchers/PostedVouchersView.tsx`, `frontend/src/components/customers/CustomersPage.tsx`)
- **Finding**: Large lists cannot be sorted: only ProductList uses th-sort/aria-sort; Vouchers, Customers, Suppliers and posted document lists have no sorting.
- **Evidence**:
  ```
  th-sort used in 1 list only
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add server-side sort on date, number and amount columns using the .th-sort pattern.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add sortBy/sortDir query params to the voucher, customer, supplier and posted-document list endpoints (allowlisted enums) and .th-sort headers with aria-sort in the matching tables.

### [UIUX-002] Most data tables show skeleton rows, but the 5 posted-document lists still show a text-only loading row and ui/TableSkeleton.tsx is never imported (Low | UI/UX | Quick Win | Confirmed)
- **Location**: `frontend/src/components/purchases/PostedPurchasesView.tsx:204-208` (+ `frontend/src/components/ui/TableSkeleton.tsx`)
- **Finding**: Most data tables show skeleton rows, but the 5 posted-document lists still show a text-only loading row and ui/TableSkeleton.tsx is never imported.
- **Evidence**:
  ```
  <td>Loading...</td>
  ```
- **Breaks Rule**: none
- **Blocked By**: UIUX-005
- **Fix**: Use TableMessageRow loading (or TableSkeleton) in posted lists; delete TableSkeleton if unused.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace the text loading rows in Posted*View components with <TableMessageRow loading colSpan={n} />.

## 8. Wave 3 — Reliability, Tests & Technical Debt

### [TEST-001] Critical ERP paths are untested (High | Testing | Major | Confirmed)
- **Location**: `backend/test/` (+ `frontend/jest.config.js:31-49`, `frontend/tests/`)
- **Finding**: Critical ERP paths are untested. backend/test has 3 Vitest files (~350 lines: account codes, balance helper, password hashing, access rules, stock holders), all untracked. No tests for any *-post.service.ts, reversal/void, fiscal close, opening balances, stock movement/balance consistency, reports, or auth routes. Frontend has 0 tests while jest.config sets 50-90% coverage thresholds.
- **Evidence**:
  ```
  backend/test: accounting-rules.test.ts, auth-access.test.ts, stock-holder-access.test.ts
  ```
- **Breaks Rule**: none
- **Blocked By**: DATA-001, DATA-002
- **Fix**: Add integration tests against a real Postgres (Testcontainers or CI service): post/reverse each document type, GL vs stock reconciliation, fiscal close and next-year Balance Sheet, opening balances, 401/403 per role.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Set up a Vitest integration suite that starts Postgres (Testcontainers), runs prisma migrate deploy, seeds a company, and tests: purchase post (GL inventory = stock value), sale post (COGS from locked average), void rejection for posted vouchers, year close then Balance Sheet difference = 0, trial balance with mid-year opening balance, and role-based 403s.

### [DEP-003] Peer-dependency conflicts are hidden with --legacy-peer-deps: @typescript-eslint 7.18 requires eslint ^8.56 but eslint 9.39 is installed; @testing-library/react 14.3 requires React 18 but React 19.2 is installed (Medium | Dependencies | Quick Win | Likely)
- **Location**: `frontend/package.json:49` (+ `frontend/package.json:55`, `frontend/Dockerfile:10`, `frontend/Dockerfile:30`)
- **Finding**: Peer-dependency conflicts are hidden with --legacy-peer-deps: @typescript-eslint 7.18 requires eslint ^8.56 but eslint 9.39 is installed; @testing-library/react 14.3 requires React 18 but React 19.2 is installed. CI runs npm ci without the flag and will likely fail with ERESOLVE.
- **Evidence**:
  ```
  RUN npm ci --legacy-peer-deps
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Upgrade to typescript-eslint v8 and @testing-library/react v16, then drop --legacy-peer-deps.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In frontend upgrade @typescript-eslint/* to v8 and @testing-library/react to v16, remove --legacy-peer-deps from the Dockerfile, run npm ci, lint and type-check.

### [OPS-003] Logs are plain-text morgan access logs with no request ids; the Next proxy forwards only accept, content-type and x-company-id, so the backend sees the frontend container IP for every user (breaks IP throttling and audit) (Medium | Operations | Quick Win | Confirmed)
- **Location**: `backend/src/app.ts:19` (+ `frontend/src/app/api/v1/[...path]/route.ts:11`)
- **Finding**: Logs are plain-text morgan access logs with no request ids; the Next proxy forwards only accept, content-type and x-company-id, so the backend sees the frontend container IP for every user (breaks IP throttling and audit).
- **Evidence**:
  ```
  app.use(morgan('combined'))
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Generate/forward x-request-id and x-forwarded-for, set trust proxy, log JSON.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In the Next proxy route forward x-forwarded-for and an x-request-id (crypto.randomUUID when absent). In app.ts set trust proxy and replace morgan with pino-http using the request id.

### [OPS-005] deployment/ is partly copied from another project: OPENAI_CHAT_MODEL, FRONTEND_URL '*', UPLOAD_TEMP_DIR, SUPPORTED_LOCALES and an uploads volume are unused; DEFAULT_COMPANY_ID is hardcoded; CORS_ORIGIN is not set; env examples still contain placeholder secrets with no startup rejection (Medium | Operations | Quick Win | Confirmed)
- **Location**: `deployment/docker-compose.yml:14-22` (+ `deployment/.env.backend.example`)
- **Finding**: deployment/ is partly copied from another project: OPENAI_CHAT_MODEL, FRONTEND_URL '*', UPLOAD_TEMP_DIR, SUPPORTED_LOCALES and an uploads volume are unused; DEFAULT_COMPANY_ID is hardcoded; CORS_ORIGIN is not set; env examples still contain placeholder secrets with no startup rejection.
- **Evidence**:
  ```
  OPENAI_CHAT_MODEL: ...   DEFAULT_COMPANY_ID: 0000...0001
  ```
- **Breaks Rule**: PR-10
- **Blocked By**: none
- **Fix**: Trim to the variables the code reads, set CORS_ORIGIN, remove DEFAULT_COMPANY_ID, and reject placeholder secrets at startup.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Edit deployment/docker-compose.yml to keep only variables read by backend/src/config/env.ts; add CORS_ORIGIN; remove DEFAULT_COMPANY_ID and OPENAI/upload settings. In env.ts reject secrets that start with 'your_' or are shorter than 32 characters in production.

### [QUAL-006] Account ranges, classes and dates are hardcoded in feature code, against project rules: Balance Sheet / P&L classify by code prefix ('01'–'05'), voucher cash/bank detection uses fixed prefixes, the trial balance invents '3999999999', reports fall back to `${year}-01-01` (breaks non-calendar fiscal years), and the frontend still falls back to a fixed company UUID (Medium | Quality | Moderate | Confirmed)
- **Location**: `backend/src/modules/reports/balance-sheet-report.service.ts:49-53` (+ `backend/src/modules/reports/profit-and-loss-report.service.ts:44-46`, `backend/src/modules/reports/trial-balance-report.service.ts:71`, `backend/src/modules/vouchers/voucher.service.ts:22`, `frontend/src/components/reports/LedgerReportHelpers.ts:19-22`, `frontend/src/lib/api/backend-client.ts:16`)
- **Finding**: Account ranges, classes and dates are hardcoded in feature code, against project rules: Balance Sheet / P&L classify by code prefix ('01'–'05'), voucher cash/bank detection uses fixed prefixes, the trial balance invents '3999999999', reports fall back to `${year}-01-01` (breaks non-calendar fiscal years), and the frontend still falls back to a fixed company UUID.
- **Evidence**:
  ```
  cashAccountCodePrefixes = ['010101','010110']
  startsWith('04')   `${year}-01-01`
  ```
- **Breaks Rule**: PR-04
- **Blocked By**: none
- **Fix**: Classify by accountType / normalBalance from the chart of accounts, read cash/bank accounts from bank-account and settings tables, default dates from the active fiscal year, and remove the fixed company UUID fallback.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace code-prefix classification in balance-sheet and profit-and-loss services with account.accountType. Replace cashAccountCodePrefixes in voucher.service.ts with a lookup of accounts linked to bank accounts or flagged as cash. Default report dates from the active fiscal year endpoint. Remove the default company UUID in backend-client.ts.

### [QUAL-005] Type-safety escapes are concentrated in finance code: 13 `any` uses including voucher mappers and a transaction typed as any in bank cheques (Medium | Quality | Moderate | Confirmed)
- **Location**: `backend/src/modules/vouchers/voucher.service.ts:97` (+ `backend/src/modules/vouchers/voucher.service.ts:127`, `backend/src/modules/vouchers/voucher.service.ts:143`, `backend/src/modules/bank-cheques/bank-cheque.service.ts:396`, `backend/src/modules/bank-cheques/bank-cheque.service.ts:408`)
- **Finding**: Type-safety escapes are concentrated in finance code: 13 `any` uses including voucher mappers and a transaction typed as any in bank cheques.
- **Evidence**:
  ```
  function voucherToResponse(v: any) ...   async (tx: any) => ...
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Type mappers with Prisma.VoucherGetPayload and transactions with Prisma.TransactionClient.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace `any` in voucher.service.ts mappers with Prisma.VoucherGetPayload<{ include: { lines: true } }> and in bank-cheque.service.ts with Prisma.TransactionClient. Run npm run type-check.

### [QUAL-001] ESLint reports 22 warnings (14 exhaustive-deps, down from 28) (Medium | Quality | Moderate | Confirmed)
- **Location**: `frontend/src/components/vouchers/CashBankVoucherPage.tsx:154-155` (+ `frontend/src/components/vouchers/BankReceiptVoucherPage.tsx:95-96`, `frontend/src/components/bank/ChequeBooksTab.tsx:104`, `frontend/src/lib/api/fiscal-years.ts:196`, `frontend/src/components/accounts/AccountSlideOver.tsx:80`, `frontend/src/app/(dashboard)/accounts/page.tsx:176`)
- **Finding**: ESLint reports 22 warnings (14 exhaustive-deps, down from 28). Because the lint script uses --max-warnings 0, `npm run lint` fails, so lint cannot be a CI gate.
- **Evidence**:
  ```
  React Hook useEffect has a missing dependency ...
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Fix the 14 dependency arrays (useCallback/useMemo where needed) and the remaining warnings so lint passes.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Run npm run lint in frontend and fix every react-hooks/exhaustive-deps warning by adding dependencies or memoizing callbacks; do not add eslint-disable comments.

### [ARCH-004] Large files remain: frontend settings/page.tsx is 1,148 lines; backend fiscal-year.service.ts 1,087, stock-adjustment.service.ts 1,029, stock-transfer.service.ts 778, account-list.service.ts 704, voucher.service.ts 670 (Medium | Architecture | Moderate | Confirmed)
- **Location**: `frontend/src/app/(dashboard)/settings/page.tsx` (+ `backend/src/modules/fiscal-years/fiscal-year.service.ts`, `backend/src/modules/stock-adjustments/stock-adjustment.service.ts`, `backend/src/modules/stock-transfers/stock-transfer.service.ts`)
- **Finding**: Large files remain: frontend settings/page.tsx is 1,148 lines; backend fiscal-year.service.ts 1,087, stock-adjustment.service.ts 1,029, stock-transfer.service.ts 778, account-list.service.ts 704, voucher.service.ts 670.
- **Evidence**:
  ```
  1148 frontend/src/app/(dashboard)/settings/page.tsx
  ```
- **Breaks Rule**: PR-13
- **Blocked By**: none
- **Fix**: Split settings into one component per tab; split backend services by use case (draft, post, list, closing checks).
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Split frontend settings/page.tsx into components/settings/*Tab.tsx with the page as orchestrator. Split fiscal-year.service.ts into fiscal-year-closing.service.ts and fiscal-year-checks.service.ts, and stock-adjustment.service.ts into draft/post/list services like sales.

### [TEST-002] CI exists but is untracked and incomplete: triggers on 'develop' while the remote uses 'dev'; no lint, no prisma validate / migrate diff, no frontend tests, no dependency audit, no Docker build, no CD (Medium | Testing | Quick Win | Confirmed)
- **Location**: `.github/workflows/ci.yml:5` (+ `.github/workflows/ci.yml:40-75`)
- **Finding**: CI exists but is untracked and incomplete: triggers on 'develop' while the remote uses 'dev'; no lint, no prisma validate / migrate diff, no frontend tests, no dependency audit, no Docker build, no CD.
- **Evidence**:
  ```
  on: push: branches: [main, develop]
  ```
- **Breaks Rule**: none
- **Blocked By**: QUAL-004
- **Fix**: Commit the workflow, fix branch names, add lint, prisma validate + migrate diff, npm audit --omit=dev, Docker build, and frontend tests.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Edit .github/workflows/ci.yml: branches [main, dev]; add jobs for npm run lint (both apps), npx prisma validate and migrate diff --exit-code, npm audit --audit-level=high --omit=dev, docker build for both Dockerfiles, and frontend jest.

### [QUAL-007] Frontend type safety is switched off: @typescript-eslint/no-explicit-any is 'off' and 208 `any` remain, concentrated in API clients and settings props (Medium | Quality | Moderate | Confirmed)
- **Location**: `frontend/.eslintrc.json` (+ `frontend/src/components/stock-adjustments/StockAdjustmentPage.tsx`, `frontend/src/lib/api/purchases.ts`, `frontend/src/lib/api/parties.ts`, `frontend/src/app/(dashboard)/settings/page.tsx:413`)
- **Finding**: Frontend type safety is switched off: @typescript-eslint/no-explicit-any is 'off' and 208 `any` remain, concentrated in API clients and settings props.
- **Evidence**:
  ```
  "@typescript-eslint/no-explicit-any": "off"
  ```
- **Breaks Rule**: none
- **Blocked By**: QUAL-001
- **Fix**: Set the rule to warn and type the API clients first.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Set no-explicit-any to 'warn' in frontend/.eslintrc.json and replace `any` in src/lib/api/purchases.ts and parties.ts with response types shared from the backend schemas.

### [OPS-009] Setup and deployment docs describe a different architecture (Redis, MinIO, BullMQ worker, TypeORM, tRPC) and point to the broken root compose; none cover migrations, admin seeding, backups or the deployment/ folder (Medium | Operations | Moderate | Confirmed)
- **Location**: `frontend/SETUP.md:16-33` (+ `README.md:10-20`)
- **Finding**: Setup and deployment docs describe a different architecture (Redis, MinIO, BullMQ worker, TypeORM, tRPC) and point to the broken root compose; none cover migrations, admin seeding, backups or the deployment/ folder. There is no end-user guide for accountants or storekeepers.
- **Evidence**:
  ```
  SETUP.md: "Redis ... MinIO ... BullMQ worker ... TypeORM"
  ```
- **Breaks Rule**: none
- **Blocked By**: OPS-001, OPS-006
- **Fix**: Rewrite README/SETUP for the real stack and add a DEPLOYMENT.md runbook plus a short user guide per module.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Rewrite README.md and frontend/SETUP.md to describe Next.js + Express + Prisma + PostgreSQL only; add DEPLOYMENT.md covering env vars, migrate deploy, seed:admin, backup/restore, rollback and TLS.

### [DEP-002] Unused frontend dependencies remain (never imported): ag-grid-community, ag-grid-react, exceljs, @auth/core, query-string, clsx, dotenv, @next/env, @mantine/hooks, supertest, playwright (no e2e), @types/express, tsx (Low | Dependencies | Quick Win | Confirmed)
- **Location**: `frontend/package.json:25-64`
- **Finding**: Unused frontend dependencies remain (never imported): ag-grid-community, ag-grid-react, exceljs, @auth/core, query-string, clsx, dotenv, @next/env, @mantine/hooks, supertest, playwright (no e2e), @types/express, tsx. puppeteer, bullmq, redis, pg and aws-sdk were removed since the last audit.
- **Evidence**:
  ```
  "ag-grid-community", "ag-grid-react", "exceljs", "@auth/core", ...
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Remove unused packages (keep exceljs only if Excel export is built for DATA-018/UIUX export).
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In frontend/package.json remove ag-grid-community, ag-grid-react, @auth/core, query-string, dotenv, @next/env, supertest, @types/express, tsx and playwright if no e2e tests are planned; verify with npm run type-check and npm run build.

### [DEP-004] Node versions differ: frontend engines/.nvmrc/Dockerfile use 24, backend Dockerfile and CI use 22 (Low | Dependencies | Quick Win | Confirmed)
- **Location**: `frontend/Dockerfile:2` (+ `backend/Dockerfile:1`, `.github/workflows/ci.yml:55`, `frontend/.nvmrc`)
- **Finding**: Node versions differ: frontend engines/.nvmrc/Dockerfile use 24, backend Dockerfile and CI use 22.
- **Evidence**:
  ```
  FROM node:24-alpine   vs   FROM node:22-alpine
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Standardise on one LTS (Node 24) across Dockerfiles, CI, engines and .nvmrc.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Set Node 24 in backend/Dockerfile, .github/workflows/ci.yml and add a root .nvmrc; add engines to backend/package.json.

### [SEC-006] Containers now run as non-root and Next.js has output: 'standalone', but the frontend Dockerfile still installs full production node_modules, copies .next and runs npm start, so the standalone build is unused and the image is larger than needed (Low | Operations | Quick Win | Confirmed)
- **Location**: `frontend/Dockerfile:30-48` (+ `frontend/next.config.js:4`)
- **Finding**: Containers now run as non-root and Next.js has output: 'standalone', but the frontend Dockerfile still installs full production node_modules, copies .next and runs npm start, so the standalone build is unused and the image is larger than needed.
- **Evidence**:
  ```
  COPY --from=builder /app/.next ./.next
  CMD ["npm","start"]
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Copy .next/standalone and .next/static and run node server.js.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Rewrite the frontend Dockerfile runner stage to COPY .next/standalone, .next/static and public, then CMD ["node","server.js"]; drop the second npm ci.

### [OPS-007] The frontend image healthcheck calls GET /, which the auth middleware redirects (307) to /login, so the check always fails in the root compose (deployment/ overrides it) (Low | Operations | Quick Win | Confirmed)
- **Location**: `frontend/Dockerfile:44-45` (+ `frontend/src/middleware.ts:21`)
- **Finding**: The frontend image healthcheck calls GET /, which the auth middleware redirects (307) to /login, so the check always fails in the root compose (deployment/ overrides it).
- **Evidence**:
  ```
  HEALTHCHECK ... fetch('http://localhost:3000/')
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Point the healthcheck at /login or a dedicated /api/health route excluded from the middleware matcher.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Add frontend/src/app/api/health/route.ts returning 200, exclude it in the middleware matcher, and use it in the Dockerfile HEALTHCHECK.

### [OPS-008] Graceful shutdown has no timeout (keep-alive connections can block it) and compose healthchecks use liveness /health instead of /health/database for readiness (Low | Operations | Quick Win | Likely)
- **Location**: `backend/src/server.ts:17-23` (+ `deployment/docker-compose.yml`)
- **Finding**: Graceful shutdown has no timeout (keep-alive connections can block it) and compose healthchecks use liveness /health instead of /health/database for readiness.
- **Evidence**:
  ```
  server.close(() => process.exit(0))
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add a forced-exit timeout and prisma.$disconnect on shutdown; use /health/database for readiness.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In server.ts add a 10s forced exit timer after SIGTERM, call prisma.$disconnect(), and change the backend compose healthcheck to /api/v1/health/database.

### [ARCH-005] Every route handler repeats the same try { resolveAccessScope … new XService(companyId, scope) … } catch(next) boilerplate (Low | Architecture | Quick Win | Confirmed)
- **Location**: `backend/src/routes/products.routes.ts:18-60`
- **Finding**: Every route handler repeats the same try { resolveAccessScope … new XService(companyId, scope) … } catch(next) boilerplate.
- **Evidence**:
  ```
  try { const scope = await resolveAccessScope(req); const service = new ProductService(...); ... } catch (e) { next(e) }
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Add an asyncHandler and a scoped-service factory helper.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Create backend/src/http/handler.ts with asyncHandler(fn) and withScope(ServiceClass) helpers and refactor products.routes.ts as the pattern; then apply to other route files.

### [ARCH-003] The frontend API client still falls back to a fixed company UUID (not exploitable — the backend verifies access — but against project rules) (Low | Architecture | Quick Win | Confirmed)
- **Location**: `frontend/src/lib/api/backend-client.ts:16` (+ `deployment/docker-compose.yml:20`)
- **Finding**: The frontend API client still falls back to a fixed company UUID (not exploitable — the backend verifies access — but against project rules).
- **Evidence**:
  ```
  '00000000-0000-0000-0000-000000000001'
  ```
- **Breaks Rule**: PR-04
- **Blocked By**: none
- **Fix**: Remove the fallback; require an active company from the session.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In frontend/src/lib/api/backend-client.ts remove the hardcoded company UUID fallback and omit x-company-id when no company is selected.

### [SEC-015] The frontend /api/v1 proxy forwards path segments with encodeURIComponent, which leaves '..' unchanged; today this only reaches the public /health endpoint (Low | Security | Quick Win | Needs Review)
- **Location**: `frontend/src/app/api/v1/[...path]/route.ts:21`
- **Finding**: The frontend /api/v1 proxy forwards path segments with encodeURIComponent, which leaves '..' unchanged; today this only reaches the public /health endpoint.
- **Evidence**:
  ```
  `${backendInternalUrl()}/${path.map(encodeURIComponent).join('/')}`
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Reject '.' and '..' segments.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > In frontend/src/app/api/v1/[...path]/route.ts return 400 when any path segment is '.' or '..'.

### [ARCH-006] Mantine's full stylesheet and provider are loaded globally but no Mantine components are used; Inter loads via a render-blocking remote @import that fails on offline/on-prem installs (Low | Architecture | Quick Win | Confirmed)
- **Location**: `frontend/src/app/layout.tsx:3-4` (+ `frontend/src/app/globals.css:1`)
- **Finding**: Mantine's full stylesheet and provider are loaded globally but no Mantine components are used; Inter loads via a render-blocking remote @import that fails on offline/on-prem installs.
- **Evidence**:
  ```
  @import url('https://fonts.googleapis.com/css2?family=Inter...')
  ```
- **Breaks Rule**: none
- **Blocked By**: none
- **Fix**: Self-host Inter with next/font and remove Mantine if unused.
- **Verify**: re-run the affected flow and the related tests; for data findings, confirm Trial Balance and Balance Sheet differences are 0 and GL Inventory equals stock value.
- **Agent Prompt**:
  > Replace the Google Fonts @import with next/font (Inter) in layout.tsx, remove @mantine/core styles and provider if no component uses them, and remove the dependency.

