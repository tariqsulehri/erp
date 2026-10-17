'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendDelete, backendGet, backendPatch, backendPost } from './backend-client';

interface PartyListParams {
  search?: string;
  type?: 'individual' | 'company' | 'government';
  is_active?: boolean;
  page?: number;
  limit?: number;
}

function toQueryString(params: PartyListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value));
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export const customersQueryKey = ['backend', 'customers'] as const;
export const suppliersQueryKey = ['backend', 'suppliers'] as const;

export function useCustomersList(params: PartyListParams) {
  return useQuery<any>({
    queryKey: [...customersQueryKey, 'list', params],
    queryFn: () => backendGet<any>(`/customers${toQueryString(params)}`),
  });
}

export function useCustomerStats() {
  return useQuery<any>({
    queryKey: [...customersQueryKey, 'stats'],
    queryFn: () => backendGet<any>('/customers/stats'),
  });
}

export function useCustomerNextCode(enabled: boolean) {
  return useQuery<string>({
    queryKey: [...customersQueryKey, 'next-code'],
    queryFn: () => backendGet<string>('/customers/next-code'),
    enabled,
  });
}

export function useCustomerAccounts() {
  return useQuery<any[]>({
    queryKey: [...customersQueryKey, 'accounts'],
    queryFn: () => backendGet<any[]>('/customers/accounts'),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => backendPost<any, typeof body>('/customers', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customersQueryKey }),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      backendPatch<any, typeof body>(`/customers/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customersQueryKey }),
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backendDelete<{ success: boolean }>(`/customers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customersQueryKey }),
  });
}

export function useSuppliersList(params: PartyListParams) {
  return useQuery<any>({
    queryKey: [...suppliersQueryKey, 'list', params],
    queryFn: () => backendGet<any>(`/suppliers${toQueryString(params)}`),
  });
}

export function useSupplierStats() {
  return useQuery<any>({
    queryKey: [...suppliersQueryKey, 'stats'],
    queryFn: () => backendGet<any>('/suppliers/stats'),
  });
}

export function useSupplierNextCode(enabled: boolean) {
  return useQuery<string>({
    queryKey: [...suppliersQueryKey, 'next-code'],
    queryFn: () => backendGet<string>('/suppliers/next-code'),
    enabled,
  });
}

export function useSupplierAccounts() {
  return useQuery<any[]>({
    queryKey: [...suppliersQueryKey, 'accounts'],
    queryFn: () => backendGet<any[]>('/suppliers/accounts'),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => backendPost<any, typeof body>('/suppliers', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suppliersQueryKey }),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      backendPatch<any, typeof body>(`/suppliers/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suppliersQueryKey }),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backendDelete<{ success: boolean }>(`/suppliers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: suppliersQueryKey }),
  });
}
