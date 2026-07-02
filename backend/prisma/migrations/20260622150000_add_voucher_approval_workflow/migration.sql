ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS approval_status varchar(20) NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS approval_requested_by uuid,
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE vouchers DROP CONSTRAINT IF EXISTS vouchers_approval_status_check;

ALTER TABLE vouchers
  ADD CONSTRAINT vouchers_approval_status_check
  CHECK (approval_status IN ('Not Required', 'Pending', 'Approved', 'Rejected'));

CREATE INDEX IF NOT EXISTS idx_vouchers_company_approval_date
  ON vouchers(company_id, approval_status, voucher_date);

ALTER TABLE vouchers
  ALTER COLUMN approval_status SET DEFAULT 'Pending';

CREATE TABLE IF NOT EXISTS document_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  document_type varchar(50) NOT NULL,
  document_id uuid NOT NULL,
  approval_status varchar(20) NOT NULL,
  approved_by_id uuid,
  approved_at timestamptz,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_approvals_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_approvals_company_document
  ON document_approvals(company_id, document_type, document_id);

CREATE INDEX IF NOT EXISTS idx_document_approvals_company_status_created
  ON document_approvals(company_id, approval_status, created_at);
