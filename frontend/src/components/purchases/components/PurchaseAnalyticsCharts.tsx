'use client';

import type { CSSProperties } from 'react';
import { formatNumber } from '@/lib/app-settings';
import { ChartMetricBadge, ChartTitle, ChartTooltipBox, ChartValueLegend, DonutLayout, chartPanelStyle } from '@/components/analytics/AnalyticsWidgets';
import { chartAxisTick, chartLegendStyle, useChartTheme } from '@/components/analytics/chart-palette';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type GeneralSettings = Parameters<typeof formatNumber>[1];

interface PurchaseAnalyticsChartsProps {
  monthlyChartData: any[];
  supplierChartData: any[];
  warehouseChartData: any[];
  totalNetAmount: number;
  averageMonthlyPurchase: number;
  creditShare: number;
  taxFreightTotal: number;
  topSupplier?: { amount: number };
  generalSettings: GeneralSettings;
  money: (value: number) => string;
  moneyAxis: (value: number) => string;
}

export function PurchaseAnalyticsCharts({
  monthlyChartData,
  supplierChartData,
  warehouseChartData,
  totalNetAmount,
  averageMonthlyPurchase,
  creditShare,
  taxFreightTotal,
  topSupplier,
  generalSettings,
  money,
  moneyAxis,
}: PurchaseAnalyticsChartsProps) {
  const theme = useChartTheme();
  const { series } = theme;
  const tick = chartAxisTick(theme);

  const chartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipBox
        label={label}
        entries={payload.map((entry: any) => ({
          key: `${entry.dataKey}-${entry.name}`,
          name: entry.name,
          color: entry.color ?? entry.payload?.fill,
          value: entry.dataKey === 'purchases' ? formatNumber(Number(entry.value), generalSettings) : money(Number(entry.value)),
        }))}
      />
    );
  };

  return (
    <>
      <div style={analyticsMainGridStyle}>
        <div style={chartPanelStyle}>
          <ChartTitle
            title="Month Wise Purchase Trend"
            subtitle="Gross purchase, net purchase, and average invoice value"
            right={<ChartMetricBadge label="Monthly Average" value={money(averageMonthlyPurchase)} />}
          />
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={monthlyChartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={moneyAxis} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} cursor={{ fill: theme.grid }} />
              <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
              <ReferenceLine y={averageMonthlyPurchase} stroke={series.slate} strokeDasharray="4 4" ifOverflow="extendDomain" />
              <Bar dataKey="grossAmount" name="Gross Amount" fill={series.blueSoft} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Area type="monotone" dataKey="netAmount" name="Net Amount" stroke={series.blue} strokeWidth={2} fill={series.blue} fillOpacity={0.08} />
              <Line type="monotone" dataKey="averageInvoice" name="Average Invoice" stroke={series.amber} strokeWidth={2} dot={{ r: 3, fill: theme.surface, strokeWidth: 2 }} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={chartPanelStyle}>
          <ChartTitle
            title="Cash Vs Credit Purchases"
            subtitle="Monthly payment-type mix and purchase count"
            right={<ChartMetricBadge label="Credit Share" value={`${formatNumber(creditShare, generalSettings)}%`} />}
          />
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={monthlyChartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="amount" tickFormatter={moneyAxis} tick={tick} axisLine={false} tickLine={false} />
              <YAxis yAxisId="count" orientation="right" tickFormatter={value => formatNumber(Number(value), generalSettings)} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} cursor={{ fill: theme.grid }} />
              <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
              <Bar yAxisId="amount" dataKey="cashAmount" name="Cash Purchases" stackId="payment" fill={series.teal} maxBarSize={30} />
              <Bar yAxisId="amount" dataKey="creditAmount" name="Credit Purchases" stackId="payment" fill={series.blue} radius={[3, 3, 0, 0]} maxBarSize={30} />
              <Line yAxisId="count" type="monotone" dataKey="purchases" name="Purchase Count" stroke={series.slate} strokeWidth={2} dot={{ r: 3, fill: theme.surface, strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={analyticsSmallGridStyle}>
        <div style={chartPanelStyle}>
          <ChartTitle
            title="Top Suppliers"
            subtitle="Highest purchase value and invoice count"
            right={<ChartMetricBadge label="Top" value={topSupplier ? money(topSupplier.amount) : money(0)} />}
          />
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={supplierChartData} layout="vertical" margin={{ top: 2, right: 12, left: 12, bottom: 2 }}>
              <CartesianGrid stroke={theme.grid} horizontal={false} />
              <XAxis type="number" tickFormatter={moneyAxis} tick={tick} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={122} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} cursor={{ fill: theme.grid }} />
              <Bar dataKey="amount" name="Net Amount" fill={series.blue} radius={[0, 3, 3, 0]} barSize={13} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={chartPanelStyle}>
          <ChartTitle
            title="Warehouse Purchase Share"
            subtitle="Where purchases are received"
            right={<ChartMetricBadge label="Warehouses" value={formatNumber(warehouseChartData.length, generalSettings)} />}
          />
          <DonutLayout
            centerLabel="Received"
            centerValue={money(totalNetAmount)}
            chart={(
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={chartTooltip} />
                  <Pie data={warehouseChartData} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                    {warehouseChartData.map((entry: any, index: number) => (
                      <Cell key={entry.name} fill={theme.categorical[index % theme.categorical.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
            legend={(
              <ChartValueLegend
                items={warehouseChartData.map((entry: any, index: number) => ({
                  name: String(entry.name),
                  color: theme.categorical[index % theme.categorical.length],
                  value: money(Number(entry.amount)),
                }))}
              />
            )}
          />
        </div>

        <div style={chartPanelStyle}>
          <ChartTitle
            title="Tax And Freight Impact"
            subtitle="Monthly add-on cost view"
            right={<ChartMetricBadge label="Total" value={money(taxFreightTotal)} />}
          />
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={monthlyChartData} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
              <CartesianGrid stroke={theme.grid} vertical={false} />
              <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={moneyAxis} tick={tick} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} cursor={{ fill: theme.grid }} />
              <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
              <Bar dataKey="taxAmount" name="Tax" fill={series.amber} radius={[3, 3, 0, 0]} maxBarSize={20} />
              <Bar dataKey="freightAmount" name="Freight" fill={series.teal} radius={[3, 3, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

const analyticsMainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: 12,
};

const analyticsSmallGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
  gap: 12,
};
