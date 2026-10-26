import { useMemo } from 'react';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { compactAxis, fillMonths, lastMonthChange, longMonthLabel, monthLabeler } from '@/components/analytics/chart-data';

interface PurchaseAnalyticsRow {
  month_key: string;
  month_label: string;
  purchase_count: number;
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  cash_amount: string;
  credit_amount: string;
  average_invoice_amount: string;
}

export interface PurchaseMonth {
  monthKey: string;
  label: string;
  longLabel: string;
  purchases: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  freightAmount: number;
  netAmount: number;
  cashAmount: number;
  creditAmount: number;
  averageInvoice: number;
  [key: string]: string | number;
}

function emptyMonth(monthKey: string): PurchaseMonth {
  return {
    monthKey, label: monthKey, longLabel: monthKey, purchases: 0, grossAmount: 0, discountAmount: 0, taxAmount: 0,
    freightAmount: 0, netAmount: 0, cashAmount: 0, creditAmount: 0, averageInvoice: 0,
  };
}

export function usePurchaseAnalyticsModel(
  analyticsData: any,
  settings: AppFormatSettingsSource | null | undefined,
  range: { dateFrom?: string; dateTo?: string },
) {
  return useMemo(() => {
    const summary = analyticsData?.summary;
    const rawMonths = ((analyticsData?.monthlyPurchases ?? []) as PurchaseAnalyticsRow[]).map(row => ({
      ...emptyMonth(row.month_key),
      purchases: Number(row.purchase_count ?? 0),
      grossAmount: Number(row.gross_amount ?? 0),
      discountAmount: Number(row.discount_amount ?? 0),
      taxAmount: Number(row.tax_amount ?? 0),
      freightAmount: Number(row.freight_amount ?? 0),
      netAmount: Number(row.net_amount ?? 0),
      cashAmount: Number(row.cash_amount ?? 0),
      creditAmount: Number(row.credit_amount ?? 0),
      averageInvoice: Number(row.average_invoice_amount ?? 0),
    }));
    const filled = fillMonths(rawMonths, emptyMonth, {
      fromKey: range.dateFrom?.slice(0, 7) || undefined,
      toKey: range.dateTo?.slice(0, 7) || undefined,
    });
    const label = monthLabeler(filled.map(month => month.monthKey), settings);
    const months: PurchaseMonth[] = filled.map(month => ({ ...month, label: label(month.monthKey), longLabel: longMonthLabel(month.monthKey, settings) }));

    const suppliers = (analyticsData?.supplierSummary ?? []).map((row: any) => ({
      name: row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : String(row.supplier_name),
      value: Number(row.net_amount ?? 0),
      count: Number(row.purchase_count ?? 0),
    })) as Array<{ name: string; value: number; count: number }>;
    const warehouses = (analyticsData?.warehouseSummary ?? []).map((row: any) => ({
      name: row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : String(row.warehouse_name),
      value: Number(row.net_amount ?? 0),
      count: Number(row.purchase_count ?? 0),
    })) as Array<{ name: string; value: number; count: number }>;
    const payments = (analyticsData?.paymentTypeSummary ?? []) as Array<{ payment_type: string; net_amount: string }>;

    const netAmount = Number(summary?.net_amount ?? 0);
    const cashTotal = Number(payments.find(row => row.payment_type === 'Cash')?.net_amount ?? 0);
    const creditTotal = Number(payments.find(row => row.payment_type === 'Credit')?.net_amount ?? 0);
    const totals = {
      netAmount,
      grossAmount: Number(summary?.gross_amount ?? 0),
      discountAmount: Number(summary?.discount_amount ?? 0),
      taxAmount: Number(summary?.tax_amount ?? 0),
      freightAmount: Number(summary?.freight_amount ?? 0),
      purchases: Number(summary?.purchase_count ?? 0),
      averageInvoice: Number(summary?.average_invoice_amount ?? 0),
      cashTotal,
      creditTotal,
      creditShare: netAmount > 0 ? creditTotal / netAmount * 100 : 0,
    };
    const averageMonthly = months.length > 0 ? months.reduce((sum, month) => sum + month.netAmount, 0) / months.length : 0;
    const peakMonth = months.reduce<PurchaseMonth | null>((best, month) => (!best || month.netAmount > best.netAmount ? month : best), null);

    return {
      months,
      suppliers,
      warehouses,
      totals,
      averageMonthly,
      peakMonth: peakMonth && peakMonth.netAmount > 0 ? peakMonth : null,
      netChange: lastMonthChange(months.map(month => month.netAmount)),
      countChange: lastMonthChange(months.map(month => month.purchases)),
      axis: compactAxis(settings),
    };
  }, [analyticsData, settings, range.dateFrom, range.dateTo]);
}
