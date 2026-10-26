# Audit Config: ERP Platform (Financial & Inventory Management System)

Pre-filled for the Audit Kit at `/Users/tk-lpt-1088/development/react/erp/ERP/audit/kit`.
Fields follow `config.template.md` in the kit and align with the current project architecture.

| Field | Value |
|---|---|
| `PRODUCT` | ERP Platform (Multi-Company Financial & Inventory Management System) |
| `REPOS` | `/Users/tk-lpt-1088/development/react/erp/ERP` (Monorepo with `backend/` and `frontend/`) |
| `Workspace root` | `/Users/tk-lpt-1088/development/react/erp/ERP` (**Git Monorepo** containing both tiers, deployment configurations, and specifications) |
| `BRANCH` | `master` (and feature branches e.g. `feature/inventory-professional`). Base is `master`. |
| `MODE` | `AUDIT-ONLY` unless a prompt says otherwise |
| `DEPTH` | `standard` unless a prompt says otherwise |
| `INCLUDE` | `backend/src`, `backend/prisma`, `frontend/src`, `documents/`, `deployment/`, `docker-compose.yml`, `DESIGN.md`, `PRODUCT.md`, `REMEDIATION_PLAN.md`, `audit-report.html` |
| `EXCLUDE` | `node_modules`, `.next`, `dist`, `coverage`, `logs`, `.agents`, `.codex`, `.claude`, `*.tmp` |
| `DIMENSIONS` | security, architecture, data, performance, reliability, observability, testing, dependencies, accessibility, ux-design, code-health, documentation |
| `COMPLIANCE` | Financial auditability, multi-tenant isolation, immutable general ledger, IFRS/GAAP double-entry balance |
| `OUTPUT_DIR` | `/Users/tk-lpt-1088/development/react/erp/ERP/audit/results` |
| `PREVIOUS_RUN` | `audit-report.html` & `REMEDIATION_PLAN.md` (Generated October 17, 2026, Score: 57/100, 23 findings) |
| `GENERATE_STACK_DRAFT` | `false` |
| `TEAM_SIZE` | 1 (you) |
| `RELEASE_CADENCE` | Continuous delivery per feature branch |
| `CONFIDENTIALITY` | Confidential financial and enterprise data. |
| `Project module` | `/Users/tk-lpt-1088/development/react/erp/ERP/audit/project-standards.md`. Load it together with stack modules at Stage 3. |

## Hard Safety Rules For This Project

1. **Production Database Safety:** `backend/.env` may point at a staging or production database. Before running any database command, verify which host `DATABASE_URL` points at. If it points to remote/production: **strictly read-only. No drop, migrations, seeds, or writes of any kind.** In an audit, read `backend/prisma/schema.prisma` and migration SQL files directly.
2. **Double-Entry & Ledger Immutability:** Never bypass accounting posting rules. Posted documents (`vouchers`, `voucher_lines`, `inventory_stock_movements`) are strictly immutable. Corrections occur via reversals, voids, debit/credit notes, or return transactions.
3. **Multi-Tenant Isolation:** Every query must enforce `company_id`. The client passes tenant context via the `x-company-id` header, which the backend must cryptographically authorize against the authenticated session user's company list.
4. **Secrets Protection:** Never print raw values from `.env*` or deployment files. Mask sensitive database passwords and secrets.
5. **Commands:** Commands are executed from the monorepo root or with `--prefix backend` / `--prefix frontend`.

## Known And Accepted (Do Not Flag)

| Item | Reason |
|---|---|
| 10-Digit Account Codes (`MM GG SS PPPP`) | Architectural standard for Chart of Accounts (Main Category, Group, Sub-Group, Posting Account). Do not flag as non-standard. |
| Customer accounts `0103010001`–`0103999999` and Supplier accounts `0201010001`–`0201999999` | Approved 10-digit account ranges for party sub-ledgers. |
| Immutable posted vouchers and stock movements | Deliberate IFRS/GAAP accounting rule. Posted transactions cannot be edited directly; corrections require approved reversal workflows. |
| Unbalanced vouchers rejected at API gateway | Enforced double-entry rule: sum of line debits must strictly equal sum of line credits before any voucher is posted. |
| Settings-driven currency and date formats | Currency symbols (`$`, `Rs`) and date formats are read dynamically from company settings via `formatMoney` and `formatDate`. Never hardcoded in UI strings. |
| Soft stock movements in drafts | Draft sales and purchase orders do not affect stock balances; only posted movements alter `inventory_stock_balances`. |

## Decisions Already Made (Do Not Reopen)

- **Visual Design Standard:** "Calm Ledger" defined in [`DESIGN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/DESIGN.md). Restrained palette (Ledger Blue `#1f56c7`, White working surface `#ffffff`, Cool ground `#f5f6f8`, Navigation Navy `#182130`). Compact 32px controls, 36px table rows, 6px control radius, 8px container radius. Flat at rest, no decorative gradients, no raw hex in components.
- **Frontend Architecture:** Next.js 15 App Router orchestrator pattern. Large screens split into orchestrator page, child components, shared fields, hooks, and domain services (Purchase module pattern per [`documents/FRONTEND_BEST_PRACTICES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/FRONTEND_BEST_PRACTICES.md)).
- **Backend Architecture:** Express thin routes + domain services + Zod validation + Prisma ORM per [`documents/BACKEND_BEST_PRACTICES.md`](/Users/tk-lpt-1088/development/react/erp/ERP/documents/BACKEND_BEST_PRACTICES.md).
- **Two Themes Only:** Light and Dark. No third theme.

## Context The Agent Should Know

- **Frontend Stack:** Next.js 15.5+, React 19, TypeScript 5.8, Mantine 9 (`@mantine/core`, `@mantine/hooks`), TanStack Query v5, NextAuth.js, Tabler Icons, Decimal.js, date-fns, Zod.
- **Backend Stack:** Node.js 22+, Express 4.21, Prisma 6.19, PostgreSQL 16, TypeScript 5.8, Decimal.js (precision financial math), Zod, jsonwebtoken (Bearer JWT), Helmet, Morgan.
- **Orchestration:** Docker Compose (`docker-compose.yml`) running PostgreSQL (`erp_postgres`: 5432), Express API (`erp_backend`: 4000), and Next.js UI (`erp_frontend`: 3000).
- **Core Domain Modules:** Vouchers (PV, RV, JV, CV, DN, CN), Chart of Accounts, Fiscal Years & Periods, Inventory (Items, Categories, Brands, UOM, Warehouses, Locations, Stock Movements), Purchases & Returns, Sales & Returns, Bank Accounts & Cheques, Financial Reports (Balance Sheet, P&L, Trial Balance, General Ledger).
- **Authoritative Baseline:** Current audit findings and prioritized remediation tasks are tracked in [`REMEDIATION_PLAN.md`](/Users/tk-lpt-1088/development/react/erp/ERP/REMEDIATION_PLAN.md) and [`audit-report.html`](/Users/tk-lpt-1088/development/react/erp/ERP/audit-report.html).
