ALTER TABLE purchase_returns
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE sale_returns
  ADD COLUMN IF NOT EXISTS location_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchase_returns_location_id_fkey'
  ) THEN
    ALTER TABLE purchase_returns
      ADD CONSTRAINT purchase_returns_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES inventory_warehouse_locations(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sale_returns_location_id_fkey'
  ) THEN
    ALTER TABLE sale_returns
      ADD CONSTRAINT sale_returns_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES inventory_warehouse_locations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS purchase_returns_company_id_location_id_idx
  ON purchase_returns(company_id, location_id);

CREATE INDEX IF NOT EXISTS sale_returns_company_id_location_id_idx
  ON sale_returns(company_id, location_id);
