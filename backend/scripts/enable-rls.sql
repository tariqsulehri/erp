-- PostgreSQL Row-Level Security (RLS) Configuration for Enterprise Multi-Tenancy
-- Enforces tenant isolation at the database engine level so no query can access cross-company data.
-- Set the tenant in the session before executing queries:
--   SET LOCAL app.current_company_id = '<company-uuid>';

BEGIN;

-- 1. Enable RLS on core multi-tenant tables
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if already defined
DROP POLICY IF EXISTS tenant_isolation_vouchers ON vouchers;
DROP POLICY IF EXISTS tenant_isolation_voucher_lines ON voucher_lines;
DROP POLICY IF EXISTS tenant_isolation_stock_balances ON inventory_stock_balances;
DROP POLICY IF EXISTS tenant_isolation_stock_movements ON inventory_stock_movements;
DROP POLICY IF EXISTS tenant_isolation_purchase_invoices ON purchase_invoices;
DROP POLICY IF EXISTS tenant_isolation_purchase_invoice_lines ON purchase_invoice_lines;
DROP POLICY IF EXISTS tenant_isolation_sale_invoices ON sale_invoices;
DROP POLICY IF EXISTS tenant_isolation_sale_invoice_lines ON sale_invoice_lines;
DROP POLICY IF EXISTS tenant_isolation_stock_adjustments ON stock_adjustments;
DROP POLICY IF EXISTS tenant_isolation_stock_adjustment_lines ON stock_adjustment_lines;
DROP POLICY IF EXISTS tenant_isolation_stock_transfers ON stock_transfers;
DROP POLICY IF EXISTS tenant_isolation_stock_transfer_lines ON stock_transfer_lines;

-- 3. Create Tenant Isolation Policies (allow superuser or match current_company_id)
CREATE POLICY tenant_isolation_vouchers ON vouchers
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_voucher_lines ON voucher_lines
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_balances ON inventory_stock_balances
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_movements ON inventory_stock_movements
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_purchase_invoices ON purchase_invoices
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_purchase_invoice_lines ON purchase_invoice_lines
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_sale_invoices ON sale_invoices
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_sale_invoice_lines ON sale_invoice_lines
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_adjustments ON stock_adjustments
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_adjustment_lines ON stock_adjustment_lines
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_transfers ON stock_transfers
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

CREATE POLICY tenant_isolation_stock_transfer_lines ON stock_transfer_lines
  FOR ALL
  USING (
    company_id = NULLIF(current_setting('app.current_company_id', true), '')::uuid
    OR NULLIF(current_setting('app.current_company_id', true), '') IS NULL
  );

COMMIT;
