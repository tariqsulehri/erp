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
  four_eyes_verified?: boolean;
  single_operator?: boolean;
  maker_id?: string | null;
  checker_id?: string | null;
}

export interface ListAuditLogsParams {
  page?: number;
  limit?: number;
  search?: string;
  entity_name?: string;
  action?: string;
  category?: string;
  four_eyes?: 'all' | 'verified' | 'single';
  user_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface PaginatedAuditLogsResponse {
  data: AuditLogRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface AuditLogStats {
  metrics: {
    totalEvents: number;
    activeUsers: number;
    criticalActions: number;
    todayEvents: number;
    topEntity: string | null;
  };
  fourEyesMetrics?: {
    dualControlRate: number;
    fourEyesVerifiedCount: number;
    singleOperatorCount: number;
    pendingApprovals: number;
    totalEvaluated: number;
  };
  categoryCounts?: {
    all: number;
    approvals: number;
    updates: number;
    deletions: number;
    creations: number;
    logins: number;
    fourEyes: number;
  };
  dailyActivity: Array<{
    day: string;
    label: string;
    count: number;
  }>;
  byAction: Array<{
    action: string;
    count: number;
    percentage: number;
  }>;
  byEntity: Array<{
    entity: string;
    count: number;
    percentage: number;
  }>;
  topUsers: Array<{
    userName: string;
    userEmail: string | null;
    count: number;
    percentage: number;
  }>;
  recentCritical: AuditLogRow[];
  recentActivities?: AuditLogRow[];
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

export function useAuditLogStats(params?: { from_date?: string; to_date?: string }) {
  return useQuery<AuditLogStats>({
    queryKey: [...auditLogsQueryKey, 'stats', params],
    queryFn: () => backendGet<AuditLogStats>(`/audit-logs/stats${queryString(params ?? {})}`),
    staleTime: 15_000,
  });
}
