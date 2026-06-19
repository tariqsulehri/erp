import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 4 — Opening balance fields on accounts + audit log table
 *
 * Adds:
 *   accounts.opening_balance      NUMERIC(15,2)  nullable
 *   accounts.opening_balance_date DATE           nullable
 *   account_audit_logs            new table
 */
export class AccountOpeningBalanceAndAudit1711700000000 implements MigrationInterface {
  name = 'AccountOpeningBalanceAndAudit1711700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    /* ── Opening balance columns on accounts ────────────────────── */
    await queryRunner.query(`
      ALTER TABLE accounts
        ADD COLUMN IF NOT EXISTS opening_balance      NUMERIC(15,2) NULL,
        ADD COLUMN IF NOT EXISTS opening_balance_date DATE          NULL
    `);

    /* ── Audit log table ────────────────────────────────────────── */
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS account_audit_logs (
        id           UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id   UUID                     NOT NULL,
        company_id   UUID                     NOT NULL,
        changed_by   VARCHAR(255),
        action       VARCHAR(50)              NOT NULL,
        changes      JSONB,
        created_at   TIMESTAMPTZ              NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_account_created
        ON account_audit_logs (account_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_company_created
        ON account_audit_logs (company_id, created_at DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS account_audit_logs`);
    await queryRunner.query(`
      ALTER TABLE accounts
        DROP COLUMN IF EXISTS opening_balance,
        DROP COLUMN IF EXISTS opening_balance_date
    `);
  }
}
