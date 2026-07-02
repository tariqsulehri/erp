'use client';

import { useQuery } from '@tanstack/react-query';
import { backendGet } from './backend-client';

export interface LedgerReportLine {
  id: string;
  voucher_id: string;
  voucher_number: string;
  voucher_type: string;
  voucher_date: string;
  reference: string | null;
  description: string;
  debit_amount: string;
  credit_amount: string;
  running_balance: string;
  running_balance_side: 'Debit' | 'Credit' | 'Balanced';
  line_no: number;
}

export interface LedgerReportResponse {
  account: {
    id: string;
    code: string;
    name: string;
    account_type: string;
    normal_balance: string;
  };
  date_from: string;
  date_to: string;
  opening_balance: string;
  opening_balance_side: 'Debit' | 'Credit' | 'Balanced';
  total_debit: string;
  total_credit: string;
  closing_balance: string;
  closing_balance_side: 'Debit' | 'Credit' | 'Balanced';
  lines: LedgerReportLine[];
}

export interface LedgerReportQuery {
  account_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface TrialBalanceLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  main_code: string;
  main_name: string;
  group_code: string;
  group_name: string;
  sub_group_code: string;
  sub_group_name: string;
  opening_debit: string;
  opening_credit: string;
  period_debit: string;
  period_credit: string;
  closing_debit: string;
  closing_credit: string;
}

export interface TrialBalanceReportResponse {
  date_from: string;
  date_to: string;
  include_zero_balances: boolean;
  totals: {
    opening_debit: string;
    opening_credit: string;
    period_debit: string;
    period_credit: string;
    closing_debit: string;
    closing_credit: string;
    difference: string;
  };
  lines: TrialBalanceLine[];
}

export interface TrialBalanceReportQuery {
  date_from?: string;
  date_to?: string;
  include_zero_balances?: boolean;
}

export interface ProfitAndLossLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  section: 'Revenue' | 'Expenses';
  main_code: string;
  main_name: string;
  group_code: string;
  group_name: string;
  sub_group_code: string;
  sub_group_name: string;
  debit_amount: string;
  credit_amount: string;
  amount: string;
}

export interface ProfitAndLossReportResponse {
  date_from: string;
  date_to: string;
  include_zero_balances: boolean;
  totals: {
    revenue: string;
    expenses: string;
    net_profit: string;
    net_loss: string;
    result: 'Profit' | 'Loss' | 'Break Even';
  };
  lines: ProfitAndLossLine[];
}

export interface ProfitAndLossReportQuery {
  date_from?: string;
  date_to?: string;
  include_zero_balances?: boolean;
}

export interface BalanceSheetLine {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  section: 'Assets' | 'Liabilities' | 'Equity';
  main_code: string;
  main_name: string;
  group_code: string;
  group_name: string;
  sub_group_code: string;
  sub_group_name: string;
  debit_balance: string;
  credit_balance: string;
  amount: string;
  is_system_line: boolean;
}

export interface BalanceSheetReportResponse {
  as_of_date: string;
  fiscal_year: {
    id: string;
    fiscal_year: string;
    start_date: string;
    end_date: string;
  } | null;
  include_zero_balances: boolean;
  totals: {
    assets: string;
    liabilities: string;
    equity: string;
    liabilities_and_equity: string;
    difference: string;
    current_year_profit: string;
    current_year_loss: string;
    result: 'Profit' | 'Loss' | 'Break Even';
  };
  lines: BalanceSheetLine[];
}

export interface BalanceSheetReportQuery {
  as_of_date?: string;
  include_zero_balances?: boolean;
}

function buildQueryString<T extends object>(query: T) {
  const params = new URLSearchParams();
  Object.entries(query as Record<string, string | number | boolean | undefined>).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    params.set(key, String(value));
  });
  return params.toString();
}

export function useLedgerReport(query: LedgerReportQuery, enabled: boolean) {
  return useQuery<LedgerReportResponse>({
    queryKey: ['backend', 'reports', 'ledger', query],
    queryFn: () => backendGet<LedgerReportResponse>(`/reports/ledger?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export function useTrialBalanceReport(query: TrialBalanceReportQuery, enabled: boolean) {
  return useQuery<TrialBalanceReportResponse>({
    queryKey: ['backend', 'reports', 'trial-balance', query],
    queryFn: () => backendGet<TrialBalanceReportResponse>(`/reports/trial-balance?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export function useProfitAndLossReport(query: ProfitAndLossReportQuery, enabled: boolean) {
  return useQuery<ProfitAndLossReportResponse>({
    queryKey: ['backend', 'reports', 'profit-and-loss', query],
    queryFn: () => backendGet<ProfitAndLossReportResponse>(`/reports/profit-and-loss?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export function useBalanceSheetReport(query: BalanceSheetReportQuery, enabled: boolean) {
  return useQuery<BalanceSheetReportResponse>({
    queryKey: ['backend', 'reports', 'balance-sheet', query],
    queryFn: () => backendGet<BalanceSheetReportResponse>(`/reports/balance-sheet?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}
