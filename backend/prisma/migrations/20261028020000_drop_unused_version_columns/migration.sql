-- Removes the 'version' columns added in 20261027170000 for optimistic concurrency. Nothing ever read or
-- updated them (every row is 1); posting and draft edits lock rows with SELECT ... FOR UPDATE instead.
-- Rollback: ALTER TABLE <table> ADD COLUMN version INTEGER NOT NULL DEFAULT 1; for each table below.
ALTER TABLE vouchers DROP COLUMN IF EXISTS version;
ALTER TABLE inventory_stock_balances DROP COLUMN IF EXISTS version;
ALTER TABLE stock_adjustments DROP COLUMN IF EXISTS version;
ALTER TABLE sale_invoices DROP COLUMN IF EXISTS version;
ALTER TABLE purchase_invoices DROP COLUMN IF EXISTS version;
