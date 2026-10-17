'use client';

import { useMemo, type CSSProperties } from 'react';
import { IconFilePlus, IconListSearch, IconRefresh } from '@tabler/icons-react';
import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { AnalyticsKpi, ChartMetricBadge, ChartTitle, ChartTooltipBox, ChartValueLegend, DonutLayout, chartPanelStyle } from '@/components/analytics/AnalyticsWidgets';
import { chartAxisTick, chartLegendStyle, useChartTheme } from '@/components/analytics/chart-palette';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface AnalyticsRow {
  id: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  paymentType: string;
  grossAmount: string;
  discountAmount: string;
  taxAmount: string;
  freightAmount: string;
  netAmount: string;
}

interface TransactionAnalyticsViewProps {
  title: string;
  documentLabel: string;
  postedListLabel: string;
  rows: AnalyticsRow[];
  totalRecords: number;
  loading: boolean;
  error: unknown;
  settings?: AppFormatSettingsSource | null;
  onNew: () => void;
  onPostedList: () => void;
  onRefresh: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function TransactionAnalyticsView({
  title,
  documentLabel,
  postedListLabel,
  rows,
  totalRecords,
  loading,
  error,
  settings,
  onNew,
  onPostedList,
  onRefresh,
  newDisabled = false,
  newDisabledReason,
}: TransactionAnalyticsViewProps) {
  const model = useMemo(() => buildAnalyticsModel(rows, settings), [rows, settings]);
  const chartEmpty = !loading && rows.length === 0;
  const theme = useChartTheme();
  const { series } = theme;
  const tick = chartAxisTick(theme);

  return (
    <main className="page-shell">
      <PageHeader
        title={title}
        description={`${formatNumber(totalRecords, settings)} Posted ${documentLabel}`}
        actions={(
          <>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={onRefresh}>Refresh</Button>
            <Button icon={<IconListSearch size={16} stroke={1.8} />} onClick={onPostedList}>{postedListLabel}</Button>
            <Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newDisabled} title={newDisabledReason} onClick={onNew}>New</Button>
          </>
        )}
      />

      {Boolean(error) && <InlineAlert tone="danger">Unable to load analytics. Refresh the page and try again.</InlineAlert>}

      <div style={chartsScrollStyle}>
        <div style={summaryGridStyle}>
          <AnalyticsKpi label="Net Amount" value={formatMoney(model.totals.net, settings)} detail={`Gross ${formatMoney(model.totals.gross, settings)}`} />
          <AnalyticsKpi label="Document Count" value={formatNumber(totalRecords, settings)} detail={`Average ${formatMoney(model.averageDocument, settings)}`} />
          <AnalyticsKpi label="Credit Amount" value={formatMoney(model.totals.credit, settings)} detail={`${formatNumber(model.creditShare, settings)}% Of Total`} />
          <AnalyticsKpi label="Tax And Freight" value={formatMoney(model.totals.tax + model.totals.freight, settings)} detail={`Discount ${formatMoney(model.totals.discount, settings)}`} />
        </div>

        {(loading || chartEmpty) && (
          <section className="panel">
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-title">{loading ? 'Loading Analytics…' : 'No Posted Records Yet'}</div>
              {chartEmpty && <div className="empty-desc">Charts appear here after {documentLabel.toLowerCase()} are posted.</div>}
            </div>
          </section>
        )}

        {!loading && !chartEmpty && (
          <>
            <div style={mainGridStyle}>
              <div style={chartPanelStyle}>
                <ChartTitle
                  title={`Month Wise ${documentLabel} Trend`}
                  subtitle="Gross amount, net amount, and average document value"
                  right={<ChartMetricBadge label="Monthly Average" value={formatMoney(model.averageMonthlyNet, settings)} />}
                />
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={model.monthlyRows} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="monthLabel" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={model.moneyAxis} tick={tick} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} cursor={{ fill: theme.grid }} />
                    <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
                    <Bar dataKey="grossAmount" name="Gross Amount" fill={series.blueSoft} radius={[3, 3, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="netAmount" name="Net Amount" fill={series.blue} radius={[3, 3, 0, 0]} maxBarSize={22} />
                    <Line type="monotone" dataKey="averageDocument" name="Average Document" stroke={series.amber} strokeWidth={2} dot={{ r: 3, fill: theme.surface, strokeWidth: 2 }} activeDot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div style={chartPanelStyle}>
                <ChartTitle
                  title={`Cash Vs Credit ${documentLabel}`}
                  subtitle="Monthly payment-type mix and document count"
                  right={<ChartMetricBadge label="Credit Share" value={`${formatNumber(model.creditShare, settings)}%`} />}
                />
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={model.monthlyRows} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="monthLabel" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="amount" tickFormatter={model.moneyAxis} tick={tick} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="count" orientation="right" tickFormatter={value => formatNumber(Number(value), settings)} tick={tick} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} cursor={{ fill: theme.grid }} />
                    <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
                    <Bar yAxisId="amount" dataKey="cashAmount" name="Cash Amount" stackId="payment" fill={series.teal} maxBarSize={30} />
                    <Bar yAxisId="amount" dataKey="creditAmount" name="Credit Amount" stackId="payment" fill={series.blue} radius={[3, 3, 0, 0]} maxBarSize={30} />
                    <Line yAxisId="count" type="monotone" dataKey="documents" name="Document Count" stroke={series.slate} strokeWidth={2} dot={{ r: 3, fill: theme.surface, strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={smallGridStyle}>
              <div style={chartPanelStyle}>
                <ChartTitle
                  title="Top Parties"
                  subtitle="Highest net amount and document count"
                  right={<ChartMetricBadge label="Top" value={formatMoney(model.partyRows[0]?.amount ?? 0, settings)} />}
                />
                <ResponsiveContainer width="100%" height={185}>
                  <BarChart data={model.partyRows} layout="vertical" margin={{ top: 2, right: 12, left: 12, bottom: 2 }}>
                    <CartesianGrid stroke={theme.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={model.moneyAxis} tick={tick} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={128} tick={tick} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} cursor={{ fill: theme.grid }} />
                    <Bar dataKey="amount" name="Net Amount" fill={series.blue} radius={[0, 3, 3, 0]} barSize={13} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={chartPanelStyle}>
                <ChartTitle
                  title="Amount Composition"
                  subtitle="Cash, credit, tax, freight, and discount share"
                  right={<ChartMetricBadge label="Net" value={formatMoney(model.totals.net, settings)} />}
                />
                <DonutLayout
                  centerLabel="Net"
                  centerValue={formatMoney(model.totals.net, settings)}
                  chart={(
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={tooltipContent(settings)} />
                        <Pie data={model.compositionRows} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                          {model.compositionRows.map((entry, index) => (
                            <Cell key={entry.name} fill={theme.categorical[index % theme.categorical.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  legend={(
                    <ChartValueLegend
                      items={model.compositionRows.map((entry, index) => ({
                        name: entry.name,
                        color: theme.categorical[index % theme.categorical.length],
                        value: formatMoney(entry.amount, settings),
                      }))}
                    />
                  )}
                />
              </div>

              <div style={chartPanelStyle}>
                <ChartTitle
                  title="Tax Discount And Freight"
                  subtitle="Monthly cost and concession view"
                  right={<ChartMetricBadge label="Total Impact" value={formatMoney(model.totals.tax + model.totals.freight + model.totals.discount, settings)} />}
                />
                <ResponsiveContainer width="100%" height={185}>
                  <BarChart data={model.monthlyRows} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
                    <CartesianGrid stroke={theme.grid} vertical={false} />
                    <XAxis dataKey="monthLabel" tick={tick} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={model.moneyAxis} tick={tick} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} cursor={{ fill: theme.grid }} />
                    <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
                    <Bar dataKey="taxAmount" name="Tax" fill={series.amber} radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="freightAmount" name="Freight" fill={series.teal} radius={[3, 3, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="discountAmount" name="Discount" fill={series.slate} radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Latest {documentLabel}</h2>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Date</th>
                      <th style={{ width: 170 }}>Document Number</th>
                      <th>Party</th>
                      <th style={{ width: 110 }}>Type</th>
                      <th className="num" style={{ width: 160 }}>Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 12).map(row => (
                      <tr key={row.id}>
                        <td>{formatDate(row.documentDate, settings)}</td>
                        <td className="cell-strong">{row.documentNumber}</td>
                        <td>{row.partyName || 'Not Set'}</td>
                        <td className="cell-muted">{row.paymentType || 'Not Set'}</td>
                        <td className="num">{formatMoney(row.netAmount, settings)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function tooltipContent(settings?: AppFormatSettingsSource | null) {
  return function AnalyticsTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltipBox
        label={label}
        entries={payload.map((entry: any) => ({
          key: `${entry.dataKey}-${entry.name}`,
          name: entry.name,
          color: entry.color ?? entry.payload?.fill,
          value: entry.dataKey === 'documents' ? formatNumber(Number(entry.value), settings) : formatMoney(Number(entry.value), settings),
        }))}
      />
    );
  };
}

function buildAnalyticsModel(rows: AnalyticsRow[], settings?: AppFormatSettingsSource | null) {
  const totals = rows.reduce((sum, row) => ({
    gross: sum.gross + Number(row.grossAmount || 0),
    discount: sum.discount + Number(row.discountAmount || 0),
    tax: sum.tax + Number(row.taxAmount || 0),
    freight: sum.freight + Number(row.freightAmount || 0),
    net: sum.net + Number(row.netAmount || 0),
    cash: sum.cash + (row.paymentType === 'Cash' ? Number(row.netAmount || 0) : 0),
    credit: sum.credit + (row.paymentType === 'Credit' ? Number(row.netAmount || 0) : 0),
  }), { gross: 0, discount: 0, tax: 0, freight: 0, net: 0, cash: 0, credit: 0 });

  const monthlyMap = new Map<string, {
    monthKey: string;
    monthLabel: string;
    documents: number;
    grossAmount: number;
    discountAmount: number;
    taxAmount: number;
    freightAmount: number;
    netAmount: number;
    cashAmount: number;
    creditAmount: number;
  }>();
  const partyMap = new Map<string, { name: string; amount: number; documents: number }>();

  rows.forEach(row => {
    const monthKey = row.documentDate.slice(0, 7);
    const monthRow = monthlyMap.get(monthKey) ?? {
      monthKey,
      monthLabel: formatMonth(monthKey),
      documents: 0,
      grossAmount: 0,
      discountAmount: 0,
      taxAmount: 0,
      freightAmount: 0,
      netAmount: 0,
      cashAmount: 0,
      creditAmount: 0,
    };
    const grossAmount = Number(row.grossAmount || 0);
    const discountAmount = Number(row.discountAmount || 0);
    const taxAmount = Number(row.taxAmount || 0);
    const freightAmount = Number(row.freightAmount || 0);
    const netAmount = Number(row.netAmount || 0);
    monthRow.documents += 1;
    monthRow.grossAmount += grossAmount;
    monthRow.discountAmount += discountAmount;
    monthRow.taxAmount += taxAmount;
    monthRow.freightAmount += freightAmount;
    monthRow.netAmount += netAmount;
    if (row.paymentType === 'Cash') monthRow.cashAmount += netAmount;
    if (row.paymentType === 'Credit') monthRow.creditAmount += netAmount;
    monthlyMap.set(monthKey, monthRow);

    const partyRow = partyMap.get(row.partyName) ?? { name: row.partyName, amount: 0, documents: 0 };
    partyRow.amount += netAmount;
    partyRow.documents += 1;
    partyMap.set(row.partyName, partyRow);
  });

  const monthlyRows = [...monthlyMap.values()]
    .sort((left, right) => left.monthKey.localeCompare(right.monthKey))
    .map(row => ({
      ...row,
      averageDocument: row.documents > 0 ? row.netAmount / row.documents : 0,
    }));
  const partyRows = [...partyMap.values()]
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 8)
    .map(row => ({ ...row, name: shortLabel(row.name) }));
  const compositionRows = [
    { name: 'Cash', amount: totals.cash },
    { name: 'Credit', amount: totals.credit },
    { name: 'Tax', amount: totals.tax },
    { name: 'Freight', amount: totals.freight },
    { name: 'Discount', amount: totals.discount },
  ].filter(row => row.amount > 0);
  const averageDocument = rows.length > 0 ? totals.net / rows.length : 0;
  const averageMonthlyNet = monthlyRows.length > 0
    ? monthlyRows.reduce((sum, row) => sum + row.netAmount, 0) / monthlyRows.length
    : 0;
  const creditShare = totals.net > 0 ? totals.credit / totals.net * 100 : 0;
  const moneyAxis = (value: number) => {
    const absolute = Math.abs(value);
    if (absolute >= 1_000_000) return `${formatNumber(value / 1_000_000, settings)}M`;
    if (absolute >= 1_000) return `${formatNumber(value / 1_000, settings)}K`;
    return formatNumber(value, settings);
  };

  return { totals, monthlyRows, partyRows, compositionRows, averageDocument, averageMonthlyNet, creditShare, moneyAxis };
}

function formatMonth(value: string) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function shortLabel(value: string) {
  return value.length > 28 ? `${value.slice(0, 25)}...` : value;
}

const chartsScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'grid',
  alignContent: 'start',
  gap: 12,
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(138px, 1fr))',
  gap: 12,
};

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: 12,
};

const smallGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
  gap: 12,
};
