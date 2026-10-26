-- Posted vouchers are corrected by a linked Reversal Voucher (RV) instead of being voided in place.
-- reversal_of_id, reversal_voucher_id and reversal_status already exist on some databases; create them when missing.
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS reversal_of_id uuid,
  ADD COLUMN IF NOT EXISTS reversal_voucher_id uuid,
  ADD COLUMN IF NOT EXISTS reversal_status varchar(20) NOT NULL DEFAULT 'None',
  ADD COLUMN IF NOT EXISTS reversed_by uuid,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_reason text;

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS fk_vouchers_reversal_of;
ALTER TABLE vouchers
  ADD CONSTRAINT fk_vouchers_reversal_of FOREIGN KEY (reversal_of_id) REFERENCES vouchers(id) ON DELETE RESTRICT;
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS fk_vouchers_reversal_voucher;
ALTER TABLE vouchers
  ADD CONSTRAINT fk_vouchers_reversal_voucher FOREIGN KEY (reversal_voucher_id) REFERENCES vouchers(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vouchers_reversal_of
  ON vouchers (reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

-- RV (Reversal Voucher) and CL (Year-End Closing) are system voucher types.
ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_voucher_type_check;
ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_voucher_type_check CHECK (
    voucher_type IN ('BRV', 'BPV', 'CRV', 'CPV', 'JV', 'CV', 'DN', 'CN', 'PI', 'PR', 'SI', 'SR', 'SA', 'RV', 'CL')
  );

-- Year-end closing moves Revenue and Expense balances into Retained Earnings through a closing voucher.
CREATE TABLE IF NOT EXISTS year_end_closing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  retained_earnings_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_year_end_closing_settings_company UNIQUE (company_id)
);

ALTER TABLE fiscal_years
  ADD COLUMN IF NOT EXISTS closing_voucher_id uuid REFERENCES vouchers(id) ON DELETE RESTRICT;
