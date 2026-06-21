import type { CSSProperties } from 'react';
import { formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';

export type VoucherMessageKind = 'success' | 'error';

export const today = () => new Date().toISOString().slice(0, 10);

export const cleanAmount = (value: string) => value.replace(/,/g, '');
export const amountValue = (value: string) => Number(cleanAmount(value) || 0);
export const validAmountPattern = /^\d+(\.\d{1,2})?$/;

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function dateInputToDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function friendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;

  const message = error.message.trim();
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection failed. Please check the backend service and try again.';
  }
  if (message.includes('Date does not fall within any active fiscal year')) {
    return 'Date does not fall within any active fiscal year.';
  }
  if (message.includes('Company ID not set')) {
    return 'Company setup is incomplete. Please select or configure the company first.';
  }
  if (message.toLowerCase().includes('unauthorized')) {
    return 'Your session is not valid. Please sign in again.';
  }
  if (message.includes('Unable to process')) return message;
  return message;
}

export function sanitizeAmountInput(value: string) {
  const withoutCommas = cleanAmount(value).replace(/[^0-9.]/g, '');
  const [whole = '', ...decimalParts] = withoutCommas.split('.');
  const decimals = decimalParts.join('').slice(0, 2);
  return decimalParts.length > 0 ? `${whole}.${decimals}` : whole;
}

export function formatAmountInput(value: string, settings?: AppFormatSettingsSource | null) {
  const numericValue = amountValue(value);
  return numericValue > 0 ? formatNumber(numericValue, settings) : '';
}

export function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    color,
    background,
    fontSize: '0.68rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}

export function tableHeadStyle(right = false): CSSProperties {
  return {
    height: 30,
    padding: '5px 7px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    border: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
  };
}

export function tableCellStyle(width?: number): CSSProperties {
  return {
    width,
    padding: 4,
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-surface)',
    verticalAlign: 'middle',
  };
}

export const compactInputStyle: CSSProperties = {
  height: 28,
  minHeight: 28,
  padding: '3px 8px',
  fontSize: '0.76rem',
};

export const compactNumericInputStyle: CSSProperties = {
  ...compactInputStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
};

export const compactDateInputStyle: CSSProperties = {
  ...compactInputStyle,
  padding: '3px 2px 3px 5px',
  fontSize: '0.72rem',
};

export const compactMoneyInputStyle: CSSProperties = {
  ...compactNumericInputStyle,
  fontWeight: 800,
};

export const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
};

export const voucherSummaryFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 12,
  alignItems: 'center',
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 10,
  minHeight: 66,
  overflow: 'hidden',
};

export const voucherSummaryValuesStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  overflow: 'hidden',
};
