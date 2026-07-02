'use client';

import { useMemo, type CSSProperties } from 'react';
import { IconChartBar, IconFilePlus, IconListSearch, IconRefresh } from '@tabler/icons-react';
import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { ChartMetricBadge, ChartTitle } from '@/components/analytics/AnalyticsWidgets';
import { compactButtonStyle, reportTitleIconStyle, reportToolbarStyle } from '@/components/reports/LedgerReportStyles';
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

  return (
    <main style={pageStyle}>
      <section style={reportToolbarStyle}>
        <div style={toolbarInnerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={reportTitleIconStyle}><IconChartBar size={20} stroke={1.8} /></div>
            <div>
              <h1 style={titleStyle}>{title}</h1>
              <p style={subtitleStyle}>{totalRecords} Posted {documentLabel}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary" style={smallButtonStyle} disabled={newDisabled} title={newDisabledReason} onClick={onNew}><IconFilePlus size={14} /> New</button>
            <button type="button" className="btn-secondary" style={smallButtonStyle} onClick={onPostedList}><IconListSearch size={14} /> {postedListLabel}</button>
            <button type="button" className="btn-secondary" style={smallButtonStyle} onClick={onRefresh}><IconRefresh size={14} /> Refresh</button>
          </div>
        </div>
      </section>

      <section className="workspace-card" style={workspaceStyle}>
        <div style={summaryGridStyle}>
          <KpiTile label="Net Amount" value={formatMoney(model.totals.net, settings)} detail={`Gross ${formatMoney(model.totals.gross, settings)}`} accent="#2563eb" tone="blue" />
          <KpiTile label="Document Count" value={formatNumber(totalRecords, settings)} detail={`Average ${formatMoney(model.averageDocument, settings)}`} accent="#0f766e" tone="teal" />
          <KpiTile label="Credit Amount" value={formatMoney(model.totals.credit, settings)} detail={`${formatNumber(model.creditShare, settings)}% Of Total`} accent="#7c3aed" tone="violet" />
          <KpiTile label="Tax And Freight" value={formatMoney(model.totals.tax + model.totals.freight, settings)} detail={`Discount ${formatMoney(model.totals.discount, settings)}`} accent="#c2410c" tone="orange" />
        </div>

        {Boolean(error) && <div style={errorStyle}>Unable to load analytics. Please refresh and try again.</div>}
        {loading && <div style={emptyStyle}>Loading Analytics...</div>}
        {chartEmpty && <div style={emptyStyle}>No posted records found for analytics.</div>}

        {!loading && !chartEmpty && (
          <div style={chartsScrollStyle}>
            <div style={mainGridStyle}>
              <ChartPanel>
                <ChartTitle
                  title={`Month Wise ${documentLabel} Trend`}
                  subtitle="Gross amount, net amount, and average document value"
                  right={<ChartMetricBadge label="Monthly Average" value={formatMoney(model.averageMonthlyNet, settings)} />}
                />
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={model.monthlyRows} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                    <XAxis dataKey="monthLabel" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={model.moneyAxis} tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="grossAmount" name="Gross Amount" fill="#bfdbfe" radius={[5, 5, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="netAmount" name="Net Amount" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={22} />
                    <Line type="monotone" dataKey="averageDocument" name="Average Document" stroke="#f97316" strokeWidth={3} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel>
                <ChartTitle
                  title={`Cash Vs Credit ${documentLabel}`}
                  subtitle="Monthly payment-type mix and document count"
                  right={<ChartMetricBadge label="Credit Share" value={`${formatNumber(model.creditShare, settings)}%`} />}
                />
                <ResponsiveContainer width="100%" height={230}>
                  <ComposedChart data={model.monthlyRows} margin={{ top: 6, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                    <XAxis dataKey="monthLabel" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="amount" tickFormatter={model.moneyAxis} tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="count" orientation="right" tickFormatter={value => formatNumber(Number(value), settings)} tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar yAxisId="amount" dataKey="cashAmount" name="Cash Amount" stackId="payment" fill="#14b8a6" radius={[0, 0, 4, 4]} maxBarSize={30} />
                    <Bar yAxisId="amount" dataKey="creditAmount" name="Credit Amount" stackId="payment" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={30} />
                    <Line yAxisId="count" type="monotone" dataKey="documents" name="Document Count" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div style={smallGridStyle}>
              <ChartPanel>
                <ChartTitle
                  title="Top Parties"
                  subtitle="Highest net amount and document count"
                  right={<ChartMetricBadge label="Top" value={formatMoney(model.partyRows[0]?.amount ?? 0, settings)} />}
                />
                <ResponsiveContainer width="100%" height={185}>
                  <BarChart data={model.partyRows} layout="vertical" margin={{ top: 2, right: 12, left: 12, bottom: 2 }}>
                    <CartesianGrid stroke="var(--color-border-subtle)" horizontal={false} strokeDasharray="4 6" />
                    <XAxis type="number" tickFormatter={model.moneyAxis} tick={smallAxisStyle} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={128} tick={smallAxisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} />
                    <Bar dataKey="amount" name="Net Amount" fill="#2563eb" radius={[0, 5, 5, 0]} barSize={13} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel>
                <ChartTitle
                  title="Amount Composition"
                  subtitle="Cash, credit, tax, freight, and discount share"
                  right={<ChartMetricBadge label="Net" value={formatMoney(model.totals.net, settings)} />}
                />
                <div style={{ position: 'relative', height: 185 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={tooltipContent(settings)} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                      <Pie data={model.compositionRows} dataKey="amount" nameKey="name" innerRadius={42} outerRadius={68} paddingAngle={4} stroke="var(--color-surface)" strokeWidth={3}>
                        {model.compositionRows.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={donutCenterStyle}>
                    <span>Net</span>
                    <strong>{formatMoney(model.totals.net, settings)}</strong>
                  </div>
                </div>
              </ChartPanel>

              <ChartPanel>
                <ChartTitle
                  title="Tax Discount And Freight"
                  subtitle="Monthly cost and concession view"
                  right={<ChartMetricBadge label="Total Impact" value={formatMoney(model.totals.tax + model.totals.freight + model.totals.discount, settings)} />}
                />
                <ResponsiveContainer width="100%" height={185}>
                  <BarChart data={model.monthlyRows} margin={{ top: 2, right: 12, left: 0, bottom: 2 }}>
                    <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} strokeDasharray="4 6" />
                    <XAxis dataKey="monthLabel" tick={smallAxisStyle} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={model.moneyAxis} tick={smallAxisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={tooltipContent(settings)} />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="taxAmount" name="Tax" fill="#fb923c" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="freightAmount" name="Freight" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                    <Bar dataKey="discountAmount" name="Discount" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Document Number</th>
                    <th style={thStyle}>Party</th>
                    <th style={thStyle}>Type</th>
                    <th style={moneyThStyle}>Net Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 12).map(row => (
                    <tr key={row.id}>
                      <td style={tdStyle}>{formatDate(row.documentDate, settings)}</td>
                      <td style={strongTdStyle}>{row.documentNumber}</td>
                      <td style={tdStyle}>{row.partyName}</td>
                      <td style={tdStyle}>{row.paymentType}</td>
                      <td style={moneyTdStyle}>{formatMoney(row.netAmount, settings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function KpiTile({
  label,
  value,
  detail,
  accent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tone: 'blue' | 'teal' | 'violet' | 'orange';
}) {
  return (
    <div style={{ ...kpiStyle, borderTopColor: accent, background: kpiBackground[tone] }}>
      <span style={kpiLabelStyle}>{label}</span>
      <strong style={kpiValueStyle}>{value}</strong>
      <span style={kpiDetailStyle}>{detail}</span>
    </div>
  );
}

function ChartPanel({ children }: { children: React.ReactNode }) {
  return <div style={chartPanelStyle}>{children}</div>;
}

function tooltipContent(settings?: AppFormatSettingsSource | null) {
  return function AnalyticsTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
      <div style={tooltipStyle}>
        <strong style={{ display: 'block', marginBottom: 6, color: 'var(--color-heading)' }}>{label}</strong>
        {payload.map((entry: any) => {
          const isCount = entry.dataKey === 'documents';
          return (
            <div key={`${entry.dataKey}-${entry.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 18, color: entry.color, fontSize: '0.72rem', fontWeight: 800 }}>
              <span>{entry.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{isCount ? formatNumber(Number(entry.value), settings) : formatMoney(Number(entry.value), settings)}</span>
            </div>
          );
        })}
      </div>
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

const chartColors = ['#2563eb', '#0f766e', '#7c3aed', '#f97316', '#64748b'];
const axisStyle = { fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 700 };
const smallAxisStyle = { fontSize: 10, fill: 'var(--color-text-muted)', fontWeight: 700 };

const pageStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  overflow: 'hidden',
};

const toolbarInnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  lineHeight: 1.1,
  color: 'var(--color-heading)',
};

const subtitleStyle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.73rem',
  fontWeight: 800,
};

const smallButtonStyle: CSSProperties = {
  ...compactButtonStyle,
  minHeight: 28,
  padding: '4px 9px',
  fontSize: '0.74rem',
};

const workspaceStyle: CSSProperties = {
  padding: 8,
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto auto minmax(0, 1fr)',
  gap: 8,
  overflow: 'hidden',
};

const chartsScrollStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  display: 'grid',
  gap: 8,
  paddingRight: 2,
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(138px, 1fr))',
  gap: 7,
};

const kpiBackground = {
  blue: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), var(--color-surface) 58%)',
  teal: 'linear-gradient(135deg, rgba(15, 118, 110, 0.12), var(--color-surface) 58%)',
  violet: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), var(--color-surface) 58%)',
  orange: 'linear-gradient(135deg, rgba(194, 65, 12, 0.12), var(--color-surface) 58%)',
} as const;

const kpiStyle: CSSProperties = {
  minHeight: 68,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 3,
  padding: '7px 10px',
  border: '1px solid var(--color-border)',
  borderTop: '3px solid var(--color-primary)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
};

const kpiLabelStyle: CSSProperties = {
  color: 'var(--color-text-muted)',
  fontSize: '0.66rem',
  fontWeight: 800,
};

const kpiValueStyle: CSSProperties = {
  color: 'var(--color-heading)',
  fontSize: '0.92rem',
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
};

const kpiDetailStyle: CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: '0.64rem',
  fontWeight: 800,
  textAlign: 'right',
};

const mainGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
  gap: 8,
};

const smallGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr) minmax(0, 1fr)',
  gap: 8,
};

const chartPanelStyle: CSSProperties = {
  minHeight: 0,
  padding: 9,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.92), var(--color-surface-alt))',
  boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)',
};

const tooltipStyle: CSSProperties = {
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
  fontWeight: 850,
};

const tableWrapStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.74rem',
};

const thStyle: CSSProperties = {
  background: 'var(--color-table-header-bg)',
  color: 'var(--color-table-header-text)',
  padding: '7px 8px',
  border: '1px solid var(--color-border)',
  textAlign: 'left',
  fontWeight: 900,
};

const moneyThStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text)',
};

const strongTdStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 900,
  color: 'var(--color-heading)',
};

const moneyTdStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 850,
};

const emptyStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  minHeight: 150,
  color: 'var(--color-text-muted)',
  fontWeight: 850,
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface-alt)',
};

const errorStyle: CSSProperties = {
  color: 'var(--color-danger-text)',
  fontSize: '0.74rem',
  fontWeight: 850,
};
