'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost, backendPut } from './backend-client';

export const stockTransferSupportQueryKey = ['backend', 'stock-transfers', 'support-data'] as const;
export const stockTransferListQueryKey = ['backend', 'stock-transfers', 'list'] as const;

/** Each side of a transfer is one Branch or one Warehouse. */
export type TransferPlaceKind = 'BRANCH' | 'WAREHOUSE';

export interface TransferPlace {
  kind: TransferPlaceKind;
  id: string;
  locationId?: string;
}

export interface StockTransferSupportData {
  branches: any[];
  warehouses: any[];
  locations: any[];
  items: any[];
  /** The source the item stock belongs to; the backend forces it for Branch and Warehouse users. */
  source: { branch_id: string | null; warehouse_id: string | null; location_id: string | null } | null;
}

export interface StockTransferLinePayload {
  item_id: string;
  quantity: number;
  description?: string;
}

export interface StockTransferPayload {
  transfer_date: string;
  from_branch_id?: string;
  from_warehouse_id?: string;
  from_location_id?: string;
  to_branch_id?: string;
  to_warehouse_id?: string;
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
  from_branch_id?: string;
  from_warehouse_id?: string;
  to_branch_id?: string;
  to_warehouse_id?: string;
  date_from?: string;
  date_to?: string;
  /** Kinds of place the stock moved between. */
  direction?: 'BRANCH_TO_BRANCH' | 'WAREHOUSE_TO_BRANCH' | 'WAREHOUSE_TO_WAREHOUSE' | 'BRANCH_TO_WAREHOUSE';
  /** Only stock delivered to the user's own Branch or Warehouse. */
  incoming?: boolean;
}

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

/** Payload / query fields for one side, e.g. placeFields('from', place) -> { from_branch_id, from_location_id }. */
export function placeFields(prefix: 'from' | 'to', place?: TransferPlace | null) {
  if (!place?.id) return {};
  return {
    [place.kind === 'BRANCH' ? `${prefix}_branch_id` : `${prefix}_warehouse_id`]: place.id,
    ...(place.locationId ? { [`${prefix}_location_id`]: place.locationId } : {}),
  };
}

export function useStockTransferSupportData(source?: TransferPlace | null) {
  const query = buildQueryString(placeFields('from', source));
  return useQuery<StockTransferSupportData>({
    queryKey: [...stockTransferSupportQueryKey, source?.kind, source?.id, source?.locationId],
    queryFn: () => backendGet<StockTransferSupportData>(`/stock-transfers/support-data${query ? `?${query}` : ''}`),
    retry: false,
  });
}

export interface StockTransferSourceStock {
  item_id: string;
  stock_on_hand: string;
  available_stock: string;
  reserved_stock: string;
}

export function useStockTransferSourceStock(source?: TransferPlace | null) {
  const query = buildQueryString({
    branch_id: source?.kind === 'BRANCH' ? source.id : undefined,
    warehouse_id: source?.kind === 'WAREHOUSE' ? source.id : undefined,
    location_id: source?.locationId,
  });
  return useQuery<StockTransferSourceStock[]>({
    queryKey: ['backend', 'stock-transfers', 'source-stock', source?.kind, source?.id, source?.locationId],
    queryFn: () => backendGet<StockTransferSourceStock[]>(`/stock-transfers/source-stock${query ? `?${query}` : ''}`),
    enabled: Boolean(source?.id),
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

/** Saves changes to a Draft stock transfer. Its number stays the same. */
export function useUpdateStockTransferDraft() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockTransferPayload }) => backendPut<any, StockTransferPayload>(`/stock-transfers/${id}`, input),
  });
}

/** Saves changes to a Draft stock transfer and posts it in one step. */
export function useUpdateAndPostStockTransfer() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: StockTransferPayload }) => backendPost<any, StockTransferPayload>(`/stock-transfers/${id}/update-and-post`, input),
  });
}

/** Posts a saved Draft stock transfer as it is. */
export function usePostStockTransferDraft() {
  return useMutation({
    mutationFn: (id: string) => backendPost<any, Record<string, never>>(`/stock-transfers/${id}/post`, {}),
  });
}

/** Reverses a posted stock transfer on the Reversal Date. It stays on file as Reversed. */
export function useReverseStockTransfer() {
  return useMutation({
    mutationFn: ({ id, reversalDate, reason }: { id: string; reversalDate: string; reason: string }) =>
      backendPost<any, { reversal_date: string; reason: string }>(`/stock-transfers/${id}/reverse`, { reversal_date: reversalDate, reason }),
  });
}

/** Cancels a Draft stock transfer. It stays on file as Cancelled with the reason. */
export function useCancelStockTransferDraft() {
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => backendPost<any, { reason: string }>(`/stock-transfers/${id}/cancel`, { reason }),
  });
}

export function useInvalidateStockTransferQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockTransferSupportQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['backend', 'stock-transfers', 'source-stock'] }),
    queryClient.invalidateQueries({ queryKey: stockTransferListQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['backend', 'stock-transfers', 'detail'] }),
  ]);
}
