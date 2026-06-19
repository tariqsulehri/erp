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

## Backend Rule

Backend route handlers should stay thin. Put business rules in service/domain layers.

Backend API, service, validation, transaction, security, and error-handling rules belong in:

- `documents/BACKEND_BEST_PRACTICES.md`

## Database Rule

Database design must be clear, auditable, multi-company safe, and transaction-safe.

Database schema, Prisma, table, field, index, master-data, and transaction design rules belong in:

- `documents/DATABASE_DESIGN_RULES.md`

## Inventory Rule

Every posted inventory transaction must create a stock movement record.

- `inventory_stock_movements` is the source of truth for inventory history.
- `inventory_stock_balances` is a current stock snapshot for fast reads.
- Draft documents must not affect stock.
- Posted stock/accounting documents should not be directly edited.
