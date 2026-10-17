CREATE TABLE IF NOT EXISTS purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  accounting_voucher_id uuid NULL,
  purchase_return_number varchar(30) NOT NULL,
  purchase_return_date date NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_account_id uuid NOT NULL,
  supplier_return_number varchar(100) NULL,
  supplier_return_date date NULL,
  payment_type varchar(20) NOT NULL,
  warehouse_id uuid NOT NULL,
  reference_number varchar(100) NULL,
  description text NULL,
  status varchar(20) NOT NULL DEFAULT 'Draft',
  gross_amount numeric(18, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(18, 2) NOT NULL DEFAULT 0,
  freight_amount numeric(18, 2) NOT NULL DEFAULT 0,
  net_amount numeric(18, 2) NOT NULL DEFAULT 0,
  created_by_id uuid NULL,
  updated_by_id uuid NULL,
  posted_by_id uuid NULL,
  posted_at timestamptz NULL,
  voided_by_id uuid NULL,
  voided_at timestamptz NULL,
  void_reason text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_purchase_returns_number UNIQUE (company_id, purchase_return_number),
  CONSTRAINT fk_purchase_returns_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_purchase_returns_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_purchase_returns_supplier_account FOREIGN KEY (supplier_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_purchase_returns_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES vouchers(id),
  CONSTRAINT fk_purchase_returns_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT chk_purchase_returns_status CHECK (status IN ('Draft', 'Posted', 'Voided')),
  CONSTRAINT chk_purchase_returns_payment_type CHECK (payment_type IN ('Cash', 'Credit')),
  CONSTRAINT chk_purchase_returns_amounts CHECK (
    gross_amount >= 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND freight_amount >= 0
    AND net_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS purchase_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  purchase_return_id uuid NOT NULL,
  line_number integer NOT NULL,
  item_id uuid NOT NULL,
  item_code varchar(60) NOT NULL,
  item_name varchar(250) NOT NULL,
  uom_id uuid NULL,
  uom_name varchar(80) NULL,
  warehouse_id uuid NOT NULL,
  quantity numeric(18, 4) NOT NULL,
  purchase_price numeric(18, 4) NOT NULL,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(18, 2) NOT NULL DEFAULT 0,
  line_total numeric(18, 2) NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_purchase_return_lines_number UNIQUE (purchase_return_id, line_number),
  CONSTRAINT fk_purchase_return_lines_return FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_return_lines_item FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  CONSTRAINT fk_purchase_return_lines_uom FOREIGN KEY (uom_id) REFERENCES inventory_units_of_measure(id),
  CONSTRAINT fk_purchase_return_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT chk_purchase_return_lines_amounts CHECK (
    quantity > 0
    AND purchase_price > 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND line_total > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_company_status_date
  ON purchase_returns(company_id, status, purchase_return_date DESC, purchase_return_number DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_date
  ON purchase_returns(company_id, supplier_id, purchase_return_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_return_lines_return
  ON purchase_return_lines(company_id, purchase_return_id);

CREATE INDEX IF NOT EXISTS idx_purchase_return_lines_item
  ON purchase_return_lines(company_id, item_id);

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;

ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_voucher_type_check
  CHECK (voucher_type IN ('BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI', 'PR'));
