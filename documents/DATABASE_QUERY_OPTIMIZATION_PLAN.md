# Database Query Optimization Plan

## Purpose

This document reviews the current ERP query patterns from a Senior Database Administrator point of view and defines a practical plan to make the queries faster, safer, and easier to maintain.

The goal is not only to make individual queries faster. The goal is to keep the system reliable as transaction volume grows across vouchers, ledger reports, sales, purchases, inventory, banks, customers, and suppliers.

## Review Scope

Reviewed areas:

- Voucher list, voucher detail, approval, and posting queries
- Ledger, Trial Balance, Profit And Loss, Balance Sheet, and dashboard reporting queries
- Chart Of Accounts list and balance calculation queries
- Bank Account list and current balance queries
- Sales Invoice, Purchase Invoice, Sale Return, and Purchase Return list queries
- Inventory product, stock balance, stock movement, stock transfer, and stock adjustment query patterns
- Existing Prisma schema indexes where models are present
- Raw SQL patterns using Prisma `$queryRaw` and `$queryRawUnsafe`

## Current Strengths

- Most business queries are company-scoped, which is essential for multi-company ERP safety.
- Financial reports correctly read accounting impact from `vouchers` and `voucher_lines`.
- Draft documents are separated from posted accounting impact.
- Several transaction list queries already use database pagination with `LIMIT` and `OFFSET`.
- Important master data tables already have company-scoped unique keys.
- Bank Account list uses a good pattern: page first, then calculate posted balances only for the page rows.
- Report aggregation queries use parameterized raw SQL in several places, which is better than loading all rows into application memory.

## High Priority Risks

### 1. Ledger And Financial Reports Need Stronger Composite Indexes

The most important reports repeatedly join:

- `voucher_lines`
- `vouchers`
- `accounts`

Common filters:

- `company_id`
- `status = 'Posted'`
- `voucher_date`
- `account_id`

Current indexes on `vouchers` and `voucher_lines` help, but they do not fully match the heavy report access pattern. As data grows, Trial Balance, Ledger, Profit And Loss, and Balance Sheet reports may become slow because the database must join and aggregate too many rows.

