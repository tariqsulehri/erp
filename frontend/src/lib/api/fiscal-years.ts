'use client';

import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const fiscalYearsQueryKey = ['backend', 'fiscal-years'] as const;

export interface FiscalYearItem {
  id: string;
  company_id: string;
  fiscal_year: string;
  year_basis: string;
  start_date: string;
  end_date: string;
  number_of_periods: number;
  period_type: string;
  posting_cutoff_days: number;
  status: string;
  is_active: boolean;
  is_locked: boolean;
  locked_at: string | null;
  transaction_count: number;
  total_debits: string;
  total_credits: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalPeriodItem {
  id: string;
  company_id: string;
  fiscal_year_id: string;
  period_number: number;
  period_name: string;
  start_date: string;
  end_date: string;
  status: string;
  is_open: boolean;
  is_locked: boolean;
  locked_at: string | null;
  posting_cutoff_days: number;
  transaction_count: number;
  total_debits: string;
  total_credits: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalYearsListResponse {
  data: FiscalYearItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface CreateFiscalYearInput {
  fiscal_year: string;
  year_basis: 'calendar' | 'july' | 'april';
  start_date: string;
  end_date: string;
  number_of_periods: number;
  posting_cutoff_days: number;
}

export interface CreateFiscalYearResponse {
  success: boolean;
  fiscal_year: FiscalYearItem;
  periods: FiscalPeriodItem[];
  message: string;
}

export interface FiscalYearActionResponse {
  success: boolean;
  message: string;
}

export interface FiscalYearClosingCheck {
  key: string;
  label: string;
  status: 'Passed' | 'Failed' | 'Warning';
  count: number;
  message: string;
  blocking: boolean;
  details?: Array<{
    label: string;
    count: number;
    note?: string;
  }>;
}

export interface FiscalYearPreCloseResponse {
  fiscal_year: FiscalYearItem;
  can_close: boolean;
  checks: FiscalYearClosingCheck[];
  message: string;
}

export type FiscalYearClosingIssueCheck = 'draft_vouchers' | 'unposted_documents';

export interface FiscalYearClosingIssue {
  id: string;
  module_name: string;
  document_type: string;
  document_number: string;
  document_date: string;
  party_name: string | null;
  amount: string | null;
  status: string;
  source_path: string | null;
}

export interface FiscalYearClosingIssuesResponse {
  check: FiscalYearClosingIssueCheck;
  fiscal_year: FiscalYearItem;
  data: FiscalYearClosingIssue[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface PostingDateValidation {
  canPost: boolean;
  reason?: string;
  period?: {
    id: string;
    period_name: string;
    is_open: boolean;
  };
}

export function useValidatePostingDate(date: string, enabled = true) {
  return useQuery<PostingDateValidation>({
    queryKey: [...fiscalYearsQueryKey, 'validate-posting-date', date],
    queryFn: () => backendGet<PostingDateValidation>(`/fiscal-years/validate-posting-date?date=${encodeURIComponent(date)}`),
    enabled,
    retry: false,
  });
}

export function usePostingDateGuard(date: string, label = 'Posting Date', enabled = true) {
  const dateIsValid = isValidDateInput(date);
  const dateValidation = useValidatePostingDate(date, enabled && dateIsValid);
  const validationError = dateValidation.error
    ? friendlyErrorMessage(dateValidation.error, `Unable to check ${label}.`)
    : '';
  const blockedReason = dateValidation.data && !dateValidation.data.canPost
    ? dateValidation.data.reason ?? `${label} is outside the open fiscal period.`
    : '';
  const statusMessage = !date
    ? `${label} is required.`
    : !dateIsValid
      ? `${label} is not valid.`
      : validationError || blockedReason;
  const isBlocked = Boolean(blockedReason || validationError || (date && !dateIsValid));

  return {
    dateValidation,
    dateIsValid,
    isChecking: dateValidation.isFetching,
    isBlocked,
    canPost: Boolean(dateValidation.data?.canPost),
    disabled: dateValidation.isFetching || isBlocked,
    statusMessage,
  };
}

function todayDateText() {
  return new Date().toISOString().slice(0, 10);
}

function postingFiscalYear(years: FiscalYearItem[]) {
  return years.find(year => year.is_active && year.status !== 'closed' && !year.is_locked)
    ?? years.find(year => year.status !== 'closed' && !year.is_locked)
    ?? null;
}

export function defaultPostingDateForFiscalYears(years: FiscalYearItem[], currentDate = todayDateText()) {
  const fiscalYear = postingFiscalYear(years);
  if (!fiscalYear) return currentDate;
  if (currentDate >= fiscalYear.start_date && currentDate <= fiscalYear.end_date) return currentDate;
  return fiscalYear.start_date;
}

export function useDefaultPostingDate(label = 'Posting Date', enabled = true) {
  const fiscalYearsQuery = useFiscalYearsList({ page: 1, limit: 50, enabled });
  const fiscalYears = fiscalYearsQuery.data?.data ?? [];
  const fiscalYear = useMemo(() => postingFiscalYear(fiscalYears), [fiscalYears]);
  const defaultPostingDate = useMemo(
    () => defaultPostingDateForFiscalYears(fiscalYears),
    [fiscalYears],
  );
  const dateGuard = usePostingDateGuard(defaultPostingDate, label, enabled && !fiscalYearsQuery.isLoading && Boolean(fiscalYear));
  const fiscalYearsError = fiscalYearsQuery.error
    ? friendlyErrorMessage(fiscalYearsQuery.error, 'Unable to check fiscal year.')
    : '';
  const noPostingFiscalYear = enabled && !fiscalYearsQuery.isLoading && !fiscalYearsError && !fiscalYear;
  const statusMessage = fiscalYearsQuery.isLoading
    ? 'Checking fiscal year...'
    : fiscalYearsError
      ? fiscalYearsError
      : noPostingFiscalYear
        ? 'No unlocked open fiscal year is available for posting. Open a new fiscal year first.'
        : dateGuard.statusMessage;

  return {
    ...dateGuard,
    defaultPostingDate,
    fiscalYearsQuery,
    fiscalYear,
    isChecking: fiscalYearsQuery.isLoading || dateGuard.isChecking,
    isBlocked: noPostingFiscalYear || Boolean(fiscalYearsError) || dateGuard.isBlocked,
    disabled: fiscalYearsQuery.isLoading || noPostingFiscalYear || Boolean(fiscalYearsError) || dateGuard.disabled,
    statusMessage,
  };
}

export function useFiscalYearsList(params: { page?: number; limit?: number; enabled?: boolean } = {}) {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page ?? 1));
  searchParams.set('limit', String(params.limit ?? 50));

  return useQuery<FiscalYearsListResponse>({
    queryKey: [...fiscalYearsQueryKey, 'list', params],
    queryFn: () => backendGet<FiscalYearsListResponse>(`/fiscal-years?${searchParams.toString()}`),
    enabled: params.enabled ?? true,
    retry: false,
  });
}

export function useFiscalPeriods(fiscalYearId: string | undefined) {
  return useQuery<FiscalPeriodItem[]>({
    queryKey: [...fiscalYearsQueryKey, 'periods', fiscalYearId],
    queryFn: () => backendGet<FiscalPeriodItem[]>(`/fiscal-years/${encodeURIComponent(fiscalYearId ?? '')}/periods`),
    enabled: Boolean(fiscalYearId),
    retry: false,
  });
}

export function useCreateFiscalYear() {
  return useMutation<CreateFiscalYearResponse, Error, CreateFiscalYearInput>({
    mutationFn: body => backendPost<CreateFiscalYearResponse, CreateFiscalYearInput>('/fiscal-years', body),
  });
}

export function useFiscalYearPreCloseCheck(fiscalYearId: string | undefined, enabled = true) {
  return useQuery<FiscalYearPreCloseResponse>({
    queryKey: [...fiscalYearsQueryKey, 'pre-close-check', fiscalYearId],
    queryFn: () => backendGet<FiscalYearPreCloseResponse>(`/fiscal-years/${encodeURIComponent(fiscalYearId ?? '')}/pre-close-check`),
    enabled: enabled && Boolean(fiscalYearId),
    retry: false,
  });
}

export function useFiscalYearClosingIssues(
  fiscalYearId: string | undefined,
  check: FiscalYearClosingIssueCheck | null,
  page: number,
  limit: number,
) {
  const searchParams = new URLSearchParams();
  if (check) searchParams.set('check', check);
  searchParams.set('page', String(page));
  searchParams.set('limit', String(limit));

  return useQuery<FiscalYearClosingIssuesResponse>({
    queryKey: [...fiscalYearsQueryKey, 'closing-issues', fiscalYearId, check, page, limit],
    queryFn: () => backendGet<FiscalYearClosingIssuesResponse>(`/fiscal-years/${encodeURIComponent(fiscalYearId ?? '')}/closing-issues?${searchParams.toString()}`),
    enabled: Boolean(fiscalYearId && check),
    retry: false,
  });
}

export function useCloseFiscalYear() {
  return useMutation<FiscalYearActionResponse, Error, { id: string; remarks?: string }>({
    mutationFn: ({ id, remarks }) => backendPatch<FiscalYearActionResponse, { remarks?: string }>(`/fiscal-years/${id}/close`, { remarks }),
  });
}

export function useLockFiscalYear() {
  return useMutation<FiscalYearActionResponse, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<FiscalYearActionResponse, Record<string, never>>(`/fiscal-years/${id}/lock`, {}),
  });
}

export function useUnlockFiscalYear() {
  return useMutation<FiscalYearActionResponse, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<FiscalYearActionResponse, Record<string, never>>(`/fiscal-years/${id}/unlock`, {}),
  });
}

export function useLockFiscalPeriod() {
  return useMutation<FiscalYearActionResponse, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<FiscalYearActionResponse, Record<string, never>>(`/fiscal-years/periods/${id}/lock`, {}),
  });
}

export function useCloseFiscalPeriod() {
  return useMutation<FiscalYearActionResponse, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<FiscalYearActionResponse, Record<string, never>>(`/fiscal-years/periods/${id}/close`, {}),
  });
}
