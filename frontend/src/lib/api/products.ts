'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { backendDelete, backendGet, backendPatch, backendPost } from './backend-client';

export const productsQueryKey = ['backend', 'products'] as const;

export interface ListProductsParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  brand_id?: string;
  product_type?: string;
  status?: string;
  is_sellable?: boolean;
  low_stock?: boolean;
  stock_filter?: string;
  sort_by?: string;
  sort_dir?: 'ASC' | 'DESC';
}

export interface ProductListResponse {
  data: any[];
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

export function useProductsList(params: ListProductsParams) {
  return useQuery<ProductListResponse>({
    queryKey: [...productsQueryKey, 'list', params],
    queryFn: () => backendGet<ProductListResponse>(`/products${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useProductDetail(id: string | undefined) {
  return useQuery<any>({
    queryKey: [...productsQueryKey, 'detail', id],
    queryFn: () => backendGet<any>(`/products/${encodeURIComponent(id ?? '')}`),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useProductCategories() {
  return useQuery<any[]>({
    queryKey: [...productsQueryKey, 'categories'],
    queryFn: () => backendGet<any[]>('/products/categories'),
    retry: false,
  });
}

export function useProductBrands() {
  return useQuery<any[]>({
    queryKey: [...productsQueryKey, 'brands'],
    queryFn: () => backendGet<any[]>('/products/brands'),
    retry: false,
  });
}

export function useProductUnitsOfMeasure() {
  return useQuery<any[]>({
    queryKey: [...productsQueryKey, 'units-of-measure'],
    queryFn: () => backendGet<any[]>('/products/units-of-measure'),
    retry: false,
  });
}

export function useSuggestedSku(prefix = 'PRD', enabled = true) {
  return useQuery<{ sku: string }>({
    queryKey: [...productsQueryKey, 'suggest-sku', prefix],
    queryFn: () => backendGet<{ sku: string }>(`/products/suggest-sku${queryString({ prefix })}`),
    enabled,
    retry: false,
  });
}

export function useCreateProduct() {
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: body => backendPost<any, Record<string, unknown>>('/products', body),
  });
}

export function useUpdateProduct() {
  return useMutation<any, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => backendPatch<any, Record<string, unknown>>(`/products/${id}`, data),
  });
}

export function useArchiveProduct() {
  return useMutation<{ ok: boolean }, Error, { id: string }>({
    mutationFn: ({ id }) => backendPatch<{ ok: boolean }, Record<string, never>>(`/products/${id}/archive`, {}),
  });
}

export function useCreateProductCategory() {
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: body => backendPost<any, Record<string, unknown>>('/products/categories', body),
  });
}

export function useUpdateProductCategory() {
  return useMutation<any, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => backendPatch<any, Record<string, unknown>>(`/products/categories/${id}`, data),
  });
}

export function useDeleteProductCategory() {
  return useMutation<{ ok: boolean }, Error, { id: string }>({
    mutationFn: ({ id }) => backendDelete<{ ok: boolean }>(`/products/categories/${id}`),
  });
}

export function useCreateProductUom() {
  return useMutation<any, Error, Record<string, unknown>>({
    mutationFn: body => backendPost<any, Record<string, unknown>>('/products/units-of-measure', body),
  });
}

export function useUpdateProductUom() {
  return useMutation<any, Error, { id: string; data: Record<string, unknown> }>({
    mutationFn: ({ id, data }) => backendPatch<any, Record<string, unknown>>(`/products/units-of-measure/${id}`, data),
  });
}

export function useDeleteProductUom() {
  return useMutation<{ ok: boolean }, Error, { id: string }>({
    mutationFn: ({ id }) => backendDelete<{ ok: boolean }>(`/products/units-of-measure/${id}`),
  });
}
