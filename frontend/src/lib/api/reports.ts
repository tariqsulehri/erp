'use client';

import { useQuery } from '@tanstack/react-query';
import { backendGet } from './backend-client';

export interface LedgerReportLine {
  id: string;
  /** Null for the Opening Balance row of an opening balance dated inside the period. */
  voucher_id: string | null;
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

/* ── Business reports ─────────────────────────────────────────────── */

export interface DayBookVoucher {
  id: string;
  voucher_number: string;
  voucher_type: string;
  voucher_date: string;
  reference: string | null;
  narration: string | null;
  total_debit: string;
  total_credit: string;
  lines: Array<{ account_id: string; account_code: string; account_name: string; debit_amount: string; credit_amount: string; narration: string | null }>;
}

export interface DayBookResponse {
  date_from: string;
  date_to: string;
  totals: { voucher_count: number; total_debit: string; total_credit: string };
  vouchers: DayBookVoucher[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface DayBookQuery {
  date_from: string;
  date_to: string;
  voucher_type?: string;
  page?: number;
  limit?: number;
}

export function useDayBookReport(query: DayBookQuery, enabled: boolean) {
  return useQuery<DayBookResponse>({
    queryKey: ['backend', 'reports', 'day-book', query],
    queryFn: () => backendGet<DayBookResponse>(`/reports/day-book?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export type AgingKind = 'receivables' | 'payables';
export type AgingBucketKey = 'days_0_30' | 'days_31_60' | 'days_61_90' | 'over_90';

export interface AgingRow extends Record<AgingBucketKey, string> {
  party_id: string;
  party_code: string;
  party_name: string;
  account_id: string;
  account_code: string;
  advance: string;
  balance: string;
}

export interface AgingResponse {
  kind: AgingKind;
  as_of_date: string;
  buckets: Array<{ key: AgingBucketKey; label: string }>;
  totals: Record<AgingBucketKey | 'advance' | 'balance', string>;
  rows: AgingRow[];
}

export function useAgingReport(query: { kind: AgingKind; as_of_date: string }, enabled: boolean) {
  return useQuery<AgingResponse>({
    queryKey: ['backend', 'reports', 'aging', query],
    queryFn: () => backendGet<AgingResponse>(`/reports/aging?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export interface SalesTaxDocument {
  document_type: 'Sale' | 'Sale Return' | 'Purchase' | 'Purchase Return';
  document_id: string;
  document_number: string;
  document_date: string;
  party_name: string;
  tax_registration_no: string | null;
  tax_side: 'Output' | 'Input';
  taxable_amount: string;
  tax_amount: string;
}

export interface SalesTaxResponse {
  date_from: string;
  date_to: string;
  summary: {
    output_taxable_amount: string;
    output_tax: string;
    input_taxable_amount: string;
    input_tax: string;
    net_tax_payable: string;
    net_tax_refundable: string;
  };
  documents: SalesTaxDocument[];
}

export function useSalesTaxReport(query: { date_from: string; date_to: string }, enabled: boolean) {
  return useQuery<SalesTaxResponse>({
    queryKey: ['backend', 'reports', 'sales-tax', query],
    queryFn: () => backendGet<SalesTaxResponse>(`/reports/sales-tax?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export interface StockLedgerQuery {
  item_id: string;
  date_from: string;
  date_to: string;
  branch_id?: string;
  warehouse_id?: string;
}

export interface StockLedgerResponse {
  item: { id: string; item_code: string; item_name: string };
  date_from: string;
  date_to: string;
  opening_quantity: string;
  opening_value: string;
  total_quantity_in: string;
  total_quantity_out: string;
  closing_quantity: string;
  closing_value: string;
  lines: Array<{
    id: string;
    movement_date: string;
    movement_kind: string;
    document_number: string | null;
    place: string;
    quantity_in: string;
    quantity_out: string;
    unit_cost: string;
    value: string;
    balance_quantity: string;
    balance_value: string;
    remarks: string | null;
  }>;
}

export function useStockLedgerReport(query: StockLedgerQuery, enabled: boolean) {
  return useQuery<StockLedgerResponse>({
    queryKey: ['backend', 'reports', 'stock-ledger', query],
    queryFn: () => backendGet<StockLedgerResponse>(`/reports/stock-ledger?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export interface StockValuationQuery {
  as_of_date: string;
  branch_id?: string;
  warehouse_id?: string;
}

export interface StockValuationResponse {
  as_of_date: string;
  totals: { quantity: string; value: string; line_count: number };
  /** Only for All Branches users without a place filter. */
  ledger_check: {
    stock_value: string;
    inventory_account_balance: string;
    difference: string;
    is_matched: boolean;
    opening_stock_value: string;
  } | null;
  lines: Array<{
    item_id: string;
    item_code: string;
    item_name: string;
    place_kind: 'Branch' | 'Warehouse';
    place_name: string;
    quantity: string;
    average_cost: string;
    value: string;
  }>;
}

export function useStockValuationReport(query: StockValuationQuery, enabled: boolean) {
  return useQuery<StockValuationResponse>({
    queryKey: ['backend', 'reports', 'stock-valuation', query],
    queryFn: () => backendGet<StockValuationResponse>(`/reports/stock-valuation?${buildQueryString(query)}`),
    enabled,
    retry: false,
  });
}

export type BookAccountKind = 'cash' | 'bank' | 'customer' | 'supplier';

export interface BookAccount {
  account_id: string;
  account_code: string;
  account_name: string;
  /** Party or bank name shown in the picker. */
  label: string;
}

/** Accounts for the Cash Book, Bank Book, Customer Ledger and Supplier Ledger pickers (searched on the server). */
export function useBookAccounts(kind: BookAccountKind, search: string) {
  return useQuery<BookAccount[]>({
    queryKey: ['backend', 'reports', 'book-accounts', kind, search],
    queryFn: () => backendGet<BookAccount[]>(`/reports/book-accounts?${buildQueryString({ kind, search: search || undefined })}`),
    staleTime: 60 * 1000,
  });
}

export interface DashboardKpis {
  period: { date_from: string; date_to: string; fiscal_year: string | null };
  comparison_period: { date_from: string; date_to: string };
  profit: {
    revenue: string;
    revenue_change_percent: string | null;
    cost_of_goods_sold: string;
    gross_profit: string;
    gross_margin_percent: string | null;
    net_profit: string;
    net_profit_change_percent: string | null;
    previous_revenue: string;
    previous_net_profit: string;
  };
  position: {
    receivables: string;
    payables: string;
    cash_and_bank: string;
    stock_value: string;
  };
}

export function useDashboardKpis(enabled = true) {
  return useQuery<DashboardKpis>({
    queryKey: ['backend', 'dashboard', 'kpis'],
    queryFn: () => backendGet<DashboardKpis>('/dashboard/kpis'),
    enabled,
    retry: false,
  });
}
