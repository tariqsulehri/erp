CREATE TABLE IF NOT EXISTS sale_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  default_cash_account_id uuid NOT NULL,
  default_inventory_account_id uuid NOT NULL,
  sales_revenue_account_id uuid NOT NULL,
  sales_tax_account_id uuid NULL,
  sales_discount_account_id uuid NULL,
  freight_income_account_id uuid NULL,
  cost_of_goods_sold_account_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sale_settings_company UNIQUE (company_id),
  CONSTRAINT fk_sale_settings_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_sale_settings_cash_account FOREIGN KEY (default_cash_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_inventory_account FOREIGN KEY (default_inventory_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_revenue_account FOREIGN KEY (sales_revenue_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_tax_account FOREIGN KEY (sales_tax_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_discount_account FOREIGN KEY (sales_discount_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_freight_account FOREIGN KEY (freight_income_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_settings_cogs_account FOREIGN KEY (cost_of_goods_sold_account_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS sale_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  accounting_voucher_id uuid NULL,
  sale_number varchar(30) NOT NULL,
  sale_date date NOT NULL,
  customer_id uuid NOT NULL,
  customer_account_id uuid NOT NULL,
  payment_type varchar(20) NOT NULL,
  due_date date NULL,
  warehouse_id uuid NOT NULL,
  customer_reference_number varchar(100) NULL,
  delivery_date date NULL,
  delivery_note_number varchar(100) NULL,
  description text NULL,
  status varchar(20) NOT NULL DEFAULT 'Draft',
  gross_amount numeric(18, 2) NOT NULL DEFAULT 0,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(18, 2) NOT NULL DEFAULT 0,
  freight_amount numeric(18, 2) NOT NULL DEFAULT 0,
  net_amount numeric(18, 2) NOT NULL DEFAULT 0,
  cost_amount numeric(18, 2) NOT NULL DEFAULT 0,
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
  CONSTRAINT uq_sale_invoices_number UNIQUE (company_id, sale_number),
  CONSTRAINT fk_sale_invoices_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_sale_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sale_invoices_customer_account FOREIGN KEY (customer_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_sale_invoices_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES vouchers(id),
  CONSTRAINT fk_sale_invoices_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT chk_sale_invoices_status CHECK (status IN ('Draft', 'Posted', 'Voided')),
  CONSTRAINT chk_sale_invoices_payment_type CHECK (payment_type IN ('Cash', 'Credit')),
  CONSTRAINT chk_sale_invoices_amounts CHECK (
    gross_amount >= 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND freight_amount >= 0
    AND net_amount >= 0
    AND cost_amount >= 0
  )
);

CREATE TABLE IF NOT EXISTS sale_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  sale_invoice_id uuid NOT NULL,
  line_number integer NOT NULL,
  item_id uuid NOT NULL,
  item_code varchar(60) NOT NULL,
  item_name varchar(250) NOT NULL,
  uom_id uuid NULL,
  uom_name varchar(80) NULL,
  warehouse_id uuid NOT NULL,
  quantity numeric(18, 4) NOT NULL,
  sale_price numeric(18, 4) NOT NULL,
  discount_amount numeric(18, 2) NOT NULL DEFAULT 0,
  tax_amount numeric(18, 2) NOT NULL DEFAULT 0,
  line_total numeric(18, 2) NOT NULL,
  unit_cost numeric(18, 4) NOT NULL DEFAULT 0,
  cost_amount numeric(18, 2) NOT NULL DEFAULT 0,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_sale_invoice_lines_number UNIQUE (sale_invoice_id, line_number),
  CONSTRAINT fk_sale_invoice_lines_invoice FOREIGN KEY (sale_invoice_id) REFERENCES sale_invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_sale_invoice_lines_item FOREIGN KEY (item_id) REFERENCES inventory_items(id),
  CONSTRAINT fk_sale_invoice_lines_uom FOREIGN KEY (uom_id) REFERENCES inventory_units_of_measure(id),
  CONSTRAINT fk_sale_invoice_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES inventory_warehouses(id),
  CONSTRAINT chk_sale_invoice_lines_amounts CHECK (
    quantity > 0
    AND sale_price > 0
    AND discount_amount >= 0
    AND tax_amount >= 0
    AND line_total > 0
    AND unit_cost >= 0
    AND cost_amount >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_sale_invoices_company_status_date
  ON sale_invoices(company_id, status, sale_date DESC, sale_number DESC);

CREATE INDEX IF NOT EXISTS idx_sale_invoices_customer_date
  ON sale_invoices(company_id, customer_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_sale_invoice_lines_invoice
  ON sale_invoice_lines(company_id, sale_invoice_id);

CREATE INDEX IF NOT EXISTS idx_sale_invoice_lines_item
  ON sale_invoice_lines(company_id, item_id);

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;

ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_voucher_type_check
  CHECK (voucher_type IN ('BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI', 'PR', 'SI', 'SR'));
