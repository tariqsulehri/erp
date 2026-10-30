import { z } from 'zod';

export const executiveQuerySchema = z.object({
  question: z.string().trim().min(1, 'Please enter a question or query.').max(1000, 'Question must be under 1,000 characters.'),
});

export type ExecutiveQueryInput = z.infer<typeof executiveQuerySchema>;

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
