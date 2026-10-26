'use client';

import { formatCount, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { BridgeChart, ChartCard, MonthlyColumnChart, RankedBars, StackedMonthlyChart, type MonthPoint } from '@/components/analytics/ProCharts';
import { useChartTheme } from '@/components/analytics/chart-palette';
import type { usePurchaseAnalyticsModel } from '../hooks/usePurchaseAnalyticsModel';

type PurchaseAnalyticsModel = ReturnType<typeof usePurchaseAnalyticsModel>;

export function PurchaseAnalyticsCharts({
  model,
  settings,
  money,
}: {
  model: PurchaseAnalyticsModel;
  settings: AppFormatSettingsSource | null | undefined;
  money: (value: number) => string;
}) {
  const theme = useChartTheme();
  const { months, totals, axis } = model;
  const count = (value: number) => formatCount(value, settings);
  const share = (value: number, total: number) => `${(total > 0 ? value / total * 100 : 0).toFixed(1)}%`;
  const monthTitle = (point: MonthPoint) => String(point.longLabel ?? point.label);

  return (
    <>
      <h2 className="analytics-section-title">Trends</h2>
      <div className="analytics-row-main">
        <ChartCard
          title="Net Purchases By Month"
          subtitle="Posted purchase value each month; the dashed line is the monthly average"
          metric={{ label: 'Monthly Average', value: money(model.averageMonthly) }}
          table={{
            columns: [
              { key: 'month', label: 'Month' },
              { key: 'count', label: 'Invoices', numeric: true },
              { key: 'gross', label: 'Gross', numeric: true },
              { key: 'net', label: 'Net', numeric: true },
              { key: 'average', label: 'Average Invoice', numeric: true },
            ],
            rows: months.map(month => ({
              month: month.longLabel,
              count: count(month.purchases),
              gross: money(month.grossAmount),
              net: money(month.netAmount),
              average: money(month.averageInvoice),
            })),
          }}
        >
          <MonthlyColumnChart
            data={months}
            dataKey="netAmount"
            seriesName="Net Purchases"
            average={model.averageMonthly}
            format={money}
            axis={axis}
            tooltipTitle={monthTitle}
          />
        </ChartCard>

        <ChartCard
          title="Gross To Net"
          subtitle="How discount, tax, and freight move gross value to the net amount"
          legend={[
            { name: 'Total', color: theme.series.blue },
            { name: 'Reduces', color: theme.series.teal },
            { name: 'Adds', color: theme.series.amber },
          ]}
          table={{
            columns: [{ key: 'step', label: 'Step' }, { key: 'amount', label: 'Amount', numeric: true }, { key: 'share', label: 'Of Gross', numeric: true }],
            rows: [
              { step: 'Gross Amount', amount: money(totals.grossAmount), share: share(totals.grossAmount, totals.grossAmount) },
              { step: 'Less Discount', amount: money(-totals.discountAmount), share: share(totals.discountAmount, totals.grossAmount) },
              { step: 'Add Tax', amount: money(totals.taxAmount), share: share(totals.taxAmount, totals.grossAmount) },
              { step: 'Add Freight', amount: money(totals.freightAmount), share: share(totals.freightAmount, totals.grossAmount) },
              { step: 'Net Amount', amount: money(totals.netAmount), share: share(totals.netAmount, totals.grossAmount) },
            ],
          }}
        >
          <BridgeChart
            format={money}
            axis={axis}
            steps={[
              { name: 'Gross', amount: totals.grossAmount, kind: 'total' },
              { name: 'Discount', amount: -totals.discountAmount, kind: 'decrease' },
              { name: 'Tax', amount: totals.taxAmount, kind: 'increase' },
              { name: 'Freight', amount: totals.freightAmount, kind: 'increase' },
              { name: 'Net', amount: totals.netAmount, kind: 'total' },
            ]}
          />
        </ChartCard>
      </div>

      <h2 className="analytics-section-title">Breakdown</h2>
      <div className="analytics-row-three">
        <ChartCard
          title="Cash And Credit By Month"
          subtitle="Net value bought on credit and paid in cash"
          metric={{ label: 'On Credit', value: `${formatNumber(totals.creditShare, settings)}%` }}
          legend={[
            { name: 'Credit', color: theme.series.blue },
            { name: 'Cash', color: theme.series.teal },
          ]}
          table={{
            columns: [
              { key: 'month', label: 'Month' },
              { key: 'credit', label: 'Credit', numeric: true },
              { key: 'cash', label: 'Cash', numeric: true },
              { key: 'net', label: 'Net', numeric: true },
            ],
            rows: months.map(month => ({
              month: month.longLabel,
              credit: money(month.creditAmount),
              cash: money(month.cashAmount),
              net: money(month.netAmount),
            })),
          }}
        >
          <StackedMonthlyChart
            data={months}
            series={[
              { key: 'cashAmount', name: 'Cash', color: theme.series.teal },
              { key: 'creditAmount', name: 'Credit', color: theme.series.blue },
            ]}
            format={money}
            axis={axis}
            tooltipTitle={monthTitle}
          />
        </ChartCard>

        <ChartCard
          title="Top Suppliers"
          subtitle="Net purchase value and share of the total"
          metric={{ label: 'Suppliers', value: count(model.suppliers.length) }}
          table={{
            columns: [{ key: 'name', label: 'Supplier' }, { key: 'count', label: 'Invoices', numeric: true }, { key: 'net', label: 'Net', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: model.suppliers.map(row => ({ name: row.name, count: count(row.count), net: money(row.value), share: share(row.value, totals.netAmount) })),
          }}
        >
          <RankedBars items={model.suppliers} total={totals.netAmount} format={money} color={theme.series.blue} countLabel={value => `${count(value)} Invoices`} />
        </ChartCard>

        <ChartCard
          title="Received By Warehouse"
          subtitle="Where purchased stock was received"
          metric={{ label: 'Warehouses', value: count(model.warehouses.length) }}
          table={{
            columns: [{ key: 'name', label: 'Warehouse' }, { key: 'count', label: 'Invoices', numeric: true }, { key: 'net', label: 'Net', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: model.warehouses.map(row => ({ name: row.name, count: count(row.count), net: money(row.value), share: share(row.value, totals.netAmount) })),
          }}
        >
          <RankedBars items={model.warehouses} total={totals.netAmount} format={money} color={theme.series.blue} countLabel={value => `${count(value)} Invoices`} />
        </ChartCard>
      </div>
    </>
  );
}
