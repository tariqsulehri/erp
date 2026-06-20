import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountCodes10DigitBlocks1745000000015 implements MigrationInterface {
  name = 'AccountCodes10DigitBlocks1745000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM accounts
          WHERE code !~ '^[0-9]+$'
             OR LENGTH(code) NOT IN (4, 6, 7, 8, 10)
        ) THEN
          RAISE EXCEPTION 'Account Code conversion stopped. Existing account codes must be numeric and 4, 6, 7, 8, or 10 digits.';
        END IF;

        IF EXISTS (
          SELECT 1
          FROM voucher_lines
          WHERE account_code !~ '^[0-9]+$'
             OR LENGTH(account_code) NOT IN (4, 6, 7, 8, 10)
        ) THEN
          RAISE EXCEPTION 'Voucher line Account Code conversion stopped. Existing account codes must be numeric and 4, 6, 7, 8, or 10 digits.';
        END IF;
      END $$;
    `);

    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_8digit"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_10digit"`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(10)`);
    await queryRunner.query(`ALTER TABLE "voucher_lines" ALTER COLUMN "account_code" TYPE character varying(10)`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION pg_temp.convert_account_code_to_10_digit_blocks(old_code text)
      RETURNS text AS $$
      DECLARE
        code_text text := trim(old_code);
        eight_digit text;
        offset_value bigint;
        subgroup_no int;
        posting_no int;
      BEGIN
        IF code_text ~ '^[0-9]{10}$' THEN
          RETURN code_text;
        END IF;

        IF code_text !~ '^[0-9]+$' THEN
          RAISE EXCEPTION 'Account Code % is not numeric.', old_code;
        END IF;

        IF code_text ~ '^[0-9]{7}$' THEN
          eight_digit := left(code_text, 2) || '0' || substring(code_text from 3);
          RETURN pg_temp.convert_account_code_to_10_digit_blocks(eight_digit);
        END IF;

        IF code_text ~ '^[0-9]{6}$' THEN
          IF right(code_text, 1) = '0' THEN
            eight_digit := code_text || '00';
          ELSE
            eight_digit := left(code_text, 5) || '00' || right(code_text, 1);
          END IF;
          RETURN pg_temp.convert_account_code_to_10_digit_blocks(eight_digit);
        END IF;

        IF code_text ~ '^[0-9]{4}$' THEN
          IF right(code_text, 1) = '0' THEN
            eight_digit := code_text || '0000';
          ELSE
            eight_digit := left(code_text, 3) || '0000' || right(code_text, 1);
          END IF;
          RETURN pg_temp.convert_account_code_to_10_digit_blocks(eight_digit);
        END IF;

        IF code_text !~ '^[0-9]{8}$' THEN
          RAISE EXCEPTION 'Account Code % cannot be converted to 10 digits.', old_code;
        END IF;

        IF code_text BETWEEN '13000001' AND '13999999' THEN
          offset_value := code_text::bigint - 13000000;
          subgroup_no := floor((offset_value - 1) / 9999)::int + 1;
          posting_no := ((offset_value - 1) % 9999)::int + 1;
          IF subgroup_no > 99 THEN
            RAISE EXCEPTION 'Customer Account Code % cannot fit into 01 03 xx nnnn range.', old_code;
          END IF;
          RETURN '0103' || lpad(subgroup_no::text, 2, '0') || lpad(posting_no::text, 4, '0');
        END IF;

        IF code_text BETWEEN '21000001' AND '21999999' THEN
          offset_value := code_text::bigint - 21000000;
          subgroup_no := floor((offset_value - 1) / 9999)::int + 1;
          posting_no := ((offset_value - 1) % 9999)::int + 1;
          IF subgroup_no > 99 THEN
            RAISE EXCEPTION 'Supplier Account Code % cannot fit into 02 01 xx nnnn range.', old_code;
          END IF;
          RETURN '0201' || lpad(subgroup_no::text, 2, '0') || lpad(posting_no::text, 4, '0');
        END IF;

        RETURN lpad(left(code_text, 1), 2, '0')
          || lpad(substring(code_text from 2 for 1), 2, '0')
          || substring(code_text from 3 for 1) || '0'
          || lpad(substring(code_text from 4 for 1) || right(code_text, 2), 4, '0');
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      UPDATE "accounts"
      SET "code" = pg_temp.convert_account_code_to_10_digit_blocks("code")
      WHERE LENGTH("code") <> 10
    `);

    await queryRunner.query(`
      UPDATE "voucher_lines"
      SET "account_code" = pg_temp.convert_account_code_to_10_digit_blocks("account_code")
      WHERE LENGTH("account_code") <> 10
    `);

    await queryRunner.query(`
      UPDATE "coa_templates"
      SET "accounts" = (
        SELECT jsonb_agg(
          jsonb_set(elem, '{code}', to_jsonb(pg_temp.convert_account_code_to_10_digit_blocks(elem->>'code')))
          ORDER BY pg_temp.convert_account_code_to_10_digit_blocks(elem->>'code')
        )
        FROM jsonb_array_elements("accounts") AS elem
      )
      WHERE "accounts" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_code_10digit"
      CHECK ("code" ~ '^[0-9]{10}$')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP CONSTRAINT IF EXISTS "CHK_accounts_code_10digit"`);
    await queryRunner.query(`ALTER TABLE "voucher_lines" ALTER COLUMN "account_code" TYPE character varying(8) USING right("account_code", 8)`);
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "code" TYPE character varying(8) USING right("code", 8)`);
    await queryRunner.query(`
      ALTER TABLE "accounts"
      ADD CONSTRAINT "CHK_accounts_code_8digit"
      CHECK ("code" ~ '^[0-9]{8}$')
    `);
  }
}
