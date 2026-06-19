# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Professional-grade, multi-company ERP Financial Module (Next.js 15 App Router + TypeScript + PostgreSQL/TypeORM + tRPC). Phase 1 (Financial Core: COA, Vouchers, Bank, AP/AR, Reports) is in progress; Phase 2 (Inventory) has Item/UOM/Category foundations started; Phase 3 (Budget, Multi-currency, Fixed Assets) is not started.

## Commands

```bash
npm run dev                 # Next dev server (localhost:3000)
npm run build                # Production build
npm run lint                 # ESLint, --max-warnings 0 (zero tolerance)
npm run type-check            # tsc --noEmit
npm run test                  # Jest (jsdom env)
npm run test:watch
npm run test:coverage
npx jest path/to/file.test.ts            # run a single test file
npx jest -t "test name substring"        # run tests matching a name

npm run docker:up / docker:down / docker:logs   # Postgres + Redis + MinIO via docker-compose

npm run db:migrate            # run pending TypeORM migrations (ts-node, tsconfig.typeorm.json)
npm run db:migrate:revert     # revert last migration
npm run db:migrate:show       # list migrations + status
npm run db:migrate:generate --name=AddX   # generate empty migration (still targets dist/, needs build first)
npm run db:seed               # seed COA templates/roles (run after build, executes dist/db/seeds/index.js)

npm run worker:dev            # BullMQ worker (tsx watch), separate process from the Next app
```

Migrations run directly against TypeScript source via `tsconfig.typeorm.json` (a CommonJS/ts-node variant of `tsconfig.json` that excludes `src/app` and `src/components`). `db:seed` and `db:migrate:generate` still expect a compiled `dist/`, so run `npm run worker:build` (tsc) first if you need those.

`tests/unit`, `tests/integration`, `tests/e2e` exist as empty scaffolding — there are no test files yet. Jest coverage thresholds in `jest.config.js` are higher for `src/modules/` (80%) and `src/lib/` (90%) than the global default (50%), reflecting where business logic must be tested.

## Architecture

### Thin app, fat modules

- `src/app/` — Next.js App Router, presentation only. `(auth)` and `(dashboard)` route groups.
- `src/modules/` — all business logic (entities, repositories, services, Zod schemas). Zero Next.js imports; should be testable in plain Node.
- `src/server/routers/` — tRPC routers. Each procedure: validate input with Zod → call a module service → return result. Keep them thin; `src/server/trpc.ts` defines `publicProcedure`/`protectedProcedure`/`requireRole(...)` middleware, `src/server/context.ts` builds per-request `Context` (user from NextAuth JWT, `company_id`, TypeORM `db`, redis).
- `src/db/` — `data-source.ts` (TypeORM DataSource), `base.entity.ts`, `base.repository.ts`, `migrations/`, `seeds/`.
- `src/worker/` — separate BullMQ process (not bundled into the Next app), run via `worker:dev`/`worker:build`.

### Multi-company scoping

Every entity extends `BaseEntity` (`src/db/base.entity.ts`): `id`, `company_id`, timestamps, `*_user_id` audit columns, soft delete (`is_deleted`, `deleted_at`). `BaseRepository<T>` (`src/db/base.repository.ts`) wraps (does not extend) a TypeORM `Repository<T>`; call `setCompanyId()` once per request and the helper methods (`findOneById`, `findAllInCompany`, `findWithPagination`, `createEntity`, `markAsDeleted`, `existsInCompany`, ...) auto-inject `company_id` and `is_deleted: false`. Methods like `find`/`findOne`/`count` that take raw TypeORM options do **not** auto-scope — callers must add `company_id` themselves when using those escape hatches.

### Chart of Accounts — current scheme is 6-digit, not 8-digit

`account.entity.ts` and `coa-template.service.ts` are the source of truth. **`CONTEXT.md` and `CHART_OF_ACCOUNTS.md` describe an earlier 8-digit/4-digit design and are out of date** — don't follow them for COA structure.

