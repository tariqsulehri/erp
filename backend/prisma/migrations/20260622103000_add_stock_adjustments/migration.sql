CREATE TABLE IF NOT EXISTS stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  adjustment_number varchar(60) NOT NULL,
  adjustment_date date NOT NULL,
  warehouse_id uuid NOT NULL,
  location_id uuid,
  reference_number varchar(100),
  reason varchar(150),
  description text,
  status varchar(20) NOT NULL DEFAULT 'Draft',
  total_quantity_in numeric(18,4) NOT NULL DEFAULT 0,
  total_quantity_out numeric(18,4) NOT NULL DEFAULT 0,
  total_cost_in numeric(18,4) NOT NULL DEFAULT 0,
  total_cost_out numeric(18,4) NOT NULL DEFAULT 0,
  created_by_id uuid,
  updated_by_id uuid,
  posted_by_id uuid,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT stock_adjustments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT stock_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES inventory_warehouse_locations(id),
  CONSTRAINT stock_adjustments_status_check CHECK (status IN ('Draft', 'Posted', 'Voided'))
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_adjustments_company_id_adjustment_number_key
  ON stock_adjustments(company_id, adjustment_number);

CREATE INDEX IF NOT EXISTS stock_adjustments_company_id_adjustment_date_adjustment_number_idx
  ON stock_adjustments(company_id, adjustment_date DESC, adjustment_number DESC);

CREATE INDEX IF NOT EXISTS stock_adjustments_company_id_status_adjustment_date_idx
  ON stock_adjustments(company_id, status, adjustment_date DESC);

CREATE INDEX IF NOT EXISTS stock_adjustments_company_id_warehouse_id_idx
  ON stock_adjustments(company_id, warehouse_id);

CREATE TABLE IF NOT EXISTS stock_adjustment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  stock_adjustment_id uuid NOT NULL,
  line_number integer NOT NULL,
  adjustment_type varchar(20) NOT NULL,
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
  CONSTRAINT stock_adjustment_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_adjustment_lines_stock_adjustment_id_fkey FOREIGN KEY (stock_adjustment_id) REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  CONSTRAINT stock_adjustment_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  CONSTRAINT stock_adjustment_lines_adjustment_type_check CHECK (adjustment_type IN ('Increase', 'Decrease')),
  CONSTRAINT stock_adjustment_lines_quantity_check CHECK (quantity > 0),
  CONSTRAINT stock_adjustment_lines_unit_cost_check CHECK (unit_cost >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_adjustment_lines_adjustment_id_line_number_key
  ON stock_adjustment_lines(stock_adjustment_id, line_number);

CREATE INDEX IF NOT EXISTS stock_adjustment_lines_company_id_item_id_idx
  ON stock_adjustment_lines(company_id, item_id);
