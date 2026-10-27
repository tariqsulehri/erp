-- Enterprise DBA 50,000-User Performance & Concurrency Migration
-- Adds optimistic concurrency control (version), composite tenant indexes, and document numbering expression indexes.

-- 1. Add version columns for optimistic concurrency
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE inventory_stock_balances ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sale_invoices ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. Add composite tenant and query acceleration indexes
CREATE INDEX IF NOT EXISTS idx_vouchers_company_type_number
  ON vouchers (company_id, voucher_type, voucher_number);

CREATE INDEX IF NOT EXISTS idx_vouchers_company_created_at
  ON vouchers (company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_company_account_code
  ON voucher_lines (company_id, account_code);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_voucher_line_no
  ON voucher_lines (voucher_id, line_no);

CREATE INDEX IF NOT EXISTS idx_stock_balances_lookup
  ON inventory_stock_balances (company_id, item_id, warehouse_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_comp_item_wh_date
  ON inventory_stock_movements (company_id, item_id, warehouse_id, movement_date);

CREATE INDEX IF NOT EXISTS idx_user_company_access_user_active
  ON user_company_access (user_id, is_active);

-- 3. Document numbering functional expression indexes (prevents full-table scan under pg_advisory_xact_lock)
CREATE INDEX IF NOT EXISTS idx_vouchers_doc_numbering 
  ON vouchers (company_id, (substring(voucher_number from '^[A-Z]+-[0-9]+-([0-9]+)$')));

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_doc_numbering 
  ON purchase_invoices (company_id, (substring(purchase_number from '^[A-Z]+-[0-9]+-([0-9]+)$')));

CREATE INDEX IF NOT EXISTS idx_sale_invoices_doc_numbering 
  ON sale_invoices (company_id, (substring(sale_number from '^[A-Z]+-[0-9]+-([0-9]+)$')));

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_doc_numbering 
  ON stock_adjustments (company_id, (substring(adjustment_number from '^[A-Z]+-[0-9]+-([0-9]+)$')));
