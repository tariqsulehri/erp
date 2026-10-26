'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { useDashboardSummary } from '@/lib/api/dashboard';
import { useDashboardKpis } from '@/lib/api/reports';
import { hasPermission } from '@/lib/auth/session-user';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatCount, formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import {
  IconBuildingBank, IconCalendarStats, IconChartBar, IconCircleCheck, IconCoin, IconListTree, IconPackage,
  IconPencil, IconTrendingUp, IconTruckDelivery, IconUsers,
} from '@tabler/icons-react';
import { ChartTooltipBox, ChartValueLegend } from '@/components/analytics/AnalyticsWidgets';
import { BarGradientDefs, TileIcon, gradientId, useGradientPrefix, type TileTone } from '@/components/analytics/ProCharts';
import { chartAxisTick, useChartTheme, type ChartTheme } from '@/components/analytics/chart-palette';
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
function StatCard({ label, value, context, tone, icon }: { label: string; value: ReactNode; context?: string; tone: TileTone; icon: ReactNode }) {
  return (
    <div className={`stat-card has-tone tone-${tone}`}>
      <div className="stat-head"><TileIcon>{icon}</TileIcon><div className="stat-label">{label}</div></div>
      <div className="stat-value" style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {context && <div className="stat-foot">{context}</div>}
    </div>
  );
}

function DashboardPanel({ title, children, bodyStyle }: { title: string; children: ReactNode; bodyStyle?: CSSProperties }) {
  return (
    <section className="panel panel-banded">
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

// ── Financial position (money tiles) ─────────────────────────────────────────

/** "▲ 12.5% vs Last Year": the arrow and the words carry the meaning, colour only supports it. */
function ChangeText({ percent, settings }: { percent: string | null; settings?: AppFormatSettingsSource | null }) {
  if (percent === null || percent === undefined) return null;
  const value = Number(percent);
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '■';
  const word = value > 0 ? 'Up' : value < 0 ? 'Down' : 'No Change';
  const color = value > 0 ? 'var(--color-success)' : value < 0 ? 'var(--color-negative)' : 'var(--color-text-muted)';
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      <span aria-hidden="true" style={{ color }}>{arrow}</span>{' '}
      <span className="sr-only">{word} </span>
      {formatNumber(Math.abs(value), settings)}% vs Same Period Last Year
    </span>
  );
}

function MoneyTile({ label, value, context, href, linkLabel, tone, icon }: {
  label: string;
  value: string;
  context?: ReactNode;
  href?: string;
  linkLabel?: string;
  tone: TileTone;
  icon: ReactNode;
}) {
  const body = (
    <>
      <div className="stat-head"><TileIcon>{icon}</TileIcon><div className="stat-label">{label}</div></div>
      <div className="stat-value" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={value}>{value}</div>
      {context && <div className="stat-foot">{context}</div>}
      {href && <div className="stat-link">{linkLabel ?? 'View Report'} →</div>}
    </>
  );
  const className = `stat-card has-tone tone-${tone}`;
  if (!href) return <div className={className}>{body}</div>;
  return (
    <Link href={href} className={className} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }} aria-label={`${label}: ${value}. ${linkLabel ?? 'View Report'}`}>
      {body}
    </Link>
  );
}

function MoneyTileSkeleton({ label }: { label: string }) {
  return (
    <div className="stat-card" aria-hidden="true">
      <div className="stat-label">{label}</div>
      <div className="skeleton" style={{ height: 24, width: '70%' }} />
      <div className="skeleton" style={{ height: 10, width: '50%', marginTop: 8 }} />
    </div>
  );
}

const MONEY_TILE_LABELS = ['Revenue', 'Gross Profit', 'Net Profit', 'Receivables', 'Payables', 'Cash And Bank', 'Stock Value'];

