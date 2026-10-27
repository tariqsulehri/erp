import type { FiscalYearItem } from '@/lib/api/fiscal-years';
import {
  basisDates,
  basisLabel,
  calendarYearsOf,
  filterFiscalYears,
  previewPeriods,
  statusLabel,
  summarizeFiscalYears,
  wholeMonthsBetween,
} from '@/components/fiscal-years/fiscal-year-rules';

function year(overrides: Partial<FiscalYearItem>): FiscalYearItem {
  return {
    id: 'id', company_id: 'c', fiscal_year: '2026-2027', year_basis: 'july', start_date: '2026-07-01', end_date: '2027-06-30',
    number_of_periods: 12, period_type: 'monthly', posting_cutoff_days: 5, status: 'open', is_active: false, is_locked: false,
    locked_at: null, transaction_count: 0, total_debits: '0', total_credits: '0', notes: null, created_at: '', updated_at: '',
    ...overrides,
  };
}

describe('basisDates', () => {
  it('fills the dates for each basis from the first year in the name', () => {
    expect(basisDates('calendar', '2026')).toEqual({ start_date: '2026-01-01', end_date: '2026-12-31' });
    expect(basisDates('july', '2026-2027')).toEqual({ start_date: '2026-07-01', end_date: '2027-06-30' });
    expect(basisDates('april', '2026-27')).toEqual({ start_date: '2026-04-01', end_date: '2027-03-31' });
  });

  it('returns null for a name without a sensible year', () => {
    expect(basisDates('july', '')).toBeNull();
    expect(basisDates('july', 'FY')).toBeNull();
    expect(basisDates('july', '1999')).toBeNull();
  });
});

describe('wholeMonthsBetween', () => {
  it('counts whole months in a year', () => {
    expect(wholeMonthsBetween('2026-07-01', '2027-06-30')).toBe(12);
    expect(wholeMonthsBetween('2026-01-01', '2026-03-31')).toBe(3);
  });

  it('counts only the whole months when the year ends mid-month', () => {
    expect(wholeMonthsBetween('2026-01-01', '2026-12-15')).toBe(11);
  });
});

describe('previewPeriods (same rule as the backend)', () => {
  it('splits a July year into 12 monthly periods, each ending the day before the next starts', () => {
    const { periods, problem } = previewPeriods('2026-07-01', '2027-06-30', 12);
    expect(problem).toBeUndefined();
    expect(periods).toHaveLength(12);
    expect(periods[0]).toEqual({ number: 1, start_date: '2026-07-01', end_date: '2026-07-31' });
    expect(periods[7]).toEqual({ number: 8, start_date: '2027-02-01', end_date: '2027-02-28' });
    expect(periods[11]).toEqual({ number: 12, start_date: '2027-06-01', end_date: '2027-06-30' });
  });

  it('makes quarters of three months', () => {
    const { periods } = previewPeriods('2026-01-01', '2026-12-31', 4);
    expect(periods.map(period => [period.start_date, period.end_date])).toEqual([
      ['2026-01-01', '2026-03-31'], ['2026-04-01', '2026-06-30'], ['2026-07-01', '2026-09-30'], ['2026-10-01', '2026-12-31'],
    ]);
  });

  it('rejects 13 periods in a 12-month year, as the backend does', () => {
    const { periods, problem } = previewPeriods('2026-07-01', '2027-06-30', 13);
    expect(periods).toEqual([]);
    expect(problem).toBe('Number Of Periods must split the 12-month year into equal parts. You can use: 1, 2, 3, 4, 6, 12.');
  });

  it('ends the last period on the End Date', () => {
    const { periods } = previewPeriods('2026-01-01', '2026-06-20', 5);
    expect(periods[4].end_date).toBe('2026-06-20');
  });

  it('explains missing or reversed dates', () => {
    expect(previewPeriods('', '2026-12-31', 12).problem).toBe('Enter a Start Date and an End Date.');
    expect(previewPeriods('2026-12-31', '2026-01-01', 12).problem).toBe('End Date must be after Start Date.');
    expect(previewPeriods('2026-01-01', '2026-01-20', 1).problem).toMatch(/0-month year/);
  });
});

describe('labels', () => {
  it('title-cases statuses and names bases', () => {
    expect(statusLabel('open')).toBe('Open');
    expect(statusLabel('')).toBe('Not Set');
    expect(basisLabel('july')).toBe('July – June');
    expect(basisLabel('weekly')).toBe('Weekly');
  });
});

describe('filterFiscalYears and summarizeFiscalYears', () => {
  const years = [
    year({ id: 'a', fiscal_year: '2025-2026', start_date: '2025-07-01', end_date: '2026-06-30', status: 'closed', is_locked: true }),
    year({ id: 'b', fiscal_year: '2026-2027', is_active: true }),
    year({ id: 'c', fiscal_year: '2027', year_basis: 'calendar', start_date: '2027-01-01', end_date: '2027-12-31', notes: 'Budget year' }),
  ];

  it('lists the calendar years a fiscal year touches', () => {
    expect(calendarYearsOf(years[1])).toEqual([2026, 2027]);
    expect(calendarYearsOf(years[2])).toEqual([2027]);
  });

  it('filters by search text, calendar year, and status', () => {
    const none = { search: '', year: '', status: '' };
    expect(filterFiscalYears(years, none).map(row => row.id)).toEqual(['a', 'b', 'c']);
    expect(filterFiscalYears(years, { ...none, search: 'budget' }).map(row => row.id)).toEqual(['c']);
    expect(filterFiscalYears(years, { ...none, search: 'calendar' }).map(row => row.id)).toEqual(['c']);
    expect(filterFiscalYears(years, { ...none, year: '2025' }).map(row => row.id)).toEqual(['a']);
    expect(filterFiscalYears(years, { ...none, year: '2027' }).map(row => row.id)).toEqual(['b', 'c']);
    expect(filterFiscalYears(years, { ...none, status: 'active' }).map(row => row.id)).toEqual(['b']);
    expect(filterFiscalYears(years, { ...none, status: 'locked' }).map(row => row.id)).toEqual(['a']);
    expect(filterFiscalYears(years, { ...none, status: 'open' }).map(row => row.id)).toEqual(['b', 'c']);
  });

  it('summarizes the years for the cards', () => {
    const summary = summarizeFiscalYears(years);
    expect(summary.active?.id).toBe('b');
    expect(summary).toMatchObject({ total: 3, open: 2, closed: 1, locked: 1, calendarYears: [2025, 2026, 2027] });
  });

  it('falls back to an open year when none is marked active, and handles no years', () => {
    expect(summarizeFiscalYears([years[0], years[2]]).active?.id).toBe('c');
    expect(summarizeFiscalYears([])).toMatchObject({ active: undefined, total: 0, calendarYears: [] });
  });
});
