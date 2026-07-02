'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const vouchersQueryKey = ['backend', 'vouchers'] as const;

interface VoucherListParams {
  page?: number;
  limit?: number;
  voucher_type?: string;
  status?: string;
  approval_status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  amount_from?: number;
  amount_to?: number;
}

function toQueryString(params: VoucherListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') searchParams.set(key, String(value));
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function useVouchersList(params: VoucherListParams) {
  return useQuery<any>({
    queryKey: [...vouchersQueryKey, 'list', params],
    queryFn: () => backendGet<any>(`/vouchers${toQueryString(params)}`),
  });
}

export function useVoucherDetail(id?: string) {
  return useQuery<any>({
    queryKey: [...vouchersQueryKey, 'detail', id],
    queryFn: () => backendGet<any>(`/vouchers/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => backendPost<any, typeof body>('/vouchers', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function useUpdateVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      backendPatch<any, typeof body>(`/vouchers/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function usePostVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => backendPost<any, Record<string, never>>(`/vouchers/${id}/post`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function useRequestVoucherApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      backendPost<any, { note?: string }>(`/vouchers/${id}/request-approval`, { note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function useApproveVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      backendPost<any, { note?: string }>(`/vouchers/${id}/approve`, { note }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function useRejectVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      backendPost<any, { reason: string }>(`/vouchers/${id}/reject`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}

export function useVoidVoucher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      backendPost<any, { reason: string }>(`/vouchers/${id}/void`, { reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vouchersQueryKey }),
  });
}
