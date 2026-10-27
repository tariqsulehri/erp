'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost, backendPut } from './backend-client';
import type { DocumentListTotals } from './document-totals';
import type { PaymentType, PurchaseListRow } from '@/components/purchases/PurchaseVoucherTypes';
import type { PurchaseSupportData } from './purchases';

export interface PurchaseReturnListRow extends Omit<PurchaseListRow,
  'purchase_number' | 'purchase_date' | 'supplier_invoice_date' | 'supplier_invoice_number'
> {
  purchase_return_number: string;
  purchase_return_date: string;
  supplier_return_date?: string | null;
  supplier_return_number?: string | null;
}

export const purchaseReturnSupportDataQueryKey = ['backend', 'purchase-returns', 'support-data'] as const;
export const purchaseReturnListBaseQueryKey = ['backend', 'purchase-returns', 'list'] as const;
export const purchaseReturnDetailBaseQueryKey = ['backend', 'purchase-returns', 'detail'] as const;

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function usePurchaseReturnSupportData() {
  return useQuery<PurchaseSupportData>({
    queryKey: purchaseReturnSupportDataQueryKey,
    queryFn: () => backendGet<PurchaseSupportData>('/purchase-returns/support-data'),
    retry: false,
  });
}

export interface PurchaseReturnsListQuery {
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

export interface PurchaseReturnsListResponse {
  data: PurchaseReturnListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Sums over every record that matches the filters, not only this page. */
  totals?: DocumentListTotals;
}

export function usePurchaseReturnsList(query: PurchaseReturnsListQuery) {
  return useQuery<PurchaseReturnsListResponse>({
    queryKey: ['backend', 'purchase-returns', 'list', query],
    queryFn: () => backendGet<PurchaseReturnsListResponse>(`/purchase-returns?${buildQueryString(query)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function usePurchaseReturnDetail(id: string | null) {
  return useQuery<any>({
    queryKey: ['backend', 'purchase-returns', 'detail', id],
    queryFn: () => backendGet<any>(`/purchase-returns/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreatePurchaseReturnDraft() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/purchase-returns/drafts', input),
  });
}

export function useCreateAndPostPurchaseReturn() {
  return useMutation({
    mutationFn: (input: unknown) => backendPost<any, unknown>('/purchase-returns/create-and-post', input),
  });
}

/** Saves changes to a Draft purchase return. The return number stays the same. */
export function useUpdatePurchaseReturnDraft() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => backendPut<any, unknown>(`/purchase-returns/${id}`, input),
  });
}

/** Saves changes to a Draft purchase return and posts it in one step. */
export function useUpdateAndPostPurchaseReturn() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) => backendPost<any, unknown>(`/purchase-returns/${id}/update-and-post`, input),
  });
}

/** Posts a saved Draft purchase return as it is. */
export function usePostPurchaseReturnDraft() {
  return useMutation({
    mutationFn: (id: string) => backendPost<any, Record<string, never>>(`/purchase-returns/${id}/post`, {}),
  });
}

/** Cancels a Draft purchase return. It stays on file as Cancelled with the reason. */
export function useCancelPurchaseReturnDraft() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => backendPost<any, { reason: string }>(`/purchase-returns/${id}/cancel`, { reason }),
  });
}

export function useInvalidatePurchaseReturnQueries() {
  const queryClient = useQueryClient();

  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: purchaseReturnSupportDataQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseReturnListBaseQueryKey }),
    queryClient.invalidateQueries({ queryKey: purchaseReturnDetailBaseQueryKey }),
  ]);
}
