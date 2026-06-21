'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
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

export function useFiscalYearsList(params: { page?: number; limit?: number } = {}) {
  const searchParams = new URLSearchParams();
  searchParams.set('page', String(params.page ?? 1));
  searchParams.set('limit', String(params.limit ?? 50));

  return useQuery<FiscalYearsListResponse>({
    queryKey: [...fiscalYearsQueryKey, 'list', params],
    queryFn: () => backendGet<FiscalYearsListResponse>(`/fiscal-years?${searchParams.toString()}`),
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

export function useLockFiscalYear() {
  return useMutation<FiscalYearActionResponse, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<FiscalYearActionResponse, Record<string, never>>(`/fiscal-years/${id}/lock`, {}),
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
