# Codebase Guide

A map of the BizTrack codebase for coding agents and new developers: what is where, how a business document
flows, which rules the code enforces, and how to change, test and ship safely. Read this first, then the rule
documents listed in `AGENTS.md` for the layer you change.

Last checked against the code: 2026-10-28 (commit `a5ec3e5`).

## 1. What This Is

BizTrack is a multi-company ERP: purchases, sales, returns, stock and accounting in one ledger.

| Part | Stack | Folder | Local port |
| --- | --- | --- | --- |
| Frontend | Next.js (App Router), React, TanStack Query, next-auth | `frontend/` | 3000 |
| Backend API | Node.js, Express, Prisma, Zod, raw SQL for posting | `backend/` | 4000 (`/api/v1`) |
| Database | PostgreSQL 17 | owned by `backend/prisma` | 5432 |

The frontend never touches the database. It calls the backend REST API through `frontend/src/lib/api/*`.

## 2. Repository Map

```text
backend/
  prisma/schema.prisma           Prisma models (database names are snake_case via @map)
  prisma/migrations/             SQL migrations, one folder per change (YYYYMMDDHHMMSS_name)
  prisma/fresh-install/schema.sql  Schema snapshot for new installs (refresh after each migration)
  scripts/                       db-snapshot.sh, db-fresh-install.sh
  src/routes/<name>.routes.ts    Thin Express handlers: parse with Zod, call a service, return JSON
  src/modules/<name>/            Schemas, services and business rules for one area
  src/modules/auth/access-rules.ts  Roles, access levels and the PERMISSION_ROLES table
  src/modules/inventory/stock-holder*.ts  Branch / Warehouse stock holder helpers and access checks
  src/modules/parties/invoice-balances.ts Paid and Balance Due per invoice (oldest first)
  src/scripts/                   seed-admin.ts, seed-demo-data.ts
  test/                          Vitest tests; *.integration.test.ts use a real database
frontend/
  src/app/(auth)/login/          Login page
  src/app/(dashboard)/<route>/   One folder per screen; page.tsx sets the tab title and renders a component
  src/components/<module>/       Screens and parts per module (purchases, sales, stock-adjustments, ...)
  src/components/documents/      Shared document parts: toolbars, lines, Draft / Reverse actions, status labels
  src/components/shell/nav-config.ts  Menu groups and pages (pages show as tabs)
  src/components/ui/             Shared controls; see COMPONENT_CATALOG.md and /design-system
  src/lib/api/                   One API client file per module (React Query hooks)
  src/lib/auth/                  Session user, hasPermission (mirror of the backend table), usePermission
  src/styles/themes/             Colour tokens; raw colours only in brand-palette.css
  tests/unit/                    Jest + React Testing Library
deployment/                      build-and-push.sh, deploy.sh, backup.sh, rollback.sh, status.sh
documents/                       Rules and reference documents (this file is the map)
```

## 3. Backend Pattern

Every route file follows the same shape:

```ts
function serviceFor(req: Request) {
  const scope = resolveAccessScope(req);            // company + the user's Branch / Warehouse
  return new StockAdjustmentService(scope.companyId, scope);
}

router.post('/:id/post', requirePermission('stock_adjustments.edit'), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    res.json(await serviceFor(req).post(id, currentUserId(req)));
  } catch (error) { next(error); }
});
```

- **Services hold all rules.** Large modules are split by job, for example `purchases/`: `purchase-draft`,
  `purchase-post`, `purchase-list`, `purchase-detail`, `purchase-validation`, `purchase-support`,
  `purchase-analytics`.
