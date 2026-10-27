'use client';

import { useQuery } from '@tanstack/react-query';
import { backendGet } from './backend-client';

export const auditLogsQueryKey = ['backend', 'audit-logs'] as const;

export interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  action: string;
  entity_name: string;
  entity_id: string | null;
  description: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  entity_name?: string;
  action?: string;
  user_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLogRow[];
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

export function useAuditLogs(params: ListAuditLogsParams) {
  return useQuery<PaginatedAuditLogsResponse>({
    queryKey: [...auditLogsQueryKey, 'list', params],
    queryFn: () => backendGet<PaginatedAuditLogsResponse>(`/audit-logs${queryString(params)}`),
    placeholderData: previous => previous,
    retry: false,
  });
}
