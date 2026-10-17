CREATE TABLE IF NOT EXISTS bank_cheque_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  book_number varchar(80) NOT NULL,
  prefix varchar(20),
  suffix varchar(20),
  start_cheque_number varchar(40) NOT NULL,
  end_cheque_number varchar(40) NOT NULL,
  total_cheques integer NOT NULL,
  issued_date date,
  received_date date,
  status varchar(20) NOT NULL DEFAULT 'Active',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_cheques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  bank_cheque_book_id uuid NOT NULL REFERENCES bank_cheque_books(id) ON DELETE RESTRICT,
  bank_account_id uuid NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  serial_number integer NOT NULL,
  cheque_number varchar(80) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'Available',
  issue_date date,
  payee_name varchar(200),
  payment_reference varchar(120),
  amount numeric(18, 2),
  voided_by_id uuid,
  voided_at timestamptz,
  void_reason varchar(80),
  void_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by_id uuid,
  updated_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_cheque_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  bank_cheque_id uuid NOT NULL REFERENCES bank_cheques(id) ON DELETE CASCADE,
  event_type varchar(30) NOT NULL,
  event_date timestamptz NOT NULL DEFAULT now(),
  reason varchar(120),
  notes text,
  created_by_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_cheque_books_book_number
  ON bank_cheque_books(company_id, bank_account_id, book_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_cheques_cheque_number
  ON bank_cheques(company_id, bank_account_id, cheque_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_cheques_book_serial
  ON bank_cheques(company_id, bank_cheque_book_id, serial_number);

CREATE INDEX IF NOT EXISTS idx_bank_cheque_books_company_bank_status
  ON bank_cheque_books(company_id, bank_account_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_cheques_company_bank_status
  ON bank_cheques(company_id, bank_account_id, status);

CREATE INDEX IF NOT EXISTS idx_bank_cheques_company_number
  ON bank_cheques(company_id, cheque_number);

CREATE INDEX IF NOT EXISTS idx_bank_cheque_events_company_cheque
  ON bank_cheque_events(company_id, bank_cheque_id, event_date DESC);
