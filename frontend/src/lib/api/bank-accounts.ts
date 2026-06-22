'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const bankAccountsQueryKey = ['backend', 'bank-accounts'] as const;

export interface BankAccountPayload {
  code: string;
  ledger_account_id: string;
  bank_name: string;
  branch_name?: string;
  branch_code?: string;
  account_title: string;
  account_number: string;
  account_type?: string;
  iban?: string;
  swift_code?: string;
  currency_code: string;
  opening_balance: number;
  opening_balance_date?: string;
  contact_name?: string;
  address?: string;
  post_code?: string;
  country?: string;
  city?: string;
  area?: string;
  phone_1?: string;
  phone_2?: string;
  mobile_number?: string;
  fax_number?: string;
  email?: string;
  website?: string;
  notes?: string;
  is_default: boolean;
  is_active: boolean;
}

export interface BankAccountsListQuery {
  page: number;
  limit: number;
  search?: string;
  is_active?: boolean;
}

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useBankAccountsSupportData() {
  return useQuery<any>({
    queryKey: [...bankAccountsQueryKey, 'support-data'],
    queryFn: () => backendGet<any>('/bank-accounts/support-data'),
    retry: false,
  });
}

export function useBankAccountsList(query: BankAccountsListQuery) {
  return useQuery<any>({
    queryKey: [...bankAccountsQueryKey, 'list', query],
    queryFn: () => backendGet<any>(`/bank-accounts?${buildQueryString(query)}`),
    placeholderData: (previous: any) => previous,
    retry: false,
  });
}

export function useCreateBankAccount() {
  return useMutation({
    mutationFn: (input: BankAccountPayload) => backendPost<any, BankAccountPayload>('/bank-accounts', input),
  });
}

export function useUpdateBankAccount() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<BankAccountPayload> }) => backendPatch<any, Partial<BankAccountPayload>>(`/bank-accounts/${id}`, input),
  });
}

export function useInvalidateBankAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: bankAccountsQueryKey });
}
