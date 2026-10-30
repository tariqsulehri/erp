'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backendGet, backendPost } from './backend-client';

export type MetricStatus = 'optimal' | 'warning' | 'critical' | 'neutral';

export interface ExecutiveMetricItem {
  label: string;
  value: string;
  status?: MetricStatus;
  change?: string | null;
  hint?: string;
}

export interface ExecutiveTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
}

export interface ExecutiveTableData {
  title: string;
  columns: ExecutiveTableColumn[];
  rows: Record<string, string | number | boolean | null>[];
}

export interface ExecutiveAiQueryResponse {
  question: string;
  intent: string;
  answer: string;
  status: MetricStatus;
  keyMetrics: ExecutiveMetricItem[];
  tableData?: ExecutiveTableData;
  actionableSuggestions: string[];
  followUpQuestions: string[];
}

export interface ExecutiveAlertItem {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  category: 'treasury' | 'receivables' | 'payables' | 'inventory' | 'governance';
  actionLabel?: string;
}

export interface ExecutiveSuggestionItem {
  id: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  impact: string;
  category: 'liquidity' | 'collections' | 'costs' | 'inventory' | 'governance';
}

export interface ExecutiveBriefingResponse {
  generatedAt: string;
  healthScore: number;
  healthStatus: MetricStatus;
  executiveSummary: string;
  kpis: {
    cashAndBank: ExecutiveMetricItem;
    revenueYtd: ExecutiveMetricItem;
    netProfitYtd: ExecutiveMetricItem;
    grossMargin: ExecutiveMetricItem;
    receivables: ExecutiveMetricItem & { overdueAmount: string; overdueRatio: string };
    payables: ExecutiveMetricItem;
    stockValuation: ExecutiveMetricItem & { lowStockCount: number; zeroStockCount: number };
    internalControl: {
      unpostedVouchersCount: number;
      unpostedVouchersTotal: string;
      dualControlRate: number;
      pendingApprovalsCount: number;
    };
  };
  criticalAlerts: ExecutiveAlertItem[];
  strategicSuggestions: ExecutiveSuggestionItem[];
}

export function useExecutiveBriefing() {
  return useQuery<ExecutiveBriefingResponse>({
    queryKey: ['executive-ai', 'briefing'],
    queryFn: () => backendGet<ExecutiveBriefingResponse>('/executive-ai/briefing'),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useExecutiveSuggestions() {
  return useQuery<ExecutiveSuggestionItem[]>({
    queryKey: ['executive-ai', 'suggestions'],
    queryFn: () => backendGet<ExecutiveSuggestionItem[]>('/executive-ai/suggestions'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useExecutiveAiQueryMutation() {
  const queryClient = useQueryClient();

  return useMutation<ExecutiveAiQueryResponse, Error, { question: string }>({
    mutationFn: ({ question }) =>
      backendPost<ExecutiveAiQueryResponse, { question: string }>('/executive-ai/query', { question }),
    onSuccess: () => {
      // Invalidate briefing so any state changes or updates stay fresh
      queryClient.invalidateQueries({ queryKey: ['executive-ai', 'briefing'] });
    },
  });
}
