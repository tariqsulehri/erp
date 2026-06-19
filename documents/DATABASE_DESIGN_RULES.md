# Database Design Rules

## Naming

- Use clear plural table names, such as `inventory_items`, `sales_invoices`, and `purchase_payments`.
- Avoid short technical names, such as `inv_mst`, `stk_trn`, or `ap_pay`.
- Use field names that explain the business meaning.
- Use Prisma camelCase field names with snake_case database column mapping.

Examples:

- `itemCode` mapped to `item_code`
- `stockOnHand` mapped to `stock_on_hand`
- `purchasePrice` mapped to `purchase_price`

## Required Fields

Every business table should include:

- `companyId`
- `isActive`
- `createdAt`
- `updatedAt`

Important transaction tables should also include:

- `createdById`
- `updatedById`
- `postedById`
- `postedAt`
- `status`

## Multi-Company Safety

- Every company-owned table must have `companyId`.
- Every query must filter by `companyId` unless the table is truly global.
- Never trust company IDs from the frontend without checking user access.
- Unique keys should usually include `companyId`.

Example:

```text
companyId + itemCode
companyId + invoiceNumber
companyId + warehouseCode
```

## Money, Quantity, and Cost

- Use `Decimal` for money, quantity, price, cost, tax rate, discount rate, weight, and dimensions.
- Do not use floating point types for money or stock.
- Use consistent precision:
  - Money and prices: `Decimal(18, 4)`
  - Quantities: `Decimal(18, 4)`
  - Percentages: `Decimal(7, 4)`
  - Accounting totals: `Decimal(18, 2)` or higher if needed

## Master Data

Use configurable lookup tables for values users may manage:

- category
- item group
- product type
- brand
- item size
- origin
- unit of measure
- warehouse
- location

Do not hardcode these values in application code unless they are stable system behavior.

## Transactions

- Draft documents should not affect stock, supplier balances, customer balances, cash, bank, or ledger.
- Posting must happen inside a database transaction.
- Posting must be idempotent or protected from double posting.
- Posted documents should be locked.
- Corrections should use returns, reversals, debit notes, credit notes, or adjustment documents.

## Inventory

- `inventory_stock_movements` is the source of truth for stock history.
- `inventory_stock_balances` is a fast summary table for current stock.
- Every posted stock transaction must insert stock movement rows.
- Stock balance updates must happen in the same database transaction as movement inserts.
- Reports should read from stock movements and stock balances, not from every source document directly.

## Accounting

- Posted financial documents should create ledger entries.
- Do not update posted ledger entries directly.
- Use reversal entries for corrections.
- Accounting periods must be checked before posting.

## Audit

- Important changes must preserve who made the change and when.
- Posted transactions should keep immutable history.
- Soft deletion is preferred for master data that may be referenced by old transactions.

## Indexing

Add indexes for common filters:

- `companyId`
- `companyId + isActive`
- `companyId + documentDate`
- `companyId + status`
- `companyId + itemId`
- `companyId + warehouseId`

Avoid over-indexing until there is a clear query need.
