'use client';

import { useMemo } from 'react';
import { type FiscalYearItem, useFiscalYearsList } from '@/lib/api/fiscal-years';
import { today } from './VoucherShared';

function activeFiscalYear(years: FiscalYearItem[]) {
  return years.find(year => year.is_active && year.status !== 'closed')
    ?? years.find(year => year.status !== 'closed')
    ?? null;
}

export function defaultVoucherDateForFiscalYear(years: FiscalYearItem[], currentDate = today()) {
  const fiscalYear = activeFiscalYear(years);
  if (!fiscalYear) return currentDate;
  if (currentDate >= fiscalYear.start_date && currentDate <= fiscalYear.end_date) return currentDate;
  return fiscalYear.start_date;
}

export function useDefaultVoucherDate() {
  const fiscalYearsQuery = useFiscalYearsList({ page: 1, limit: 50 });
  const defaultVoucherDate = useMemo(
    () => defaultVoucherDateForFiscalYear(fiscalYearsQuery.data?.data ?? []),
    [fiscalYearsQuery.data],
  );

  return {
    defaultVoucherDate,
    fiscalYearsLoading: fiscalYearsQuery.isLoading,
    fiscalYearsError: fiscalYearsQuery.error,
  };
}
