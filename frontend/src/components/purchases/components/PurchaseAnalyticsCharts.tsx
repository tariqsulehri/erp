'use client';

import type { CSSProperties } from 'react';
import { formatNumber } from '@/lib/app-settings';
import { ChartMetricBadge, ChartTitle } from '@/components/analytics/AnalyticsWidgets';
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
  const chartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={chartTooltipStyle}>
        <strong style={{ display: 'block', marginBottom: 6, color: 'var(--color-heading)' }}>{label}</strong>
        {payload.map((entry: any) => {
          const isCount = entry.dataKey === 'purchases';
          return (
            <div key={`${entry.dataKey}-${entry.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: entry.color, fontSize: '0.72rem', fontWeight: 800 }}>
              <span>{entry.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{isCount ? formatNumber(Number(entry.value), generalSettings) : money(Number(entry.value))}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div style={analyticsMainGridStyle}>
        <div style={analyticsPanelStyle}>
          <ChartTitle
            title="Month Wise Purchase Trend"
            subtitle="Gross purchase, net purchase, and average invoice value"
            right={<ChartMetricBadge label="Monthly Average" value={money(averageMonthlyPurchase)} />}
          />
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={monthlyChartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="purchaseNetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="month" tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={moneyAxis} tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <ReferenceLine y={averageMonthlyPurchase} stroke="#64748b" strokeDasharray="5 5" ifOverflow="extendDomain" />
              <Bar dataKey="grossAmount" name="Gross Amount" fill="#bfdbfe" radius={[5, 5, 0, 0]} maxBarSize={28} />
              <Area type="monotone" dataKey="netAmount" name="Net Amount" stroke="#2563eb" strokeWidth={3} fill="url(#purchaseNetGradient)" />
              <Line type="monotone" dataKey="averageInvoice" name="Average Invoice" stroke="#f97316" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={analyticsPanelStyle}>
          <ChartTitle
            title="Cash Vs Credit Purchases"
            subtitle="Monthly payment-type mix and purchase count"
            right={<ChartMetricBadge label="Credit Share" value={`${formatNumber(creditShare, generalSettings)}%`} />}
          />
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={monthlyChartData} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cashAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="creditAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="month" tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="amount" tickFormatter={moneyAxis} tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis yAxisId="count" orientation="right" tickFormatter={value => formatNumber(Number(value), generalSettings)} tick={chartAxisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Bar yAxisId="amount" dataKey="cashAmount" name="Cash Purchases" stackId="payment" fill="url(#cashAmount)" radius={[0, 0, 4, 4]} maxBarSize={30} />
              <Bar yAxisId="amount" dataKey="creditAmount" name="Credit Purchases" stackId="payment" fill="url(#creditAmount)" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line yAxisId="count" type="monotone" dataKey="purchases" name="Purchase Count" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={analyticsSmallGridStyle}>
        <div style={analyticsPanelStyle}>
          <ChartTitle
            title="Top Suppliers"
            subtitle="Highest purchase value and invoice count"
            right={<ChartMetricBadge label="Top" value={topSupplier ? money(topSupplier.amount) : money(0)} />}
          />
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={supplierChartData} layout="vertical" margin={{ top: 2, right: 12, left: 12, bottom: 2 }}>
              <defs>
                <linearGradient id="supplierBar" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.95} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.95} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} strokeDasharray="4 6" />
              <XAxis type="number" tickFormatter={moneyAxis} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={122} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} />
              <Bar dataKey="amount" name="Net Amount" fill="url(#supplierBar)" radius={[0, 5, 5, 0]} barSize={13} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={analyticsPanelStyle}>
          <ChartTitle
            title="Warehouse Purchase Share"
            subtitle="Where purchases are received"
            right={<ChartMetricBadge label="Warehouses" value={formatNumber(warehouseChartData.length, generalSettings)} />}
          />
          <div style={{ position: 'relative', height: 185 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Pie data={warehouseChartData} dataKey="amount" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={4} stroke="var(--color-surface)" strokeWidth={3}>
                  {warehouseChartData.map((entry: any, index: number) => (
                    <Cell key={entry.name} fill={analyticsColors[index % analyticsColors.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={donutCenterStyle}>
              <span>Received</span>
              <strong>{money(totalNetAmount)}</strong>
            </div>
          </div>
        </div>

        <div style={analyticsPanelStyle}>
          <ChartTitle
            title="Tax And Freight Impact"
            subtitle="Monthly add-on cost view"
            right={<ChartMetricBadge label="Total" value={money(taxFreightTotal)} />}
          />
          <ResponsiveContainer width="100%" height={185}>
            <BarChart data={monthlyChartData} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
              <defs>
                <linearGradient id="taxBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb923c" stopOpacity={0.98} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0.75} />
                </linearGradient>
                <linearGradient id="freightBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.98} />
                  <stop offset="95%" stopColor="#0f766e" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
              <XAxis dataKey="month" tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={moneyAxis} tick={smallChartAxisStyle} axisLine={false} tickLine={false} />
              <Tooltip content={chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
              <Bar dataKey="taxAmount" name="Tax" fill="url(#taxBar)" radius={[4, 4, 0, 0]} maxBarSize={20} />
              <Bar dataKey="freightAmount" name="Freight" fill="url(#freightBar)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

const analyticsColors = ['#2563eb', '#0f766e', '#7c3aed', '#f97316', '#0891b2', '#be123c', '#65a30d', '#9333ea'];

const chartAxisStyle = { fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 700 };
const smallChartAxisStyle = { fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 700 };

const analyticsMainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: 8,
};

const analyticsSmallGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
  gap: 8,
};

const analyticsPanelStyle: CSSProperties = {
  minHeight: 0,
  padding: 9,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.92), var(--color-surface-alt))',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
};

const chartTooltipStyle: CSSProperties = {
  minWidth: 170,
  padding: '7px 9px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)',
};

const donutCenterStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '47%',
  transform: 'translate(-50%, -50%)',
  display: 'grid',
  gap: 2,
  textAlign: 'center',
  pointerEvents: 'none',
  color: 'var(--color-text-muted)',
  fontSize: '0.62rem',
  fontWeight: 900,
};
