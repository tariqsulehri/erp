import { formatNumber } from '@/lib/app-settings';

type GeneralSettings = Parameters<typeof formatNumber>[1];

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

export function usePurchaseAnalyticsModel(analyticsData: any, generalSettings: GeneralSettings) {
  const summary = analyticsData?.summary;
  const monthlyRows = (analyticsData?.monthlyPurchases ?? []) as PurchaseAnalyticsRow[];
  const monthlyChartData = monthlyRows.map(row => ({
    month: row.month_label,
    purchases: Number(row.purchase_count ?? 0),
    grossAmount: Number(row.gross_amount ?? 0),
    netAmount: Number(row.net_amount ?? 0),
    cashAmount: Number(row.cash_amount ?? 0),
    creditAmount: Number(row.credit_amount ?? 0),
    averageInvoice: Number(row.average_invoice_amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    freightAmount: Number(row.freight_amount ?? 0),
  }));
  const supplierChartData = (analyticsData?.supplierSummary ?? []).map((row: any) => ({
    name: row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));
  const warehouseChartData = (analyticsData?.warehouseSummary ?? []).map((row: any) => ({
    name: row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));
  const paymentChartData = (analyticsData?.paymentTypeSummary ?? []).map((row: any) => ({
    name: row.payment_type,
    amount: Number(row.net_amount ?? 0),
    purchases: Number(row.purchase_count ?? 0),
  }));

  const totalNetAmount = Number(summary?.net_amount ?? 0);
  const totalPurchases = Number(summary?.purchase_count ?? 0);
  const averageInvoice = Number(summary?.average_invoice_amount ?? 0);
  const taxFreightTotal = Number(summary?.tax_amount ?? 0) + Number(summary?.freight_amount ?? 0);
  const grossAmount = Number(summary?.gross_amount ?? 0);
  const discountAmount = Number(summary?.discount_amount ?? 0);
  const cashTotal = paymentChartData.find((row: { name: string; amount: number }) => row.name === 'Cash')?.amount ?? 0;
  const creditTotal = paymentChartData.find((row: { name: string; amount: number }) => row.name === 'Credit')?.amount ?? 0;
  const creditShare = totalNetAmount > 0 ? creditTotal / totalNetAmount * 100 : 0;
  const averageMonthlyPurchase = monthlyChartData.length > 0
    ? monthlyChartData.reduce((sum, row) => sum + row.netAmount, 0) / monthlyChartData.length
    : 0;
  const peakMonth = monthlyChartData.reduce<typeof monthlyChartData[number] | null>(
    (best, row) => (!best || row.netAmount > best.netAmount ? row : best),
    null,
  );

  const moneyAxis = (value: number) => {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) return `${formatNumber(value / 1_000_000, generalSettings)}M`;
    if (absolute >= 1_000) return `${formatNumber(value / 1_000, generalSettings)}K`;
    return formatNumber(value, generalSettings);
  };

  return {
    monthlyChartData,
    supplierChartData,
    warehouseChartData,
    paymentChartData,
    totalNetAmount,
    totalPurchases,
    averageInvoice,
    taxFreightTotal,
    grossAmount,
    discountAmount,
    cashTotal,
    creditTotal,
    creditShare,
    averageMonthlyPurchase,
    peakMonth,
    topSupplier: supplierChartData[0],
    topWarehouse: warehouseChartData[0],
    moneyAxis,
  };
}
