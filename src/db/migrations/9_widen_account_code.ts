import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 9 — Switch COA from 4-digit to 6-digit codes
 *
 * WHY:
 *   The 4-digit scheme supports only 4 hierarchy levels, which is insufficient
 *   for professional accounting.  6-digit codes give 6 levels of detail and are
 *   the international SMB standard (used by QuickBooks, SAP B1, Tally, etc.).
 *
 *   The old 4-digit AR sub-ledger range (1301–1399) only allowed 90 customers.
 *   With 6-digit codes the sub-ledger uses 7-digit codes — 99,999 capacity.
 *
 * NEW HIERARCHY (6-digit main COA):
 *   X00000  Level 1  Category    divisible by 100000   e.g. 100000  Assets
 *   XX0000  Level 2  Group       divisible by  10000   e.g. 110000  Current Assets
 *   XXX000  Level 3  Sub-Group   divisible by   1000   e.g. 113000  Trade Receivables
 *   XXXX00  Level 4  Sub-Detail  divisible by    100   e.g. 113100  AR Control
 *   XXXXX0  Level 5  Segment     divisible by     10   e.g. 113110  AR – Domestic
 *   XXXXXX  Level 6  Posting     NOT divisible by 10   e.g. 113111  AR – Misc. Posting
 *
 * SUB-LEDGER (7-digit — always posting, never a COA pivot):
 *   AR debtors   1300001–1399999   up to 99,999 customers
 *   AP creditors 2100001–2199999   up to 99,999 suppliers
 *
 * COLUMN: accounts.code   VARCHAR(4) → VARCHAR(10)
 * CHECK:  '^[0-9]{4}$'   → '^[0-9]{6,10}$'
 *         (6-digit main + 7–10 digit sub-ledger)
 *
 * NOTE: Existing 4-digit COA rows are TRUNCATED — the COA must be re-seeded
 *       using 6-digit codes via Settings → Chart of Accounts template.
 *       (Same approach as migration 3 which truncated 8-digit rows.)
 */
export class WidenAccountCode1000000000009 implements MigrationInterface {
  name = 'WidenAccountCode1000000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /* 1. Clear all 4-digit COA rows — they are incompatible with 6-digit scheme.
          Sub-ledger rows (13xxxxx / 21xxxxx) also cleared since none exist yet. */
    await queryRunner.query(`TRUNCATE TABLE "accounts" RESTART IDENTITY CASCADE`);

    /* 2. Drop the old 4-digit-only constraint */
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_4digit"`,
    );

    /* 3. Widen the code column: VARCHAR(4) → VARCHAR(10) */
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(10)`,
    );

    /* 4. Add flexible constraint:
          - 6 digits  → main COA account  (e.g. 113100)
          - 7–10 digits → sub-ledger leaf  (e.g. 1300001 for a customer AR account) */
    await queryRunner.query(
      `ALTER TABLE "accounts"
         ADD CONSTRAINT "CHK_accounts_code_6to10digit"
         CHECK ("code" ~ '^[0-9]{6,10}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /* Remove any 6+ digit accounts, restore 4-digit constraint */
    await queryRunner.query(`DELETE FROM "accounts" WHERE LENGTH("code") > 4`);

    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_6to10digit"`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(4)`,
    );

    await queryRunner.query(
      `ALTER TABLE "accounts"
         ADD CONSTRAINT "CHK_accounts_code_4digit"
         CHECK ("code" ~ '^[0-9]{4}$')`,
    );
  }
}