Recommended indexes:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vouchers_company_status_date_id
ON vouchers (company_id, status, voucher_date, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vouchers_company_status_date_number_id
ON vouchers (company_id, status, voucher_date DESC, voucher_number DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_lines_company_account_voucher
ON voucher_lines (company_id, account_id, voucher_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_lines_company_voucher_account
ON voucher_lines (company_id, voucher_id, account_id);
```

Expected benefit:

- Faster Ledger report for one account
- Faster Trial Balance and Balance Sheet aggregations
- Faster Profit And Loss report for date ranges
- Lower CPU and buffer reads during month-end reporting

### 2. Transaction Lists Aggregate Line Counts For All Matching Documents

Sales, purchases, and return list queries calculate line counts using subqueries such as:

```sql
SELECT sale_invoice_id, COUNT(*) AS line_count
FROM sale_invoice_lines
WHERE company_id = $1
GROUP BY sale_invoice_id
```

This calculates counts for all rows in the company before paging. For large companies, this becomes expensive even when the user only needs 50 rows.

Recommended pattern:

```sql
WITH page_rows AS (
  SELECT si.id
  FROM sale_invoices si
  WHERE si.company_id = $1
  ORDER BY si.sale_date DESC, si.sale_number DESC, si.id DESC
  LIMIT $2 OFFSET $3
),
line_counts AS (
  SELECT sil.sale_invoice_id, COUNT(*) AS line_count
  FROM sale_invoice_lines sil
  JOIN page_rows pr ON pr.id = sil.sale_invoice_id
  WHERE sil.company_id = $1
  GROUP BY sil.sale_invoice_id
)
SELECT ...
FROM page_rows pr
JOIN sale_invoices si ON si.id = pr.id
LEFT JOIN line_counts lc ON lc.sale_invoice_id = si.id;
```

Apply this to:

- `sale-list.service.ts`
- `purchase-list.service.ts`
- `sale-return-list.service.ts`
- `purchase-return-list.service.ts`

Expected benefit:

- Line count work becomes proportional to the visible page, not the whole company.
- Large invoice lists remain responsive.

### 3. Count Queries Join Tables Even When Not Needed

Current list count queries often join customers, suppliers, warehouses, and locations even when the user is not searching those names.

Recommended pattern:

- Count from the document header table only when filters are on document fields.
- Add joins only when search requires customer, supplier, warehouse, or location text.
- Keep count query and data query logically equivalent.

Example:

```sql
SELECT COUNT(*)::int AS total
FROM sale_invoices si
WHERE si.company_id = $1
  AND si.status = $2;
```

Only join customer and warehouse tables when `search` includes party or warehouse fields.

Expected benefit:

- Faster pagination counts
- Less lock and buffer pressure on master tables

### 4. Document Number Generation Can Race Under Concurrent Users

Several modules generate the next document number by reading the current last number and adding one.

Observed pattern:

- `ORDER BY document_number DESC`
- `LIMIT 1`
- parse last sequence
- add one

This may create duplicate number attempts when two users save at the same time.

Recommended design:

Create a company-scoped counter table:

```sql
CREATE TABLE document_number_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  document_type text NOT NULL,
  fiscal_year integer NOT NULL,
  next_number integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, document_type, fiscal_year)
);
```

Use row-level locking inside the same transaction:

```sql
SELECT next_number
FROM document_number_counters
WHERE company_id = $1
  AND document_type = $2
  AND fiscal_year = $3
FOR UPDATE;
```

Then update the counter and build the formatted document number.

Apply to:

- Vouchers
- Sales Invoices
- Purchase Invoices
- Sale Returns
- Purchase Returns
- Stock Transfers
- Stock Adjustments
- Customers and suppliers if code generation must be concurrent-safe

Expected benefit:

- Professional, audit-safe numbering
- No race condition during concurrent creation
- Less dependence on string sorting

### 5. Search Queries Use Leading Wildcards

Many searches use:

```sql
ILIKE '%search%'
```

or Prisma `contains`.

This is user-friendly but cannot use a normal B-tree index effectively.

Recommended plan:

Enable PostgreSQL trigram search for high-use text fields:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

Add GIN trigram indexes only on heavily searched columns:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_name_trgm
ON accounts USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm
ON customers USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_name_trgm
ON suppliers USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_items_name_trgm
ON inventory_items USING gin (item_name gin_trgm_ops);
```

For document numbers and account codes, prefer prefix search when possible:

```sql
WHERE voucher_number ILIKE 'JV-2026-%'
```

Expected benefit:

- Faster user search on names
- Reduced sequential scans on master data
- Keeps account code and document number search efficient

## Recommended Index Plan

### Vouchers

Use these for voucher list, approval queue, posting queue, and reports:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vouchers_company_status_date_id
ON vouchers (company_id, status, voucher_date, id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vouchers_company_type_status_date
ON vouchers (company_id, voucher_type, status, voucher_date DESC, voucher_number DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vouchers_company_approval_status_date
ON vouchers (company_id, approval_status, status, voucher_date DESC, id DESC);
```

Notes:

- Keep the existing unique key on `(company_id, voucher_number)`.
- Do not remove existing indexes until production query plans are reviewed.

### Voucher Lines

Use these for account ledgers, trial balance, balance sheet, profit and loss, bank balances, customer balances, and supplier balances:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_lines_company_account_voucher
ON voucher_lines (company_id, account_id, voucher_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_lines_company_voucher_account
ON voucher_lines (company_id, voucher_id, account_id);
```

Optional after measuring:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voucher_lines_company_account_amounts
ON voucher_lines (company_id, account_id)
INCLUDE (voucher_id, dr_amount, cr_amount);
```

### Accounts

Existing account indexes are useful. Add only if report and list plans prove the need:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_company_code_posting_active
ON accounts (company_id, code, is_posting, is_active, is_deleted);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_company_type_posting_code
ON accounts (company_id, account_type, is_posting, code);
```

Use trigram indexes only if account name search is slow:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_name_trgm
ON accounts USING gin (name gin_trgm_ops);
```

### Sales And Purchase Document Headers

Use one stable list index for each major document:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_invoices_company_status_date_number_id
ON sale_invoices (company_id, status, sale_date DESC, sale_number DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoices_company_status_date_number_id
ON purchase_invoices (company_id, status, purchase_date DESC, purchase_number DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_returns_company_status_date_number_id
ON sale_returns (company_id, status, sale_return_date DESC, sale_return_number DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_returns_company_status_date_number_id
ON purchase_returns (company_id, status, purchase_return_date DESC, purchase_return_number DESC, id DESC);
```

Add party-specific indexes for customer and supplier ledgers:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_invoices_company_customer_date
ON sale_invoices (company_id, customer_id, sale_date DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoices_company_supplier_date
ON purchase_invoices (company_id, supplier_id, purchase_date DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_returns_company_customer_date
ON sale_returns (company_id, customer_id, sale_return_date DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_returns_company_supplier_date
ON purchase_returns (company_id, supplier_id, purchase_return_date DESC, id DESC);
```

### Sales And Purchase Lines

Use these for page-sized line counts and item history:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_invoice_lines_company_invoice
ON sale_invoice_lines (company_id, sale_invoice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_lines_company_invoice
ON purchase_invoice_lines (company_id, purchase_invoice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_return_lines_company_return
ON sale_return_lines (company_id, sale_return_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_return_lines_company_return
ON purchase_return_lines (company_id, purchase_return_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sale_invoice_lines_company_item
ON sale_invoice_lines (company_id, item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_invoice_lines_company_item
ON purchase_invoice_lines (company_id, item_id);
```

### Inventory

Existing stock indexes are useful. Add these if stock reports or item history slow down:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_company_item_warehouse_date
ON inventory_stock_movements (company_id, item_id, warehouse_id, movement_date DESC, id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_company_source
ON inventory_stock_movements (company_id, source_kind, source_document_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_balances_company_item_warehouse_location
ON inventory_stock_balances (company_id, item_id, warehouse_id, location_id);
```

### Bank Accounts

Bank Account list already has a good page-first balance query. Improve search and stable ordering only if needed:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_accounts_company_default_name
ON bank_accounts (company_id, is_default DESC, bank_name, account_title);
```

If account number search becomes common:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_accounts_account_number_trgm
ON bank_accounts USING gin (account_number gin_trgm_ops);
```

## Query Rewrite Plan

### Voucher List

Current pattern:

- Prisma `findMany`
- Prisma `count`
- filters on company, voucher type, status, approval status, date, amount, search
- sort by voucher date, voucher number, id

Recommended changes:

- Add composite index matching status, date, voucher number, and id.
- Keep selected columns explicit in list view. Avoid fetching fields not displayed.
- Use keyset pagination for very large posted voucher lists and audit screens.
- Keep offset pagination for normal screens where users jump between pages.

Professional list query shape:

```sql
SELECT
  id,
  voucher_number,
  voucher_type,
  voucher_date,
  reference,
  narration,
  status,
  approval_status,
  total_debit,
  total_credit
FROM vouchers
WHERE company_id = $1
  AND status = $2
ORDER BY voucher_date DESC, voucher_number DESC, id DESC
LIMIT $3 OFFSET $4;
```

### Ledger Report

Current pattern:

- Load account
- Aggregate previous totals
- Load period voucher lines with included voucher
- Calculate running balance in application code

Recommended changes:

- Keep running balance in application code for readability, unless the report becomes very large.
- Replace Prisma relation include with a single SQL join selecting only required columns when data grows.
- Use the new voucher and voucher line composite indexes.
- Add optional export mode with streaming or cursor pagination for very large ledgers.

Professional query shape:

```sql
SELECT
  vl.id,
  vl.voucher_id,
  v.voucher_number,
  v.voucher_type,
  v.voucher_date,
  v.reference,
  COALESCE(vl.narration, v.narration, '') AS description,
  vl.dr_amount,
  vl.cr_amount,
  vl.line_no
FROM voucher_lines vl
JOIN vouchers v
  ON v.id = vl.voucher_id
 AND v.company_id = vl.company_id
WHERE vl.company_id = $1
  AND vl.account_id = $2
  AND v.status = 'Posted'
  AND v.voucher_date BETWEEN $3 AND $4
ORDER BY v.voucher_date, v.voucher_number, vl.line_no, vl.id;
```

### Trial Balance, Profit And Loss, And Balance Sheet

Current pattern:

- Load account master list
- Aggregate voucher movements by account
- Merge results in application code

Recommended changes:

- Keep this pattern because it is clear and auditable.
- Ensure date filters use `date` parameters instead of string casts wherever possible.
- Add report indexes before rewriting business logic.
- Consider precomputed monthly ledger summaries only after real production volume proves the need.

Future monthly summary table, if required:

```text
ledger_monthly_balances
- company_id
- account_id
- fiscal_year
- month_number
- opening_debit
- opening_credit
- period_debit
- period_credit
- closing_debit
- closing_credit
```

Do not introduce this table until direct voucher aggregation becomes too slow after indexing.

### Sales, Purchase, And Return Lists

Recommended changes:

- Use `page_rows` CTE first.
- Join line counts only for `page_rows`.
- Only join party and warehouse tables in the count query when the search needs them.
- Always add `id DESC` to final ordering for stable pagination.

Professional query shape:

```sql
WITH filtered AS (
  SELECT si.id
  FROM sale_invoices si
  WHERE si.company_id = $1
    AND si.status = $2
  ORDER BY si.sale_date DESC, si.sale_number DESC, si.id DESC
  LIMIT $3 OFFSET $4
),
line_counts AS (
  SELECT sil.sale_invoice_id, COUNT(*)::int AS line_count
  FROM sale_invoice_lines sil
  JOIN filtered f ON f.id = sil.sale_invoice_id
  WHERE sil.company_id = $1
  GROUP BY sil.sale_invoice_id
)
SELECT ...
FROM filtered f
JOIN sale_invoices si ON si.id = f.id
JOIN customers c ON c.id = si.customer_id
LEFT JOIN line_counts lc ON lc.sale_invoice_id = si.id
ORDER BY si.sale_date DESC, si.sale_number DESC, si.id DESC;
```

### Chart Of Accounts List

Current pattern:

- Fetch page accounts
- Count accounts
- Calculate current balances for page accounts through voucher line aggregation

Recommended changes:

- Current page-sized balance calculation is acceptable.
- Add index on voucher lines by company, account, voucher.
- For full export, create a backend export/report endpoint instead of making the frontend request every page.
- Keep account code ordering as the default because the Chart Of Accounts is hierarchical by code.

### Dashboard

Current pattern:

- Multiple count and group queries in parallel
- Recent vouchers
- Monthly volume by formatted voucher date

Recommended changes:

- Use `date_trunc('month', voucher_date)` for grouping.
- Return formatted month labels from application code.
- Add a maximum date range to dashboard widgets.
- Consider a daily dashboard summary table only when dashboard load becomes a frequent production bottleneck.

Improved monthly query:

```sql
SELECT
  date_trunc('month', voucher_date)::date AS month_start,
  COUNT(*) AS count,
  COALESCE(SUM(total_debit), 0) AS total
FROM vouchers
WHERE company_id = $1
  AND status = 'Posted'
  AND voucher_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY date_trunc('month', voucher_date)
ORDER BY month_start;
```

## Raw SQL Safety Standards

Allowed:

- `prisma.$queryRaw` with template parameters
- `prisma.$executeRaw` with template parameters
- Carefully reviewed `$queryRawUnsafe` only when dynamic SQL is required and every dynamic part is generated by server code, not user input

Required standards:

- Never concatenate user input directly into SQL.
- Keep dynamic `WHERE` clauses built from approved server-side fragments only.
- Always pass user values as parameters.
- Use explicit column lists. Avoid `SELECT *` in list and report queries.
- Keep every company-owned query filtered by `company_id`.
- Add `id` as the final sort field for stable pagination.
- Use `numeric`/`Decimal` for money and quantity.
- Never use floating point for accounting or inventory.

## Pagination Standards

Use offset pagination for:

- Normal entry screens
- Short master lists
- Lists where users need page numbers

Use keyset pagination for:

- Large posted voucher history
- Audit logs
- Ledger drill-downs
- Stock movement history
- Export endpoints

Keyset example:

```sql
WHERE company_id = $1
  AND status = 'Posted'
  AND (
    voucher_date,
    voucher_number,
    id
  ) < ($2, $3, $4)
ORDER BY voucher_date DESC, voucher_number DESC, id DESC
LIMIT $5;
```

## Reporting Strategy

### Phase 1: Direct Query Optimization

Start with indexes and query rewrites. This keeps reports accurate and simple.

Reports continue to read from:

- `vouchers`
- `voucher_lines`
- `inventory_stock_movements`
- `inventory_stock_balances`

### Phase 2: Summary Tables Only If Needed

Add monthly summary tables only when direct reporting remains slow after indexing and query tuning.

Candidate summaries:

- Monthly ledger balances
- Daily stock balances
- Customer and supplier aging snapshots
- Dashboard KPI snapshots

Rules for summary tables:

- Source of truth remains transaction tables.
- Summary tables must be rebuildable.
- Updates must happen inside the same posting transaction or through a controlled background job.
- Reconciliation reports must compare summary totals against source transaction totals.

## Verification Plan

Before changing production queries or indexes, collect baselines:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
```

Measure:

- Planning time
- Execution time
- Shared buffer hits
- Shared buffer reads
- Rows scanned versus rows returned
- Sort method and memory usage
- Whether the correct index is used

Enable or review `pg_stat_statements` in non-production or production monitoring:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Useful DBA review query:

```sql
SELECT
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 25;
```

After each optimization:

- Compare before and after `EXPLAIN ANALYZE`
- Confirm row counts match
- Confirm totals match existing reports
- Confirm API response shape did not change
- Confirm indexes are actually used
- Watch insert/update cost on high-write tables

## Implementation Roadmap

### Phase 1: Observability And Baseline

- Enable slow query logging in staging.
- Enable `pg_stat_statements`.
- Capture top 25 slow queries by total time and mean time.
- Capture `EXPLAIN (ANALYZE, BUFFERS)` for voucher list, ledger report, trial balance, sales list, purchase list, and stock movement report.

### Phase 2: Critical Indexes

- Add voucher and voucher line composite indexes.
- Add stable list indexes for sales, purchases, returns, stock transfers, and stock adjustments.
- Add line table indexes for document line counts.
- Run `ANALYZE` after index creation.

### Phase 3: Query Rewrites

- Rewrite sales, purchase, and return list queries to page first, then count lines.
- Simplify count queries to avoid unnecessary joins.
- Rewrite Ledger report to a single explicit SQL join if Prisma relation include becomes slow.
- Change dashboard monthly grouping to `date_trunc`.

### Phase 4: Number Generation Safety

- Add `document_number_counters`.
- Move all document number generation to locked counter rows.
- Migrate existing next numbers from current maximum document numbers.
- Add tests for concurrent creation.

### Phase 5: Search Optimization

- Enable `pg_trgm` if search is slow.
- Add trigram indexes only to columns with confirmed high search usage.
- Change account code and document number search to prefix search where the UI supports it.

### Phase 6: Large Export And Reports

- Add backend export endpoints for Chart Of Accounts and large financial reports.
- Use streaming or cursor pagination for large exports.
- Keep frontend from making hundreds of paged API requests for one export.

## Testing Checklist

- Voucher list returns the same rows and total count before and after changes.
- Approval queue returns approved, pending, rejected, and posted states correctly.
- Ledger opening balance, period debit, period credit, and closing balance match before and after changes.
- Trial Balance debit and credit totals remain equal.
- Profit And Loss net profit/loss matches current report.
- Balance Sheet remains balanced.
- Sales, purchase, and return list line counts remain correct.
- Bank Account current balance matches voucher line totals.
- Stock on hand matches stock movements and stock balances.
- Draft documents do not affect ledger or stock reports.
- Posted documents remain locked and auditable.

## Professional Query Writing Rules For This ERP

- Use clear table aliases that match business meaning, such as `v` for vouchers and `vl` for voucher lines.
- Select only columns needed by the screen or report.
- Always filter by `company_id` for company-owned data.
- Always filter posted accounting impact with `v.status = 'Posted'`.
- Put the most selective indexed filters first in query design.
- Match composite indexes to actual filter and sort patterns.
- Add `id` to sort order for stable pagination.
- Avoid `SELECT *` in API list endpoints.
- Avoid recalculating totals from source documents when posted accounting impact exists in vouchers.
- Avoid over-indexing small lookup tables.
- Use `CREATE INDEX CONCURRENTLY` for production-sized tables.
- Run index changes in separate migrations outside long application transactions.

## Recommended First Pull Request

The first optimization pull request should be small and measurable:

1. Add voucher and voucher line composite indexes.
2. Add list indexes for sales, purchases, sale returns, and purchase returns.
3. Rewrite one list query, preferably Sales Invoice list, to use the `page_rows` CTE pattern.
4. Capture before and after `EXPLAIN (ANALYZE, BUFFERS)`.
5. Repeat the same pattern for the remaining document lists after the first one is verified.

## Final DBA Recommendation

The database design is moving in the right direction: company-scoped data, clear transaction tables, posted voucher source of truth, and stock movement source of truth. The next level of professionalism is to make the physical database design match the real ERP workload.

Focus first on:

- Composite indexes for financial reports
- Page-first list queries
- Lighter count queries
- Concurrent-safe document numbering
- Measured search indexes

Do these in phases, measure each change, and avoid adding speculative indexes that do not support an observed query pattern.
