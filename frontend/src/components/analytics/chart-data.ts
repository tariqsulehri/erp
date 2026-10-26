import { normalizeFormatSettings, type AppFormatSettingsSource } from '@/lib/app-settings';

/** 'YYYY-MM' keys from `fromKey` to `toKey`, both included. */
export function monthKeysBetween(fromKey: string, toKey: string) {
  const keys: string[] = [];
  let [year, month] = fromKey.split('-').map(Number);
  const [endYear, endMonth] = toKey.split('-').map(Number);
  // A two-year cap keeps a wide date range from drawing hundreds of empty columns.
  while ((year < endYear || (year === endYear && month <= endMonth)) && keys.length < 24) {
    keys.push(`${year}-${String(month).padStart(2, '0')}`);
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return keys;
}

export function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Monthly rows with the empty months filled in, so a quiet month shows as zero instead of disappearing.
 * The range runs from `fromKey` (or the first month with data) to `toKey` (or the last month with data),
 * never past the current month.
 */
export function fillMonths<T extends { monthKey: string }>(
  rows: T[],
  empty: (monthKey: string) => T,
  range: { fromKey?: string; toKey?: string } = {},
) {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((left, right) => left.monthKey.localeCompare(right.monthKey));
  const first = range.fromKey && range.fromKey < sorted[0].monthKey ? range.fromKey : sorted[0].monthKey;
  const lastData = sorted[sorted.length - 1].monthKey;
  const requestedEnd = range.toKey && range.toKey > lastData ? range.toKey : lastData;
  const thisMonth = currentMonthKey();
  const last = requestedEnd > thisMonth && lastData <= thisMonth ? thisMonth : requestedEnd;
  const byKey = new Map(sorted.map(row => [row.monthKey, row]));
  const keys = monthKeysBetween(first, last);
  return keys.map(key => byKey.get(key) ?? empty(key));
}

/** Short month label from the company locale: "Jul" within one year, "Jul 26" across years. */
export function monthLabeler(monthKeys: string[], settings?: AppFormatSettingsSource | null) {
  const locale = normalizeFormatSettings(settings).locale;
  const years = new Set(monthKeys.map(key => key.slice(0, 4)));
  return (monthKey: string) => {
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return years.size > 1
      ? date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
      : date.toLocaleDateString(locale, { month: 'short' });
  };
}

/** Full month label for tooltips and tables, e.g. "July 2026". */
export function longMonthLabel(monthKey: string, settings?: AppFormatSettingsSource | null) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(normalizeFormatSettings(settings).locale, { month: 'long', year: 'numeric' });
}

/** Axis ticks and chart labels in compact form: 950, 1.2K, 3.4M, using the company decimal separator. */
export function compactAxis(settings?: AppFormatSettingsSource | null) {
  const { decimalSeparator, thousandsSeparator } = normalizeFormatSettings(settings);
  const short = (value: number) => {
    const text = value.toFixed(1).replace(/\.0$/, '');
    const [whole, fraction] = text.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    return fraction ? `${grouped}${decimalSeparator}${fraction}` : grouped;
  };
  return (value: number) => {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) return `${short(value / 1_000_000)}M`;
    if (absolute >= 1_000) return `${short(value / 1_000)}K`;
    return short(Math.round(value));
  };
}

/** Change of the last month against the month before it, in percent; null when there is nothing to compare. */
export function lastMonthChange(values: number[]) {
  if (values.length < 2) return null;
  const previous = values[values.length - 2];
  const latest = values[values.length - 1];
  if (previous === 0) return null;
  return (latest - previous) / Math.abs(previous) * 100;
}
