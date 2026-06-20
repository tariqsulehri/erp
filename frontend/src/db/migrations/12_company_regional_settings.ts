import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyRegionalSettings1745000000012 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS companies
        ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs',
        ADD COLUMN IF NOT EXISTS decimal_places INT NOT NULL DEFAULT 2,
        ADD COLUMN IF NOT EXISTS thousand_separator VARCHAR(5) NOT NULL DEFAULT ',',
        ADD COLUMN IF NOT EXISTS decimal_separator VARCHAR(5) NOT NULL DEFAULT '.',
        ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) NOT NULL DEFAULT 'dd/MM/yyyy',
        ADD COLUMN IF NOT EXISTS time_format VARCHAR(20) NOT NULL DEFAULT '12-hour',
        ADD COLUMN IF NOT EXISTS time_zone VARCHAR(80) NOT NULL DEFAULT 'Asia/Karachi',
        ADD COLUMN IF NOT EXISTS locale VARCHAR(20) NOT NULL DEFAULT 'en-PK',
        ADD COLUMN IF NOT EXISTS default_country_code CHAR(2) NOT NULL DEFAULT 'PK'
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'companies'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'chk_companies_decimal_places'
        ) THEN
          ALTER TABLE companies
            ADD CONSTRAINT chk_companies_decimal_places
            CHECK (decimal_places BETWEEN 0 AND 6);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS companies DROP CONSTRAINT IF EXISTS chk_companies_decimal_places`);
    await queryRunner.query(`
      ALTER TABLE IF EXISTS companies
        DROP COLUMN IF EXISTS default_country_code,
        DROP COLUMN IF EXISTS locale,
        DROP COLUMN IF EXISTS time_zone,
        DROP COLUMN IF EXISTS time_format,
        DROP COLUMN IF EXISTS date_format,
        DROP COLUMN IF EXISTS decimal_separator,
        DROP COLUMN IF EXISTS thousand_separator,
        DROP COLUMN IF EXISTS decimal_places,
        DROP COLUMN IF EXISTS currency_symbol
    `);
  }
}
