'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';
import type { ListWarehouseStockParams, PaginatedResponse, WarehouseStockRow } from './warehouses';

export const branchesQueryKey = ['backend', 'branches'] as const;

export interface BranchRow {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  manager_name?: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface BranchPayload {
  code?: string;
  name?: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  manager_name?: string;
  is_default?: boolean;
  is_active?: boolean;
}

export interface ListBranchesParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface PaginatedBranchesResponse {
  data: BranchRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
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

export function useBranchesList(params: ListBranchesParams) {
  return useQuery<PaginatedBranchesResponse>({
    queryKey: [...branchesQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedBranchesResponse>(`/branches${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateBranch() {
  return useMutation<BranchRow, Error, BranchPayload>({
    mutationFn: body => backendPost<BranchRow, BranchPayload>('/branches', body),
  });
}

export function useUpdateBranch() {
  return useMutation<BranchRow, Error, { id: string; data: BranchPayload }>({
    mutationFn: ({ id, data }) => backendPatch<BranchRow, BranchPayload>(`/branches/${id}`, data),
  });
}

/** Item stock held at one Branch. Branch users can open only their own Branch. */
export function useBranchStockSummary(branchId: string | undefined, params: ListWarehouseStockParams) {
  return useQuery<PaginatedResponse<WarehouseStockRow>>({
    queryKey: [...branchesQueryKey, 'stock-summary', branchId, params],
    queryFn: () => backendGet<PaginatedResponse<WarehouseStockRow>>(`/branches/${encodeURIComponent(branchId ?? '')}/stock-summary${queryString(params)}`),
    enabled: Boolean(branchId),
    placeholderData: previous => previous,
    retry: false,
  });
}
