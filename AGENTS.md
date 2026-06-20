# Agent Instructions

These instructions apply to all coding work in this repository.

## Required Reading Before Changes

Before making code or database changes, read and follow:

- `documents/PROJECT_RULES.md`
- `documents/CODING_STANDARDS.md`

For frontend work, also follow:

- `documents/FRONTEND_BEST_PRACTICES.md`

For backend work, also follow:

- `documents/BACKEND_BEST_PRACTICES.md`

For database, Prisma, inventory, stock, accounting, or reporting work, also follow:

- `documents/DATABASE_DESIGN_RULES.md`
- `documents/INVENTORY_TABLES.md`
- `documents/INVENTORY_SCHEMA.md`
- `documents/BANK_DEPOSIT_SCHEMA.md`

## Non-Negotiable Naming Rule

Use clear, descriptive names that are easy for non-native English speakers and less technical staff to understand.

- Use simple business words.
- Avoid unexplained abbreviations.
- Avoid professional-only jargon in labels, titles, descriptions, and field names.
- Prefer descriptive table names over short technical names.

Examples:

- Use `inventory_items`, not `inv_mst`.
- Use `inventory_stock_movements`, not `stk_trn`.
- Use `sales_price`, not `rate_out`.
- Use `blocked_reason`, not `inactive_meta`.

## Frontend Rule

Frontend forms must validate user input before calling the backend, but backend validation is still required.

Frontend UI, validation, theme, layout, voucher screen, and user-message rules belong in:

- `documents/FRONTEND_BEST_PRACTICES.md`

Sales, purchase, payment, receipt, voucher, stock, and future transaction screens must follow the shared transaction module rules in `documents/FRONTEND_BEST_PRACTICES.md`. Use the Purchase Voucher options as the reference pattern where applicable: entry view, posted/history list, backend filters, read-only detail view, print preview, print, and PDF download.

## Backend Rule

Backend route handlers should stay thin. Put business rules in service/domain layers.

Backend API, service, validation, transaction, security, and error-handling rules belong in:

- `documents/BACKEND_BEST_PRACTICES.md`

## Database Rule

Database design must be clear, auditable, multi-company safe, and transaction-safe.

Database schema, Prisma, table, field, index, master-data, and transaction design rules belong in:

- `documents/DATABASE_DESIGN_RULES.md`

## Account Code Rule

Use 10-digit numeric text for Account Codes.

- Account Codes follow `MM GG SS PPPP`: Main Category, Group, Sub-Group, Posting Account.
- Example: `0101100001` means `01 01 10 0001`.
- Customer linked accounts use `0103010001` to `0103999999`.
- Supplier linked accounts use `0201010001` to `0201999999`.
- Do not introduce older 4-digit, 6-digit, 7-digit, or 8-digit Account Code rules in new code.

## Inventory Rule

Every posted inventory transaction must create a stock movement record.

- `inventory_stock_movements` is the source of truth for inventory history.
- `inventory_stock_balances` is a current stock snapshot for fast reads.
- Draft documents must not affect stock.
- Posted stock/accounting documents should not be directly edited.
