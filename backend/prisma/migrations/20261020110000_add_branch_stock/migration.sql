-- Branch stock.
-- A Branch is a shop that holds its own physical stock and is the only place that sells.
-- A Warehouse stores stock, receives purchases, and sends stock to Branches.
-- Every stock row now belongs to exactly one holder: a Branch (branch_id) or a Warehouse (warehouse_id).
-- Existing rows all belong to Warehouses, so they stay valid without data changes.

-- Shelves / racks can belong to a Branch as well as a Warehouse (optional; none are required yet).
ALTER TABLE inventory_warehouse_locations ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE inventory_warehouse_locations ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE inventory_warehouse_locations
  ADD CONSTRAINT inventory_warehouse_locations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT inventory_warehouse_locations_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS inventory_warehouse_locations_branch_id_code_key
  ON inventory_warehouse_locations (branch_id, code) WHERE branch_id IS NOT NULL;

-- Current stock snapshot.
ALTER TABLE inventory_stock_balances ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE inventory_stock_balances ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE inventory_stock_balances
  ADD CONSTRAINT inventory_stock_balances_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT inventory_stock_balances_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));

-- One balance row per item per holder per location. NULLS NOT DISTINCT makes "no location" a single row too,
-- replacing the two older unique indexes.
DROP INDEX IF EXISTS inventory_stock_balances_company_id_item_id_warehouse_id_locati;
DROP INDEX IF EXISTS inventory_stock_balances_no_location_key;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_stock_balances_holder_key
  ON inventory_stock_balances (company_id, item_id, branch_id, warehouse_id, location_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS inventory_stock_balances_company_id_branch_id_idx
  ON inventory_stock_balances (company_id, branch_id);

-- Stock history (source of truth).
ALTER TABLE inventory_stock_movements ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE inventory_stock_movements ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE inventory_stock_movements
  ADD CONSTRAINT inventory_stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT inventory_stock_movements_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));
CREATE INDEX IF NOT EXISTS inventory_stock_movements_company_id_branch_id_movement_date
  ON inventory_stock_movements (company_id, branch_id, movement_date);

-- Sales and sale returns happen at a Branch. Older documents keep their Warehouse.
ALTER TABLE sale_invoices ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE sale_invoices ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE sale_invoices
  ADD CONSTRAINT sale_invoices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT sale_invoices_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));
CREATE INDEX IF NOT EXISTS sale_invoices_company_id_branch_id_sale_date_idx
  ON sale_invoices (company_id, branch_id, sale_date);

ALTER TABLE sale_invoice_lines ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE sale_invoice_lines ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE sale_invoice_lines
  ADD CONSTRAINT sale_invoice_lines_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT sale_invoice_lines_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));

ALTER TABLE sale_returns ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE sale_returns ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE sale_returns
  ADD CONSTRAINT sale_returns_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT sale_returns_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));
CREATE INDEX IF NOT EXISTS sale_returns_company_id_branch_id_idx
  ON sale_returns (company_id, branch_id);

ALTER TABLE sale_return_lines ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE sale_return_lines ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE sale_return_lines
  ADD CONSTRAINT sale_return_lines_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT sale_return_lines_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));

-- Stock Transfers can move stock between any two holders:
-- Warehouse -> Branch, Branch -> Branch, Warehouse -> Warehouse, Branch -> Warehouse.
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS from_branch_id uuid;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS to_branch_id uuid;
ALTER TABLE stock_transfers ALTER COLUMN from_warehouse_id DROP NOT NULL;
ALTER TABLE stock_transfers ALTER COLUMN to_warehouse_id DROP NOT NULL;
ALTER TABLE stock_transfers
  ADD CONSTRAINT stock_transfers_from_branch_id_fkey FOREIGN KEY (from_branch_id) REFERENCES branches(id),
  ADD CONSTRAINT stock_transfers_to_branch_id_fkey FOREIGN KEY (to_branch_id) REFERENCES branches(id),
  ADD CONSTRAINT stock_transfers_from_holder_check CHECK ((from_branch_id IS NULL) <> (from_warehouse_id IS NULL)),
  ADD CONSTRAINT stock_transfers_to_holder_check CHECK ((to_branch_id IS NULL) <> (to_warehouse_id IS NULL));
CREATE INDEX IF NOT EXISTS stock_transfers_company_id_from_branch_id_idx ON stock_transfers (company_id, from_branch_id);
CREATE INDEX IF NOT EXISTS stock_transfers_company_id_to_branch_id_idx ON stock_transfers (company_id, to_branch_id);

-- Stock Adjustments can correct Branch stock or Warehouse stock.
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE stock_adjustments ALTER COLUMN warehouse_id DROP NOT NULL;
ALTER TABLE stock_adjustments
  ADD CONSTRAINT stock_adjustments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  ADD CONSTRAINT stock_adjustments_holder_check CHECK ((branch_id IS NULL) <> (warehouse_id IS NULL));
CREATE INDEX IF NOT EXISTS stock_adjustments_company_id_branch_id_idx ON stock_adjustments (company_id, branch_id);
