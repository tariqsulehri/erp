'use client';

import { useMemo } from 'react';
import { IconCalculator, IconCreditCard, IconFileInvoice, IconFilePlus, IconListSearch, IconReceipt2, IconRefresh } from '@tabler/icons-react';
import { formatCount, formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { BridgeChart, ChartCard, KpiTile, MonthlyColumnChart, RankedBars, StackedMonthlyChart, type MonthPoint } from '@/components/analytics/ProCharts';
import { compactAxis, fillMonths, lastMonthChange, longMonthLabel, monthLabeler } from '@/components/analytics/chart-data';
import { useChartTheme } from '@/components/analytics/chart-palette';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';

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
  /** Singular party name for labels, e.g. Customer or Supplier. */
  partyLabel?: string;
  rows: AnalyticsRow[];
  totalRecords: number;
  loading: boolean;
  fetching?: boolean;
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
  partyLabel = 'Party',
  rows,
  totalRecords,
  loading,
  fetching = false,
  error,
  settings,
  onNew,
  onPostedList,
  onRefresh,
  newDisabled = false,
  newDisabledReason,
}: TransactionAnalyticsViewProps) {
  const model = useMemo(() => buildAnalyticsModel(rows, settings), [rows, settings]);
  const theme = useChartTheme();
  const money = (value: number) => formatMoney(value, settings);
  const count = (value: number) => formatCount(value, settings);
  const share = (value: number, total: number) => `${(total > 0 ? value / total * 100 : 0).toFixed(1)}%`;
  const monthTitle = (point: MonthPoint) => String(point.longLabel ?? point.label);
  const empty = !loading && rows.length === 0;
  const { totals, months } = model;
  const comparison = months.length >= 2 ? `${months[months.length - 1].label} vs ${months[months.length - 2].label}` : '';

  return (
    <main className="page-shell">
      <PageHeader
        title={title}
        description={`${formatCount(totalRecords, settings)} Posted ${documentLabel}`}
        actions={(
          <>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={onRefresh}>Refresh</Button>
            <Button icon={<IconListSearch size={16} stroke={1.8} />} onClick={onPostedList}>{postedListLabel}</Button>
            <Button variant="primary" icon={<IconFilePlus size={16} stroke={1.8} />} disabled={newDisabled} title={newDisabledReason} onClick={onNew}>New</Button>
          </>
        )}
      />

      {Boolean(error) && <InlineAlert tone="danger">Unable to load analytics. Refresh the page and try again.</InlineAlert>}
      {!loading && totalRecords > rows.length && (
        <InlineAlert tone="info">{`Charts use the latest ${count(rows.length)} of ${count(totalRecords)} posted ${documentLabel.toLowerCase()}.`}</InlineAlert>
      )}

      <div className={`analytics-stack${fetching && !loading ? ' analytics-loading' : ''}`} style={{ flex: 1 }}>
        {(loading || empty) && (
          <div className="chart-card chart-empty">
            {loading ? 'Loading Analytics…' : `No posted ${documentLabel.toLowerCase()} yet. Charts appear here after the first one is posted.`}
          </div>
        )}

        {!loading && !empty && (
          <>
            <h2 className="analytics-section-title">Key Figures</h2>
            <div className="analytics-kpis">
              <KpiTile
                label={`Net ${documentLabel}`}
                tone="blue"
                icon={<IconReceipt2 size={18} stroke={1.8} />}
                value={money(totals.net)}
                spark={months.map(month => month.netAmount)}
                change={{ percent: lastMonthChange(months.map(month => month.netAmount)), text: comparison }}
                detail={months.length < 2 ? `Gross ${money(totals.gross)}` : undefined}
              />
              <KpiTile
                label="Documents"
                tone="violet"
                icon={<IconFileInvoice size={18} stroke={1.8} />}
                value={count(rows.length)}
                spark={months.map(month => month.documents)}
                change={{ percent: lastMonthChange(months.map(month => month.documents)), text: comparison }}
              />
              <KpiTile
                label="Average Document"
                tone="teal"
                icon={<IconCalculator size={18} stroke={1.8} />}
                value={money(model.averageDocument)}
                detail={model.peakMonth ? `Peak Month ${model.peakMonth.longLabel} · ${money(model.peakMonth.netAmount)}` : undefined}
              />
              <KpiTile
                label="On Credit"
                tone="amber"
                icon={<IconCreditCard size={18} stroke={1.8} />}
                value={money(totals.credit)}
                detail={`${formatNumber(model.creditShare, settings)}% On Credit · Cash ${money(totals.cash)}`}
                meter={[
                  { name: 'Credit', value: totals.credit, color: theme.series.blue },
                  { name: 'Cash', value: totals.cash, color: theme.series.teal },
                ]}
              />
            </div>

            <h2 className="analytics-section-title">Trends</h2>
            <div className="analytics-row-main">
              <ChartCard
                title={`Net ${documentLabel} By Month`}
                subtitle="Posted value each month; the dashed line is the monthly average"
                metric={{ label: 'Monthly Average', value: money(model.averageMonthlyNet) }}
                table={{
                  columns: [
                    { key: 'month', label: 'Month' },
                    { key: 'count', label: 'Documents', numeric: true },
                    { key: 'gross', label: 'Gross', numeric: true },
                    { key: 'net', label: 'Net', numeric: true },
                  ],
                  rows: months.map(month => ({ month: String(month.longLabel), count: count(month.documents), gross: money(month.grossAmount), net: money(month.netAmount) })),
                }}
              >
                <MonthlyColumnChart
                  data={months}
                  dataKey="netAmount"
                  seriesName={`Net ${documentLabel}`}
                  average={model.averageMonthlyNet}
                  format={money}
                  axis={model.axis}
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
                    { step: 'Gross Amount', amount: money(totals.gross), share: share(totals.gross, totals.gross) },
                    { step: 'Less Discount', amount: money(-totals.discount), share: share(totals.discount, totals.gross) },
                    { step: 'Add Tax', amount: money(totals.tax), share: share(totals.tax, totals.gross) },
                    { step: 'Add Freight', amount: money(totals.freight), share: share(totals.freight, totals.gross) },
                    { step: 'Net Amount', amount: money(totals.net), share: share(totals.net, totals.gross) },
                  ],
                }}
              >
                <BridgeChart
                  format={money}
                  axis={model.axis}
                  steps={[
                    { name: 'Gross', amount: totals.gross, kind: 'total' },
                    { name: 'Discount', amount: -totals.discount, kind: 'decrease' },
                    { name: 'Tax', amount: totals.tax, kind: 'increase' },
                    { name: 'Freight', amount: totals.freight, kind: 'increase' },
                    { name: 'Net', amount: totals.net, kind: 'total' },
                  ]}
                />
              </ChartCard>
            </div>

            <h2 className="analytics-section-title">Breakdown</h2>
            <div className="analytics-row-three">
              <ChartCard
                title="Cash And Credit By Month"
                subtitle="Net value settled in cash and left on credit"
                metric={{ label: 'On Credit', value: `${formatNumber(model.creditShare, settings)}%` }}
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
                  rows: months.map(month => ({ month: String(month.longLabel), credit: money(month.creditAmount), cash: money(month.cashAmount), net: money(month.netAmount) })),
                }}
              >
                <StackedMonthlyChart
                  data={months}
                  series={[
                    { key: 'cashAmount', name: 'Cash', color: theme.series.teal },
                    { key: 'creditAmount', name: 'Credit', color: theme.series.blue },
                  ]}
                  format={money}
                  axis={model.axis}
                  tooltipTitle={monthTitle}
                />
              </ChartCard>

              <ChartCard
                title={`Top ${partyLabel}s`}
                subtitle="Net value and share of the total"
                metric={{ label: `${partyLabel}s`, value: count(model.parties.length) }}
                table={{
                  columns: [{ key: 'name', label: partyLabel }, { key: 'count', label: 'Documents', numeric: true }, { key: 'net', label: 'Net', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
                  rows: model.parties.map(row => ({ name: row.name, count: count(row.count), net: money(row.value), share: share(row.value, totals.net) })),
                }}
              >
                <RankedBars items={model.parties} total={totals.net} format={money} color={theme.series.blue} countLabel={value => `${count(value)} Documents`} />
              </ChartCard>

              <ChartCard
                title={`Latest ${documentLabel}`}
                subtitle="Most recent posted documents"
                table={{
                  columns: [
                    { key: 'date', label: 'Date' },
                    { key: 'number', label: 'Number' },
                    { key: 'party', label: partyLabel },
                    { key: 'type', label: 'Type' },
                    { key: 'net', label: 'Net', numeric: true },
                  ],
                  rows: rows.map(row => ({
                    date: formatDate(row.documentDate, settings),
                    number: row.documentNumber,
                    party: row.partyName || 'Not Set',
                    type: row.paymentType || 'Not Set',
                    net: money(Number(row.netAmount || 0)),
                  })),
                }}
              >
                <ul className="ranked-bars">
                  {rows.slice(0, 6).map(row => (
                    <li key={row.id} title={`${row.documentNumber} · ${row.partyName}`}>
                      <span className="name"><strong style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{row.documentNumber}</strong> · {row.partyName || 'Not Set'}</span>
                      <span className="value">{money(Number(row.netAmount || 0))}</span>
                      <span className="name" style={{ gridColumn: '1 / -1', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                        {`${formatDate(row.documentDate, settings)} · ${row.paymentType || 'Not Set'}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

interface MonthRow extends MonthPoint {
  documents: number;
  grossAmount: number;
  netAmount: number;
  cashAmount: number;
  creditAmount: number;
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

  const emptyMonth = (monthKey: string): MonthRow => ({
    monthKey, label: monthKey, longLabel: monthKey, documents: 0, grossAmount: 0, netAmount: 0, cashAmount: 0, creditAmount: 0,
  });
  const monthlyMap = new Map<string, MonthRow>();
  const partyMap = new Map<string, { name: string; value: number; count: number }>();

  rows.forEach(row => {
    const monthKey = row.documentDate.slice(0, 7);
    const month = monthlyMap.get(monthKey) ?? emptyMonth(monthKey);
    const netAmount = Number(row.netAmount || 0);
    month.documents += 1;
    month.grossAmount += Number(row.grossAmount || 0);
    month.netAmount += netAmount;
    if (row.paymentType === 'Cash') month.cashAmount += netAmount;
    if (row.paymentType === 'Credit') month.creditAmount += netAmount;
    monthlyMap.set(monthKey, month);

    const partyName = row.partyName || 'Not Set';
    const party = partyMap.get(partyName) ?? { name: partyName, value: 0, count: 0 };
    party.value += netAmount;
    party.count += 1;
    partyMap.set(partyName, party);
  });

  const filled = fillMonths([...monthlyMap.values()], emptyMonth);
  const label = monthLabeler(filled.map(month => month.monthKey), settings);
  const months = filled.map(month => ({ ...month, label: label(month.monthKey), longLabel: longMonthLabel(month.monthKey, settings) }));
  const parties = [...partyMap.values()].sort((left, right) => right.value - left.value);
  const peak = months.reduce<MonthRow | null>((best, month) => (!best || month.netAmount > best.netAmount ? month : best), null);

  return {
    totals,
    months,
    parties,
    peakMonth: peak && peak.netAmount > 0 ? peak : null,
    averageDocument: rows.length > 0 ? totals.net / rows.length : 0,
    averageMonthlyNet: months.length > 0 ? months.reduce((sum, month) => sum + month.netAmount, 0) / months.length : 0,
    creditShare: totals.net > 0 ? totals.credit / totals.net * 100 : 0,
    axis: compactAxis(settings),
  };
}
