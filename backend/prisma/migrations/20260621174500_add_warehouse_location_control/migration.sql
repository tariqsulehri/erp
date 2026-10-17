ALTER TABLE inventory_warehouses
  ADD COLUMN IF NOT EXISTS use_locations boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS inventory_warehouses_company_id_use_locations_idx
  ON inventory_warehouses(company_id, use_locations);
