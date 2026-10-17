'use client';

import type { CSSProperties, ReactNode } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useDashboardSummary } from '@/lib/api/dashboard';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatCount, formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { ChartTooltipBox, ChartValueLegend } from '@/components/analytics/AnalyticsWidgets';
import { chartAxisTick, chartLegendStyle, useChartTheme, type ChartTheme } from '@/components/analytics/chart-palette';
import { Badge } from '@/components/ui/Badge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PV: 'Payment', RV: 'Receipt', JV: 'Journal',
  CV: 'Contra', DN: 'Debit Note', CN: 'Credit Note',
};

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

function voucherStatusVariant(status: string): BadgeVariant {
  if (status === 'Posted') return 'success';
  if (status === 'Draft') return 'warning';
  if (status === 'Voided') return 'danger';
  return 'neutral';
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** One palette for every dashboard chart, taken from the shared chart palette. */
function accountTypeColor(theme: ChartTheme, type: string) {
  const map: Record<string, string> = {
    Asset: theme.series.blue,
    Liability: theme.series.red,
    Equity: theme.series.slate,
    Revenue: theme.series.teal,
    Expense: theme.series.amber,
  };
  return map[type] ?? theme.series.slate;
}

function statusColor(theme: ChartTheme, status: string) {
  if (status === 'Posted') return theme.series.teal;
  if (status === 'Draft') return theme.series.amber;
  return theme.series.slate;
}

// ── Building blocks ──────────────────────────────────────────────────────────
function StatCard({ label, value, context }: { label: string; value: ReactNode; context?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {context && <div style={{ marginTop: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{context}</div>}
    </div>
  );
}

function DashboardPanel({ title, children, bodyStyle }: { title: string; children: ReactNode; bodyStyle?: CSSProperties }) {
  return (
    <section className="panel">
      <div className="panel-header"><h2 className="panel-title">{title}</h2></div>
      <div className="panel-body" style={bodyStyle}>{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <div className="empty-desc">{children}</div>
    </div>
  );
}

function MeterRow({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 'var(--font-size-sm)' }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-heading)' }}>
          {value} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-full)', height: 6, overflow: 'hidden' }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 'var(--radius-full)' }} />
      </div>
    </div>
  );
}

function SummaryRow({ label, value, last = false }: { label: ReactNode; value: ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--color-border-subtle)', fontSize: 'var(--font-size-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{label}</div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-heading)' }}>{value}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();
  const { data: settings } = useGeneralSettings();
  const theme = useChartTheme();
  const tick = chartAxisTick(theme);

  const compact = (n: number) => {
    const absolute = Math.abs(n);
    if (absolute >= 1_000_000) return `${formatNumber(n / 1_000_000, settings)}M`;
    if (absolute >= 1_000) return `${formatNumber(n / 1_000, settings)}K`;
    return String(n);
  };

  if (isLoading || error || !data) {
    return (
      <main className="page-shell">
        <PageHeader title="Dashboard" description="Accounts, vouchers, and the current fiscal year at a glance." />
        {error && <InlineAlert tone="danger">Unable to load the Dashboard: {error.message}. Refresh the page and try again.</InlineAlert>}
        {isLoading && (
          <section className="panel">
            <div className="empty-state" style={{ padding: '40px 16px' }}><div className="empty-title">Loading Dashboard…</div></div>
          </section>
        )}
      </main>
    );
  }

  const { accounts, vouchers, fiscalYear } = data;

  const statusData = [
    { name: 'Posted', value: vouchers.posted },
    { name: 'Draft', value: vouchers.draft },
    { name: 'Voided', value: vouchers.voided },
  ].filter(d => d.value > 0);

  const accountTypeData = accounts.byType.map(r => ({ name: r.type, value: r.count }));

  const voucherTypeData = vouchers.byType.map(r => ({
    name: VOUCHER_TYPE_LABELS[r.type] ?? r.type,
    type: r.type,
    count: r.count,
    total: r.total,
  }));

  const fyPct = fiscalYear
    ? Math.round((fiscalYear.closedPeriods / (fiscalYear.totalPeriods || 1)) * 100)
    : 0;
  const pctOf = (n: number) => (accounts.total > 0 ? Math.round((n / accounts.total) * 100) : 0);

  const description = fiscalYear
    ? `Fiscal Year ${fiscalYear.name} · ${fiscalYear.currentPeriod ? `Current Period ${fiscalYear.currentPeriod.name}` : 'No Open Period'}`
    : 'No Active Fiscal Year';

  return (
    <main className="page-shell">
      <PageHeader title="Dashboard" description={description} />

      <div style={scrollStyle}>
        {/* Row 1: summary figures */}
        <div className="layout-cols-4">
          <StatCard label="Total Accounts" value={formatCount(accounts.total, settings)} context={`${accounts.active} Active · ${accounts.posting} Posting`} />
          <StatCard label="Posted Vouchers" value={formatCount(vouchers.posted, settings)} context={`Of ${vouchers.total} Total`} />
          <StatCard label="Draft Vouchers" value={formatCount(vouchers.draft, settings)} context="Waiting To Be Posted" />
          <StatCard
            label="Fiscal Year"
            value={fiscalYear ? (
              <Badge variant={fiscalYear.status === 'open' ? 'success' : 'neutral'} style={{ fontSize: 'var(--font-size-sm)' }}>{titleCase(fiscalYear.status)}</Badge>
            ) : 'Not Set'}
            context={fiscalYear ? `${fiscalYear.name} · ${fiscalYear.openPeriods} Open · ${fiscalYear.closedPeriods} Closed` : 'No Active Fiscal Year'}
          />
        </div>

        {/* Row 2: monthly volume + voucher status */}
        <div className="layout-main-aside">
          <DashboardPanel title="Monthly Voucher Volume For The Last 6 Months">
            {vouchers.monthlyVolume.length === 0 ? (
              <EmptyNote>No posted vouchers in the last 6 months.</EmptyNote>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vouchers.monthlyVolume} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={tick} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={tick} axisLine={false} tickLine={false} tickFormatter={v => compact(Number(v))} />
                  <Tooltip
                    cursor={{ fill: theme.grid }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <ChartTooltipBox
                          label={label}
                          entries={[
                            { key: 'count', name: 'Vouchers', color: theme.series.slate, value: formatCount(Number(payload[0]?.value ?? 0), settings) },
                            { key: 'total', name: 'Amount', color: theme.series.blue, value: formatMoney(Number(payload[1]?.value ?? 0), settings) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Legend wrapperStyle={chartLegendStyle} iconType="square" iconSize={10} />
                  <Bar yAxisId="left" dataKey="count" fill={theme.series.slate} radius={[3, 3, 0, 0]} name="Vouchers" maxBarSize={28} />
                  <Bar yAxisId="right" dataKey="total" fill={theme.series.blue} radius={[3, 3, 0, 0]} name="Amount" maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardPanel>

          <DashboardPanel title="Voucher Status">
            {statusData.length === 0 ? (
              <EmptyNote>No vouchers yet.</EmptyNote>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                      {statusData.map(entry => <Cell key={entry.name} fill={statusColor(theme, entry.name)} />)}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const entry = payload[0];
                        return <ChartTooltipBox entries={[{ key: String(entry.name), name: String(entry.name), color: statusColor(theme, String(entry.name)), value: formatCount(Number(entry.value ?? 0), settings) }]} />;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 8 }}>
                  <ChartValueLegend items={statusData.map(d => ({ name: d.name, color: statusColor(theme, d.name), value: d.value.toLocaleString() }))} />
                </div>
              </>
            )}
          </DashboardPanel>
        </div>

        {/* Row 3: accounts by type + posted amount by voucher type */}
        <div className="layout-cols-2">
          <DashboardPanel title="Accounts By Type">
            {accountTypeData.length === 0 ? (
              <EmptyNote>No accounts yet.</EmptyNote>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: '45%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={accountTypeData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                        {accountTypeData.map(entry => <Cell key={entry.name} fill={accountTypeColor(theme, entry.name)} />)}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const entry = payload[0];
                          return <ChartTooltipBox entries={[{ key: String(entry.name), name: String(entry.name), color: accountTypeColor(theme, String(entry.name)), value: formatCount(Number(entry.value ?? 0), settings) }]} />;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ChartValueLegend
                    items={accountTypeData.map(d => ({ name: d.name, color: accountTypeColor(theme, d.name), value: `${d.value} (${pctOf(d.value)}%)` }))}
                  />
                  <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>
                    <span>Total</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{accounts.total}</span>
                  </div>
                </div>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel title="Posted Amount By Voucher Type">
            {voucherTypeData.length === 0 ? (
              <EmptyNote>No posted vouchers yet.</EmptyNote>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={voucherTypeData} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
                  <CartesianGrid stroke={theme.grid} horizontal={false} />
                  <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={v => compact(Number(v))} />
                  <YAxis type="category" dataKey="name" tick={tick} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    cursor={{ fill: theme.grid }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return <ChartTooltipBox label={label} entries={[{ key: 'total', name: 'Posted Amount', color: theme.series.blue, value: formatMoney(Number(payload[0]?.value ?? 0), settings) }]} />;
                    }}
                  />
                  <Bar dataKey="total" fill={theme.series.blue} radius={[0, 3, 3, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardPanel>
        </div>

        {/* Row 4: recent vouchers + fiscal year progress */}
        <div className="layout-main-aside">
          <section className="panel">
            <div className="panel-header"><h2 className="panel-title">Recent Vouchers</h2></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>Number</th>
                    <th style={{ width: 70 }}>Type</th>
                    <th style={{ width: 110 }}>Date</th>
                    <th>Narration</th>
                    <th className="num" style={{ width: 150 }}>Amount</th>
                    <th style={{ width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vouchers.recent.length === 0 && <TableMessageRow colSpan={6} title="No Vouchers Yet" description="Vouchers appear here after they are created." />}
                  {vouchers.recent.map(v => (
                    <tr key={v.id}>
                      <td className="cell-strong">{v.voucher_number}</td>
                      <td className="cell-muted" title={VOUCHER_TYPE_LABELS[v.voucher_type] ?? v.voucher_type}>{v.voucher_type}</td>
                      <td className="cell-muted">{formatDate(v.voucher_date, settings)}</td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.narration || <span className="cell-muted">Not Set</span>}
                      </td>
                      <td className="num">{formatMoney(parseFloat(v.total_debit ?? '0'), settings)}</td>
                      <td><Badge variant={voucherStatusVariant(v.status)}>{v.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <DashboardPanel title="Fiscal Year Progress" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!fiscalYear ? (
              <EmptyNote>No active fiscal year.</EmptyNote>
            ) : (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{fiscalYear.name}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{fyPct}% Complete</span>
                  </div>
                  <div style={{ background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-full)', height: 8, overflow: 'hidden' }}>
                    <div style={{ background: 'var(--color-primary)', height: '100%', width: `${fyPct}%`, borderRadius: 'var(--radius-full)' }} />
                  </div>
                </div>

                <div>
                  <SummaryRow label="Total Periods" value={fiscalYear.totalPeriods} />
                  <SummaryRow label="Open Periods" value={fiscalYear.openPeriods} />
                  <SummaryRow label="Closed Periods" value={fiscalYear.closedPeriods} />
                  <SummaryRow label="Status" value={<Badge variant={fiscalYear.status === 'open' ? 'success' : 'neutral'}>{titleCase(fiscalYear.status)}</Badge>} />
                  <SummaryRow
                    label="Current Period"
                    value={fiscalYear.currentPeriod ? `${fiscalYear.currentPeriod.name} (${titleCase(fiscalYear.currentPeriod.status)})` : 'Not Set'}
                    last
                  />
                </div>

                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'auto' }}>
                  {formatDate(fiscalYear.startDate, settings)} to {formatDate(fiscalYear.endDate, settings)}
                </div>
              </>
            )}
          </DashboardPanel>
        </div>

        {/* Row 5: account and voucher summaries */}
        <div className="layout-cols-3">
          <DashboardPanel title="Account Health" bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MeterRow label="Total Accounts" value={String(accounts.total)} pct={100} color={theme.series.blue} />
            <MeterRow label="Active" value={String(accounts.active)} pct={pctOf(accounts.active)} color={theme.series.blue} />
            <MeterRow label="Inactive" value={String(accounts.inactive)} pct={pctOf(accounts.inactive)} color={theme.series.slate} />
            <MeterRow label="Posting Accounts" value={String(accounts.posting)} pct={pctOf(accounts.posting)} color={theme.series.blue} />
          </DashboardPanel>

          <DashboardPanel title="Voucher Summary">
            <SummaryRow label="Total Vouchers" value={vouchers.total.toLocaleString()} />
            <SummaryRow label={<Badge variant="success">Posted</Badge>} value={vouchers.posted.toLocaleString()} />
            <SummaryRow label={<Badge variant="warning">Draft</Badge>} value={vouchers.draft.toLocaleString()} />
            <SummaryRow label={<Badge variant="danger">Voided</Badge>} value={vouchers.voided.toLocaleString()} last />
          </DashboardPanel>

          <DashboardPanel title="Voucher Type Counts">
            {vouchers.byType.length === 0 ? (
              <EmptyNote>No posted vouchers yet.</EmptyNote>
            ) : vouchers.byType.map((r, index) => (
              <SummaryRow
                key={r.type}
                last={index === vouchers.byType.length - 1}
                label={(
                  <>
                    <Badge variant="neutral">{r.type}</Badge>
                    <span style={{ color: 'var(--color-text-muted)' }}>{VOUCHER_TYPE_LABELS[r.type] ?? r.type}</span>
                  </>
                )}
                value={(
                  <>
                    <div>{r.count}</div>
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}>{compact(r.total)}</div>
                  </>
                )}
              />
            ))}
          </DashboardPanel>
        </div>
      </div>
    </main>
  );
}

const scrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  display: 'grid',
  alignContent: 'start',
  gap: 12,
};
