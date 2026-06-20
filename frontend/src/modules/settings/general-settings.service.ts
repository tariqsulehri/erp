import { AppDataSource } from '@/db/data-source';
import { Company } from '@/modules/companies/company.entity';
import { GeneralSetting } from './general-setting.entity';

export interface GeneralSettingsInput {
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

const defaultSettings = {
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
  constructor(private companyId: string) {}

  private repo() {
    return AppDataSource.getRepository(GeneralSetting);
  }

  private companyRepo() {
    return AppDataSource.getRepository(Company);
  }

  private async createDefaultSettings() {
    const company = await this.companyRepo().findOne({ where: { id: this.companyId } });
    const settings = this.repo().create({
      ...defaultSettings,
      company_id: this.companyId,
      default_country_code: company?.default_country_code ?? defaultSettings.default_country_code,
      time_zone: company?.time_zone ?? defaultSettings.time_zone,
      locale: company?.locale ?? defaultSettings.locale,
      date_format: company?.date_format ?? defaultSettings.date_format,
      time_format: company?.time_format ?? defaultSettings.time_format,
      currency_code: company?.currency_code ?? defaultSettings.currency_code,
      currency_symbol: company?.currency_symbol ?? defaultSettings.currency_symbol,
      currency_position: defaultSettings.currency_position,
      decimal_places: company?.decimal_places ?? defaultSettings.decimal_places,
      thousand_separator: company?.thousand_separator ?? defaultSettings.thousand_separator,
      decimal_separator: company?.decimal_separator ?? defaultSettings.decimal_separator,
    });

    return this.repo().save(settings);
  }

  async get(): Promise<GeneralSetting> {
    const existing = await this.repo().findOne({ where: { company_id: this.companyId } });
    if (existing) return existing;
    return this.createDefaultSettings();
  }

  async update(input: GeneralSettingsInput): Promise<GeneralSetting> {
    if (
      input.thousand_separator &&
      input.decimal_separator &&
      input.thousand_separator === input.decimal_separator
    ) {
      throw new Error('Thousand Separator and Decimal Separator cannot be the same.');
    }

    const current = await this.get();
    const next = this.repo().merge(current, {
      ...input,
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
    });

    return this.repo().save(next);
  }
}
