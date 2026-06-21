# Project Documents

This folder contains the rules and reference documents used while building the ERP.

## How To Use These Documents

Start with:

1. `PROJECT_RULES.md`
2. `CODING_STANDARDS.md`

Then read the layer-specific document for the work being done:

- Frontend work: `FRONTEND_BEST_PRACTICES.md`
- Backend work: `BACKEND_BEST_PRACTICES.md`
- Database, Prisma, accounting, inventory, stock, or reporting work: `DATABASE_DESIGN_RULES.md`
- Accounting posting work: `ACCOUNTING_POSTING_RULES.md`

Schema reference documents should be used when working on their specific modules.

## Files

| File | Purpose |
| --- | --- |
| `PROJECT_RULES.md` | Business-wide rules: naming, settings, parties, account codes, transactions, inventory, and rule ownership. |
| `CODING_STANDARDS.md` | Shared engineering standards for modularity, reuse, validation, transactions, comments, and data types. |
| `FRONTEND_BEST_PRACTICES.md` | Frontend-specific standards for UI, forms, validation, transaction screens, theming, and accessibility. |
| `BACKEND_BEST_PRACTICES.md` | Backend-specific standards for APIs, services, posting, validation, security, and errors. |
| `DATABASE_DESIGN_RULES.md` | Database and Prisma standards for naming, multi-company safety, audit, indexes, pagination, and transaction tables. |
| `ACCOUNTING_POSTING_RULES.md` | Accounting source-of-truth and posting rules for vouchers, voucher lines, source document totals, and module postings. |
| `INVENTORY_TABLES.md` | Inventory table names and simple descriptions. |
| `INVENTORY_SCHEMA.md` | Inventory tables, fields, and plain-English field descriptions. |
| `BANK_DEPOSIT_SCHEMA.md` | Bank account and bank deposit voucher tables with plain-English field descriptions. |

## Most Important Rule

Keep labels, field names, descriptions, table names, and titles easy to understand for non-native speakers and less technical staff.
