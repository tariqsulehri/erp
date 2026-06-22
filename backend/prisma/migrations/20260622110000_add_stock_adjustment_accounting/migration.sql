ALTER TABLE stock_adjustments
  ADD COLUMN IF NOT EXISTS accounting_voucher_id uuid;

ALTER TABLE stock_adjustments
  ADD CONSTRAINT stock_adjustments_accounting_voucher_id_fkey
  FOREIGN KEY (accounting_voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS stock_adjustments_company_id_accounting_voucher_id_idx
  ON stock_adjustments(company_id, accounting_voucher_id);

CREATE TABLE IF NOT EXISTS stock_adjustment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  default_inventory_account_id uuid NOT NULL,
  adjustment_gain_account_id uuid NOT NULL,
  adjustment_loss_account_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_adjustment_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT stock_adjustment_settings_default_inventory_account_id_fkey FOREIGN KEY (default_inventory_account_id) REFERENCES accounts(id),
  CONSTRAINT stock_adjustment_settings_adjustment_gain_account_id_fkey FOREIGN KEY (adjustment_gain_account_id) REFERENCES accounts(id),
  CONSTRAINT stock_adjustment_settings_adjustment_loss_account_id_fkey FOREIGN KEY (adjustment_loss_account_id) REFERENCES accounts(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_adjustment_settings_company_id_key
  ON stock_adjustment_settings(company_id);

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;

ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_voucher_type_check
  CHECK (voucher_type IN ('BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI', 'PR', 'SI', 'SR', 'SA'));
