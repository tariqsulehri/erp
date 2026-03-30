# ERP Financial Module — Developer Context & Planning Reference

> **Purpose:** This document captures every architectural decision, design choice,
> and planning detail agreed upon during the solution architecture sessions.
> Keep this file open while coding. It is the single source of truth.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Final Technology Stack](#2-final-technology-stack)
3. [Project Folder Structure](#3-project-folder-structure)
4. [Implementation Phases](#4-implementation-phases)
5. [Multi-Company Design](#5-multi-company-design)
6. [Chart of Accounts (COA)](#6-chart-of-accounts-coa)
7. [Voucher Types & Numbering](#7-voucher-types--numbering)
8. [Database Schema — All Tables](#8-database-schema--all-tables)
9. [Key Business Rules](#9-key-business-rules)
10. [Coding Patterns](#10-coding-patterns)
11. [Financial Reporting Suite](#11-financial-reporting-suite)
12. [Inventory Module (Phase 2)](#12-inventory-module-phase-2)

---

## 1. Project Overview

A **professional-grade, multi-company ERP Financial Module** built with Next.js.

- Complies with IFRS / GAAP double-entry accounting rules
- Configurable per company (fiscal year, COA, tax codes, currencies)
- Full audit trail — every mutation is versioned permanently
- Phase 1: Financial core (COA, Vouchers, Bank, PDC, AP/AR, Reports)
- Phase 2: Inventory integration (Purchase, Sales, Inventory Adjustment)
- Phase 3: Advanced (Budget, Multi-currency, Fixed Assets, Cost Centres)

---

## 2. Final Technology Stack

| Layer              | Technology                        | Reason                                              |
|--------------------|-----------------------------------|-----------------------------------------------------|
| Runtime            | **Node.js 22 LTS**                | Latest stable LTS (Oct 2024 - Oct 2027)            |
| Framework          | **Next.js 15 LTS (App Router)**   | Full-stack, Server Components for reports, SSR      |
| Language           | **TypeScript 5.8+**               | Financial correctness requires compile-time safety  |
| API Layer          | **tRPC 11+ (latest)**             | Type-safe, no schema duplication, zero boilerplate  |
| Database           | **PostgreSQL 16 LTS**             | ACID, complex queries, JSONB for audit diffs        |
| ORM                | **TypeORM 0.3.20+**               | Fine-grained transaction control for posting engine |
| Auth               | **Auth.js v5.1+**                 | JWT sessions, RBAC via middleware                   |
| Background Worker  | **BullMQ 5.0+** (separate Node)   | PDC jobs, period-close, async report generation     |
| Cache / Queue      | **Redis 7 LTS**                   | BullMQ broker, session cache                        |
| UI Components      | **Ant Design 5.17+**              | Enterprise-grade, built for data-heavy ERP UIs      |
| Data Grids         | **AG Grid Community 33+**         | Best-in-class for ledger/financial tables           |
| Money Math         | **Decimal.js 10.4+**              | Never use JS floats for money — ever                |
| PDF Output         | **Puppeteer 23+**                 | Server-side, pixel-perfect voucher/report rendering |
| Excel Export       | **ExcelJS 4.4+**                  | Native .xlsx with formatting                        |
| File Storage       | **MinIO / AWS S3 SDK v3.600+**    | Voucher attachments, archived exports               |
| Validation         | **Zod 3.23+**                     | DTO validation in tRPC + shared with frontend       |
| Testing            | **Jest 30+ / Supertest 6.3+ / Playwright 1.48+** | Unit, integration, end-to-end                       |
| Containers         | **Docker 27+ / Docker Compose 2.29+** | App container + Worker container                    |

---

## 3. Project Folder Structure

```
erp/
│
├── app/                              # Next.js App Router — PRESENTATION ONLY
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                  # All protected routes
│   │   ├── layout.tsx                # Main ERP shell (sidebar, header)
│   │   ├── accounts/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── vouchers/
│   │   │   ├── cash-payment/
│   │   │   │   ├── page.tsx          # List CPVs
│   │   │   │   ├── new/page.tsx      # Create CPV
│   │   │   │   └── [id]/page.tsx     # View / Print CPV
│   │   │   ├── cash-receipt/
│   │   │   ├── bank-payment/
│   │   │   ├── bank-receipt/
│   │   │   └── journal/
│   │   ├── bank/
│   │   │   ├── accounts/
│   │   │   ├── cheques/
│   │   │   ├── pdc/
│   │   │   └── reconciliation/
│   │   ├── payables/
│   │   ├── receivables/
│   │   ├── inventory/                # Phase 2
│   │   │   ├── items/
│   │   │   ├── purchase/
│   │   │   └── sales/
│   │   ├── reports/
│   │   │   ├── trial-balance/
│   │   │   ├── profit-loss/
│   │   │   ├── balance-sheet/
│   │   │   ├── ledger/
│   │   │   └── aging/
│   │   └── settings/
│   │       ├── company/
│   │       ├── fiscal-year/
│   │       ├── users/
│   │       └── tax/
│   │
│   └── api/trpc/[trpc]/route.ts      # tRPC HTTP entry point
│
│
├── modules/                          # ← THE HEART. Pure business logic.
│   │                                 #   Zero dependency on Next.js.
│   │                                 #   100% unit-testable in plain Node.
│   ├── accounts/
│   │   ├── account.entity.ts
│   │   ├── account.repository.ts
│   │   ├── account.service.ts
│   │   ├── account.types.ts
│   │   └── account.schema.ts         # Zod schemas
│   │
│   ├── vouchers/
│   │   ├── voucher.entity.ts
│   │   ├── voucher-line.entity.ts
│   │   ├── voucher.repository.ts
│   │   ├── voucher.service.ts        # Orchestrates workflow
│   │   ├── voucher.engine.ts         # Double-entry validation engine
│   │   ├── voucher.numbering.ts      # TYPE-FY-NNNNN key generator
│   │   ├── voucher.types.ts
│   │   └── voucher.schema.ts
│   │
│   ├── journal/
│   │   ├── journal-entry.entity.ts
│   │   ├── journal.repository.ts
│   │   └── journal.service.ts        # Posting engine — immutable GL records
│   │
│   ├── fiscal-year/
│   │   ├── fiscal-year.entity.ts
│   │   ├── fiscal-period.entity.ts
│   │   ├── fiscal-year.repository.ts
│   │   ├── fiscal-year.service.ts
│   │   └── period-guard.ts           # Validates posting dates vs open periods
│   │
│   ├── bank/
│   │   ├── bank-account.entity.ts
│   │   ├── cheque.entity.ts
│   │   ├── pdc.entity.ts
│   │   ├── reconciliation.entity.ts
│   │   ├── bank.service.ts
│   │   ├── cheque.service.ts
│   │   └── pdc.service.ts
│   │
│   ├── payables/
│   │   ├── supplier.entity.ts
│   │   ├── payables.repository.ts
│   │   └── payables.service.ts
│   │
│   ├── receivables/
│   │   ├── customer.entity.ts
│   │   ├── receivables.repository.ts
│   │   └── receivables.service.ts
│   │
│   ├── tax/
│   │   ├── tax-code.entity.ts
│   │   └── tax.service.ts
│   │
│   ├── companies/
│   │   ├── company.entity.ts
│   │   ├── company-group.entity.ts
│   │   ├── company.service.ts
│   │   └── coa-template.service.ts   # Stamps COA on company creation
│   │
│   └── inventory/                    # Phase 2
│       ├── item.entity.ts
│       ├── warehouse.entity.ts
│       ├── stock-movement.entity.ts
│       ├── purchase/
│       │   ├── purchase-order.entity.ts
│       │   ├── grn.entity.ts
│       │   ├── purchase-invoice.entity.ts
│       │   └── purchase.service.ts
│       ├── sales/
│       │   ├── sales-order.entity.ts
│       │   ├── sales-invoice.entity.ts
│       │   └── sales.service.ts
│       ├── adjustment/
│       │   └── adjustment.service.ts
│       └── costing/
│           ├── fifo.engine.ts
│           ├── avco.engine.ts
│           └── costing.service.ts
│
│
├── server/                           # tRPC layer — thin wrappers only
│   ├── trpc.ts                       # tRPC init + auth context + RBAC
│   ├── context.ts                    # Per-request: user, company, db
│   └── routers/
│       ├── _app.ts                   # Root router
│       ├── accounts.router.ts
│       ├── vouchers.router.ts
│       ├── bank.router.ts
│       ├── fiscal-year.router.ts
│       ├── reports.router.ts
│       ├── companies.router.ts
│       └── inventory.router.ts       # Phase 2
│
│
├── db/
│   ├── data-source.ts                # TypeORM DataSource config
│   ├── entities/index.ts             # Re-exports all entities
│   ├── migrations/                   # TypeORM migration files
│   └── seeds/                        # Default COA templates, roles, tax codes
│
│
├── worker/                           # Separate Docker container
│   ├── worker.ts                     # BullMQ entry point
│   └── jobs/
│       ├── pdc-maturity.job.ts       # Daily PDC clearing automation
│       ├── period-close.job.ts       # Period validation checks
│       └── report-export.job.ts      # Async large report generation
│
│
├── components/
│   ├── ui/                           # Base: Button, Input, Modal, Badge
│   ├── forms/                        # VoucherForm, AccountForm, etc.
│   ├── tables/                       # LedgerTable, AgingTable, etc.
│   └── layout/                       # Sidebar, Header, PageShell
│
│
└── lib/
    ├── auth/                         # Auth.js config
    ├── trpc/                         # tRPC client for React
    ├── decimal.ts                    # Decimal.js wrapper — ALL money math here
    ├── date.ts                       # Date helpers for fiscal year logic
    └── constants/
        ├── voucher-types.ts          # All type codes as constants
        └── account-types.ts          # Enums for account categories
```

### The Golden Rule

> **`app/` is thin. `modules/` is fat.**
>
> - `app/` = routing, layout, rendering only
> - `modules/` = all business logic, zero Next.js imports
> - `server/routers/` = validate input → call service → return result (3 lines max)

---

## 4. Implementation Phases

### Phase 1 — Financial Core (9–12 months)

| Month  | Deliverables                                                                 |
|--------|------------------------------------------------------------------------------|
| M1–M2  | Project setup, Docker, DB, Company Config, COA, User & Role Management      |
| M3–M4  | Fiscal Year & Periods, General Ledger engine, Journal Entry posting          |
| M5–M6  | Vouchers: CPV, CRV, JV — full workflow + double-entry validation             |
| M7     | Vouchers: BPV, BRV — Bank Payment and Receipt                               |
| M8     | Bank Accounts, Cheque Books, PDC Management, Bank Reconciliation             |
| M9     | Accounts Payable & Receivable sub-ledgers, Aging Reports                     |
| M10    | Tax Configuration, Tax Summary Reports                                       |
| M11    | Financial Reporting: Trial Balance, P&L, Balance Sheet, Cash Flow            |
| M12    | UAT, Performance Testing, Security Hardening, Go-Live                        |

### Phase 2 — Inventory (5–7 months after Phase 1 go-live)

| Month  | Deliverables                                                                 |
|--------|------------------------------------------------------------------------------|
| M1–M2  | Item Master, Warehouses, UOM, Costing Engine (FIFO / AVCO / Standard)       |
| M3–M4  | Purchase Flow: PO → GRN → PINV → BPV, 3-Way Matching, Inventory-GL Bridge  |
| M5–M6  | Sales Flow: SO → DN → SINV → BRV, COGS auto-posting                         |
| M6–M7  | Inventory Adjustment (IADJ), Stocktaking, Phase 2 Reports, UAT, Go-Live     |

### Phase 3 — Advanced Features

- Budget Module
- Multi-Currency + Exchange Rate Management
- Fixed Assets & Depreciation Schedules
- Cost Centre / Department Accounting
- Custom Report Builder
- External API Integration Layer

---

## 5. Multi-Company Design

### Three-Tier Structure

```
company_groups        ← Holding / Parent entity (consolidation)
    └── companies     ← Individual legal entities
            └── all other tables carry company_id
```

### Key Rule

Every table has `company_id`. The `BaseRepository` automatically injects
`WHERE company_id = :currentCompanyId` into every query. Business logic
never manually filters by company — it is invisible at the data layer.

### COA Template System

When a new company is created:
1. Admin selects a COA template (Standard Trading / Manufacturing / Services)
2. System auto-stamps all template accounts into `accounts` table for that company
3. Company can add custom accounts freely
4. Required/system accounts cannot be deactivated

### User Access Model

- One user can belong to **multiple companies** with different roles in each
- Switch companies via dropdown — no re-login required
- Session token re-scopes to new `company_id` on switch
- Group-level users can view consolidated reports across all companies in a group

### Inter-Company Accounts (added to standard COA)

```
10700001  IC Receivable        ← Current Asset  (system account)
20700001  IC Payable           ← Current Liability (system account)
```

When Company A pays on behalf of Company B, the system creates **mirror entries
in both companies in a single atomic transaction**, linked by `intercompany_ref_id`.

---

## 6. Chart of Accounts (COA)

### Structure Decision

| Decision         | Choice       | Reason                                          |
|------------------|--------------|-------------------------------------------------|
| Digit length     | **8 digits** | Never run out; 9,999 accounts per sub-group     |
| Levels           | **4**        | Deep enough for detail, simple enough for users |
| Tables           | **1 table**  | Self-referencing via code prefix                |
| Posting flag     | **is_posting** | Not `isParent` — unambiguous, never goes stale |

### 8-Digit Level Breakdown

```
Position 1      → Level 1  Category    (1 digit)
Position 1–2    → Level 2  Group       (2 digits)
Position 1–4    → Level 3  Sub-Group   (4 digits)
Position 1–8    → Level 4  Account     (last 4 = serial 0001–9999)
```

**Example:**
```
1               Assets                    Level 1 — Category
10              Current Assets            Level 2 — Group
1010            Cash & Cash Equivalents   Level 3 — Sub-Group
10100001        Petty Cash — Main         Level 4 — POSTING ✓
10100002        Petty Cash — Branch A     Level 4 — POSTING ✓
10200001        Bank — HBL Current        Level 4 — POSTING ✓
```

### Parent Lookup (no join needed)

```typescript
function getParentCode(code: string): string | null {
  if (code.length === 1) return null;         // Category — top level
  if (code.length === 2) return code.slice(0, 1);  // Group → Category
  if (code.length === 4) return code.slice(0, 2);  // Sub-Group → Group
  if (code.length === 8) return code.slice(0, 4);  // Account → Sub-Group
  return null;
}

// Get all posting accounts under Current Assets (1010x group)
// SELECT * FROM accounts WHERE company_id = ? AND code LIKE '10%' AND is_posting = true
```

### Standard COA — Category Allocation

| Digit | Category             | Normal Balance |
|-------|----------------------|----------------|
| 1     | Assets               | Debit          |
| 2     | Liabilities          | Credit         |
| 3     | Equity               | Credit         |
| 4     | Revenue              | Credit         |
| 5     | Cost of Goods Sold   | Debit          |
| 6     | Operating Expenses   | Debit          |
| 7     | Tax Expenses         | Debit          |
| 9     | Suspense & Control   | Varies         |

### Standard COA — Full Reference

```
1         ASSETS
├─ 10       Current Assets
│   ├─ 1010   Cash & Cash Equivalents
│   │   ├──── 10100001  Petty Cash — Main             POSTING
│   │   └──── 10100002  Petty Cash — Branch           POSTING
│   ├─ 1020   Bank Accounts
│   │   ├──── 10200001  Bank — Main Current Account   POSTING
│   │   ├──── 10200002  Bank — Payroll Account        POSTING
│   │   └──── 10200003  Bank — USD Account            POSTING
│   ├─ 1030   Trade Receivables
│   │   ├──── 10300001  AR Control A/C           ⚑   POSTING (Control)
│   │   └──── 10300002  AR — Export                  POSTING
│   ├─ 1040   Inventory
│   │   ├──── 10400001  Inventory — Raw Material      POSTING
│   │   ├──── 10400002  Inventory — WIP               POSTING
│   │   └──── 10400003  Inventory — Finished Goods    POSTING
│   ├─ 1050   Prepayments & Advances
│   │   ├──── 10500001  Prepaid Expenses              POSTING
│   │   ├──── 10500002  Advance to Suppliers          POSTING
│   │   └──── 10500003  Advance to Employees          POSTING
│   ├─ 1060   PDC Receivable
│   │   └──── 10600001  PDC Receivable           ⚑   POSTING (System)
│   ├─ 1070   Intercompany Receivables
│   │   └──── 10700001  IC Receivable            ⚑   POSTING (System)
│   └─ 1090   Other Current Assets
│       └──── 10900001  Other Current Assets          POSTING
│
└─ 11       Non-Current Assets
    ├─ 1110   PPE — Cost
    │   ├──── 11100001  Land & Building               POSTING
    │   ├──── 11100002  Machinery & Equipment         POSTING
    │   ├──── 11100003  Vehicles                      POSTING
    │   └──── 11100004  Office Equipment              POSTING
    ├─ 1120   Accumulated Depreciation
    │   ├──── 11200001  Dep — Building                POSTING
    │   ├──── 11200002  Dep — Machinery               POSTING
    │   ├──── 11200003  Dep — Vehicles                POSTING
    │   └──── 11200004  Dep — Office Equipment        POSTING
    ├─ 1130   Intangible Assets
    │   ├──── 11300001  Goodwill                      POSTING
    │   └──── 11300002  Software & Licenses           POSTING
    └─ 1140   Long-term Investments
        └──── 11400001  Investment in Subsidiaries    POSTING

2         LIABILITIES
├─ 20       Current Liabilities
│   ├─ 2010   Trade Payables
│   │   └──── 20100001  AP Control A/C           ⚑   POSTING (Control)
│   ├─ 2020   Short-term Borrowings
│   │   ├──── 20200001  Bank Overdraft                POSTING
│   │   └──── 20200002  Short-term Loan               POSTING
│   ├─ 2030   Accrued Liabilities
│   │   ├──── 20300001  Accrued Salaries              POSTING
│   │   └──── 20300002  Accrued Expenses              POSTING
│   ├─ 2040   Tax Payable
│   │   ├──── 20400001  VAT / GST Payable        ⚑   POSTING (System)
│   │   ├──── 20400002  Input Tax Recoverable    ⚑   POSTING (System)
│   │   └──── 20400003  WHT Payable                   POSTING
│   ├─ 2050   PDC Payable
│   │   └──── 20500001  PDC Payable              ⚑   POSTING (System)
│   ├─ 2060   Customer Advances
│   │   └──── 20600001  Advance from Customers        POSTING
│   ├─ 2070   Intercompany Payables
│   │   └──── 20700001  IC Payable               ⚑   POSTING (System)
│   └─ 2090   Other Current Liabilities
│       └──── 20900001  Other Payables                POSTING
│
└─ 21       Non-Current Liabilities
    ├─ 2110   Long-term Loans
    │   └──── 21100001  Long-term Bank Loan            POSTING
    └─ 2120   Deferred Tax
        └──── 21200001  Deferred Tax Liability         POSTING

3         EQUITY
└─ 30       Equity
    ├─ 3010   Share Capital
    │   └──── 30100001  Ordinary Share Capital         POSTING
    ├─ 3020   Reserves
    │   └──── 30200001  General Reserve                POSTING
    ├─ 3030   Retained Earnings
    │   └──── 30300001  Retained Earnings         ⚑   POSTING (System)
    └─ 3040   Current Year P&L
        └──── 30400001  Current Year P&L          ⚑   POSTING (System)

4         REVENUE
└─ 40       Revenue
    ├─ 4010   Sales Revenue
    │   ├──── 40100001  Sales — Local                  POSTING
    │   └──── 40100002  Sales — Export                 POSTING
    ├─ 4020   Service Revenue
    │   └──── 40200001  Service Income                 POSTING
    ├─ 4030   Sales Returns
    │   └──── 40300001  Sales Returns                  POSTING
    └─ 4090   Other Income
        ├──── 40900001  Interest Income                POSTING
        ├──── 40900002  Rental Income                  POSTING
        └──── 40900003  Gain on Asset Disposal         POSTING

5         COST OF GOODS SOLD
└─ 50       Cost of Sales
    ├─ 5010   Direct Materials
    │   └──── 50100001  Cost of Sales — Products       POSTING
    ├─ 5020   Direct Labor
    │   └──── 50200001  Direct Wages                   POSTING
    ├─ 5030   Purchase Returns
    │   └──── 50300001  Purchase Returns               POSTING
    └─ 5040   Manufacturing Overhead
        └──── 50400001  Factory Overhead               POSTING

6         OPERATING EXPENSES
└─ 60       Expenses
    ├─ 6010   Personnel Costs
    │   ├──── 60100001  Salaries & Wages               POSTING
    │   ├──── 60100002  Employee Benefits              POSTING
    │   └──── 60100003  Staff Gratuity                 POSTING
    ├─ 6020   Occupancy
    │   ├──── 60200001  Rent Expense                   POSTING
    │   └──── 60200002  Utilities                      POSTING
    ├─ 6030   Depreciation & Amortisation
    │   ├──── 60300001  Depreciation Expense           POSTING
    │   └──── 60300002  Amortisation Expense           POSTING
    ├─ 6040   Marketing & Sales
    │   ├──── 60400001  Advertising & Marketing        POSTING
    │   └──── 60400002  Sales Commission               POSTING
    ├─ 6050   Finance Charges
    │   ├──── 60500001  Bank Charges                   POSTING
    │   ├──── 60500002  Loan Interest Expense          POSTING
    │   └──── 60500003  Exchange Loss                  POSTING
    ├─ 6060   Admin & General
    │   ├──── 60600001  Office Supplies                POSTING
    │   ├──── 60600002  Travel & Entertainment         POSTING
    │   ├──── 60600003  Legal & Professional Fees      POSTING
    │   └──── 60600004  Insurance                      POSTING
    └─ 6090   Miscellaneous
        └──── 60900001  Miscellaneous Expenses         POSTING

7         TAX EXPENSES
└─ 70       Tax
    └─ 7010   Income Tax
        ├──── 70100001  Current Tax Expense            POSTING
        └──── 70100002  Deferred Tax Expense           POSTING

9         SUSPENSE & CONTROL
└─ 90       Control Accounts
    ├─ 9010   Suspense
    │   └──── 90100001  Suspense Account          ⚑   POSTING (System)
    ├─ 9020   Clearing
    │   ├──── 90200001  GRN Clearing Account      ⚑   POSTING (System)
    │   └──── 90200002  Inventory Adjustment A/C  ⚑   POSTING (System)
    └─ 9030   Rounding
        └──── 90300001  Rounding Difference        ⚑   POSTING (System)

⚑ = System Account — engine posts only, manual journal entry BLOCKED
```

---

## 7. Voucher Types & Numbering

### Numbering Format

```
[TYPE] - [FY] - [NNNNN]

TYPE  = Voucher type code (2–5 chars)
FY    = Fiscal year shortcode (e.g. 2425 for FY 2024-25)
NNNNN = 5-digit zero-padded sequence, resets each FY per type

Examples:
  CPV-2425-00001    First Cash Payment in FY 2024-25
  BRV-2425-00047    47th Bank Receipt in FY 2024-25
  JV-2425-00003     3rd Journal Voucher in FY 2024-25
  PINV-2425-00123   123rd Purchase Invoice in FY 2024-25
  PDC-I-2425-00012  12th PDC Issued in FY 2024-25
```

The combination of `TYPE + FY + NNNNN` is **globally unique for all time**.
Once assigned, a voucher number is **permanent and immutable**.

### Phase 1 — Financial Voucher Types

| Code    | Name                        | Debit                  | Credit                 |
|---------|-----------------------------|------------------------|------------------------|
| CPV     | Cash Payment Voucher        | Expense / Asset / AP   | Cash Account           |
| CRV     | Cash Receipt Voucher        | Cash Account           | Income / AR / Liability|
| BPV     | Bank Payment Voucher        | Expense / Asset / AP   | Bank GL Account        |
| BRV     | Bank Receipt Voucher        | Bank GL Account        | Income / AR / Liability|
| JV      | Journal Voucher             | Any Account            | Any Account            |
| OBV     | Opening Balance Voucher     | Balance Sheet Accounts | Balance Sheet Accounts |
| PDC-I   | PDC Issued                  | AP (20100001)          | PDC Payable (20500001) |
| PDC-R   | PDC Received                | PDC Receivable(10600001)| AR (10300001)         |
| DN      | Debit Note (Vendor)         | AP (20100001)          | Purchase Returns       |
| CN      | Credit Note (Customer)      | Sales Returns          | AR (10300001)          |
| RV      | Reversal Voucher            | Mirror of original     | Mirror of original     |

### Phase 2 — Inventory Voucher Types

| Code    | Name                     | Inventory Impact | GL Impact                              |
|---------|--------------------------|------------------|----------------------------------------|
| PINV    | Purchase Invoice         | Stock In         | Dr Inventory / Cr AP                   |
| SINV    | Sales Invoice            | Stock Out        | Dr AR / Cr Revenue + Dr COGS / Cr Inv  |
| PRN     | Purchase Return Note     | Stock Out        | Dr AP / Cr Inventory                   |
| SRN     | Sales Return Note        | Stock In         | Dr Inventory / Cr AR                   |
| GRN     | Goods Receipt Note       | Stock In         | No GL until matched to PINV            |
| PO      | Purchase Order           | None             | None (commitment only)                 |
| SO      | Sales Order              | Reserve Stock    | None                                   |
| IADJ    | Inventory Adjustment     | Stock ±          | Dr/Cr Inventory / Cr/Dr Adj A/C        |

### Voucher Workflow (all types)

```
DRAFT → SUBMITTED → APPROVED → POSTED → (REVERSED)
                               ↑
                    Only this state writes to journal_entries
                    Once POSTED: immutable forever
                    Corrections: only via RV (Reversal Voucher)
```

---

## 8. Database Schema — All Tables

> All tables include: `created_by UUID`, `created_at TIMESTAMP`,
> `updated_by UUID`, `updated_at TIMESTAMP`, `deleted_at TIMESTAMP` (soft delete)
> All monetary amounts: `NUMERIC(18,4)` — never FLOAT

### Multi-Company Tables

```sql
company_groups
  id UUID PK, code VARCHAR, name VARCHAR,
  reporting_currency VARCHAR, is_active BOOLEAN

companies
  id UUID PK, group_id UUID FK(company_groups) NULLABLE,
  code VARCHAR UNIQUE, name VARCHAR, legal_name VARCHAR,
  registration_no VARCHAR, tax_id VARCHAR,
  base_currency VARCHAR, fiscal_year_type VARCHAR,
  coa_template_id UUID FK(coa_templates),
  status VARCHAR  -- ACTIVE | INACTIVE | SUSPENDED

coa_templates
  id UUID PK, name VARCHAR, description VARCHAR,
  is_default BOOLEAN, is_system BOOLEAN

coa_template_accounts
  id UUID PK, template_id UUID FK(coa_templates),
  code VARCHAR(8), name VARCHAR, level SMALLINT,
  account_type VARCHAR, normal_balance VARCHAR,
  is_posting BOOLEAN, is_system BOOLEAN,
  is_control BOOLEAN, is_required BOOLEAN
```

### Chart of Accounts

```sql
accounts
  id UUID PK,
  company_id UUID FK(companies),          -- ALWAYS present
  template_account_id UUID FK NULLABLE,   -- traceability to template
  code VARCHAR(8),                        -- '10100001'
  parent_code VARCHAR(4),                 -- '1010'
  level SMALLINT,                         -- 1 | 2 | 3 | 4
  name VARCHAR(100),
  account_type VARCHAR,                   -- ASSET|LIABILITY|EQUITY|REVENUE|EXPENSE
  normal_balance VARCHAR,                 -- DEBIT | CREDIT
  is_posting BOOLEAN,                     -- true only for level 4
  is_system BOOLEAN,                      -- engine-managed, no manual entry
  is_control BOOLEAN,                     -- AP/AR control accounts
  is_required BOOLEAN,                    -- cannot be deactivated
  is_active BOOLEAN,

  UNIQUE (company_id, code)
```

### Fiscal Year & Periods

```sql
fiscal_years
  id UUID PK, company_id UUID,
  code VARCHAR,          -- 'FY2425'
  start_date DATE, end_date DATE,
  status VARCHAR,        -- DRAFT|ACTIVE|SOFT_CLOSED|HARD_CLOSED
  closed_at TIMESTAMP, closing_jv_id UUID

fiscal_periods
  id UUID PK, fiscal_year_id UUID FK, company_id UUID,
  period_number SMALLINT, name VARCHAR,
  start_date DATE, end_date DATE,
  status VARCHAR         -- DRAFT|OPEN|SOFT_CLOSED|HARD_CLOSED
```

### Voucher System

```sql
voucher_series
  id UUID PK, company_id UUID,
  voucher_type VARCHAR,   -- 'CPV'|'BPV'|'JV' etc.
  fiscal_year_id UUID FK,
  last_number INT DEFAULT 0,
  padding SMALLINT DEFAULT 5,
  UNIQUE (company_id, voucher_type, fiscal_year_id)

vouchers
  id UUID PK, company_id UUID,
  voucher_number VARCHAR,    -- 'CPV-2425-00001' — immutable once set
  voucher_type VARCHAR,
  date DATE,
  fiscal_period_id UUID FK,
  status VARCHAR,            -- DRAFT|SUBMITTED|APPROVED|POSTED|REVERSED|REJECTED
  narration TEXT,
  total_debit NUMERIC(18,4),
  total_credit NUMERIC(18,4),
  reference VARCHAR,         -- external reference
  reversed_by UUID NULLABLE, -- FK to reversal voucher
  intercompany_ref_id UUID NULLABLE

voucher_lines
  id UUID PK, voucher_id UUID FK, company_id UUID,
  account_code VARCHAR(8),   -- denormalized for performance
  account_id UUID FK(accounts),
  debit_amount NUMERIC(18,4) DEFAULT 0,
  credit_amount NUMERIC(18,4) DEFAULT 0,
  narration TEXT,
  tax_code_id UUID NULLABLE,
  tax_amount NUMERIC(18,4),
  cost_center_id UUID NULLABLE,
  sort_order SMALLINT

journal_entries                -- IMMUTABLE — never updated, never deleted
  id UUID PK, company_id UUID,
  voucher_id UUID FK,
  account_id UUID FK,
  account_code VARCHAR(8),
  debit NUMERIC(18,4),
  credit NUMERIC(18,4),
  date DATE,
  fiscal_period_id UUID FK,
  running_balance NUMERIC(18,4)
```

### Bank & PDC

```sql
bank_accounts
  id UUID PK, company_id UUID,
  code VARCHAR, bank_name VARCHAR, branch VARCHAR,
  account_number VARCHAR, account_type VARCHAR,
  currency VARCHAR, gl_account_id UUID FK(accounts),
  iban VARCHAR, swift VARCHAR, status VARCHAR

cheque_books
  id UUID PK, bank_account_id UUID FK, company_id UUID,
  book_number VARCHAR, series_from VARCHAR, series_to VARCHAR,
  status VARCHAR

cheques
  id UUID PK, cheque_book_id UUID FK, company_id UUID,
  cheque_number VARCHAR,
  status VARCHAR,  -- AVAILABLE|RESERVED|ISSUED|CLEARED|BOUNCED|CANCELLED|PDC_PENDING|PDC_PRESENTED
  voucher_id UUID NULLABLE, cleared_date DATE, returned_date DATE

pdc_records
  id UUID PK, company_id UUID, cheque_id UUID FK,
  type VARCHAR,              -- ISSUED | RECEIVED
  party_id UUID,             -- supplier or customer
  amount NUMERIC(18,4),
  pdc_date DATE,             -- maturity date
  status VARCHAR,            -- PENDING|PRESENTED|CLEARED|BOUNCED
  originating_voucher_id UUID,
  maturity_voucher_id UUID NULLABLE

bank_reconciliations
  id UUID PK, company_id UUID,
  bank_account_id UUID FK, fiscal_period_id UUID FK,
  statement_date DATE,
  statement_balance NUMERIC(18,4),
  gl_balance NUMERIC(18,4),
  difference NUMERIC(18,4),
  status VARCHAR             -- DRAFT|COMPLETED|LOCKED
```

### AP / AR

```sql
suppliers
  id UUID PK, company_id UUID,
  code VARCHAR, name VARCHAR, tax_id VARCHAR,
  payment_terms INT,  -- days
  default_expense_account VARCHAR(8),
  bank_details JSONB, is_active BOOLEAN

customers
  id UUID PK, company_id UUID,
  code VARCHAR, name VARCHAR, tax_id VARCHAR,
  credit_limit NUMERIC(18,4), payment_terms INT,
  is_active BOOLEAN

-- AP / AR transactions link to voucher_lines via reference
-- Sub-ledger balance = sum of voucher_lines for that party
-- Must always equal GL control account balance
```

### Tax

```sql
tax_codes
  id UUID PK, company_id UUID,
  code VARCHAR,   -- 'VAT15' | 'WHT5' | 'EXEMPT'
  name VARCHAR,
  type VARCHAR,   -- OUTPUT | INPUT | WITHHOLDING
  rate NUMERIC(5,2),
  output_account_id UUID FK,
  input_account_id UUID FK,
  effective_from DATE,
  effective_to DATE NULLABLE
```

### Users & Access

```sql
users
  id UUID PK, email VARCHAR UNIQUE,
  name VARCHAR, password_hash VARCHAR, is_active BOOLEAN

user_companies
  id UUID PK, user_id UUID FK, company_id UUID FK,
  role VARCHAR,  -- ADMIN|FINANCE_MANAGER|SR_ACCOUNTANT|ACCOUNTANT|DATA_ENTRY|CASHIER|AUDITOR
  is_default BOOLEAN

user_group_access
  id UUID PK, user_id UUID FK, group_id UUID FK,
  can_view_consolidated BOOLEAN
```

### Audit Trail (append-only, separate schema)

```sql
audit_logs
  id UUID PK,
  company_id UUID, user_id UUID,
  table_name VARCHAR, record_id UUID,
  operation VARCHAR,    -- INSERT | UPDATE | DELETE
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR,
  session_id VARCHAR,
  created_at TIMESTAMP  -- never updated_at — append only
```

### Performance Cache (add when needed, not on day 1)

```sql
account_period_balances   -- pre-computed, rebuilt on each posting
  id UUID PK, company_id UUID,
  account_id UUID FK, fiscal_period_id UUID FK,
  opening_debit NUMERIC(18,4), opening_credit NUMERIC(18,4),
  period_debit NUMERIC(18,4),  period_credit NUMERIC(18,4),
  closing_debit NUMERIC(18,4), closing_credit NUMERIC(18,4)
```

---

## 9. Key Business Rules

### Double-Entry Rule (non-negotiable)
```
Total Debit Lines = Total Credit Lines (to 4 decimal places)
Enforced in: voucher.engine.ts — before any status transition to POSTED
```

### Period Lock Rule
```
OPEN         → posting allowed for all roles
SOFT_CLOSED  → posting allowed for FINANCE_MANAGER and above only
HARD_CLOSED  → NO posting allowed by anyone, including ADMIN
```

### Immutable Posting Rule
```
Once status = POSTED:
  - voucher record: read-only
  - voucher_lines: read-only
  - journal_entries: read-only forever

Corrections = new RV (Reversal Voucher) + new corrected voucher
```

### Control Account Rule
```
Accounts where is_control = true:
  - 10300001 (AR Control)
  - 20100001 (AP Control)

These accounts: BLOCKED for direct JV posting by all users
Updated ONLY by AR/AP module service layer
```

### System Account Rule
```
Accounts where is_system = true:
  - PDC Receivable (10600001)
  - PDC Payable (20500001)
  - VAT Payable (20400001)
  - Input Tax (20400002)
  - Retained Earnings (30300001)
  - Current Year P&L (30400001)
  - All 9xxxxx suspense/clearing accounts

These accounts: BLOCKED for manual journal entry
Posted ONLY by the respective engine (PDC engine, tax engine, closing engine)
```

### Money Rule
```typescript
// ALWAYS use Decimal.js — never native JS arithmetic on money
import { Decimal } from '@/lib/decimal';

// BAD — never do this
const total = 10.1 + 20.2;  // = 30.299999999999997

// GOOD — always do this
const total = new Decimal('10.10').plus('20.20').toFixed(4);  // = '30.3000'
```

### Year-End Closing Rule
```
P&L accounts (4x, 5x, 6x, 7x) → zeroed out, balance transferred to 30300001
Balance Sheet accounts (1x, 2x, 3x) → carry forward as opening balance
Closing JV is auto-generated, cannot be manually edited, only approved/rejected
```

---

## 10. Coding Patterns

### BaseRepository — Auto Company Scoping

```typescript
// lib/base.repository.ts
export class BaseRepository<T extends { companyId: string }> {
  constructor(
    private repo: Repository<T>,
    private ctx: RequestContext  // { companyId, userId } from JWT
  ) {}

  find(where: FindOptionsWhere<T>) {
    return this.repo.find({
      where: { ...where, companyId: this.ctx.companyId as any }
    });
  }

  findOne(where: FindOptionsWhere<T>) {
    return this.repo.findOne({
      where: { ...where, companyId: this.ctx.companyId as any }
    });
  }

  save(data: DeepPartial<T>) {
    return this.repo.save({ ...data, companyId: this.ctx.companyId } as any);
  }
}
```

### tRPC Router — Always Thin

```typescript
// server/routers/vouchers.router.ts
postVoucher: protectedProcedure
  .input(PostVoucherSchema)           // 1. Validate input with Zod
  .mutation(async ({ input, ctx }) => {
    return voucherService.post(       // 2. Call service
      input.voucherId,
      ctx.user
    );                                // 3. Return result
  }),
// Never more than these 3 steps in a router procedure
```

### Voucher Posting — Atomic Transaction

```typescript
// modules/vouchers/voucher.service.ts
async post(voucherId: string, user: User): Promise<Voucher> {
  return this.db.transaction(async (queryRunner) => {

    const voucher = await this.voucherRepo.findById(voucherId);

    // 1. Period check
    await this.periodGuard.assertOpen(voucher.date, user.role);

    // 2. Double-entry validation
    await this.voucherEngine.validate(voucher);

    // 3. All DB writes in single transaction
    await this.voucherRepo.updateStatus(voucherId, 'POSTED', queryRunner);
    await this.journalService.createEntries(voucher, queryRunner);
    await this.auditService.log('VOUCHER_POSTED', voucher, user, queryRunner);

    return voucher;
    // Commits here — or rolls back everything on any error
  });
}
```

### Voucher Number Generator

```typescript
// modules/vouchers/voucher.numbering.ts
async generateNumber(
  type: VoucherType,
  fiscalYearId: string,
  companyId: string,
  queryRunner: QueryRunner
): Promise<string> {
  // Pessimistic lock to prevent race conditions
  const series = await queryRunner.manager.findOne(VoucherSeries, {
    where: { voucherType: type, fiscalYearId, companyId },
    lock: { mode: 'pessimistic_write' }
  });

  const next = series.lastNumber + 1;
  const fyCode = series.fiscalYear.code.replace('FY', ''); // 'FY2425' → '2425'
  const padded = String(next).padStart(series.padding, '0'); // 5 → '00001'

  await queryRunner.manager.update(VoucherSeries,
    { id: series.id },
    { lastNumber: next }
  );

  return `${type}-${fyCode}-${padded}`;  // 'CPV-2425-00001'
}
```

### Decimal Money Wrapper

```typescript
// lib/decimal.ts
import Decimal from 'decimal.js';
Decimal.set({ precision: 18, rounding: Decimal.ROUND_HALF_UP });
export { Decimal };

// Usage everywhere money is involved:
export function addMoney(a: string, b: string): string {
  return new Decimal(a).plus(b).toFixed(4);
}

export function isBalanced(debits: string[], credits: string[]): boolean {
  const totalDr = debits.reduce((sum, d) => sum.plus(d), new Decimal(0));
  const totalCr = credits.reduce((sum, c) => sum.plus(c), new Decimal(0));
  return totalDr.equals(totalCr);
}
```

---

## 11. Financial Reporting Suite

All reports are generated real-time from `journal_entries`.
Every report supports: company filter, date/period filter, PDF export, Excel export.

| Report                    | Source Table(s)                         |
|---------------------------|-----------------------------------------|
| Trial Balance             | journal_entries grouped by account      |
| General Ledger            | journal_entries per account with running balance |
| Income Statement (P&L)    | journal_entries where account 4x–7x    |
| Balance Sheet             | journal_entries where account 1x–3x    |
| Cash Flow Statement       | journal_entries + voucher types         |
| AP Aging                  | voucher_lines + suppliers               |
| AR Aging                  | voucher_lines + customers               |
| Bank Reconciliation       | bank_reconciliations + cheques          |
| Voucher Register          | vouchers filtered by type/period        |
| Day Book (Cash/Bank)      | vouchers where type IN CPV,CRV,BPV,BRV |
| Tax Summary               | voucher_lines where tax_code_id != null |
| PDC Status Report         | pdc_records                             |
| Intercompany Report       | journal_entries across companies in group |

---

## 12. Inventory Module (Phase 2)

### Costing Methods (set per item or company-wide)

| Method   | Description                                     |
|----------|-------------------------------------------------|
| FIFO     | First In First Out — oldest cost leaves first   |
| AVCO     | Weighted Average Cost — recalculated on each receipt |
| Standard | Fixed standard cost — variances posted separately |

### Purchase Flow

```
Purchase Order (PO)
    ↓
Goods Receipt Note (GRN)     → Stock In at PO price
    ↓                           Dr Inventory / Cr GRN Clearing (90200001)
Purchase Invoice (PINV)      → Match to GRN
    ↓                           Dr GRN Clearing / Cr AP (20100001)
Bank/Cash Payment (BPV/CPV)  → Settle AP
                                Dr AP / Cr Bank
```

### Sales Flow

```
Sales Order (SO)             → Reserve stock only
    ↓
Delivery Note (DN)           → Stock Out at cost
    ↓                           Dr COGS / Cr Inventory
Sales Invoice (SINV)         → Revenue recognition
    ↓                           Dr AR / Cr Revenue
Bank/Cash Receipt (BRV/CRV)  → Settle AR
                                Dr Bank / Cr AR
```

### Inventory-GL Bridge Rule

> Every inventory movement and its GL journal entry are committed
> in a **single database transaction**. Both succeed or both fail.
> There is no state where stock moved but GL was not updated.

---

## Quick Reference — Common GL Entries

| Transaction                        | Debit              | Credit             |
|------------------------------------|--------------------|--------------------|
| Pay supplier by cheque             | AP — 20100001      | Bank — 102xxxxx    |
| Receive cash from customer         | Cash — 101xxxxx    | AR — 10300001      |
| Issue PDC to supplier              | AP — 20100001      | PDC Payable 20500001|
| PDC matures (auto BPV)             | PDC Payable 20500001| Bank — 102xxxxx   |
| Receive PDC from customer          | PDC Rec. 10600001  | AR — 10300001      |
| PDC deposited (auto BRV)           | Bank — 102xxxxx    | PDC Rec. 10600001  |
| Depreciation charge                | Dep. Exp 60300001  | Accum. Dep 11200001|
| Purchase inventory on credit       | Inventory 104xxxxx | AP — 20100001      |
| Sell goods on credit (revenue)     | AR — 10300001      | Sales — 40100001   |
| Sell goods (COGS — auto)           | COGS — 50100001    | Inventory 104xxxxx |
| Year-end close net profit          | Curr. P&L 30400001 | Retained Earn. 30300001 |

---

*Last updated: March 2026 — v1.0*
*This document should be committed to the root of the ERP repository as `CONTEXT.md`*
