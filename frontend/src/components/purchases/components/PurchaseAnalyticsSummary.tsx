'use client';

import { formatCount, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { IconCalculator, IconCreditCard, IconFileInvoice, IconShoppingCart } from '@tabler/icons-react';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
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
  const monthsWithPurchases = months.filter(month => month.purchases > 0).length;

  return (
    <>
      <h2 className="analytics-section-title">Key Figures</h2>
      <StatGrid label="Purchase Key Figures">
        <StatTile
          label="Net Purchases"
          tone="blue"
          icon={<IconShoppingCart />}
          value={money(totals.netAmount)}
          change={{ percent: model.netChange, text: comparison }}
          detail={`Gross ${money(totals.grossAmount)}`}
          help="Total of posted purchase invoices after discount, tax, and freight, for the selected filters."
        />
        <StatTile
          label="Purchase Invoices"
          tone="violet"
          icon={<IconFileInvoice />}
          value={formatCount(totals.purchases, settings)}
          change={{ percent: model.countChange, text: comparison }}
          detail={`In ${formatCount(monthsWithPurchases, settings)} of ${formatCount(months.length, settings)} months`}
          progress={months.length > 0 ? monthsWithPurchases / months.length * 100 : 0}
          help="Number of posted purchase invoices. The bar shows how many months had at least one purchase."
        />
        <StatTile
          label="Average Invoice"
          tone="teal"
          icon={<IconCalculator />}
          value={money(totals.averageInvoice)}
          detail={model.peakMonth ? `Peak month ${model.peakMonth.longLabel}: ${money(model.peakMonth.netAmount)}` : 'No posted purchases'}
          help="Net purchases divided by the number of invoices."
        />
        <StatTile
          label="Bought On Credit"
          tone="amber"
          icon={<IconCreditCard />}
          value={`${formatNumber(totals.creditShare, settings)}%`}
          suffix={`/ ${money(totals.creditTotal)}`}
          detail={`Paid in cash ${money(totals.cashTotal)}`}
          parts={[
            { name: 'Credit', value: totals.creditTotal, color: theme.series.blue },
            { name: 'Cash', value: totals.cashTotal, color: theme.series.teal },
          ]}
          help="Share of net purchases bought on credit (owed to suppliers) against paid in cash."
        />
      </StatGrid>
    </>
  );
}
