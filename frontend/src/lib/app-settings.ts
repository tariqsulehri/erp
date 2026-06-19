import { formatCurrency } from '@/lib/decimal';

export const appFormatSettings = {
  locale: 'en-PK',
  dateInputFormat: 'yyyy-MM-dd',
  dateDisplayFormat: 'dd/MM/yyyy',
  currencyCode: 'PKR',
  currencySymbol: 'Rs',
  decimalPlaces: 2,
  thousandsSeparator: ',',
  decimalSeparator: '.',
} as const;

export function formatNumber(value: number | string) {
  return formatCurrency(
    value,
    appFormatSettings.decimalPlaces,
    appFormatSettings.thousandsSeparator,
    appFormatSettings.decimalSeparator,
  );
}

export function formatMoney(value: number | string) {
  return `${appFormatSettings.currencySymbol} ${formatNumber(value)}`;
}
