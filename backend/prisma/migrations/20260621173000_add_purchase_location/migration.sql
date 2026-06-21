ALTER TABLE purchase_invoices
  ADD COLUMN IF NOT EXISTS location_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'purchase_invoices_location_id_fkey'
  ) THEN
    ALTER TABLE purchase_invoices
      ADD CONSTRAINT purchase_invoices_location_id_fkey
      FOREIGN KEY (location_id)
      REFERENCES inventory_warehouse_locations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS purchase_invoices_company_id_location_id_idx
  ON purchase_invoices(company_id, location_id);
