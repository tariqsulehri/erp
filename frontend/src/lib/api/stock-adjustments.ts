'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';

export const stockAdjustmentSupportQueryKey = ['backend', 'stock-adjustments', 'support-data'] as const;
export const stockAdjustmentListQueryKey = ['backend', 'stock-adjustments', 'list'] as const;
export const stockAdjustmentDetailQueryKey = ['backend', 'stock-adjustments', 'detail'] as const;

export type AdjustmentType = 'Increase' | 'Decrease';

export interface StockAdjustmentSupportData {
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
  warehouse_id: string;
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

export function useInvalidateStockAdjustmentQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockAdjustmentSupportQueryKey }),
    queryClient.invalidateQueries({ queryKey: stockAdjustmentListQueryKey }),
    queryClient.invalidateQueries({ queryKey: stockAdjustmentDetailQueryKey }),
  ]);
}
