'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const warehousesQueryKey = ['backend', 'warehouses'] as const;

export interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  branch_id?: string | null;
  branch?: { id: string; code: string; name: string } | null;
  description?: string | null;
  address?: string | null;
  is_default: boolean;
  use_locations: boolean;
  is_active: boolean;
  stock_item_count?: number;
  stock_on_hand?: string;
  available_stock?: string;
  total_stock_value?: string;
}

export interface WarehouseLocationRow {
  id: string;
  warehouse_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface WarehouseStockRow {
  id: string;
  item_code: string;
  sku: string;
  item_name: string;
  location_code?: string | null;
  location_name?: string | null;
  stock_on_hand: string;
  reserved_stock: string;
  available_stock: string;
  average_cost: string;
  total_stock_value: string;
}

export interface ListWarehousesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface ListWarehouseStockParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface WarehousePayload {
  code?: string;
  name?: string;
  branch_id?: string;
  description?: string;
  address?: string;
  is_default?: boolean;
  use_locations?: boolean;
  is_active?: boolean;
}

export interface WarehouseLocationPayload {
  code?: string;
  name?: string;
  description?: string;
  is_default?: boolean;
  is_active?: boolean;
}

function queryString(params: object) {
  const searchParams = new URLSearchParams();
  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function useWarehousesList(params: ListWarehousesParams) {
  return useQuery<PaginatedResponse<WarehouseRow>>({
    queryKey: [...warehousesQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedResponse<WarehouseRow>>(`/warehouses${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useWarehouseDetail(id: string | undefined) {
  return useQuery<WarehouseRow & { locations: WarehouseLocationRow[] }>({
    queryKey: [...warehousesQueryKey, 'detail', id],
    queryFn: () => backendGet<WarehouseRow & { locations: WarehouseLocationRow[] }>(`/warehouses/${encodeURIComponent(id ?? '')}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useWarehouseLocations(warehouseId: string | undefined) {
  return useQuery<WarehouseLocationRow[]>({
    queryKey: [...warehousesQueryKey, 'locations', warehouseId],
    queryFn: () => backendGet<WarehouseLocationRow[]>(`/warehouses/${encodeURIComponent(warehouseId ?? '')}/locations`),
    enabled: Boolean(warehouseId),
    retry: false,
  });
}

export function useWarehouseStockSummary(warehouseId: string | undefined, params: ListWarehouseStockParams) {
  return useQuery<PaginatedResponse<WarehouseStockRow>>({
    queryKey: [...warehousesQueryKey, 'stock-summary', warehouseId, params],
    queryFn: () => backendGet<PaginatedResponse<WarehouseStockRow>>(`/warehouses/${encodeURIComponent(warehouseId ?? '')}/stock-summary${queryString(params)}`),
    enabled: Boolean(warehouseId),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateWarehouse() {
  return useMutation<WarehouseRow, Error, WarehousePayload>({
    mutationFn: body => backendPost<WarehouseRow, WarehousePayload>('/warehouses', body),
  });
}

export function useUpdateWarehouse() {
  return useMutation<WarehouseRow, Error, { id: string; data: WarehousePayload }>({
    mutationFn: ({ id, data }) => backendPatch<WarehouseRow, WarehousePayload>(`/warehouses/${id}`, data),
  });
}

export function useCreateWarehouseLocation() {
  return useMutation<WarehouseLocationRow, Error, { warehouseId: string; data: WarehouseLocationPayload }>({
    mutationFn: ({ warehouseId, data }) => backendPost<WarehouseLocationRow, WarehouseLocationPayload>(`/warehouses/${warehouseId}/locations`, data),
  });
}

export function useUpdateWarehouseLocation() {
  return useMutation<WarehouseLocationRow, Error, { id: string; data: WarehouseLocationPayload }>({
    mutationFn: ({ id, data }) => backendPatch<WarehouseLocationRow, WarehouseLocationPayload>(`/warehouses/locations/${id}`, data),
  });
}
