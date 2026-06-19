import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 9 — Switch COA from 4-digit to 6-digit codes  (IN-PLACE, data-safe)
 *
 * WHY:
 *   The 4-digit scheme supports only 4 hierarchy levels, which is insufficient
 *   for professional accounting.  6-digit codes give 6 levels of detail and are
 *   the international SMB standard (used by QuickBooks, SAP B1, Tally, etc.).
 *
 *   The old 4-digit AR sub-ledger range (1301–1399) allowed only 90 customers.
 *   With 6-digit main COA the sub-ledger moves to 7-digit ranges giving 99,999
 *   capacity per company.
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
 * COLUMN:  accounts.code  VARCHAR(4)  → VARCHAR(10)
 * CHECK:   '^[0-9]{4}$'  → '^[0-9]{6,10}$'
 *
 * CODE CONVERSION (existing 4-digit rows — no data loss):
 *   Non-posting headers:  code || '00'   (1000 → 100000, 1100 → 110000 …)
 *   Posting leaf accounts: code || '01'  (1111 → 111101, 2121 → 212101 …)
 *
 *   This preserves the full hierarchy relationship in the new 6-digit scheme:
 *     100000 ÷ 100000 = 1 → L1 Category  ✓
 *     110000 ÷  10000 = 1 → L2 Group      ✓
 *     111000 ÷   1000 = 1 → L3 Sub-Group  ✓
 *     111101 not ÷ 10     → L6 Posting    ✓
 */
export class WidenAccountCode1000000000009 implements MigrationInterface {
  name = 'WidenAccountCode1000000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {

    /* ── Step 1: drop the old 4-digit-only CHECK ──────────────────── */
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_4digit"`,
    );

    /* ── Step 2: widen the column VARCHAR(4) → VARCHAR(10) ────────── */
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(10)`,
    );

    /* ── Step 3: IN-PLACE conversion of existing 4-digit COA rows ─── */
    /*
     * Non-posting accounts (headers / group nodes) get '00' appended:
     *   1000 → 100000  (L1, divisible by 100000)
     *   1100 → 110000  (L2, divisible by  10000)
     *   1110 → 111000  (L3, divisible by   1000)
     *
     * Posting leaf accounts get '01' appended:
     *   1111 → 111101  (L6, not divisible by 10)
     *   2121 → 212101  (L6, not divisible by 10)
     *
     * The WHERE clause is LENGTH = 4 so any existing 6-digit or 7-digit
     * rows (e.g. from a partial re-run) are left untouched.
     */
    await queryRunner.query(`
      UPDATE "accounts"
      SET    "code" = "code" || CASE WHEN "is_posting" = true THEN '01' ELSE '00' END
      WHERE  LENGTH("code") = 4
    `);

    /* ── Step 4: convert matching codes inside coa_templates JSONB ── */
    /*
     * The template stores accounts as a JSONB array.  We walk the array,
     * detect 4-digit codes, and apply the same posting/non-posting rule.
     *
     * jsonb_array_elements() unnests the array; jsonb_set() replaces the
     * 'code' key; jsonb_agg() re-assembles the array.
     */
    await queryRunner.query(`
      UPDATE "coa_templates"
      SET    "accounts" = (
        SELECT jsonb_agg(
          CASE
            WHEN (elem->>'code') ~ '^[0-9]{4}$'
            THEN jsonb_set(
                   elem,
                   '{code}',
                   to_jsonb(
                     (elem->>'code') ||
                     CASE WHEN (elem->>'is_posting')::boolean THEN '01' ELSE '00' END
                   )
                 )
            ELSE elem
          END
        )
        FROM jsonb_array_elements("accounts") AS elem
      )
      WHERE "accounts" IS NOT NULL
    `);

    /* ── Step 5: add the new flexible CHECK constraint ────────────── */
    /*
     * 6 digits  → main COA account  (e.g. 113100)
     * 7–10 digits → sub-ledger leaf  (e.g. 1300001 for a customer AR account)
     */
    await queryRunner.query(
      `ALTER TABLE "accounts"
         ADD CONSTRAINT "CHK_accounts_code_6to10digit"
         CHECK ("code" ~ '^[0-9]{6,10}$')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    /* ── Step 1: remove sub-ledger accounts (7+ digit, non-reversible) */
    await queryRunner.query(`DELETE FROM "accounts" WHERE LENGTH("code") > 6`);

    /* ── Step 2: revert coa_templates JSONB back to 4-digit codes ─── */
    await queryRunner.query(`
      UPDATE "coa_templates"
      SET    "accounts" = (
        SELECT jsonb_agg(
          CASE
            WHEN LENGTH(elem->>'code') = 6
            THEN jsonb_set(elem, '{code}', to_jsonb(LEFT(elem->>'code', 4)))
            ELSE elem
          END
        )
        FROM jsonb_array_elements("accounts") AS elem
      )
      WHERE "accounts" IS NOT NULL
    `);

    /* ── Step 3: revert 6-digit account codes back to 4-digit ──────── */
    await queryRunner.query(`
      UPDATE "accounts"
      SET    "code" = LEFT("code", 4)
      WHERE  LENGTH("code") = 6
    `);

    /* ── Step 4: drop the 6-digit constraint ──────────────────────── */
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_6to10digit"`,
    );

    /* ── Step 5: shrink the column back to VARCHAR(4) ─────────────── */
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(4)`,
    );

    /* ── Step 6: restore the old 4-digit CHECK constraint ─────────── */
    await queryRunner.query(
      `ALTER TABLE "accounts"
         ADD CONSTRAINT "CHK_accounts_code_4digit"
         CHECK ("code" ~ '^[0-9]{4}$')`,
    );
  }
}
