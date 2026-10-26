-- Indexes used by Trial Balance, Ledger, Balance Sheet and Profit And Loss. They were declared in
-- schema.prisma but never created by a migration.
CREATE INDEX IF NOT EXISTS idx_vouchers_company_status_date_id
  ON vouchers (company_id, status, voucher_date, id);

CREATE INDEX IF NOT EXISTS idx_voucher_lines_company_account_voucher
  ON voucher_lines (company_id, account_id, voucher_id);
