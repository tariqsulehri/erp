CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  transfer_number varchar(60) NOT NULL,
  transfer_date date NOT NULL,
  from_warehouse_id uuid NOT NULL,
  from_location_id uuid,
  to_warehouse_id uuid NOT NULL,
  to_location_id uuid,
  reference_number varchar(100),
  description text,
  status varchar(20) NOT NULL DEFAULT 'Draft',
  total_quantity numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) NOT NULL DEFAULT 0,
  created_by_id uuid,
  updated_by_id uuid,
  posted_by_id uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT stock_transfers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT stock_transfers_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES inventory_warehouse_locations(id),
  CONSTRAINT stock_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT stock_transfers_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES inventory_warehouse_locations(id),
  CONSTRAINT stock_transfers_status_check CHECK (status IN ('Draft', 'Posted', 'Voided'))
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_transfers_company_id_transfer_number_key
  ON stock_transfers(company_id, transfer_number);

CREATE INDEX IF NOT EXISTS stock_transfers_company_id_transfer_date_transfer_number_idx
  ON stock_transfers(company_id, transfer_date DESC, transfer_number DESC);

CREATE INDEX IF NOT EXISTS stock_transfers_company_id_status_transfer_date_idx
  ON stock_transfers(company_id, status, transfer_date DESC);

CREATE INDEX IF NOT EXISTS stock_transfers_company_id_from_warehouse_id_idx
  ON stock_transfers(company_id, from_warehouse_id);

CREATE INDEX IF NOT EXISTS stock_transfers_company_id_to_warehouse_id_idx
  ON stock_transfers(company_id, to_warehouse_id);

CREATE TABLE IF NOT EXISTS stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  stock_transfer_id uuid NOT NULL,
  line_number integer NOT NULL,
  item_id uuid NOT NULL,
  item_code varchar(60) NOT NULL,
  item_name varchar(250) NOT NULL,
  uom_name varchar(30),
  quantity numeric(18,4) NOT NULL,
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT stock_transfer_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_transfer_lines_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
  CONSTRAINT stock_transfer_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  CONSTRAINT stock_transfer_lines_quantity_check CHECK (quantity > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_transfer_lines_transfer_id_line_number_key
  ON stock_transfer_lines(stock_transfer_id, line_number);

CREATE INDEX IF NOT EXISTS stock_transfer_lines_company_id_item_id_idx
  ON stock_transfer_lines(company_id, item_id);
