import { prisma } from '../../db/prisma.js';

export interface GeneralSettingsDto {
  id: string | null;
  company_id: string;
  default_country_code: string;
  time_zone: string;
  locale: string;
  date_format: string;
  time_format: '12-hour' | '24-hour';
  currency_code: string;
  currency_symbol: string;
  currency_position: 'prefix' | 'suffix';
  decimal_places: number;
  thousand_separator: string;
  decimal_separator: string;
  is_active: boolean;
}

export interface GeneralSettingsUpdateInput {
  default_country_code?: string | null;
  time_zone?: string | null;
  locale?: string | null;
  date_format?: string | null;
  time_format?: '12-hour' | '24-hour' | null;
  currency_code?: string | null;
  currency_symbol?: string | null;
  currency_position?: 'prefix' | 'suffix' | null;
  decimal_places?: number;
  thousand_separator?: string | null;
  decimal_separator?: string | null;
  is_active?: boolean;
}

const defaultGeneralSettings = {
  default_country_code: 'PK',
  time_zone: 'Asia/Karachi',
  locale: 'en-PK',
  date_format: 'dd/MM/yyyy',
  time_format: '12-hour' as const,
  currency_code: 'PKR',
  currency_symbol: 'Rs',
  currency_position: 'prefix' as const,
  decimal_places: 2,
  thousand_separator: ',',
  decimal_separator: '.',
  is_active: true,
};

export class GeneralSettingsService {
  async getForCompany(companyId: string): Promise<GeneralSettingsDto> {
    const rows = await prisma.$queryRaw<GeneralSettingsDto[]>`
      SELECT
        id,
        company_id,
        default_country_code,
        time_zone,
        locale,
        date_format,
        time_format,
        currency_code,
        currency_symbol,
        currency_position,
        decimal_places,
        thousand_separator,
        decimal_separator,
        is_active
      FROM general_settings
      WHERE company_id = CAST(${companyId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;

    return rows[0] ?? {
      id: null,
      company_id: companyId,
      ...defaultGeneralSettings,
    };
  }

  async updateForCompany(companyId: string, input: GeneralSettingsUpdateInput): Promise<GeneralSettingsDto> {
    const current = await this.getForCompany(companyId);
    const next = {
      default_country_code: input.default_country_code ?? current.default_country_code,
      time_zone: input.time_zone ?? current.time_zone,
      locale: input.locale ?? current.locale,
      date_format: input.date_format ?? current.date_format,
      time_format: input.time_format ?? current.time_format,
      currency_code: input.currency_code ?? current.currency_code,
      currency_symbol: input.currency_symbol ?? current.currency_symbol,
      currency_position: input.currency_position ?? current.currency_position,
      decimal_places: input.decimal_places ?? current.decimal_places,
      thousand_separator: input.thousand_separator ?? current.thousand_separator,
      decimal_separator: input.decimal_separator ?? current.decimal_separator,
      is_active: input.is_active ?? current.is_active,
    };

    const rows = await prisma.$queryRaw<GeneralSettingsDto[]>`
      INSERT INTO general_settings (
        company_id,
        default_country_code,
        time_zone,
        locale,
        date_format,
        time_format,
        currency_code,
        currency_symbol,
        currency_position,
        decimal_places,
        thousand_separator,
        decimal_separator,
        is_active
      )
      VALUES (
        CAST(${companyId} AS uuid),
        ${next.default_country_code},
        ${next.time_zone},
        ${next.locale},
        ${next.date_format},
        ${next.time_format},
        ${next.currency_code},
        ${next.currency_symbol},
        ${next.currency_position},
        ${next.decimal_places},
        ${next.thousand_separator},
        ${next.decimal_separator},
        ${next.is_active}
      )
      ON CONFLICT (company_id) DO UPDATE SET
        default_country_code = EXCLUDED.default_country_code,
        time_zone = EXCLUDED.time_zone,
        locale = EXCLUDED.locale,
        date_format = EXCLUDED.date_format,
        time_format = EXCLUDED.time_format,
        currency_code = EXCLUDED.currency_code,
        currency_symbol = EXCLUDED.currency_symbol,
        currency_position = EXCLUDED.currency_position,
        decimal_places = EXCLUDED.decimal_places,
        thousand_separator = EXCLUDED.thousand_separator,
        decimal_separator = EXCLUDED.decimal_separator,
        is_active = EXCLUDED.is_active,
        updated_at = now()
      RETURNING
        id,
        company_id,
        default_country_code,
        time_zone,
        locale,
        date_format,
        time_format,
        currency_code,
        currency_symbol,
        currency_position,
        decimal_places,
        thousand_separator,
        decimal_separator,
        is_active
    `;

    return rows[0];
  }
}
