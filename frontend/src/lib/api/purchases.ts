'use client';

import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';
import type { PaymentType, PurchaseListRow } from '@/components/purchases/PurchaseVoucherTypes';

export interface PurchaseSupportData {
  suppliers: any[];
  items: any[];
  warehouses: any[];
  locations: any[];
  settings: any;
}

export const purchaseSupportDataQueryKey = ['backend', 'purchases', 'support-data'] as const;
export const purchaseListBaseQueryKey = ['backend', 'purchases', 'list'] as const;
export const purchaseAnalyticsBaseQueryKey = ['backend', 'purchases', 'analytics'] as const;
export const purchaseDetailBaseQueryKey = ['backend', 'purchases', 'detail'] as const;

export function usePurchaseSupportData() {
  return useQuery<PurchaseSupportData>({
    queryKey: purchaseSupportDataQueryKey,
    queryFn: () => backendGet<PurchaseSupportData>('/purchases/support-data'),
    retry: false,
  });
}

export interface PurchaseInvoicesListQuery {
  page: number;
  limit: number;
  status?: 'Draft' | 'Posted' | 'Voided';
  search?: string;
  supplier_id?: string;
  payment_type?: PaymentType;
  warehouse_id?: string;
  date_from?: string;
  date_to?: string;
  amount_from?: number;
  amount_to?: number;
}

export interface PurchaseInvoicesListResponse {
  data: PurchaseListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });

  return params.toString();
}

export function usePurchaseInvoicesList(query: PurchaseInvoicesListQuery) {
  return useQuery<PurchaseInvoicesListResponse>({
    queryKey: ['backend', 'purchases', 'list', query],
    queryFn: () => backendGet<PurchaseInvoicesListResponse>(`/purchases?${buildQueryString(query)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export interface PurchaseAnalyticsQuery {
  supplier_id?: string;
  payment_type?: PaymentType;
  warehouse_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PurchaseAnalyticsResponse {
  summary: any;
  monthlyPurchases: any[];
  supplierSummary: any[];
  warehouseSummary: any[];
  paymentTypeSummary: any[];
}

export function usePurchaseAnalytics(query: PurchaseAnalyticsQuery) {
  return useQuery<PurchaseAnalyticsResponse>({
    queryKey: ['backend', 'purchases', 'analytics', query],
    queryFn: () => backendGet<PurchaseAnalyticsResponse>(`/purchases/analytics?${buildQueryString(query)}`),
    retry: false,
  });
}

export function usePurchaseInvoiceDetail(id: string | null) {
  return useQuery<any>({
    queryKey: ['backend', 'purchases', 'detail', id],
    queryFn: () => backendGet<any>(`/purchases/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export interface PurchaseValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fiscalPeriod: any;
  totals: {
    gross_amount: string;
    discount_amount: string;
    tax_amount: string;
    freight_amount: string;
    net_amount: string;
  };
  lines: any[];
}

export function validatePurchaseInvoice(input: unknown) {
  return backendPost<PurchaseValidationResponse, unknown>('/purchases/validate', input);
}

export function useCreatePurchaseDraft() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/purchases/drafts', input),
  });
}

export function useCreateAndPostPurchase() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/purchases/create-and-post', input),
  });
}

export function useInvalidatePurchaseQueries() {
  const queryClient = useQueryClient();

  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: purchaseSupportDataQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseListBaseQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseAnalyticsBaseQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseDetailBaseQueryKey }),
  ]);
}
