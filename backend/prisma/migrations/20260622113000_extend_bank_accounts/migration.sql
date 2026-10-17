ALTER TABLE bank_accounts
  ADD COLUMN IF NOT EXISTS code varchar(30),
  ADD COLUMN IF NOT EXISTS branch_code varchar(50),
  ADD COLUMN IF NOT EXISTS account_type varchar(80),
  ADD COLUMN IF NOT EXISTS contact_name varchar(150),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS post_code varchar(30),
  ADD COLUMN IF NOT EXISTS country varchar(100),
  ADD COLUMN IF NOT EXISTS city varchar(100),
  ADD COLUMN IF NOT EXISTS area varchar(100),
  ADD COLUMN IF NOT EXISTS phone_1 varchar(40),
  ADD COLUMN IF NOT EXISTS phone_2 varchar(40),
  ADD COLUMN IF NOT EXISTS mobile_number varchar(40),
  ADD COLUMN IF NOT EXISTS fax_number varchar(40),
  ADD COLUMN IF NOT EXISTS email varchar(120),
  ADD COLUMN IF NOT EXISTS website varchar(200);

UPDATE bank_accounts
SET code = COALESCE(code, CONCAT('BANK-', LPAD(row_number_text, 4, '0')))
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY created_at, id)::text AS row_number_text
  FROM bank_accounts
) numbered
WHERE bank_accounts.id = numbered.id
  AND bank_accounts.code IS NULL;

ALTER TABLE bank_accounts
  ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_code
  ON bank_accounts(company_id, code);
