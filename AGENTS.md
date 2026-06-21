# Agent Instructions

These instructions apply to all coding work in this repository.

## Required Reading Before Changes

Before making code or database changes, read and follow:

- `documents/PROJECT_RULES.md`
- `documents/CODING_STANDARDS.md`

For frontend work, also read:

- `documents/FRONTEND_BEST_PRACTICES.md`

For backend work, also read:

- `documents/BACKEND_BEST_PRACTICES.md`

For database, Prisma, inventory, stock, accounting, posting, or reporting work, also read:

- `documents/DATABASE_DESIGN_RULES.md`
- `documents/ACCOUNTING_POSTING_RULES.md`
- `documents/INVENTORY_TABLES.md`
- `documents/INVENTORY_SCHEMA.md`
- `documents/BANK_DEPOSIT_SCHEMA.md`

## Non-Negotiable Rules

### Simple Naming

Use clear, descriptive names that are easy for non-native English speakers and less technical staff to understand.

- Use simple business words.
- Avoid unexplained abbreviations.
- Avoid professional-only jargon in labels, titles, descriptions, and field names.
- Prefer descriptive table names over short technical names.
- Use Title Case for user-facing labels and table headings.

Examples:

- Use `inventory_items`, not `inv_mst`.
- Use `inventory_stock_movements`, not `stk_trn`.
- Use `sales_price`, not `rate_out`.
- Use `blocked_reason`, not `inactive_meta`.

### Modular Architecture

Every module must be scalable, reusable, readable, and easy to maintain.

- Do not put business logic, UI logic, validation, formatting, API calls, data mapping, styles, and print/report logic in one large file.
- Split large screens into focused files such as Entry View, List View, Detail View, Analytics View, Print Preview, Toolbar, Summary, Line Items, and shared filters.
- New frontend modules must follow the Purchase module pattern: page as orchestrator, focused child components, shared field controls, hooks for state/data shaping, helper files for validation/payload/business rules, API calls in `src/lib/api`, and separate print/report logic.
- Move reusable frontend controls to shared component files.
- Move reusable frontend helpers to shared library files.
- Move backend business rules to service/domain/repository/helper layers. Route handlers should stay thin.
- Reuse theme tokens, shared styles, constants, lookup tables, and settings instead of hard-coded values.
- Add comments only for important business rules, non-obvious calculations, concurrency/transaction behavior, or integration constraints.

### Frontend

- Frontend forms must validate user input before calling the backend, but backend validation is still required.
- Frontend UI, validation, theme, layout, voucher screen, and user-message rules belong in `documents/FRONTEND_BEST_PRACTICES.md`.
- Sales, purchases, payments, receipts, vouchers, stock, and future transaction screens must follow the shared transaction module rules in the frontend practices document.

### Backend

- Backend route handlers should stay thin.
- Put business rules, validation, posting, numbering, and transaction behavior in service/domain layers.
- Backend API, service, validation, transaction, security, and error-handling rules belong in `documents/BACKEND_BEST_PRACTICES.md`.

### Database

- Database design must be clear, auditable, multi-company safe, and transaction-safe.
- Database schema, Prisma, table, field, index, master-data, and transaction design rules belong in `documents/DATABASE_DESIGN_RULES.md`.

## Accounting Rules

Use 10-digit numeric text for Account Codes.

- Account Codes follow `MM GG SS PPPP`: Main Category, Group, Sub-Group, Posting Account.
- Example: `0101100001` means `01 01 10 0001`.
- Customer linked accounts use `0103010001` to `0103999999`.
- Supplier linked accounts use `0201010001` to `0201999999`.
- Do not introduce older 4-digit, 6-digit, 7-digit, or 8-digit Account Code rules in new code.

Posted accounting documents should not be directly edited. Use approved correction workflows such as reversal, void, return, debit note, credit note, or adjustment.

All posted accounting impact must be stored in `vouchers` and `voucher_lines`. Business document tables store source document totals, while `vouchers.total_debit` and `vouchers.total_credit` store the sum of accounting voucher lines.

## Inventory Rules

Every posted inventory transaction must create a stock movement record.

- `inventory_stock_movements` is the source of truth for inventory history.
- `inventory_stock_balances` is a current stock snapshot for fast reads.
- Draft documents must not affect stock.
- Posted stock/accounting documents should not be directly edited.
