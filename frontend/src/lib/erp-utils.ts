import Decimal from 'decimal.js';
import { formatNumber } from '@/lib/app-settings';

export function friendlyErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message.trim()) return fallback;
  const message = error.message.trim();
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return 'Connection failed. Please check the backend service and try again.';
  }
  if (message.toLowerCase().includes('unauthorized')) {
    return 'Your session is not valid. Please sign in again.';
  }
  if (message.includes('Company ID not set')) {
    return 'Company setup is incomplete. Please select or configure the company first.';
  }
  return message;
}

export function cleanNumber(value: string) {
  return value.replace(/,/g, '');
}

export function numericValue(value: string) {
  return Number(cleanNumber(value) || 0);
}

export function decimal(value: string | number | Decimal) {
  return new Decimal(cleanNumber(String(value)) || 0);
}

export function sanitizeMoneyInput(value: string, decimals = 2) {
  const withoutCommas = cleanNumber(value).replace(/[^0-9.]/g, '');
  const [whole = '', ...decimalParts] = withoutCommas.split('.');
  const decimalPart = decimalParts.join('').slice(0, decimals);
  return decimalParts.length > 0 ? `${whole}.${decimalPart}` : whole;
}

export function formatAmountInput(value: string, settings?: Parameters<typeof formatNumber>[1]) {
  const numeric = numericValue(value);
  return numeric > 0 ? formatNumber(numeric, settings) : '';
}

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

export function addDays(value: string, days: number) {
  const date = dateInputToDate(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
