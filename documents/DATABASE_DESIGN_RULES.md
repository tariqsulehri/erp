# Database Design Rules

These rules apply to schema design, Prisma models, migrations, indexes, reporting tables, and transaction safety.

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

Every company-owned business table should include:

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
- a user-facing document number or voucher number
- approval fields when approval is required
- reversal/void fields when correction workflows are supported

## Multi-Company Safety

- Every company-owned table must have `companyId`.
- Every query must filter by `companyId` unless the table is truly global.
- Never trust company IDs from the frontend without checking user access.
- Unique keys should usually include `companyId`.

Examples:

```text
companyId + itemCode
companyId + invoiceNumber
companyId + warehouseCode
```

## Data Types

- Store Account Codes as text, not numbers.
- Use `Decimal` for money, quantity, price, cost, tax rate, discount rate, weight, and dimensions.
- Do not use floating point types for money or stock.
- Use consistent precision:
  - Money and prices: `Decimal(18, 4)`
  - Quantities: `Decimal(18, 4)`
  - Percentages: `Decimal(7, 4)`
  - Accounting totals: `Decimal(18, 2)` or higher when needed

## Master Data

Use configurable lookup tables for values users may manage.

Examples:

- category
- item group
- product type
- brand
- item size
- origin
- unit of measure
- warehouse
- location

Rules:

- Do not hard-code user-manageable values in application code.
- Lookup tables should include `companyId`, `isActive`, `createdAt`, and `updatedAt`.
- Use company-scoped unique keys for codes and names where needed.
- Use configurable item attribute tables for business-specific extra item details.
- Do not add one-off item master columns for fields that only one business or product group needs.

## General Settings

General application settings should use a company-scoped `general_settings` table for shared values:

- default country
- time zone
- locale
- date format
- time format
- currency code
- currency symbol
- currency display position, such as `prefix` or `suffix`
- decimal places
- thousand separator
- decimal separator

Each company should have one active general settings record.

## Account Codes

- Account Codes must be stored as 10-digit numeric text.
- Format: `MM GG SS PPPP`: Main Category, Group, Sub-Group, Posting Account.
- Example: `0101100001` means `01 01 10 0001`.
- Use `0100000000` to `0199999999` for Asset accounts.
- Use `0200000000` to `0299999999` for Liability accounts.
- Use `0300000000` to `0399999999` for Equity accounts.
- Use `0400000000` to `0499999999` for Revenue accounts.
- Use `0500000000` to `0599999999` for Expense accounts.
- Use `0103010001` to `0103999999` for Customer linked accounts.
- Use `0201010001` to `0201999999` for Supplier linked accounts.

## Party Accounting

- Customer and Supplier master records can be marked as `Customer And Supplier` when the same party works in both roles.
- Store `Main Role` so reports can identify whether the party started as a customer or supplier.
- In the current phase, keep one linked GL account for the party based on its main role.

## Transactions

- Create transaction document headers and lines inside one database transaction.
- Document/voucher numbers should be permanent and unique for the company data.
- Voucher number format should include type, year, and sequence, such as `JV-2026-0001`.
- Draft documents must not affect stock, supplier balances, customer balances, cash, bank, or ledger.
- Posting must happen inside a database transaction.
- Posting must be idempotent or protected from double posting.
- Posted documents should be locked.
- Corrections should use returns, reversals, debit notes, credit notes, voids, or adjustment documents.
- Multi-user posting must protect the same document and affected balance rows from being updated twice at the same time.

## Transaction Support Tables

Use shared support tables when the ERP module needs them:

- `cost_centers`
- `projects`
- `departments`
- `document_attachments`
- `document_approvals`
- `document_print_logs`

Line-level accounting documents should be able to store `costCenterId`, `projectId`, and `departmentId` when these dimensions are enabled.

Auto-reversing entries should store:

- `autoReverseDate`
- `reversalStatus`
- `reversalVoucherId`
- `reversalOfId`

Duplicate reference prevention should use company-scoped indexes or backend checks based on the business rule for each document type.

## Inventory

- `inventory_stock_movements` is the source of truth for stock history.
- `inventory_stock_balances` is a fast summary table for current stock.
- Every posted stock transaction must insert stock movement rows.
- Stock balance updates must happen in the same database transaction as movement inserts.
- Reports should read from stock movements and stock balances, not directly from every source document.
- Stock Transfer documents should store a header and lines, then post movement rows using `TRANSFER_OUT` and `TRANSFER_IN` with `STOCK_TRANSFER` as the source.
- Stock Transfer posting must lock affected stock balance rows before changing quantities.
- Do not mix warehouse-level stock and location-level stock inside the same location-controlled Warehouse.
- If `inventory_warehouses.use_locations = false`, stock may be held at Warehouse level with `location_id = null`.
- If `inventory_warehouses.use_locations = true`, every posted stock movement for that Warehouse must use a Warehouse Location.
- Location-controlled Warehouses should receive purchases into a default receiving/main Location first, then use Stock Transfer or Putaway to move stock to final shelf/bin Locations.
- Do not enable location control while a Warehouse has stock without a Location, and do not disable it while it has stock in Locations.

## Branch And Warehouse

- Use a `branches` table for business branches.
- Use `inventory_warehouses.branch_id` to connect Warehouses to Branches.
- Keep `branch_id` optional only while old data is being migrated. New sales, purchase, transfer, and stock screens should select a Branch when the workflow needs branch-wise control.
- Stock remains stored by `item_id + warehouse_id + location_id` in `inventory_stock_balances`.
- Branch stock reports should sum Warehouses for the selected Branch instead of storing duplicate branch stock rows.

## Accounting

- Posted financial documents should create ledger entries.
- All posted accounting transactions must create records in `vouchers` and `voucher_lines`.
- Business document tables store source totals, such as gross amount, discount amount, tax amount, freight amount, other charges, and net amount.
- `vouchers.total_debit` must equal the sum of related `voucher_lines.dr_amount`.
- `vouchers.total_credit` must equal the sum of related `voucher_lines.cr_amount`.
- `vouchers.total_debit` and `vouchers.total_credit` must always be equal.
- Ledger-style reports must read posted accounting impact from `voucher_lines` joined to `vouchers`, not by recalculating from source document tables.
- Do not update posted ledger entries directly.
- Use reversal entries for corrections.
- Accounting periods must be checked before posting.
- Control and system accounts should be protected from manual posting unless a controlled workflow is responsible for them.

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
- `companyId + documentDate + documentNumber` for stable paginated transaction lists
- `companyId + partyId + documentDate` for customer, supplier, and account history lists
- `companyId + status + documentDate` for draft, posted, void, and approval queues

Avoid over-indexing until there is a clear query need.

## Pagination

- Large ERP lists should be designed for database pagination from the start.
- Page-based pagination is acceptable for normal screens because staff need page numbers and total counts.
- Cursor pagination can be added later for very large audit logs or infinite-scroll activity lists.
- Queries used by paginated screens must have a stable `ORDER BY`, such as `documentDate DESC, documentNumber DESC, id DESC`.
- Do not paginate without deterministic ordering.
- List pages should select only the columns needed for the table.
- Load full headers, lines, notes, attachments, and print data from detail queries.
