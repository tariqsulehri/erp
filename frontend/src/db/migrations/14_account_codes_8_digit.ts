import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountCodes8Digit1745000000014 implements MigrationInterface {
  name = 'AccountCodes8Digit1745000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM accounts
          WHERE code !~ '^[0-9]+$'
             OR LENGTH(code) NOT IN (4, 6, 7, 8)
        ) THEN
          RAISE EXCEPTION 'Account Code conversion stopped. Existing account codes must be numeric and 4, 6, 7, or 8 digits.';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM voucher_lines
          WHERE account_code !~ '^[0-9]+$'
             OR LENGTH(account_code) NOT IN (4, 6, 7, 8)
        ) THEN
          RAISE EXCEPTION 'Voucher line Account Code conversion stopped. Existing account codes must be numeric and 4, 6, 7, or 8 digits.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_4digit"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_6to10digit"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_8digit"`);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "code" = CASE
        WHEN LENGTH("code") = 4 AND RIGHT("code", 1) = '0'
          THEN "code" || '0000'
        WHEN LENGTH("code") = 4
          THEN LEFT("code", 3) || '0000' || RIGHT("code", 1)
        WHEN LENGTH("code") = 6 AND RIGHT("code", 1) = '0'
          THEN "code" || '00'
        WHEN LENGTH("code") = 6
          THEN LEFT("code", 5) || '00' || RIGHT("code", 1)
        WHEN LENGTH("code") = 7
          THEN LEFT("code", 2) || '0' || SUBSTRING("code" FROM 3)
        ELSE "code"
      END
      WHERE LENGTH("code") IN (4, 6, 7)
    `);

    await queryRunner.query(`
      UPDATE "voucher_lines"
      SET "account_code" = CASE
        WHEN LENGTH("account_code") = 4 AND RIGHT("account_code", 1) = '0'
          THEN "account_code" || '0000'
        WHEN LENGTH("account_code") = 4
          THEN LEFT("account_code", 3) || '0000' || RIGHT("account_code", 1)
        WHEN LENGTH("account_code") = 6 AND RIGHT("account_code", 1) = '0'
          THEN "account_code" || '00'
        WHEN LENGTH("account_code") = 6
          THEN LEFT("account_code", 5) || '00' || RIGHT("account_code", 1)
        WHEN LENGTH("account_code") = 7
          THEN LEFT("account_code", 2) || '0' || SUBSTRING("account_code" FROM 3)
        ELSE "account_code"
      END
      WHERE LENGTH("account_code") IN (4, 6, 7)
    `);

    await queryRunner.query(`
      UPDATE "coa_templates"
      SET "accounts" = (
        SELECT jsonb_agg(
          CASE
            WHEN (elem->>'code') ~ '^[0-9]{8}$' THEN elem
            WHEN (elem->>'code') ~ '^[0-9]{7}$' THEN
              jsonb_set(elem, '{code}', to_jsonb(LEFT(elem->>'code', 2) || '0' || SUBSTRING(elem->>'code' FROM 3)))
            WHEN (elem->>'code') ~ '^[0-9]{6}$' AND RIGHT(elem->>'code', 1) = '0' THEN
              jsonb_set(elem, '{code}', to_jsonb((elem->>'code') || '00'))
            WHEN (elem->>'code') ~ '^[0-9]{6}$' THEN
              jsonb_set(elem, '{code}', to_jsonb(LEFT(elem->>'code', 5) || '00' || RIGHT(elem->>'code', 1)))
            WHEN (elem->>'code') ~ '^[0-9]{4}$' AND RIGHT(elem->>'code', 1) = '0' THEN
              jsonb_set(elem, '{code}', to_jsonb((elem->>'code') || '0000'))
            WHEN (elem->>'code') ~ '^[0-9]{4}$' THEN
              jsonb_set(elem, '{code}', to_jsonb(LEFT(elem->>'code', 3) || '0000' || RIGHT(elem->>'code', 1)))
            ELSE elem
          END
          ORDER BY elem->>'code'
        )
        FROM jsonb_array_elements("accounts") AS elem
      )
      WHERE "accounts" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(8)`);
    await queryRunner.query(`ALTER TABLE "voucher_lines" ALTER COLUMN "account_code" TYPE character varying(8)`);
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_code_8digit"
      CHECK ("code" ~ '^[0-9]{8}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_8digit"`);
    await queryRunner.query(`ALTER TABLE "voucher_lines" ALTER COLUMN "account_code" TYPE character varying(10)`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(10)`);
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_code_6to10digit"
      CHECK ("code" ~ '^[0-9]{6,10}$')
    `);
  }
}
