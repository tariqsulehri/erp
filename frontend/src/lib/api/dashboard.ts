'use client';

import { useQuery } from '@tanstack/react-query';
import { backendGet } from './backend-client';

export interface DashboardSummary {
  accounts: {
    total: number;
    active: number;
    inactive: number;
    posting: number;
    byType: Array<{ type: string; count: number }>;
  };
  vouchers: {
    total: number;
    posted: number;
    draft: number;
    voided: number;
    byType: Array<{ type: string; count: number; total: number }>;
    recent: Array<{
      id: string;
      voucher_number: string;
      voucher_type: string;
      voucher_date: string;
      narration: string | null;
      total_debit: string;
      status: string;
    }>;
    monthlyVolume: Array<{ month: string; count: number; total: number }>;
  };
  fiscalYear: {
    id: string;
    name: string;
    status: string;
    startDate: string;
    endDate: string;
    isLocked: boolean;
    openPeriods: number;
    closedPeriods: number;
    totalPeriods: number;
    currentPeriod: { name: string; status: string } | null;
  } | null;
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary>({
    queryKey: ['backend', 'dashboard', 'summary'],
    queryFn: () => backendGet<DashboardSummary>('/dashboard/summary'),
    refetchOnWindowFocus: false,
    retry: false,
  });
}

