import { MigrationInterface, QueryRunner } from 'typeorm';

export class GeneralSettings1745000000013 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS general_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id UUID NOT NULL,
        default_country_code CHAR(2) NOT NULL DEFAULT 'PK',
        time_zone VARCHAR(80) NOT NULL DEFAULT 'Asia/Karachi',
        locale VARCHAR(20) NOT NULL DEFAULT 'en-PK',
        date_format VARCHAR(20) NOT NULL DEFAULT 'dd/MM/yyyy',
        time_format VARCHAR(20) NOT NULL DEFAULT '12-hour',
        currency_code CHAR(3) NOT NULL DEFAULT 'PKR',
        currency_symbol VARCHAR(10) NOT NULL DEFAULT 'Rs',
        decimal_places INT NOT NULL DEFAULT 2,
        thousand_separator VARCHAR(5) NOT NULL DEFAULT ',',
        decimal_separator VARCHAR(5) NOT NULL DEFAULT '.',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_general_settings_company UNIQUE (company_id),
        CONSTRAINT fk_general_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT chk_general_settings_decimal_places CHECK (decimal_places BETWEEN 0 AND 6),
        CONSTRAINT chk_general_settings_separators CHECK (thousand_separator <> decimal_separator),
        CONSTRAINT chk_general_settings_time_format CHECK (time_format IN ('12-hour', '24-hour'))
      )
    `);

    await queryRunner.query(`
      INSERT INTO general_settings (
        company_id,
        default_country_code,
        time_zone,
        locale,
        date_format,
        time_format,
        currency_code,
        currency_symbol,
        decimal_places,
        thousand_separator,
        decimal_separator,
        is_active
      )
      SELECT
        id,
        COALESCE(default_country_code, 'PK'),
        COALESCE(time_zone, 'Asia/Karachi'),
        COALESCE(locale, 'en-PK'),
        COALESCE(date_format, 'dd/MM/yyyy'),
        COALESCE(time_format, '12-hour'),
        COALESCE(currency_code, 'PKR'),
        COALESCE(currency_symbol, 'Rs'),
        COALESCE(decimal_places, 2),
        COALESCE(thousand_separator, ','),
        COALESCE(decimal_separator, '.'),
        true
      FROM companies
      ON CONFLICT (company_id) DO NOTHING
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_general_settings_active ON general_settings(company_id, is_active)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_general_settings_active`);
    await queryRunner.query(`DROP TABLE IF EXISTS general_settings`);
  }
}
