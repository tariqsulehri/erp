'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { backendGet, backendPatch } from './backend-client';

export const generalSettingsQueryKey = ['backend', 'settings', 'general'] as const;
export const companyProfileQueryKey = ['backend', 'settings', 'company'] as const;
export const postingAccountSettingsQueryKey = ['backend', 'settings', 'posting-accounts'] as const;

export interface PostingAccountSettings {
  purchase: Record<string, string | null> | null;
  sale: Record<string, string | null> | null;
  stock_adjustment: Record<string, string | null> | null;
}

export interface UpdatePostingAccountSettingsInput {
  purchase?: Partial<{
    default_cash_account_id: string;
    default_inventory_account_id: string;
    purchase_tax_account_id: string | null;
    freight_account_id: string | null;
    purchase_discount_account_id: string | null;
  }>;
  sale?: Partial<{
    default_cash_account_id: string;
    default_inventory_account_id: string;
    sales_revenue_account_id: string;
    sales_tax_account_id: string | null;
    sales_discount_account_id: string | null;
    freight_income_account_id: string | null;
    cost_of_goods_sold_account_id: string;
  }>;
  stock_adjustment?: Partial<{
    default_inventory_account_id: string;
    adjustment_gain_account_id: string;
    adjustment_loss_account_id: string;
  }>;
}

export function useGeneralSettings() {
  return useQuery<AppFormatSettingsSource>({
    queryKey: generalSettingsQueryKey,
    queryFn: () => backendGet<AppFormatSettingsSource>('/settings/general'),
  });
}

export function useCompanyProfile() {
  return useQuery<any>({
    queryKey: companyProfileQueryKey,
    queryFn: () => backendGet<any>('/settings/company'),
  });
}

export function usePostingAccountSettings() {
  return useQuery<PostingAccountSettings>({
    queryKey: postingAccountSettingsQueryKey,
    queryFn: () => backendGet<PostingAccountSettings>('/settings/posting-accounts'),
  });
}

export function useUpdateGeneralSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<AppFormatSettingsSource> & Record<string, unknown>) =>
      backendPatch<AppFormatSettingsSource, typeof body>('/settings/general', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: generalSettingsQueryKey });
    },
  });
}

export function useUpdateCompanyProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Record<string, unknown>) => backendPatch<any, typeof body>('/settings/company', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companyProfileQueryKey });
    },
  });
}

export function useUpdatePostingAccountSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePostingAccountSettingsInput) =>
      backendPatch<PostingAccountSettings, UpdatePostingAccountSettingsInput>('/settings/posting-accounts', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postingAccountSettingsQueryKey });
    },
  });
}
