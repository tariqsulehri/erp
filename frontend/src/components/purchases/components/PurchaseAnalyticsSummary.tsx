'use client';

import { formatCount, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { IconCalculator, IconCreditCard, IconFileInvoice, IconShoppingCart } from '@tabler/icons-react';
import { KpiTile } from '@/components/analytics/ProCharts';
import { useChartTheme } from '@/components/analytics/chart-palette';
import type { usePurchaseAnalyticsModel } from '../hooks/usePurchaseAnalyticsModel';

type PurchaseAnalyticsModel = ReturnType<typeof usePurchaseAnalyticsModel>;

export function PurchaseAnalyticsSummary({
  model,
  settings,
  money,
}: {
  model: PurchaseAnalyticsModel;
  settings: AppFormatSettingsSource | null | undefined;
  money: (value: number) => string;
}) {
  const theme = useChartTheme();
  const { totals, months } = model;
  const comparison = months.length >= 2 ? `${months[months.length - 1].label} vs ${months[months.length - 2].label}` : '';

  return (
    <>
      <h2 className="analytics-section-title">Key Figures</h2>
      <div className="analytics-kpis">
        <KpiTile
          label="Net Purchases"
          tone="blue"
          icon={<IconShoppingCart size={18} stroke={1.8} />}
          value={money(totals.netAmount)}
          spark={months.map(month => month.netAmount)}
          change={{ percent: model.netChange, text: comparison }}
          detail={model.netChange === null ? `Gross ${money(totals.grossAmount)}` : undefined}
        />
        <KpiTile
          label="Purchase Invoices"
          tone="violet"
          icon={<IconFileInvoice size={18} stroke={1.8} />}
          value={formatCount(totals.purchases, settings)}
          spark={months.map(month => month.purchases)}
          change={{ percent: model.countChange, text: comparison }}
          detail={model.countChange === null ? 'Posted in the selected period' : undefined}
        />
        <KpiTile
          label="Average Invoice"
          tone="teal"
          icon={<IconCalculator size={18} stroke={1.8} />}
          value={money(totals.averageInvoice)}
          detail={model.peakMonth ? `Peak Month ${model.peakMonth.longLabel} · ${money(model.peakMonth.netAmount)}` : 'No posted purchases'}
        />
        <KpiTile
          label="Credit Purchases"
          tone="amber"
          icon={<IconCreditCard size={18} stroke={1.8} />}
          value={money(totals.creditTotal)}
          detail={`${formatNumber(totals.creditShare, settings)}% On Credit · Cash ${money(totals.cashTotal)}`}
          meter={[
            { name: 'Credit', value: totals.creditTotal, color: theme.series.blue },
            { name: 'Cash', value: totals.cashTotal, color: theme.series.teal },
          ]}
        />
      </div>
    </>
  );
}
