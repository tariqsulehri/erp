CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code varchar(30) NOT NULL,
  name varchar(150) NOT NULL,
  description text,
  address text,
  city varchar(100),
  phone varchar(30),
  email varchar(120),
  manager_name varchar(150),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branches_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS branches_company_id_code_key
  ON branches(company_id, code);

CREATE INDEX IF NOT EXISTS branches_company_id_is_active_idx
  ON branches(company_id, is_active);

ALTER TABLE inventory_warehouses
  ADD COLUMN IF NOT EXISTS branch_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'inventory_warehouses_branch_id_fkey'
  ) THEN
    ALTER TABLE inventory_warehouses
      ADD CONSTRAINT inventory_warehouses_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS inventory_warehouses_company_id_branch_id_idx
  ON inventory_warehouses(company_id, branch_id);
