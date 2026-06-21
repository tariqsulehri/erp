'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { backendGet, backendPatch } from './backend-client';

export const generalSettingsQueryKey = ['backend', 'settings', 'general'] as const;
export const companyProfileQueryKey = ['backend', 'settings', 'company'] as const;

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
