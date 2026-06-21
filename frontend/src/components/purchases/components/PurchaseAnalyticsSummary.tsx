'use client';

import type { CSSProperties } from 'react';
import { formatNumber } from '@/lib/app-settings';
import { AnalyticsKpi, InsightBox } from '@/components/analytics/AnalyticsWidgets';

type GeneralSettings = Parameters<typeof formatNumber>[1];

interface PurchaseAnalyticsSummaryProps {
  totalNetAmount: number;
  grossAmount: number;
  totalPurchases: number;
  averageInvoice: number;
  creditTotal: number;
  creditShare: number;
  taxFreightTotal: number;
  discountAmount: number;
  peakMonth: { month: string; netAmount: number } | null;
  topSupplier?: { name: string; amount: number };
  topWarehouse?: { name: string; amount: number };
  cashTotal: number;
  generalSettings: GeneralSettings;
  money: (value: number) => string;
  kpiGridStyle: CSSProperties;
  insightGridStyle: CSSProperties;
}

export function PurchaseAnalyticsSummary({
  totalNetAmount,
  grossAmount,
  totalPurchases,
  averageInvoice,
  creditTotal,
  creditShare,
  taxFreightTotal,
  discountAmount,
  peakMonth,
  topSupplier,
  topWarehouse,
  cashTotal,
  generalSettings,
  money,
  kpiGridStyle,
  insightGridStyle,
}: PurchaseAnalyticsSummaryProps) {
  return (
    <>
      <div style={kpiGridStyle}>
        <AnalyticsKpi label="Net Purchases" value={money(totalNetAmount)} detail={`Gross ${money(grossAmount)}`} accent="#2563eb" tone="blue" />
        <AnalyticsKpi label="Purchase Count" value={formatNumber(totalPurchases, generalSettings)} detail={`Average ${money(averageInvoice)}`} accent="#0f766e" tone="teal" />
        <AnalyticsKpi label="Credit Exposure" value={money(creditTotal)} detail={`${formatNumber(creditShare, generalSettings)}% Of Purchases`} accent="#7c3aed" tone="violet" />
        <AnalyticsKpi label="Tax And Freight" value={money(taxFreightTotal)} detail={`Discount ${money(discountAmount)}`} accent="#c2410c" tone="orange" />
      </div>

      <div style={insightGridStyle}>
        <InsightBox label="Peak Purchase Month" value={peakMonth ? peakMonth.month : 'No Data'} detail={peakMonth ? money(peakMonth.netAmount) : money(0)} />
        <InsightBox label="Top Supplier" value={topSupplier?.name ?? 'No Data'} detail={topSupplier ? money(topSupplier.amount) : money(0)} />
        <InsightBox label="Top Warehouse" value={topWarehouse?.name ?? 'No Data'} detail={topWarehouse ? money(topWarehouse.amount) : money(0)} />
        <InsightBox label="Cash Paid" value={money(cashTotal)} detail={`Credit ${money(creditTotal)}`} />
      </div>
    </>
  );
}
