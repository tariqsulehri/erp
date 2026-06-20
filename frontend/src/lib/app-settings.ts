import { formatCurrency } from '@/lib/decimal';

export const APP_CURRENCY_OPTIONS = [
  { code: 'PKR', label: 'PKR - Pakistani Rupee', symbol: 'Rs' },
  { code: 'USD', label: 'USD - US Dollar', symbol: '$' },
  { code: 'EUR', label: 'EUR - Euro', symbol: 'EUR' },
  { code: 'GBP', label: 'GBP - British Pound', symbol: 'GBP' },
  { code: 'AED', label: 'AED - UAE Dirham', symbol: 'AED' },
  { code: 'SAR', label: 'SAR - Saudi Riyal', symbol: 'SAR' },
  { code: 'INR', label: 'INR - Indian Rupee', symbol: 'INR' },
] as const;

export const APP_COUNTRY_OPTIONS = [
  { code: 'PK', label: 'Pakistan' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IN', label: 'India' },
] as const;

export const APP_DATE_FORMAT_OPTIONS = [
  { value: 'dd/MM/yyyy', label: '31/12/2026' },
  { value: 'MM/dd/yyyy', label: '12/31/2026' },
  { value: 'yyyy-MM-dd', label: '2026-12-31' },
  { value: 'dd-MMM-yyyy', label: '31-Dec-2026' },
] as const;

export const APP_TIME_ZONE_OPTIONS = [
  { value: 'Asia/Karachi', label: 'Pakistan Time - Asia/Karachi' },
  { value: 'Asia/Dubai', label: 'UAE Time - Asia/Dubai' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia Time - Asia/Riyadh' },
  { value: 'Asia/Kolkata', label: 'India Time - Asia/Kolkata' },
  { value: 'Europe/London', label: 'United Kingdom Time - Europe/London' },
  { value: 'America/New_York', label: 'US Eastern Time - America/New_York' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const APP_LOCALE_OPTIONS = [
  { value: 'en-PK', label: 'English (Pakistan)' },
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'ar-AE', label: 'Arabic (United Arab Emirates)' },
  { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
  { value: 'hi-IN', label: 'Hindi (India)' },
] as const;

export const APP_CURRENCY_SYMBOLS = APP_CURRENCY_OPTIONS.reduce<Record<string, string>>((symbols, currency) => {
  symbols[currency.code] = currency.symbol;
  return symbols;
}, {});

export const APP_CURRENCY_POSITION_OPTIONS = [
  { value: 'prefix', label: 'Before Amount' },
  { value: 'suffix', label: 'After Amount' },
] as const;

export type CurrencyPosition = typeof APP_CURRENCY_POSITION_OPTIONS[number]['value'];

export const defaultAppFormatSettings = {
  locale: 'en-PK',
  dateInputFormat: 'yyyy-MM-dd',
  dateDisplayFormat: 'dd/MM/yyyy',
  timeFormat: '12-hour',
  timeZone: 'Asia/Karachi',
  countryCode: 'PK',
  currencyCode: 'PKR',
  currencySymbol: 'Rs',
  currencyPosition: 'prefix' as CurrencyPosition,
  decimalPlaces: 2,
  thousandsSeparator: ',',
  decimalSeparator: '.',
} as const;

export const appFormatSettings = defaultAppFormatSettings;

export interface AppFormatSettingsSource {
  locale?: string | null;
  date_format?: string | null;
  dateDisplayFormat?: string | null;
  time_format?: string | null;
  timeFormat?: string | null;
  time_zone?: string | null;
  timeZone?: string | null;
  default_country_code?: string | null;
  countryCode?: string | null;
  currency_code?: string | null;
  currencyCode?: string | null;
  currency_symbol?: string | null;
  currencySymbol?: string | null;
  currency_position?: string | null;
  currencyPosition?: string | null;
  decimal_places?: number | null;
  decimalPlaces?: number | null;
  thousand_separator?: string | null;
  thousandsSeparator?: string | null;
  decimal_separator?: string | null;
  decimalSeparator?: string | null;
}

function normalizeCurrencyPosition(position?: string | null): CurrencyPosition {
  return position === 'suffix' ? 'suffix' : 'prefix';
}

export function normalizeFormatSettings(settings?: AppFormatSettingsSource | null) {
  return {
    locale: settings?.locale ?? defaultAppFormatSettings.locale,
    dateInputFormat: defaultAppFormatSettings.dateInputFormat,
    dateDisplayFormat: settings?.date_format ?? settings?.dateDisplayFormat ?? defaultAppFormatSettings.dateDisplayFormat,
    timeFormat: settings?.time_format ?? settings?.timeFormat ?? defaultAppFormatSettings.timeFormat,
    timeZone: settings?.time_zone ?? settings?.timeZone ?? defaultAppFormatSettings.timeZone,
    countryCode: settings?.default_country_code ?? settings?.countryCode ?? defaultAppFormatSettings.countryCode,
    currencyCode: settings?.currency_code ?? settings?.currencyCode ?? defaultAppFormatSettings.currencyCode,
    currencySymbol: settings?.currency_symbol ?? settings?.currencySymbol ?? defaultAppFormatSettings.currencySymbol,
    currencyPosition: normalizeCurrencyPosition(
      settings?.currency_position ?? settings?.currencyPosition ?? defaultAppFormatSettings.currencyPosition,
    ),
    decimalPlaces: settings?.decimal_places ?? settings?.decimalPlaces ?? defaultAppFormatSettings.decimalPlaces,
    thousandsSeparator: settings?.thousand_separator ?? settings?.thousandsSeparator ?? defaultAppFormatSettings.thousandsSeparator,
    decimalSeparator: settings?.decimal_separator ?? settings?.decimalSeparator ?? defaultAppFormatSettings.decimalSeparator,
  };
}

export function formatNumber(value: number | string, settings?: AppFormatSettingsSource | null) {
  const normalizedSettings = normalizeFormatSettings(settings);
  return formatCurrency(
    value,
    normalizedSettings.decimalPlaces,
    normalizedSettings.thousandsSeparator,
    normalizedSettings.decimalSeparator,
  );
}

export function formatMoney(value: number | string, settings?: AppFormatSettingsSource | null) {
  const normalizedSettings = normalizeFormatSettings(settings);
  const amount = formatNumber(value, normalizedSettings);
  return normalizedSettings.currencyPosition === 'suffix'
    ? `${amount} ${normalizedSettings.currencySymbol}`
    : `${normalizedSettings.currencySymbol} ${amount}`;
}

function parseDateValue(value: Date | string) {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function shortMonthName(monthIndex: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][monthIndex] ?? '';
}

export function formatDate(value: Date | string | null | undefined, settings?: AppFormatSettingsSource | null) {
  if (!value) return '';
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return '';

  const normalizedSettings = normalizeFormatSettings(settings);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());

  switch (normalizedSettings.dateDisplayFormat) {
    case 'MM/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'yyyy-MM-dd':
      return `${year}-${month}-${day}`;
    case 'dd-MMM-yyyy':
      return `${day}-${shortMonthName(date.getMonth())}-${year}`;
    case 'dd/MM/yyyy':
    default:
      return `${day}/${month}/${year}`;
  }
}