- **Errors** are thrown as `businessError(message, statusCode)`: 400 for rule breaks, 403 for access,
  404 for not found (also used for another place's document, so its existence is not revealed).
- **Messages are plain English** for staff, for example `Only Draft Stock Adjustments can be changed.`
- **Posting uses `prisma.$transaction` with raw SQL** and locks rows with `SELECT ... FOR UPDATE`.
  Long postings pass `POSTING_TRANSACTION_OPTIONS` (`maxWait 10s, timeout 30s`).

## 4. Business Documents

Seven document types share one lifecycle. Each lives in its own table with a lines table.

| Document | Number | Voucher | Stock effect | Backend module |
| --- | --- | --- | --- | --- |
| Purchase Voucher | `PI-YYYY-NNNN` | `PI` | In, at a Warehouse | `purchases` |
| Purchase Return | `PR-YYYY-NNNN` | `PR` | Out, at a Warehouse | `purchase-returns` |
| Sale Voucher | `SI-YYYY-NNNN` | `SI` | Out, at a Branch | `sales` |
| Sale Return | `SR-YYYY-NNNN` | `SR` | In, at a Branch | `sale-returns` |
| Stock Transfer | `ST-YYYY-NNNN` | none | Out of one place, into another | `stock-transfers` |
| Stock Adjustment | `SA-YYYY-NNNN` | `SA` | In or out | `stock-adjustments` |
| Opening Stock | `OS-YYYY-NNNN` | `OS` | In (first stock only) | `stock-adjustments` (`document_kind = 'Opening Stock'`) |

### Lifecycle

```text
Draft ──Post──▶ Posted ──Reverse (stock documents only)──▶ Voided (shown as "Reversed")
  │
  └─Cancel Draft (reason required)──▶ Voided (shown as "Cancelled")
```

- **Draft** has no stock or ledger effect. It can be opened and changed (`PUT /:id`); its number never changes.
- **Posted** documents are never edited. Corrections use returns, reversals or adjustments.
- **Voided** keeps `voided_by_id`, `voided_at` and `void_reason`. The screen shows *Cancelled* for a voided
  draft and *Reversed* for a voided document that has a `posted_at` (`documentStatusLabel`).
- **Numbers are never reused**, not even for cancelled drafts.

### Endpoints (same names on every document route)

| Endpoint | Does |
| --- | --- |
| `GET /` , `GET /:id` | List (filters include `status`) and detail |
| `GET /support-data` | Parties, items, places for the entry form |
| `POST /validate` | Returns `{ valid, errors, warnings }` without saving |
| `POST /drafts` | Save a new Draft |
| `POST /create-and-post` | Save and post in **one transaction**: if posting is refused, nothing is saved |
| `PUT /:id` | Change a Draft (every check runs again; the number stays) |
| `POST /:id/update-and-post` | Save changes and post in one transaction |
| `POST /:id/post` | Post a saved Draft |
| `POST /:id/cancel` | Cancel a Draft with `{ reason }` |
| `POST /:id/reverse` | Stock Transfers and Adjustments only: `{ reversal_date, reason }` |

Manual vouchers (`/vouchers`: `BRV`, `BPV`, `CRV`, `CPV`, `JV`, reversal `RV`) have their own flow:
Draft → request approval → approve → post. **Two-person rule:** whoever created a voucher or sent it for
approval cannot approve it. Never bypass this by writing to the database.

### Posting rules the code enforces

- Every posted stock change writes `inventory_stock_movements` (the history and source of truth) and updates
  `inventory_stock_balances` (a fast snapshot). Costing is weighted average.
- Every posted accounting effect is a row in `vouchers` + `voucher_lines` with equal debits and credits.
- **The Inventory account must equal total stock value.** Inventory Overview and the Stock Valuation report
  warn when they differ. Anything that changes stock value must post the matching voucher in the same
  transaction (Opening Stock posts `Dr Inventory / Cr Opening Balance Account`).
- Posting dates must fall in an open fiscal period (`assertDateInOpenPeriod`).
- A **reversal** gives back the exact posted cost of each line (not today's average) on a Reversal Date, and
  for adjustments posts an `RV` voucher that swaps every debit and credit of the `SA` / `OS` voucher. It is
  refused, with nothing changed, if the place no longer holds the stock or value to give back.
- **Opening Stock** is accepted once per item per Branch or Warehouse: only when that item has no stock
  movement there yet (checked when saving and again when posting).
- **Paid / Balance Due** of credit sales and purchases is not stored. `invoice-balances.ts` applies each
  party's payments, returns and other reductions to its oldest amounts first, like the Aging report.

## 5. Access And Permissions

- **Roles:** `admin`, `top_management`, `manager`, `accountant`, `sales_staff`, `warehouse_staff`, `viewer`.
- **Access levels:** `ALL_BRANCHES` (Admin, Top Management), `BRANCH` (one shop: sells), `WAREHOUSE`
  (one store: buys). Stock belongs to exactly one Branch or one Warehouse, optionally with a Location (shelf).
- The backend enforces both: `requirePermission(...)` on routes, and the scope check
  (`assertCanUseHolder`, `canUseHolder`) inside services.
- **`PERMISSION_ROLES` is defined three times and must stay identical:**
  `backend/src/modules/auth/access-rules.ts`, `frontend/src/lib/auth/session-user.ts`, and the full expected
  table in `backend/test/permissions.test.ts` (the test fails if any permission or role list differs). Add a
  matching plain message in `permissionActionText` in `backend/src/http/access-context.ts`.
- The frontend disables actions the role cannot use (`usePermission`, `roleCannotSave`) with a plain tooltip;
  the backend refuses them anyway.

## 6. Frontend Pattern

- `app/(dashboard)/<route>/page.tsx` sets `metadata.title` as `'<Page> — BizTrack'` and renders one component.
- A document screen is an orchestrator page (for example `PurchaseVoucherPage.tsx`) that switches between
  Analytics, List and Entry views and composes focused parts, hooks and helpers:
  `*Business.ts` (validation, payload, `*FormFromDetail` to open a Draft), `hooks/`, `components/`.
- Lists use the shared `components/documents` parts: `PostedListPanel`, Status filter
  (`DOCUMENT_STATUS_OPTIONS`, `STOCK_DOCUMENT_STATUS_OPTIONS`), `DraftDocumentActions`, `ReverseDocumentAction`.
- Data comes from React Query hooks in `lib/api/<module>.ts`; after a change call the module's
  `useInvalidate...Queries()` so lists and details refresh.
- To add a menu page, add it to `components/shell/nav-config.ts` (and update `tests/unit/shell/navigation.test.tsx`).
- UI rules: `DESIGN.md`, `documents/design/DESIGN_STANDARDS.md`, `documents/FRONTEND_BEST_PRACTICES.md`.
  Colours only through tokens (`npm run check:colors`), Title Case labels, right-aligned amounts, `*` on
  required fields, help (ⓘ) on every screen, formats from settings.

## 7. Commands And Checks

Run from the folder shown. All must pass before a commit.

```bash
cd backend  && npm run type-check && npm test            # Vitest (unit + database tests)
cd frontend && npm run type-check && npm run lint && npm run check:colors && npm test
npm run check:secrets && npm run test:secrets            # from the repository root
deployment/tests/lib.test.sh                             # when you change files in deployment/
```

- **Backend database tests** use `TEST_DATABASE_URL`, or `DATABASE_URL` from `backend/.env`. Each test file
  makes its own company with `createTestCompany()` (`test/support/test-database.ts`) and removes it after.
- **Frontend screen tests** render the real page and mock `next-auth/react` and `@/lib/api/<module>`. jsdom has
  no layout, so stub `Element.prototype.scrollIntoView` when a test opens a dropdown (`SearchableSelect`).
  See `tests/unit/purchases/purchase-voucher-page.test.tsx` for the pattern.
- Do not start the dev servers unless asked; the developer keeps the frontend running on port 3000.

## 8. Changing The Database

1. **Back up first** (`pg_dump -Fc`), and ask the owner before any change that removes or rewrites data.
2. Add `backend/prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`. Prefer additive changes
   (`ADD COLUMN IF NOT EXISTS`), and write the rollback steps in a comment at the top.
3. Update `schema.prisma` to match, then `npx prisma validate`, `npx prisma migrate deploy`, `npx prisma generate`.
4. Refresh the snapshot: `SNAPSHOT_DATABASE_URL=... scripts/db-snapshot.sh`, and commit it with the migration.
5. Raw-SQL CHECK constraints may limit values (for example `vouchers_voucher_type_check`); widen them in the
   migration when you add a new value.

## 9. Git And Delivery

- One branch per change; never commit straight to `master`. Commit only after the checks in section 7 pass.
- Do not push, merge, force-push or deploy unless the owner asks. `master` and `main` are both used.
- Never `git commit --no-verify`; the pre-commit hook runs the secret check.
- **Build and push images:** `deployment/build-and-push.sh` (Docker Desktop must run; images
  `tariqsulehri/erp-be` and `tariqsulehri/erp-fe`, tagged with a date version and `latest`, built for
  linux/amd64, which is slow on Apple Silicon). `--deploy` also deploys over SSH.
- **On the server** (`/deployments/erp`): `./deploy.sh <version>` backs up the database, runs pending migrations
  and starts the new containers (`erp_be`, `erp_fe`); `./backup.sh`, `./status.sh`, `./rollback.sh`.
  The server also runs other companies' apps: touch only the `erp_*` containers.
- The production image has no `tsx` or `src/`; run scripts there as `docker exec erp_be node dist/scripts/<name>.js`.

## 10. Data, Seeds And Known History

- `npm run seed:admin` creates the first Admin. `npm run seed:demo` (test environments only) posts demo
  documents through the real services; most carry reference `DEMO DATA`, demo sales use `CUST-PO-81xx`.
  It stops if branch `BR-DEMO` exists.
- `prisma/seed-inventory.ts` (old setup) writes opening stock **without a voucher**. On the test server this
  was corrected by Journal Voucher `JV-2026-0005` (reference `OPENING STOCK LEDGER FIX`). Use the Opening
  Stock screen for real opening stock.
- Commits `a095f86..0324d66` came from another agent (Antigravity) and broke several rules; they have since
  been fixed (see `documents/INVENTORY_CURRENT_STATE.md` and the git log). Check new work against the rules
  rather than copying patterns from that range.
- Current gaps and decisions for inventory: `documents/INVENTORY_CURRENT_STATE.md` and
  `documents/INVENTORY_TRACKING_ROADMAP.md`.

## 11. Common Mistakes To Avoid

- Writing posting logic in a route, or in two transactions (save, then post): use one transaction.
- Editing a posted document, or deleting stock movements or voucher lines: post a reversal instead.
- Changing stock value without the matching voucher (the Inventory warning will appear).
- Adding a permission in one place only (see section 5).
- Hard-coding company IDs, account IDs, currency, dates or fiscal years: read them from settings or the database.
- Raw hex colours in components, `==` comparisons (lint fails), or `Array.prototype.at` in tests (TS target).
- Shell `grep --include=*.ts` in zsh fails on the glob; quote it: `--include='*.ts'`.

## 12. Starting Another Agent (Antigravity, Codex, Cursor)

Some agents read `AGENTS.md` or `GEMINI.md` on their own, depending on version and settings. To be sure an
agent builds the right context, and to see what it understood before it changes anything, start each new
conversation with the context prompt below. The agent must open this repository folder on a branch that
has this guide.

### Context prompt (paste at the start of a new conversation)

```text
You are working in the BizTrack ERP repository (Next.js frontend in frontend/, Express + Prisma +
PostgreSQL backend in backend/). Before doing any task, build your context of this codebase.
Do not change any file in this step.

1. Read these files in this order:
   - AGENTS.md
   - documents/CODEBASE_GUIDE.md
   - documents/PROJECT_RULES.md
   - documents/CODING_STANDARDS.md
   - documents/DEFINITION_OF_DONE.md
   - documents/ACCOUNTING_POSTING_RULES.md
   - documents/INVENTORY_CURRENT_STATE.md
2. Open these to see the patterns in real code:
   - backend/src/routes/stock-adjustments.routes.ts
   - backend/src/modules/stock-adjustments/stock-adjustment.service.ts
   - backend/src/modules/auth/access-rules.ts
   - frontend/src/components/purchases/PurchaseVoucherPage.tsx
   - frontend/src/components/documents/index.ts
   - frontend/src/components/shell/nav-config.ts
   - backend/test/stock-adjustments.integration.test.ts
3. Then reply with a short summary in your own words:
   - how a route, service and transaction fit together in the backend;
   - the Draft → Post → Cancel / Reverse lifecycle and the endpoints every document uses;
   - the posting rules (one transaction, Inventory account equals stock value, posted documents never edited);
   - where permissions are defined and which three places must stay in sync;
   - the commands that must pass before a commit;
   - the working rules you must follow (branch per change, ask before push / deploy / data deletion,
     never bypass approvals or access checks, keep CODEBASE_GUIDE.md up to date).
4. List anything in the documents that looks unclear or contradicts the code.

Wait for my next message before making any change.
```

### If the agent only replies "ready" without a summary

Some agents skip step 3 and only say they made no changes. Ask for the summary before giving any task:

```text
Please give me the summary from step 3 now, in your own words, covering each point:
- how a route, service and transaction fit together in the backend;
- the Draft → Post → Cancel / Reverse lifecycle and the endpoints every document uses;
- the posting rules;
- where permissions are defined and which three places must stay in sync;
- the commands that must pass before a commit;
- the working rules you must follow.
Then list anything in the documents that looks unclear or contradicts the code.
```

### What a correct summary must say

Correct the agent before its first task if any point is missing or wrong:

1. **Backend:** routes only parse input and check the permission, then call a service. All business rules and
   posting live in services, in one database transaction, locking rows with `SELECT ... FOR UPDATE`.
2. **Lifecycle:** Draft → Post, or Draft → Cancel (with a reason). Posted Stock Transfers, Stock Adjustments
   and Opening Stock are undone with Reverse. Document numbers are never reused.
3. **Endpoints:** `POST /drafts`, `POST /create-and-post`, `PUT /:id`, `POST /:id/update-and-post`,
   `POST /:id/post`, `POST /:id/cancel`, and `POST /:id/reverse` for stock documents (section 4).
4. **Posting rules:** saving and posting happen in **one** transaction; posted documents are **never edited**;
   the **Inventory account must equal total stock value**.
5. **Permissions:** one table in three places that must match: `backend/src/modules/auth/access-rules.ts`,
   `frontend/src/lib/auth/session-user.ts` and `backend/test/permissions.test.ts` (section 5).
6. **Checks before commit:** backend type-check and tests; frontend type-check, lint, `check:colors` and tests;
   `npm run check:secrets` and `npm run test:secrets`; `deployment/tests/lib.test.sh` for deployment changes
   (section 7).
7. **Working rules:** a branch per change; ask before pushing, deploying, or deleting or dropping data; never
   bypass approvals, access checks or period locks; keep this guide up to date.

### Task prompt (start each later task with this)

```text
Follow AGENTS.md and documents/CODEBASE_GUIDE.md. Work on a new branch, reuse the shared parts named
in the guide, add or update tests, run every check in section 7 of the guide, and commit only when they
pass. Do not push, deploy or change the database without asking me first.

Task: <describe what you want>
```

### Tips

- **Check the agent's summary.** Correct anything wrong (for example "posted documents can be edited" or
  "save and post use two transactions") before it writes code.
- **One task per conversation.** Start a new conversation, with the context prompt again, for unrelated work.
- **Workspace or global rules:** if the agent has a rules setting, paste the lines from `GEMINI.md` there so
  they apply to every conversation.
- **Review before merging:** run the checks in section 7 on the agent's branch, or ask for a code review.
