-- Opening Stock: a kind of Stock Adjustment document (OS-YYYY-NNNN) that records the first stock of an item
-- at a Branch or Warehouse, posted as OPENING_BALANCE movements with an OS voucher
-- (Dr Inventory, Cr the Opening Balance account from Stock Adjustment settings).
-- Additive: existing adjustments become document_kind 'Adjustment'; the new settings column starts empty.
-- Rollback: drop stock_adjustments.document_kind (and its check and index),
-- stock_adjustment_settings.opening_balance_account_id, and restore vouchers_voucher_type_check without 'OS'.
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS document_kind VARCHAR(20) NOT NULL DEFAULT 'Adjustment';
ALTER TABLE stock_adjustments DROP CONSTRAINT IF EXISTS stock_adjustments_document_kind_check;
ALTER TABLE stock_adjustments
  ADD CONSTRAINT stock_adjustments_document_kind_check CHECK (document_kind IN ('Adjustment', 'Opening Stock'));
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_company_kind_status
  ON stock_adjustments (company_id, document_kind, status);

ALTER TABLE stock_adjustment_settings ADD COLUMN IF NOT EXISTS opening_balance_account_id UUID;

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_voucher_type_check
  CHECK (voucher_type IN ('BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI', 'PR', 'SI', 'SR', 'SA', 'RV', 'CL', 'OS'));
