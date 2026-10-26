---
name: node-js-code-review
description: Use this skill to review pull request code for Node.js backend applications. Trigger for PR reviews, code reviews, merge reviews, or risk checks involving Node.js, Express, TypeScript, REST APIs, Prisma, PostgreSQL, authentication, authorization, validation, background jobs, service layers, transactions, error handling, tests, or backend build changes.
---

# Node.js Code Review

Review the pull request as a senior backend reviewer. Prioritize correctness, data safety, security, transaction integrity, regressions, performance risks, and missing tests. Keep style comments secondary unless they hide a real maintainability or behavior problem.

## First Steps

1. Read repository guidance before reviewing:
   - `AGENTS.md` when present.
   - `CLAUDE.md` when present.
   - Project documents named by those files.
2. Identify the PR scope:
   - Prefer PR metadata when available.
   - Otherwise inspect `git status`, `git diff --stat`, and the diff against the likely base branch.
3. Read the changed files and nearby code, not only the diff, when behavior depends on routes, middleware, services, repositories, schemas, Prisma models, shared helpers, or environment setup.
4. Find line numbers from changed files before reporting issues.

## Node.js Backend Review Checks

Check for:

- Route handlers that contain business rules, posting logic, database-heavy work, or repeated validation that belongs in services, domain helpers, repositories, or schemas.
- Missing backend validation for required fields, types, ranges, statuses, dates, permissions, related records, and business invariants.
- Unsafe trust in frontend data such as company IDs, user IDs, roles, permissions, generated document numbers, calculated totals, prices, stock balances, or final accounting totals.
- Error handling that leaks stack traces, database errors, SQL messages, secrets, connection strings, or raw Prisma errors to users.
- Inconsistent API response shapes, unclear user-safe messages, swallowed exceptions, partial success without a clear result, and missing server-side logging context.
- Authentication and authorization gaps, especially missing permission checks, missing tenant/company scoping, and endpoints that allow cross-company reads or writes.
- Prisma query problems: missing `companyId` filters, loading too much related data, filtering or sorting in memory, non-deterministic pagination, unsafe raw SQL, and missing transaction boundaries.
- Data type mistakes such as using floating point numbers for money, quantity, price, tax, discount, cost, weight, dimensions, or account balances.
- Race conditions in create, update, posting, numbering, balance updates, and duplicate reference checks.
- Idempotency gaps where retrying a request can double-post, double-create, double-charge, or double-adjust data.
- Configuration issues such as hard-coded secrets, database URLs, company IDs, currency symbols, locales, time zones, account ranges, fiscal years, or environment-specific behavior.
- Build and runtime issues hidden by local dev: missing env vars, incorrect ESM/CommonJS imports, unhandled promises, long-running request work, process-level crashes, and unbounded memory growth.
- Test gaps around validation, permission branches, service rules, Prisma transactions, error paths, race-sensitive flows, and API contract changes.

## Express And API Checks

For Express or REST APIs, also check:

- Middleware order, request body limits, CORS, authentication guards, rate-sensitive endpoints, and route conflicts.
- Status codes that match the result: validation errors, unauthorized, forbidden, not found, conflict, and server errors.
- List endpoints with backend pagination, stable sorting, database-side filters, practical page-size limits, and pagination metadata.
- Detail endpoints that load heavy line items only when needed.
- Mutating endpoints that validate record status before update, post, reverse, void, delete, or restore.

## Prisma And PostgreSQL Checks

For Prisma or database changes, also check:

- Prisma camelCase fields map cleanly to snake_case database columns with `@map` where needed.
- Money, quantity, cost, price, tax rate, discount rate, weight, and dimensions use Decimal-safe handling.
- Company-owned records include company scoping and company-scoped uniqueness where needed.
- Migrations preserve existing data, include useful indexes for common filters, and avoid destructive changes without a safe migration path.
- Database transactions wrap document headers with lines, posting flows, voucher lines, stock movements, and balance updates.
- Queries used by paginated screens have deterministic ordering.

## ERP Project Checks

When reviewing this ERP repository, also check:

- Follow `documents/PROJECT_RULES.md`, `documents/CODING_STANDARDS.md`, `documents/BACKEND_BEST_PRACTICES.md`, and `documents/DATABASE_DESIGN_RULES.md`.
- For accounting, posting, stock, inventory, Prisma, reporting, or database changes, also follow:
  - `documents/ACCOUNTING_POSTING_RULES.md`
  - `documents/INVENTORY_TABLES.md`
  - `documents/INVENTORY_SCHEMA.md`
  - `documents/BANK_DEPOSIT_SCHEMA.md`
- Keep route handlers thin and place business rules, validation, posting, numbering, and transaction behavior in service/domain/repository/helper layers.
- Use 10-digit numeric text Account Codes and shared account-code helpers.
- Generate transaction numbers on the backend and keep them permanent.
- Draft documents must not affect stock, ledger, cash, bank, customer, or supplier balances.
- Posted documents must not be directly edited through normal update endpoints.
- Posted accounting impact must be stored in `vouchers` and `voucher_lines`; voucher totals must come from voucher lines and remain balanced.
- Every posted inventory transaction must create `inventory_stock_movements`; current stock snapshots belong in `inventory_stock_balances`.
- Stock, accounting, customer, supplier, bank, and cash balance updates must happen in the same transaction as their source movement or voucher lines.

## Useful Commands

Use commands that exist in the project. Prefer reading `package.json` before running them.

Common Node.js backend checks:

```bash
npm run lint
npm run type-check
npm run test
npm run build
npm run prisma:generate
```

If a command is missing, do not treat that as a failure by itself. Report the unavailable check.

## Review Output

Return findings first, ordered by severity. Use this format:

```markdown
**Findings**
- High: `path/to/file.ts:42` Clear description of the bug, why it matters, and the scenario that triggers it.
- Medium: `path/to/file.ts:87` Clear description...

**Open Questions**
- Question, if any.

**Checks Run**
- `npm run type-check` passed.
- `npm run build` failed: short reason.
```

If there are no findings, say that clearly and mention any checks that were not run. Keep summaries brief and secondary to the review findings.