function FinancialPosition({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const { data: session } = useSession();
  const enabled = hasPermission(session?.user.role, 'reports.financial');
  const { data, isLoading, error } = useDashboardKpis(enabled);

  if (!enabled) return null;

  const subtitle = data
    ? `${data.period.fiscal_year ? `Fiscal Year ${data.period.fiscal_year} to date` : 'Year to date'} (${formatDate(data.period.date_from, settings)} to ${formatDate(data.period.date_to, settings)})`
    : 'Money figures for the current fiscal year.';

  return (
    // .panel allows shrinking to zero; inside the fixed-height scrolling grid this panel must keep its content height.
    <section className="panel panel-banded" aria-labelledby="financial-position-title" style={{ overflow: 'visible', minHeight: 'auto', flexShrink: 0 }}>
      <div className="panel-header" style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="panel-title" id="financial-position-title">Financial Position</h2>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{subtitle}</span>
      </div>
      <div className="panel-body">
        {error ? (
          <InlineAlert tone="danger">Unable to load the money figures: {error.message}. Refresh the page and try again.</InlineAlert>
        ) : isLoading || !data ? (
          <div className="layout-cols-4" aria-busy="true" aria-label="Loading Financial Position">
            {MONEY_TILE_LABELS.map(label => <MoneyTileSkeleton key={label} label={label} />)}
          </div>
        ) : (
          <div className="layout-cols-4">
            <MoneyTile
              label="Revenue" tone="blue" icon={<IconTrendingUp size={18} stroke={1.8} />}
              value={formatMoney(data.profit.revenue, settings)}
              context={<ChangeText percent={data.profit.revenue_change_percent} settings={settings} />}
            />
            <MoneyTile
              label="Gross Profit" tone="teal" icon={<IconChartBar size={18} stroke={1.8} />}
              value={formatMoney(data.profit.gross_profit, settings)}
              context={data.profit.gross_margin_percent !== null ? `Gross Margin ${formatNumber(data.profit.gross_margin_percent, settings)}%` : 'Gross Margin Not Available'}
            />
            <MoneyTile
              label="Net Profit" tone="violet" icon={<IconCoin size={18} stroke={1.8} />}
              value={formatMoney(data.profit.net_profit, settings)}
              context={<ChangeText percent={data.profit.net_profit_change_percent} settings={settings} />}
            />
            <MoneyTile
              label="Receivables" tone="amber" icon={<IconUsers size={18} stroke={1.8} />}
              value={formatMoney(data.position.receivables, settings)}
              context="Customers Owe Us"
              href="/reports?report=receivables-aging"
              linkLabel="View Receivables Aging"
            />
            <MoneyTile
              label="Payables" tone="rose" icon={<IconTruckDelivery size={18} stroke={1.8} />}
              value={formatMoney(data.position.payables, settings)}
              context="We Owe Suppliers"
              href="/reports?report=payables-aging"
              linkLabel="View Payables Aging"
            />
            <MoneyTile label="Cash And Bank" tone="teal" icon={<IconBuildingBank size={18} stroke={1.8} />} value={formatMoney(data.position.cash_and_bank, settings)} context="Cash In Hand And In Banks" />
            <MoneyTile
              label="Stock Value" tone="blue" icon={<IconPackage size={18} stroke={1.8} />}
              value={formatMoney(data.position.stock_value, settings)}
              context="Stock On Hand At Cost"
              href="/reports?report=stock-valuation"
              linkLabel="View Stock Valuation"
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();
  const { data: settings } = useGeneralSettings();
  const theme = useChartTheme();
  const tick = chartAxisTick(theme);
  const prefix = useGradientPrefix();
  const fill = (color: string) => `url(#${gradientId(prefix, color)})`;
  const gradientColors = Object.values(theme.series);

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
        {error && <FinancialPosition settings={settings} />}
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
        {/* Money tiles: only for users who may see financial reports */}
        <FinancialPosition settings={settings} />

        {/* Row 1: summary figures */}
        <div className="layout-cols-4">
          <StatCard label="Total Accounts" tone="blue" icon={<IconListTree size={18} stroke={1.8} />} value={formatCount(accounts.total, settings)} context={`${accounts.active} Active · ${accounts.posting} Posting`} />
          <StatCard label="Posted Vouchers" tone="teal" icon={<IconCircleCheck size={18} stroke={1.8} />} value={formatCount(vouchers.posted, settings)} context={`Of ${vouchers.total} Total`} />
          <StatCard label="Draft Vouchers" tone="amber" icon={<IconPencil size={18} stroke={1.8} />} value={formatCount(vouchers.draft, settings)} context="Waiting To Be Posted" />
          <StatCard
            label="Fiscal Year" tone="violet" icon={<IconCalendarStats size={18} stroke={1.8} />}
            value={fiscalYear ? (
              <Badge variant={fiscalYear.status === 'open' ? 'success' : 'neutral'} style={{ fontSize: 'var(--font-size-sm)' }}>{titleCase(fiscalYear.status)}</Badge>
            ) : 'Not Set'}
            context={fiscalYear ? `${fiscalYear.name} · ${fiscalYear.openPeriods} Open · ${fiscalYear.closedPeriods} Closed` : 'No Active Fiscal Year'}
          />
        </div>

        {/* Row 2: monthly volume + voucher status */}
        <div className="layout-main-aside">
          <DashboardPanel title="Posted Amount By Month For The Last 6 Months">
            {vouchers.monthlyVolume.length === 0 ? (
              <EmptyNote>No posted vouchers in the last 6 months.</EmptyNote>
            ) : (
              // One value axis: the amount is plotted, the voucher count is shown in the tooltip.
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={vouchers.monthlyVolume} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
                  <BarGradientDefs prefix={prefix} colors={gradientColors} />
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="month" tick={tick} axisLine={{ stroke: theme.border }} tickLine={false} />
                  <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={v => compact(Number(v))} width={52} />
                  <Tooltip
                    cursor={{ fill: theme.grid, opacity: 0.6 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as { count: number; total: number };
                      return (
                        <ChartTooltipBox
                          label={label}
                          entries={[
                            { key: 'total', name: 'Posted Amount', color: theme.series.blue, value: formatMoney(Number(point.total ?? 0), settings) },
                            { key: 'count', name: 'Vouchers', color: theme.series.slate, value: formatCount(Number(point.count ?? 0), settings) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Bar dataKey="total" fill={fill(theme.series.blue)} radius={[4, 4, 0, 0]} name="Posted Amount" maxBarSize={28} />
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
                    <BarGradientDefs prefix={prefix} colors={gradientColors} />
                    <Pie data={statusData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                      {statusData.map(entry => <Cell key={entry.name} fill={fill(statusColor(theme, entry.name))} />)}
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
                  <ChartValueLegend items={statusData.map(d => ({ name: d.name, color: statusColor(theme, d.name), value: formatCount(d.value, settings) }))} />
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
                      <BarGradientDefs prefix={prefix} colors={gradientColors} />
                      <Pie data={accountTypeData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={2} stroke={theme.surface} strokeWidth={2}>
                        {accountTypeData.map(entry => <Cell key={entry.name} fill={fill(accountTypeColor(theme, entry.name))} />)}
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
                  <BarGradientDefs prefix={prefix} colors={gradientColors} />
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
                  <Bar dataKey="total" fill={fill(theme.series.blue)} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </DashboardPanel>
        </div>

        {/* Row 4: recent vouchers + fiscal year progress */}
        <div className="layout-main-aside">
          <section className="panel panel-banded">
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
            <SummaryRow label="Total Vouchers" value={formatCount(vouchers.total, settings)} />
            <SummaryRow label={<Badge variant="success">Posted</Badge>} value={formatCount(vouchers.posted, settings)} />
            <SummaryRow label={<Badge variant="warning">Draft</Badge>} value={formatCount(vouchers.draft, settings)} />
            <SummaryRow label={<Badge variant="danger">Voided</Badge>} value={formatCount(vouchers.voided, settings)} last />
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
