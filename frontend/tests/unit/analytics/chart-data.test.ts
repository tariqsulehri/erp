import { compactAxis, fillMonths, lastMonthChange, monthKeysBetween, monthLabeler } from '@/components/analytics/chart-data';
import { barGradientStops } from '@/components/analytics/chart-palette';

type Month = { monthKey: string; amount: number };
const empty = (monthKey: string): Month => ({ monthKey, amount: 0 });

describe('monthKeysBetween', () => {
  it('lists every month in the range, across a year end', () => {
    expect(monthKeysBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('caps the range at 24 months', () => {
    expect(monthKeysBetween('2020-01', '2026-12')).toHaveLength(24);
  });
});

describe('fillMonths', () => {
  beforeAll(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 15));
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it('returns nothing when there is no data', () => {
    expect(fillMonths([], empty, { fromKey: '2026-01', toKey: '2026-12' })).toEqual([]);
  });

  it('fills quiet months with zero and keeps the data months', () => {
    const rows = fillMonths([{ monthKey: '2026-08', amount: 5 }, { monthKey: '2026-06', amount: 3 }], empty);
    expect(rows).toEqual([
      { monthKey: '2026-06', amount: 3 },
      { monthKey: '2026-07', amount: 0 },
      { monthKey: '2026-08', amount: 5 },
    ]);
  });

  it('starts at the filter start and stops at the current month, not the future end date', () => {
    const rows = fillMonths([{ monthKey: '2026-07', amount: 9 }], empty, { fromKey: '2026-01', toKey: '2026-12' });
    expect(rows[0].monthKey).toBe('2026-01');
    expect(rows[rows.length - 1].monthKey).toBe('2026-10');
    expect(rows).toHaveLength(10);
  });

  it('keeps a past end date as given', () => {
    const rows = fillMonths([{ monthKey: '2025-03', amount: 1 }], empty, { fromKey: '2025-01', toKey: '2025-06' });
    expect(rows.map(row => row.monthKey)).toEqual(['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06']);
  });
});

describe('monthLabeler', () => {
  it('adds the year only when the months cross a year', () => {
    const oneYear = monthLabeler(['2026-07', '2026-08']);
    const twoYears = monthLabeler(['2025-12', '2026-01']);
    expect(oneYear('2026-07')).not.toMatch(/26/);
    expect(twoYears('2026-01')).toMatch(/26/);
  });
});

describe('compactAxis', () => {
  const axis = compactAxis({ thousand_separator: ',', decimal_separator: '.' } as never);

  it('uses at most one decimal and drops a trailing .0', () => {
    expect(axis(12000)).toBe('12K');
    expect(axis(11186.5)).toBe('11.2K');
    expect(axis(2_500_000)).toBe('2.5M');
    expect(axis(950)).toBe('950');
    expect(axis(0)).toBe('0');
  });

  it('keeps the sign for negative values', () => {
    expect(axis(-1066)).toBe('-1.1K');
  });

  it('uses the company decimal separator', () => {
    const european = compactAxis({ thousand_separator: '.', decimal_separator: ',' } as never);
    expect(european(1500)).toBe('1,5K');
  });
});

describe('lastMonthChange', () => {
  it('compares the last month with the one before it', () => {
    expect(lastMonthChange([100, 200, 150])).toBeCloseTo(-25);
  });

  it('returns null when there is nothing to compare', () => {
    expect(lastMonthChange([100])).toBeNull();
    expect(lastMonthChange([0, 50])).toBeNull();
  });
});

describe('barGradientStops', () => {
  it('runs light to deep and keeps the true colour in the middle', () => {
    const stops = barGradientStops('#1f56c7');
    expect(stops.map(stop => stop.offset)).toEqual(['0%', '45%', '100%']);
    expect(stops[1].color).toBe('#1f56c7');
    const lightness = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lightness(stops[0].color)).toBeGreaterThan(lightness(stops[1].color));
    expect(lightness(stops[2].color)).toBeLessThan(lightness(stops[1].color));
  });
});
