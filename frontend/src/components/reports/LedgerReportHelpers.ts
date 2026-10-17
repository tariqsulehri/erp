import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatMoney } from '@/lib/app-settings';

export type BalanceSide = 'Debit' | 'Credit' | 'Balanced';

export function formatLedgerBalance(
  amount: string | number,
  side: BalanceSide,
  settings?: AppFormatSettingsSource | null,
) {
  if (side === 'Balanced') return formatMoney(0, settings);
  return `${formatMoney(amount, settings)} ${side === 'Debit' ? 'Dr' : 'Cr'}`;
}

export function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

export function firstDayOfCurrentYear() {
  const today = new Date();
  return `${today.getFullYear()}-01-01`;
}
