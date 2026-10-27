import type { FiscalYearItem } from '@/lib/api/fiscal-years';

export type YearBasis = 'calendar' | 'july' | 'april';
export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const YEAR_BASIS_OPTIONS: Array<{ value: YearBasis; label: string }> = [
  { value: 'calendar', label: 'Calendar Year (Jan 1 – Dec 31)' },
  { value: 'july',     label: 'July Basis (Jul 1 – Jun 30)' },
  { value: 'april',    label: 'April Basis (Apr 1 – Mar 31)' },
];

/** The year must split into equal whole-month periods; the backend rejects anything else. */
export const PERIOD_COUNT_OPTIONS = [
  { value: '12', label: '12 — Monthly' },
  { value: '6',  label: '6 — Every Two Months' },
  { value: '4',  label: '4 — Quarterly' },
  { value: '2',  label: '2 — Half-Yearly' },
  { value: '1',  label: '1 — Whole Year' },
];

export const YEAR_STATUS_TONE: Record<string, BadgeTone> = { open: 'success', closing: 'warning', closed: 'neutral', archived: 'neutral' };
export const PERIOD_STATUS_TONE: Record<string, BadgeTone> = { open: 'success', locked: 'warning', closed: 'neutral' };

/** "open" → "Open" for display; the stored value is unchanged. */
export function statusLabel(status: string) {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Not Set';
}

export function basisLabel(basis: string) {
  return { calendar: 'Calendar', july: 'July – June', april: 'April – March' }[basis] ?? statusLabel(basis);
}

/** Start and end dates for a basis, from the first calendar year in the name ("2026" or "2026-2027"). */
export function basisDates(basis: YearBasis, fiscalYearName: string) {
  const year = Number.parseInt(fiscalYearName, 10);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  if (basis === 'calendar') return { start_date: `${year}-01-01`, end_date: `${year}-12-31` };
  if (basis === 'july') return { start_date: `${year}-07-01`, end_date: `${year + 1}-06-30` };
  return { start_date: `${year}-04-01`, end_date: `${year + 1}-03-31` };
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Whole months that fit between start and the day after end (the backend's rule). */
export function wholeMonthsBetween(startDate: string, endDate: string) {
  const start = parseDate(startDate);
  const dayAfterEnd = addDays(parseDate(endDate), 1);
  let months = 0;
  while (addMonths(start, months + 1) <= dayAfterEnd) months += 1;
  return months;
}

export interface PeriodPreview {
  number: number;
  start_date: string;
  end_date: string;
}

/**
 * The periods the backend will create (FiscalYearService.buildPeriods): equal blocks of whole months, each
 * ending the day before the next starts. Returns the backend's message instead when the dates cannot be split.
 */
export function previewPeriods(startDate: string, endDate: string, count: number): { periods: PeriodPreview[]; problem?: string } {
  if (!startDate || !endDate) return { periods: [], problem: 'Enter a Start Date and an End Date.' };
  if (startDate >= endDate) return { periods: [], problem: 'End Date must be after Start Date.' };
  const months = wholeMonthsBetween(startDate, endDate);
  if (months === 0 || count < 1 || months % count !== 0) {
    const choices = [1, 2, 3, 4, 6, 12].filter(value => months > 0 && months % value === 0).join(', ');
    return { periods: [], problem: `Number Of Periods must divide the ${months}-month year into equal parts (${choices || 'none'}).` };
  }
  const size = months / count;
  const start = parseDate(startDate);
  const periods = Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    start_date: toInput(addMonths(start, index * size)),
    // The last period always ends on the End Date, as on the backend.
    end_date: index === count - 1 ? endDate : toInput(addDays(addMonths(start, (index + 1) * size), -1)),
  }));
  return { periods };
}

export interface FiscalYearFilters {
  search: string;
  year: string;
  status: string;
}

/** The calendar years a fiscal year touches, e.g. 2026-2027 → [2026, 2027]. */
export function calendarYearsOf(year: Pick<FiscalYearItem, 'start_date' | 'end_date'>) {
  const first = Number(year.start_date.slice(0, 4));
  const last = Number(year.end_date.slice(0, 4));
  return Array.from({ length: Math.max(last - first + 1, 1) }, (_, index) => first + index);
}

export function filterFiscalYears(years: FiscalYearItem[], filters: FiscalYearFilters) {
  const search = filters.search.trim().toLowerCase();
  return years.filter(year =>
    (!search || [year.fiscal_year, basisLabel(year.year_basis), statusLabel(year.status), year.notes ?? ''].some(text => text.toLowerCase().includes(search)))
    && (!filters.year || calendarYearsOf(year).includes(Number(filters.year)))
    && (!filters.status
      || (filters.status === 'active' ? year.is_active
        : filters.status === 'locked' ? year.is_locked
          : year.status === filters.status)));
}

export function summarizeFiscalYears(years: FiscalYearItem[]) {
  const active = years.find(year => year.is_active) ?? years.find(year => year.status === 'open');
  const calendarYears = [...new Set(years.flatMap(calendarYearsOf))].sort();
  return {
    active,
    total: years.length,
    open: years.filter(year => year.status === 'open').length,
    closed: years.filter(year => year.status === 'closed').length,
    locked: years.filter(year => year.is_locked).length,
    calendarYears,
  };
}
