'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { AccessLevel, SessionBranch, SessionWarehouse, UserRole } from '@/lib/auth/session-user';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const usersQueryKey = ['backend', 'users'] as const;

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  access_level: AccessLevel | null;
  branch: SessionBranch | null;
  warehouse: SessionWarehouse | null;
  is_active: boolean;
  last_login_at: string | null;
}

export interface UserPayload {
  full_name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  access_level?: AccessLevel;
  branch_id?: string | null;
  warehouse_id?: string | null;
  is_active?: boolean;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'All' | 'Active' | 'Inactive';
}

export interface PaginatedUsersResponse {
  data: UserRow[];
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

export function useUsersList(params: ListUsersParams) {
  return useQuery<PaginatedUsersResponse>({
    queryKey: [...usersQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedUsersResponse>(`/users${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}

export function useCreateUser() {
  return useMutation<UserRow, Error, UserPayload>({
    mutationFn: body => backendPost<UserRow, UserPayload>('/users', body),
  });
}

export function useUpdateUser() {
  return useMutation<UserRow, Error, { id: string; data: UserPayload }>({
    mutationFn: ({ id, data }) => backendPatch<UserRow, UserPayload>(`/users/${id}`, data),
  });
}

export function useResetUserPassword() {
  return useMutation<{ message: string }, Error, { id: string; newPassword: string }>({
    mutationFn: ({ id, newPassword }) => backendPost<{ message: string }, { new_password: string }>(`/users/${id}/reset-password`, { new_password: newPassword }),
  });
}