Current hierarchy (`accounts.code`, `VARCHAR(10)`, check constraint `^[0-9]{6,10}$`):
```
X00000  L1 Category    (divisible by 100000)   e.g. 100000 Assets
XX0000  L2 Group       (divisible by  10000)   e.g. 110000 Current Assets
XXX000  L3 Sub-Group   (divisible by   1000)   e.g. 113000 Trade Receivables
XXXX00  L4 Sub-Detail  (divisible by    100)
XXXXX0  L5 Segment     (divisible by     10)
XXXXXX  L6 Posting     (not divisible by 10)   — only these accept journal entries (is_posting = true)
```
Parent code = floor to the next-larger divisor (e.g. `113111` → `113110` → `113100` → `113000` → `110000` → `100000`).

Sub-ledger accounts use 7-digit codes and are never COA hierarchy pivots:
- `1300001`–`1399999` — AR debtors (customers), 99,999 capacity per company
- `2100001`–`2199999` — AP creditors (suppliers), 99,999 capacity per company

`CustomerService`/`SupplierService` auto-create a posting GL account in these ranges on create (`nextArAccountCode`/equivalent scans the range for the first unused integer) and keep the account name in sync when the customer/supplier name changes. Categories for inventory items can be created inline from the product form rather than requiring a separate setup step.

Migration 9 (`src/db/migrations/9_widen_account_code.ts`) converted in place from the old 4-digit scheme (non-posting header codes get `00` appended, posting leaf codes get `01` appended) — it does not truncate data, unlike migration 3 which preceded it.

### Money math

Never use native JS arithmetic on monetary values. Use `src/lib/decimal.ts`, which wraps `decimal.js` (configured `precision: 18, rounding: ROUND_HALF_UP`) and exposes `money()`, `add`/`subtract`/`multiply`/`divide`, `sum`, `isZero`, `compare`, `round`, `formatCurrency`, etc. All `NUMERIC` DB columns for amounts should be treated as strings/Decimals at the boundary, not floats.

### Path aliases

`@/*` → `src/*`, plus narrower aliases (`@/modules/*`, `@/server/*`, `@/db/*`, `@/lib/*`, `@/components/*`, `@/worker/*`, `@/types/*`, `@/tests/*`) defined identically in `tsconfig.json` and `jest.config.js` — keep both in sync if adding a new top-level `src/` folder.

### Voucher/journal model (per CONTEXT.md, largely still being implemented)

Vouchers move `DRAFT → SUBMITTED → APPROVED → POSTED → (REVERSED)`; only the transition to `POSTED` writes immutable `journal_entries` rows. Corrections after posting are done via a Reversal Voucher (RV) plus a new corrected voucher — never by editing posted records. Voucher numbers follow `TYPE-FY-NNNNN` (e.g. `CPV-2425-00001`) and are permanent once assigned. Accounts flagged `is_system` (PDC clearing, tax control, retained earnings, suspense) or `is_control` (AR/AP control accounts) are blocked from direct manual journal entry — only the relevant engine posts to them.

## Notes on the docs in this repo

- `README.md` — quick start / install steps, mostly accurate.
- `CONTEXT.md` — large original architecture/planning doc; **COA section (8-digit) is superseded**, but voucher numbering, fiscal year/period rules, business rules (double-entry, period lock, immutable posting), and the database schema sketch for non-COA tables are still useful as design intent (not all of it is implemented yet — check the actual module before assuming a table/field exists).
- `CHART_OF_ACCOUNTS.md` / `FISCAL_YEAR.md` — point-in-time "implementation complete" snapshots for those modules; useful for the intended method/repository surface but may drift from current code (e.g. COA digit count). Prefer reading the entity/service files directly.
- `TESTING_GUIDE.md`, `SETUP.md` — testing conventions and local setup respectively.
