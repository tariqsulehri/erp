'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';

export const stockTransferSupportQueryKey = ['backend', 'stock-transfers', 'support-data'] as const;
export const stockTransferListQueryKey = ['backend', 'stock-transfers', 'list'] as const;

export interface StockTransferSupportData {
  branches: any[];
  warehouses: any[];
  locations: any[];
  items: any[];
}

export interface StockTransferLinePayload {
  item_id: string;
  quantity: number;
  description?: string;
}

export interface StockTransferPayload {
  transfer_date: string;
  from_warehouse_id: string;
  from_location_id?: string;
  to_warehouse_id: string;
  to_location_id?: string;
  reference_number?: string;
  description?: string;
  lines: StockTransferLinePayload[];
}

export interface StockTransferListQuery {
  page: number;
  limit: number;
  status?: 'Draft' | 'Posted' | 'Voided';
  search?: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
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

export function useStockTransferSupportData() {
  return useQuery<StockTransferSupportData>({
    queryKey: stockTransferSupportQueryKey,
    queryFn: () => backendGet<StockTransferSupportData>('/stock-transfers/support-data'),
    retry: false,
  });
}

export function useStockTransfersList(query: StockTransferListQuery) {
  return useQuery<any>({
    queryKey: [...stockTransferListQueryKey, query],
    queryFn: () => backendGet<any>(`/stock-transfers?${buildQueryString(query)}`),
    placeholderData: (previous: any) => previous,
    retry: false,
  });
}

export function useStockTransferDetail(id: string | null) {
  return useQuery<any>({
    queryKey: ['backend', 'stock-transfers', 'detail', id],
    queryFn: () => backendGet<any>(`/stock-transfers/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateStockTransferDraft() {
  return useMutation({
    mutationFn: (input: StockTransferPayload) => backendPost<any, StockTransferPayload>('/stock-transfers/drafts', input),
  });
}

export function useCreateAndPostStockTransfer() {
  return useMutation({
    mutationFn: (input: StockTransferPayload) => backendPost<any, StockTransferPayload>('/stock-transfers/create-and-post', input),
  });
}

export function useInvalidateStockTransferQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockTransferSupportQueryKey }),
    queryClient.invalidateQueries({ queryKey: stockTransferListQueryKey }),
  ]);
}
