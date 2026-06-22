'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPatch, backendPost } from './backend-client';

export const bankChequesQueryKey = ['backend', 'bank-cheques'] as const;

export type ChequeStatus = 'Available' | 'Reserved' | 'Issued' | 'Cleared' | 'Bounced' | 'Void' | 'Cancelled' | 'Stopped';
export type ChequeBookStatus = 'Active' | 'Closed';
export type VoidReason = 'Torn' | 'Text Not Clear' | 'Writing Mistake' | 'Cancelled' | 'Printer Error' | 'Other';

export interface CreateChequeBookPayload {
  bank_account_id: string;
  book_number: string;
  prefix?: string;
  suffix?: string;
  start_cheque_number: string;
  end_cheque_number: string;
  issued_date?: string;
  received_date?: string;
  notes?: string;
}

export interface BankChequeListQuery {
  page: number;
  limit: number;
  bank_account_id?: string;
  cheque_book_id?: string;
  status?: ChequeStatus | '';
  search?: string;
}

export interface BankChequeBookListQuery {
  page: number;
  limit: number;
  bank_account_id?: string;
  status?: ChequeBookStatus | '';
  search?: string;
}

export interface VoidChequePayload {
  reason: VoidReason;
  notes?: string;
}

export interface IssueChequePayload {
  issue_date: string;
  payee_name: string;
  payment_reference?: string;
  amount: number;
}

function buildQueryString<TQuery extends object>(query: TQuery) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useBankChequesSupportData() {
  return useQuery<any>({
    queryKey: [...bankChequesQueryKey, 'support-data'],
    queryFn: () => backendGet<any>('/bank-cheques/support-data'),
    retry: false,
  });
}

export function useBankChequeBooksList(query: BankChequeBookListQuery, enabled = true) {
  return useQuery<any>({
    queryKey: [...bankChequesQueryKey, 'books', query],
    queryFn: () => backendGet<any>(`/bank-cheques/books?${buildQueryString(query)}`),
    enabled,
    placeholderData: (previous: any) => previous,
    retry: false,
  });
}

export function useBankChequesList(query: BankChequeListQuery, enabled = true) {
  return useQuery<any>({
    queryKey: [...bankChequesQueryKey, 'list', query],
    queryFn: () => backendGet<any>(`/bank-cheques?${buildQueryString(query)}`),
    enabled,
    placeholderData: (previous: any) => previous,
    retry: false,
  });
}

export function useAvailableBankCheques(bankAccountId: string, search = '', enabled = true) {
  return useQuery<any[]>({
    queryKey: [...bankChequesQueryKey, 'available', bankAccountId, search],
    queryFn: () => backendGet<any[]>(`/bank-cheques/available?${buildQueryString({ bank_account_id: bankAccountId, search, limit: 50 })}`),
    enabled: enabled && Boolean(bankAccountId),
    retry: false,
  });
}

export function useCreateBankChequeBook() {
  return useMutation({
    mutationFn: (input: CreateChequeBookPayload) => backendPost<any, CreateChequeBookPayload>('/bank-cheques/books', input),
  });
}

export function useVoidBankCheque() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VoidChequePayload }) => backendPatch<any, VoidChequePayload>(`/bank-cheques/${id}/void`, input),
  });
}

export function useIssueBankCheque() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: IssueChequePayload }) => backendPatch<any, IssueChequePayload>(`/bank-cheques/${id}/issue`, input),
  });
}

export function useInvalidateBankCheques() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: bankChequesQueryKey });
}
