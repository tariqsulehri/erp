-- Who cancelled a Draft Stock Transfer or Stock Adjustment, when, and why.
-- Purchases, Sales and both Returns already have these columns. All three are optional and start empty;
-- no existing row or column changes. Rollback: ALTER TABLE ... DROP COLUMN for each of the six columns.
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS voided_by_id UUID;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ(6);
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS void_reason TEXT;

ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS voided_by_id UUID;
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ(6);
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS void_reason TEXT;
