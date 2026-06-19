import { startOfDay, endOfDay, isBefore, isAfter, isSameDay, differenceInDays } from 'date-fns';

/**
 * Fiscal year date helpers
 * Used for period validation, period determination, and fiscal year boundaries
 */

export interface FiscalYearBounds {
  start_date: Date;
  end_date: Date;
}

export interface FiscalPeriodBounds {
  start_date: Date;
  end_date: Date;
  period_number: number;
}

/**
 * Check if a date falls within a fiscal year
 */
export function isDateInFiscalYear(date: Date, fiscalYear: FiscalYearBounds): boolean {
  const normalizedDate = startOfDay(date);
  const startDate = startOfDay(fiscalYear.start_date);
  const endDate = endOfDay(fiscalYear.end_date);

  return (isSameDay(normalizedDate, startDate) ||
    isAfter(normalizedDate, startDate)) &&
    (isSameDay(normalizedDate, endDate) ||
      isBefore(normalizedDate, endDate));
}

/**
 * Check if a date falls within a fiscal period
 */
export function isDateInFiscalPeriod(
  date: Date,
  period: FiscalPeriodBounds,
): boolean {
  const normalizedDate = startOfDay(date);
  const startDate = startOfDay(period.start_date);
  const endDate = endOfDay(period.end_date);

  return (isSameDay(normalizedDate, startDate) ||
    isAfter(normalizedDate, startDate)) &&
    (isSameDay(normalizedDate, endDate) ||
      isBefore(normalizedDate, endDate));
}

/**
 * Find which fiscal period a date belongs to
 */
export function findFiscalPeriodForDate(
  date: Date,
  periods: FiscalPeriodBounds[],
): FiscalPeriodBounds | null {
  return periods.find(period => isDateInFiscalPeriod(date, period)) || null;
}

/**
 * Check if a fiscal period is closed
 */
export function isFiscalPeriodClosed(
  period: FiscalPeriodBounds & { is_closed: boolean },
): boolean {
  return period.is_closed === true;
}

/**
 * Check if a date is too old to post to (fiscal period past cutoff)
 */
export function canPostToDate(
  date: Date,
  period: FiscalPeriodBounds & { is_closed: boolean; posting_cutoff_days: number },
): boolean {
  if (isFiscalPeriodClosed(period)) {
    return false;
  }

  const daysSince = differenceInDays(new Date(), date);
  return daysSince <= period.posting_cutoff_days;
}

/**
 * Get fiscal year boundaries for calendar year basis
 * (Jan 1 - Dec 31)
 */
export function getCalendarYearBounds(year: number): FiscalYearBounds {
  return {
    start_date: new Date(year, 0, 1), // Jan 1
    end_date: new Date(year, 11, 31), // Dec 31
  };
}

/**
 * Get fiscal year boundaries for July basis
 * (Jul 1 - Jun 30)
 */
export function getJulyYearBounds(year: number): FiscalYearBounds {
  return {
    start_date: new Date(year, 6, 1), // Jul 1
    end_date: new Date(year + 1, 5, 30), // Jun 30
  };
}

/**
 * Get fiscal year boundaries for April basis (India standard)
 * (Apr 1 - Mar 31)
 */
export function getAprilYearBounds(year: number): FiscalYearBounds {
  return {
    start_date: new Date(year, 3, 1), // Apr 1
    end_date: new Date(year + 1, 2, 31), // Mar 31
  };
}

/**
 * Determine fiscal year for a given date (calendar year basis)
 */
export function getFiscalYearForDate(date: Date): number {
  return date.getFullYear();
}

/**
 * Format date for display in financial statements
 */
export function formatDateForReport(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return isAfter(date, new Date());
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return isBefore(date, new Date());
}

/**
 * Get start of fiscal year based on year basis
 */
export function getStartOfFiscalYear(
  date: Date,
  yearBasis: 'calendar' | 'july' | 'april',
): Date {
  const year = date.getFullYear();

  switch (yearBasis) {
    case 'calendar':
      return new Date(year, 0, 1);
    case 'july':
      return date.getMonth() < 6 ? new Date(year - 1, 6, 1) : new Date(year, 6, 1);
    case 'april':
      return date.getMonth() < 3 ? new Date(year - 1, 3, 1) : new Date(year, 3, 1);
    default:
      return new Date(year, 0, 1);
  }
}

/**
 * Get end of fiscal year based on year basis
 */
export function getEndOfFiscalYear(
  date: Date,
  yearBasis: 'calendar' | 'july' | 'april',
): Date {
  const year = date.getFullYear();

  switch (yearBasis) {
    case 'calendar':
      return new Date(year, 11, 31);
    case 'july':
      return date.getMonth() < 6 ? new Date(year, 5, 30) : new Date(year + 1, 5, 30);
    case 'april':
      return date.getMonth() < 3 ? new Date(year, 2, 31) : new Date(year + 1, 2, 31);
    default:
      return new Date(year, 11, 31);
  }
}
