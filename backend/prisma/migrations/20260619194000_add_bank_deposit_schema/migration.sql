CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "ledger_account_id" UUID NOT NULL,
  "bank_name" VARCHAR(150) NOT NULL,
  "branch_name" VARCHAR(150),
  "account_title" VARCHAR(200) NOT NULL,
  "account_number" VARCHAR(80) NOT NULL,
  "iban" VARCHAR(34),
  "swift_code" VARCHAR(20),
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
  "opening_balance" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "opening_balance_date" DATE,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_accounts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_accounts_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_accounts_ledger_account" ON "bank_accounts"("company_id", "ledger_account_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_accounts_account_number" ON "bank_accounts"("company_id", "account_number");
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_company_active" ON "bank_accounts"("company_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_bank_accounts_company_bank_name" ON "bank_accounts"("company_id", "bank_name");

CREATE TABLE IF NOT EXISTS "bank_deposit_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "code" VARCHAR(30) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "deposit_kind" VARCHAR(30) NOT NULL DEFAULT 'OTHER',
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_deposit_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_deposit_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposit_types_deposit_kind_check" CHECK ("deposit_kind" IN ('CASH', 'CHEQUE', 'BANK_TRANSFER', 'OTHER'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_deposit_types_code" ON "bank_deposit_types"("company_id", "code");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_types_company_active" ON "bank_deposit_types"("company_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_types_company_kind" ON "bank_deposit_types"("company_id", "deposit_kind");

CREATE TABLE IF NOT EXISTS "bank_deposits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "voucher_id" UUID,
  "bank_account_id" UUID NOT NULL,
  "deposit_number" VARCHAR(40) NOT NULL,
  "deposit_date" DATE NOT NULL,
  "reference_number" VARCHAR(100),
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'Draft',
  "cash_total" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "cheque_total" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "transfer_total" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "other_total" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "bank_balance_before" DECIMAL(18, 2),
  "bank_balance_after" DECIMAL(18, 2),
  "created_by_id" UUID,
  "updated_by_id" UUID,
  "posted_by_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "voided_by_id" UUID,
  "voided_at" TIMESTAMPTZ(6),
  "void_reason" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_deposits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_deposits_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposits_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposits_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposits_total_amount_check" CHECK ("total_amount" >= 0),
  CONSTRAINT "bank_deposits_cash_total_check" CHECK ("cash_total" >= 0),
  CONSTRAINT "bank_deposits_cheque_total_check" CHECK ("cheque_total" >= 0),
  CONSTRAINT "bank_deposits_transfer_total_check" CHECK ("transfer_total" >= 0),
  CONSTRAINT "bank_deposits_other_total_check" CHECK ("other_total" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_deposits_voucher" ON "bank_deposits"("voucher_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_deposits_number" ON "bank_deposits"("company_id", "deposit_number");
CREATE INDEX IF NOT EXISTS "idx_bank_deposits_company_date" ON "bank_deposits"("company_id", "deposit_date");
CREATE INDEX IF NOT EXISTS "idx_bank_deposits_company_status" ON "bank_deposits"("company_id", "status");
CREATE INDEX IF NOT EXISTS "idx_bank_deposits_company_bank_date" ON "bank_deposits"("company_id", "bank_account_id", "deposit_date");
CREATE INDEX IF NOT EXISTS "idx_bank_deposits_company_active" ON "bank_deposits"("company_id", "is_active");

CREATE TABLE IF NOT EXISTS "bank_deposit_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "bank_deposit_id" UUID NOT NULL,
  "line_number" INTEGER NOT NULL DEFAULT 1,
  "received_from_account_id" UUID NOT NULL,
  "received_from_account_code" VARCHAR(20) NOT NULL,
  "received_from_account_name" VARCHAR(200) NOT NULL,
  "deposit_type_id" UUID NOT NULL,
  "deposit_type_name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "cheque_number" VARCHAR(80),
  "cheque_date" DATE,
  "cheque_bank_name" VARCHAR(150),
  "clearing_date" DATE,
  "amount" DECIMAL(18, 2) NOT NULL,
  "is_cleared" BOOLEAN NOT NULL DEFAULT false,
  "cleared_at" TIMESTAMPTZ(6),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_deposit_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bank_deposit_lines_bank_deposit_id_fkey" FOREIGN KEY ("bank_deposit_id") REFERENCES "bank_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bank_deposit_lines_received_from_account_id_fkey" FOREIGN KEY ("received_from_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposit_lines_deposit_type_id_fkey" FOREIGN KEY ("deposit_type_id") REFERENCES "bank_deposit_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bank_deposit_lines_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_bank_deposit_lines_number" ON "bank_deposit_lines"("bank_deposit_id", "line_number");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_deposit" ON "bank_deposit_lines"("company_id", "bank_deposit_id");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_received_from" ON "bank_deposit_lines"("company_id", "received_from_account_id");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_deposit_type" ON "bank_deposit_lines"("company_id", "deposit_type_id");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_clearing_date" ON "bank_deposit_lines"("company_id", "clearing_date");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_cleared" ON "bank_deposit_lines"("company_id", "is_cleared");
CREATE INDEX IF NOT EXISTS "idx_bank_deposit_lines_company_active" ON "bank_deposit_lines"("company_id", "is_active");
