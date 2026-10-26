'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';
import type { DocumentListTotals } from './document-totals';
import type { SaleListRow, SalePaymentType } from '@/components/sales/SaleVoucherTypes';

export interface SaleSupportData {
  customers: any[];
  items: any[];
  branches: any[];
  locations: any[];
  /** The Branch whose stock is shown on items. */
  stock_branch_id: string | null;
  settings: any;
}

export const saleSupportDataQueryKey = ['backend', 'sales', 'support-data'] as const;
export const saleListBaseQueryKey = ['backend', 'sales', 'list'] as const;
export const saleDetailBaseQueryKey = ['backend', 'sales', 'detail'] as const;

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

/** Item stock in the result is the stock at `branchId` (Branch users always get their own Branch). */
export function useSaleSupportData(branchId?: string) {
  return useQuery<SaleSupportData>({
    queryKey: [...saleSupportDataQueryKey, branchId ?? ''],
    queryFn: () => backendGet<SaleSupportData>(`/sales/support-data${branchId ? `?branch_id=${branchId}` : ''}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export interface SaleInvoicesListQuery {
  page: number;
  limit: number;
  status?: 'Draft' | 'Posted' | 'Voided';
  search?: string;
  customer_id?: string;
  payment_type?: SalePaymentType;
  branch_id?: string;
  date_from?: string;
  date_to?: string;
  amount_from?: number;
  amount_to?: number;
}

export interface SaleInvoicesListResponse {
  data: SaleListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Sums over every record that matches the filters, not only this page. */
  totals?: DocumentListTotals;
}

export function useSaleInvoicesList(query: SaleInvoicesListQuery) {
  return useQuery<SaleInvoicesListResponse>({
    queryKey: ['backend', 'sales', 'list', query],
    queryFn: () => backendGet<SaleInvoicesListResponse>(`/sales?${buildQueryString(query)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useSaleInvoiceDetail(id: string | null) {
  return useQuery<any>({
    queryKey: ['backend', 'sales', 'detail', id],
    queryFn: () => backendGet<any>(`/sales/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateSaleDraft() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/sales/drafts', input),
  });
}

export function useCreateAndPostSale() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/sales/create-and-post', input),
  });
}

export function useInvalidateSaleQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: saleSupportDataQueryKey }),
    queryClient.invalidateQueries({ queryKey: saleListBaseQueryKey }),
    queryClient.invalidateQueries({ queryKey: saleDetailBaseQueryKey }),
  ]);
}
