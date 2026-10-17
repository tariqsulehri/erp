ALTER TABLE sale_invoices
  ADD COLUMN IF NOT EXISTS location_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sale_invoices_location_id_fkey'
  ) THEN
    ALTER TABLE sale_invoices
      ADD CONSTRAINT sale_invoices_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES inventory_warehouse_locations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sale_invoices_company_id_location_id_idx
  ON sale_invoices(company_id, location_id);
