import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 8 — Customers & Suppliers (AR / AP Sub-ledger Masters)
 *
 * Creates:
 *  1. customers  — AR sub-ledger master
 *  2. suppliers  — AP sub-ledger master
 *
 * Both tables follow the same design principles as the rest of the schema:
 *  - UUID primary keys
 *  - company_id scoping (multi-tenant)
 *  - auto-code sequencing enforced at application layer
 *  - COA linkage via nullable UUID FKs (soft reference — no hard FK so that
 *    accounts can be reorganised without breaking customer/supplier records)
 *  - CHECK constraints for business rules
 *  - Immutable created_at, auto-updated updated_at
 */
export class CustomersSuppliers1745000000008 implements MigrationInterface {
  name = 'CustomersSuppliers1745000000008';

  public async up(runner: QueryRunner): Promise<void> {

    /* ─────────────────────────────────────────────────────────────
       1. CUSTOMERS
       ───────────────────────────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE customers (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id           UUID         NOT NULL,

        -- Identity
        code                 VARCHAR(20)  NOT NULL,
        name                 VARCHAR(200) NOT NULL,
        trade_name           VARCHAR(200),
        customer_type        VARCHAR(20)  NOT NULL DEFAULT 'company',
        tax_registration_no  VARCHAR(50),

        -- Contact
        email                VARCHAR(200),
        phone                VARCHAR(30),
        mobile               VARCHAR(30),
        billing_address      TEXT,
        shipping_address     TEXT,
        city                 VARCHAR(100),
        country              VARCHAR(100),
        postal_code          VARCHAR(20),

        -- Financial terms
        payment_terms_days   SMALLINT     NOT NULL DEFAULT 30,
        credit_limit         NUMERIC(18,2) NOT NULL DEFAULT 0,
        currency_code        CHAR(3)      NOT NULL DEFAULT 'USD',

        -- COA linkage (soft FK — intentionally no hard constraint)
        ar_account_id        UUID,       -- 1100 Accounts Receivable Control
        advance_account_id   UUID,       -- 2200 Customer Advances

        -- Meta
        is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_customer_code     UNIQUE (company_id, code),
        CONSTRAINT chk_customer_type    CHECK  (customer_type IN ('individual','company','government')),
        CONSTRAINT chk_customer_terms   CHECK  (payment_terms_days >= 0 AND payment_terms_days <= 365),
        CONSTRAINT chk_customer_limit   CHECK  (credit_limit >= 0),
        CONSTRAINT chk_customer_currency CHECK (char_length(currency_code) = 3)
      );
    `);

    await runner.query(`CREATE INDEX idx_customers_company   ON customers(company_id);`);
    await runner.query(`CREATE INDEX idx_customers_active    ON customers(company_id, is_active);`);
    await runner.query(`CREATE INDEX idx_customers_name      ON customers(company_id, lower(name));`);
    await runner.query(`CREATE INDEX idx_customers_ar_acct   ON customers(ar_account_id) WHERE ar_account_id IS NOT NULL;`);

    /* Auto-update updated_at trigger */
    await runner.query(`
      CREATE OR REPLACE FUNCTION trg_set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;
    `);
    await runner.query(`
      CREATE TRIGGER customers_updated_at
        BEFORE UPDATE ON customers
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);

    /* ─────────────────────────────────────────────────────────────
       2. SUPPLIERS
       ───────────────────────────────────────────────────────────── */
    await runner.query(`
      CREATE TABLE suppliers (
        id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id           UUID         NOT NULL,

        -- Identity
        code                 VARCHAR(20)  NOT NULL,
        name                 VARCHAR(200) NOT NULL,
        trade_name           VARCHAR(200),
        supplier_type        VARCHAR(20)  NOT NULL DEFAULT 'company',
        tax_registration_no  VARCHAR(50),

        -- Contact
        email                VARCHAR(200),
        phone                VARCHAR(30),
        mobile               VARCHAR(30),
        address              TEXT,           -- remittance / billing address
        city                 VARCHAR(100),
        country              VARCHAR(100),
        postal_code          VARCHAR(20),

        -- Financial terms
        payment_terms_days   SMALLINT     NOT NULL DEFAULT 30,
        currency_code        CHAR(3)      NOT NULL DEFAULT 'USD',

        -- COA linkage (soft FK)
        ap_account_id        UUID,       -- 2100 Accounts Payable Control
        advance_account_id   UUID,       -- 2300 Supplier Advances

        -- Bank details (used on payment vouchers)
        bank_name            VARCHAR(100),
        bank_account_no      VARCHAR(50),
        bank_swift_code      VARCHAR(20),
        bank_iban            VARCHAR(34),

        -- Meta
        is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
        notes                TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_supplier_code      UNIQUE (company_id, code),
        CONSTRAINT chk_supplier_type     CHECK  (supplier_type IN ('individual','company','government')),
        CONSTRAINT chk_supplier_terms    CHECK  (payment_terms_days >= 0 AND payment_terms_days <= 365),
        CONSTRAINT chk_supplier_currency CHECK  (char_length(currency_code) = 3)
      );
    `);

    await runner.query(`CREATE INDEX idx_suppliers_company   ON suppliers(company_id);`);
    await runner.query(`CREATE INDEX idx_suppliers_active    ON suppliers(company_id, is_active);`);
    await runner.query(`CREATE INDEX idx_suppliers_name      ON suppliers(company_id, lower(name));`);
    await runner.query(`CREATE INDEX idx_suppliers_ap_acct   ON suppliers(ap_account_id) WHERE ap_account_id IS NOT NULL;`);

    await runner.query(`
      CREATE TRIGGER suppliers_updated_at
        BEFORE UPDATE ON suppliers
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);
  }

  public async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP TRIGGER IF EXISTS suppliers_updated_at ON suppliers;`);
    await runner.query(`DROP TABLE IF EXISTS suppliers;`);
    await runner.query(`DROP TRIGGER IF EXISTS customers_updated_at ON customers;`);
    await runner.query(`DROP TABLE IF EXISTS customers;`);
    /* Note: trg_set_updated_at() function is shared — leave it */
  }
}
