-- Application users and their company / branch / warehouse access.
-- A user signs in once (users) and works inside one company with one access scope (user_company_access).

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(150) NOT NULL,
  full_name varchar(150) NOT NULL,
  password_hash text NOT NULL,
  role varchar(30) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  password_changed_at timestamptz,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN (
    'admin', 'top_management', 'manager', 'accountant', 'sales_staff', 'warehouse_staff', 'viewer'
  ))
);

-- Email is the sign-in name, so it must be unique regardless of letter case.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_is_active_idx ON users (is_active);

CREATE TABLE IF NOT EXISTS user_company_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  access_level varchar(20) NOT NULL,
  branch_id uuid,
  warehouse_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_company_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT user_company_access_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT user_company_access_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id),
  CONSTRAINT user_company_access_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT user_company_access_level_check CHECK (access_level IN ('ALL_BRANCHES', 'BRANCH', 'WAREHOUSE')),
  -- ALL_BRANCHES has no branch or warehouse; BRANCH has only a branch; WAREHOUSE has only a warehouse.
  CONSTRAINT user_company_access_scope_check CHECK (
    (access_level = 'ALL_BRANCHES' AND branch_id IS NULL AND warehouse_id IS NULL)
    OR (access_level = 'BRANCH' AND branch_id IS NOT NULL AND warehouse_id IS NULL)
    OR (access_level = 'WAREHOUSE' AND warehouse_id IS NOT NULL AND branch_id IS NULL)
  )
);

-- One access record per user per company: one user works in one branch (or one warehouse) for now.
CREATE UNIQUE INDEX IF NOT EXISTS user_company_access_user_id_company_id_key
  ON user_company_access (user_id, company_id);
CREATE INDEX IF NOT EXISTS user_company_access_company_id_branch_id_idx
  ON user_company_access (company_id, branch_id);
CREATE INDEX IF NOT EXISTS user_company_access_company_id_warehouse_id_idx
  ON user_company_access (company_id, warehouse_id);
