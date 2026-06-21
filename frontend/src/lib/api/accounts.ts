'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export interface AccountListItem {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  account_type: string;
  normal_balance: string;
  is_posting: boolean;
  is_system: boolean;
  is_active: boolean;
  sort_order: number | null;
  opening_balance: string | null;
  opening_balance_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isPosting: boolean;
  children: AccountTreeNode[];
}

export interface AccountHistoryItem {
  id: string;
  account_id: string;
  company_id: string;
  changed_by: string | null;
  action: string;
  changes: unknown;
  created_at: string;
}

export interface AccountsListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  is_active?: boolean;
  is_posting?: boolean;
}

export interface AccountsListResponse {
  data: AccountListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export interface UpdateAccountInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
}

export interface AccountActionResponse {
  success: boolean;
  account: AccountListItem;
  message: string;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  description?: string | null;
  account_type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
  normal_balance: 'Debit' | 'Credit';
  is_posting: boolean;
  is_system?: boolean;
  sort_order?: number;
  category_id?: string | null;
  opening_balance?: number | null;
  opening_balance_date?: string | null;
}

export interface AccountTemplateItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  accountCount: number;
}

export interface BulkCreateAccountsResponse {
  results: Array<{ code: string; success: boolean; message: string }>;
  created: number;
  skipped: number;
  failed: number;
}

export interface ImportAccountTemplateResponse extends BulkCreateAccountsResponse {
  success: boolean;
  imported: number;
  message: string;
}

export interface BulkAccountActiveResponse {
  success: boolean;
  updated: number;
  message: string;
}

export interface CloneAccountResponse extends AccountActionResponse {}

export const accountsQueryKey = ['backend', 'accounts'] as const;

function buildAccountsQuery(params: AccountsListParams) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function useAccountsList(params: AccountsListParams, enabled = true) {
  return useQuery<AccountsListResponse>({
    queryKey: [...accountsQueryKey, 'list', params],
    queryFn: () => backendGet<AccountsListResponse>(`/accounts${buildAccountsQuery(params)}`),
    enabled,
    retry: false,
  });
}

export function useAccountsHierarchy() {
  return useQuery<AccountTreeNode[]>({
    queryKey: [...accountsQueryKey, 'hierarchy'],
    queryFn: () => backendGet<AccountTreeNode[]>('/accounts/hierarchy'),
    retry: false,
  });
}

export function useTopLevelAccounts() {
  return useQuery<AccountListItem[]>({
    queryKey: [...accountsQueryKey, 'top-level'],
    queryFn: () => backendGet<AccountListItem[]>('/accounts/top-level'),
    retry: false,
  });
}

export function useChildAccounts(parentCode: string | undefined, enabled = true) {
  return useQuery<AccountListItem[]>({
    queryKey: [...accountsQueryKey, 'children', parentCode],
    queryFn: () => backendGet<AccountListItem[]>(`/accounts/children?parent_code=${encodeURIComponent(parentCode ?? '')}`),
    enabled: Boolean(parentCode) && enabled,
    retry: false,
  });
}

export function useNextAccountCode(parentCode: string | undefined, isPosting: boolean, enabled = true) {
  return useQuery<{ code: string | null }>({
    queryKey: [...accountsQueryKey, 'next-code', parentCode, isPosting],
    queryFn: () => backendGet<{ code: string | null }>(`/accounts/next-code?parent_code=${encodeURIComponent(parentCode ?? '')}&is_posting=${String(isPosting)}`),
    enabled: Boolean(parentCode) && enabled,
    retry: false,
  });
}

export function useAccountTemplates(open = true) {
  return useQuery<AccountTemplateItem[]>({
    queryKey: [...accountsQueryKey, 'templates'],
    queryFn: () => backendGet<AccountTemplateItem[]>('/accounts/templates'),
    enabled: open,
    retry: false,
  });
}

export function useAccountDetail(id: string | undefined, enabled = true) {
  return useQuery<AccountListItem>({
    queryKey: [...accountsQueryKey, 'detail', id],
    queryFn: () => backendGet<AccountListItem>(`/accounts/${encodeURIComponent(id ?? '')}`),
    enabled: Boolean(id) && enabled,
    retry: false,
  });
}

export function useAccountHistory(accountId: string | undefined, enabled = true) {
  return useQuery<AccountHistoryItem[]>({
    queryKey: [...accountsQueryKey, 'history', accountId],
    queryFn: () => backendGet<AccountHistoryItem[]>(`/accounts/${encodeURIComponent(accountId ?? '')}/history`),
    enabled: Boolean(accountId) && enabled,
    retry: false,
  });
}

export function useUpdateAccount() {
  return useMutation<AccountActionResponse, Error, { id: string; data: UpdateAccountInput }>({
    mutationFn: ({ id, data }) => backendPatch<AccountActionResponse, UpdateAccountInput>(`/accounts/${id}`, data),
  });
}

export function useCreateAccount() {
  return useMutation<AccountActionResponse, Error, CreateAccountInput>({
    mutationFn: body => backendPost<AccountActionResponse, CreateAccountInput>('/accounts', body),
  });
}

export function useBulkCreateAccounts() {
  return useMutation<BulkCreateAccountsResponse, Error, { rows: CreateAccountInput[] }>({
    mutationFn: body => backendPost<BulkCreateAccountsResponse, typeof body>('/accounts/bulk-create', body),
  });
}

export function useImportAccountTemplate() {
  return useMutation<ImportAccountTemplateResponse, Error, { templateCode: string }>({
    mutationFn: ({ templateCode }) => backendPost<ImportAccountTemplateResponse, { template_code: string }>('/accounts/templates/import', { template_code: templateCode }),
  });
}

export function useToggleAccountActive() {
  return useMutation<AccountActionResponse, Error, { id: string; is_active: boolean }>({
    mutationFn: ({ id, is_active }) => backendPatch<AccountActionResponse, { is_active: boolean }>(`/accounts/${id}/active`, { is_active }),
  });
}

export function useBulkSetAccountActive() {
  return useMutation<BulkAccountActiveResponse, Error, { ids: string[]; is_active: boolean }>({
    mutationFn: body => backendPatch<BulkAccountActiveResponse, typeof body>('/accounts/bulk-active', body),
  });
}

export function useCloneAccount() {
  return useMutation<CloneAccountResponse, Error, { sourceId: string; newName: string }>({
    mutationFn: ({ sourceId, newName }) => backendPost<CloneAccountResponse, { new_name: string }>(`/accounts/${sourceId}/clone`, { new_name: newName }),
  });
}
