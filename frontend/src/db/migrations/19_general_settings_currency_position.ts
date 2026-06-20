import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneralSettingsCurrencyPosition1745000000019 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE general_settings
      ADD COLUMN IF NOT EXISTS currency_position VARCHAR(10) NOT NULL DEFAULT 'prefix'
    `);

    await queryRunner.query(`
      ALTER TABLE general_settings
      DROP CONSTRAINT IF EXISTS chk_general_settings_currency_position
    `);

    await queryRunner.query(`
      ALTER TABLE general_settings
      ADD CONSTRAINT chk_general_settings_currency_position
      CHECK (currency_position IN ('prefix', 'suffix'))
    `);

    await queryRunner.query(`
      ALTER TABLE customers
      ALTER COLUMN currency_code SET DEFAULT 'PKR'
    `);

    await queryRunner.query(`
      ALTER TABLE suppliers
      ALTER COLUMN currency_code SET DEFAULT 'PKR'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE suppliers
      ALTER COLUMN currency_code SET DEFAULT 'USD'
    `);

    await queryRunner.query(`
      ALTER TABLE customers
      ALTER COLUMN currency_code SET DEFAULT 'USD'
    `);

    await queryRunner.query(`
      ALTER TABLE general_settings
      DROP CONSTRAINT IF EXISTS chk_general_settings_currency_position
    `);

    await queryRunner.query(`
      ALTER TABLE general_settings
      DROP COLUMN IF EXISTS currency_position
    `);
  }
}
