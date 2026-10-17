'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';
import type { SaleListRow, SalePaymentType } from '@/components/sales/SaleVoucherTypes';
import type { SaleSupportData } from './sales';

export interface SaleReturnListRow extends Omit<SaleListRow,
  'sale_number' | 'sale_date' | 'delivery_date' | 'delivery_note_number' | 'customer_reference_number'
> {
  sale_return_number: string;
  sale_return_date: string;
  customer_return_date?: string | null;
  customer_return_number?: string | null;
  reference_number?: string | null;
}

export const saleReturnSupportDataQueryKey = ['backend', 'sale-returns', 'support-data'] as const;
export const saleReturnListBaseQueryKey = ['backend', 'sale-returns', 'list'] as const;
export const saleReturnDetailBaseQueryKey = ['backend', 'sale-returns', 'detail'] as const;

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useSaleReturnSupportData() {
  return useQuery<SaleSupportData>({
    queryKey: saleReturnSupportDataQueryKey,
    queryFn: () => backendGet<SaleSupportData>('/sale-returns/support-data'),
    retry: false,
  });
}

export interface SaleReturnsListQuery {
  page: number;
  limit: number;
  status?: 'Draft' | 'Posted' | 'Voided';
  search?: string;
  customer_id?: string;
  payment_type?: SalePaymentType;
  warehouse_id?: string;
  date_from?: string;
  date_to?: string;
  amount_from?: number;
  amount_to?: number;
}

export interface SaleReturnsListResponse {
  data: SaleReturnListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useSaleReturnsList(query: SaleReturnsListQuery) {
  return useQuery<SaleReturnsListResponse>({
    queryKey: ['backend', 'sale-returns', 'list', query],
    queryFn: () => backendGet<SaleReturnsListResponse>(`/sale-returns?${buildQueryString(query)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useSaleReturnDetail(id: string | null) {
  return useQuery<any>({
    queryKey: ['backend', 'sale-returns', 'detail', id],
    queryFn: () => backendGet<any>(`/sale-returns/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateSaleReturnDraft() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/sale-returns/drafts', input),
  });
}

export function useCreateAndPostSaleReturn() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/sale-returns/create-and-post', input),
  });
}

export function useInvalidateSaleReturnQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: saleReturnSupportDataQueryKey }),
    queryClient.invalidateQueries({ queryKey: saleReturnListBaseQueryKey }),
    queryClient.invalidateQueries({ queryKey: saleReturnDetailBaseQueryKey }),
  ]);
}
