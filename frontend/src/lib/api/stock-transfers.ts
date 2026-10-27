'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';

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

export function useInvalidateStockTransferQueries() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: stockTransferSupportQueryKey }),
    queryClient.invalidateQueries({ queryKey: ['backend', 'stock-transfers', 'source-stock'] }),
    queryClient.invalidateQueries({ queryKey: stockTransferListQueryKey }),
  ]);
}
