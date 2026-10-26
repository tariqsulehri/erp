'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatMoney } from '@/lib/app-settings';
import { useFiscalYearsList, type FiscalYearItem } from '@/lib/api/fiscal-years';

export type BalanceSide = 'Debit' | 'Credit' | 'Balanced';

export function formatLedgerBalance(
  amount: string | number,
  side: BalanceSide,
  settings?: AppFormatSettingsSource | null,
) {
  if (side === 'Balanced') return formatMoney(0, settings);
  return `${formatMoney(amount, settings)} ${side === 'Debit' ? 'Dr' : 'Cr'}`;
}

/** Today's date (YYYY-MM-DD) on the user's computer, not in UTC, so early-morning reports do not show yesterday. */
export function todayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Fallback when no fiscal year is set up yet. */
export function firstDayOfCurrentYear() {
  return `${new Date().getFullYear()}-01-01`;
}

/** Start of the fiscal year that contains the date, or 1 January when there is none. */
export function fiscalYearStartFor(years: FiscalYearItem[], dateText: string) {
  const fiscalYear = years.find(year => year.start_date <= dateText && year.end_date >= dateText);
  return fiscalYear?.start_date ?? `${dateText.slice(0, 4)}-01-01`;
}

/**
 * Date From / Date To for a report, starting at the fiscal year start and today. The fiscal year arrives
 * after the first render, so Date From updates once it loads unless the user already changed it.
 */
export function useReportDateRange() {
  const today = useMemo(() => todayInputDate(), []);
  const fiscalYearsQuery = useFiscalYearsList({ page: 1, limit: 50 });
  const [dateFrom, setDateFromState] = useState(firstDayOfCurrentYear());
  const [dateTo, setDateTo] = useState(today);
  const userChangedDateFrom = useRef(false);

  const fiscalStart = useMemo(
    () => (fiscalYearsQuery.data ? fiscalYearStartFor(fiscalYearsQuery.data.data ?? [], today) : null),
    [fiscalYearsQuery.data, today],
  );

  useEffect(() => {
    if (fiscalStart && !userChangedDateFrom.current) setDateFromState(fiscalStart);
  }, [fiscalStart]);

  function setDateFrom(value: string) {
    userChangedDateFrom.current = true;
    setDateFromState(value);
  }

  return { dateFrom, setDateFrom, dateTo, setDateTo, today };
}
