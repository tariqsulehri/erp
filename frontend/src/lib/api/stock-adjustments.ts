'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost, backendPut } from './backend-client';

export const stockAdjustmentSupportQueryKey = ['backend', 'stock-adjustments', 'support-data'] as const;
export const stockAdjustmentListQueryKey = ['backend', 'stock-adjustments', 'list'] as const;
export const stockAdjustmentDetailQueryKey = ['backend', 'stock-adjustments', 'detail'] as const;

export type AdjustmentType = 'Increase' | 'Decrease';

export type StockHolderKind = 'BRANCH' | 'WAREHOUSE';

export interface StockAdjustmentSupportData {
  /** Branch users get only their Branch; Warehouse users get no Branches. */
  branches: any[];
  /** Warehouse users get only their Warehouse; Branch users get no Warehouses. */
  warehouses: any[];
  locations: any[];
  items: any[];
}

export interface StockAdjustmentLinePayload {
  adjustment_type: AdjustmentType;
  item_id: string;
  quantity: number;
  unit_cost: number;
  description?: string;
}

export interface StockAdjustmentPayload {
  adjustment_date: string;
  /** Exactly one of branch_id and warehouse_id is sent. */
  branch_id?: string;
  warehouse_id?: string;
  location_id?: string;
  reference_number?: string;
  reason?: string;
  description?: string;
  lines: StockAdjustmentLinePayload[];
}

export interface StockAdjustmentListQuery {
  page: number;
  limit: number;
  status?: 'Draft' | 'Posted' | 'Voided';
  search?: string;
  branch_id?: string;
  warehouse_id?: string;
  adjustment_type?: AdjustmentType;
  date_from?: string;
  date_to?: string;
}

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useStockAdjustmentSupportData() {
  return useQuery<StockAdjustmentSupportData>({
    queryKey: stockAdjustmentSupportQueryKey,
    queryFn: () => backendGet<StockAdjustmentSupportData>('/stock-adjustments/support-data'),
    retry: false,
  });
}

export function useStockAdjustmentsList(query: StockAdjustmentListQuery) {
  return useQuery<any>({
    queryKey: [...stockAdjustmentListQueryKey, query],
    queryFn: () => backendGet<any>(`/stock-adjustments?${buildQueryString(query)}`),
    placeholderData: (previous: any) => previous,
    retry: false,
  });
}

export function useStockAdjustmentDetail(id: string | null) {
  return useQuery<any>({
    queryKey: [...stockAdjustmentDetailQueryKey, id],
    queryFn: () => backendGet<any>(`/stock-adjustments/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateStockAdjustmentDraft() {
  return useMutation({
    mutationFn: (input: StockAdjustmentPayload) => backendPost<any, StockAdjustmentPayload>('/stock-adjustments/drafts', input),
  });
}

export function useCreateAndPostStockAdjustment() {
  return useMutation({
    mutationFn: (input: StockAdjustmentPayload) => backendPost<any, StockAdjustmentPayload>('/stock-adjustments/create-and-post', input),
  });
}

/** Saves changes to a Draft stock adjustment. Its number stays the same. */
export function useUpdateStockAdjustmentDraft() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockAdjustmentPayload }) => backendPut<any, StockAdjustmentPayload>(`/stock-adjustments/${id}`, input),
  });
}

/** Saves changes to a Draft stock adjustment and posts it in one step. */
export function useUpdateAndPostStockAdjustment() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockAdjustmentPayload }) => backendPost<any, StockAdjustmentPayload>(`/stock-adjustments/${id}/update-and-post`, input),
  });
}

/** Posts a saved Draft stock adjustment as it is. */
export function usePostStockAdjustmentDraft() {
  return useMutation({
    mutationFn: (id: string) => backendPost<any, Record<string, never>>(`/stock-adjustments/${id}/post`, {}),
  });
}

/** Cancels a Draft stock adjustment. It stays on file as Cancelled with the reason. */
export function useCancelStockAdjustmentDraft() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => backendPost<any, { reason: string }>(`/stock-adjustments/${id}/cancel`, { reason }),
  });
}

export function useInvalidateStockAdjustmentQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockAdjustmentSupportQueryKey }),
    queryClient.invalidateQueries({ queryKey: stockAdjustmentListQueryKey }),
    queryClient.invalidateQueries({ queryKey: stockAdjustmentDetailQueryKey }),
  ]);
}
