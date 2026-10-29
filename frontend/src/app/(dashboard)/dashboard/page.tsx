'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useDashboardSummary } from '@/lib/api/dashboard';
import { useDashboardKpis } from '@/lib/api/reports';
import { hasPermission } from '@/lib/auth/session-user';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatCount, formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import {
  IconBuildingBank, IconCalendarStats, IconChartBar, IconCircleCheck, IconCoin, IconListTree, IconPackage,
  IconPencil, IconTrendingUp, IconTruckDelivery, IconUsers,
} from '@tabler/icons-react';
import { ChartCard, DonutChart, MonthlyColumnChart, RankedBars } from '@/components/analytics/ProCharts';
import { compactAxis } from '@/components/analytics/chart-data';
import { StatGrid, StatTile, type StatTone } from '@/components/ui/StatTile';
import { useChartTheme, type ChartTheme } from '@/components/analytics/chart-palette';
import { Badge } from '@/components/ui/Badge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar, type ProgressTone } from '@/components/ui/ProgressBar';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { LoadingState } from '@/components/ui/LoadingSpinner';

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

function MeterRow({
  label,
  value,
  pct,
  tone = 'blue',
  color,
  gradient,
}: {
  label: string;
  value: string;
  pct: number;
  tone?: ProgressTone;
  color?: string;
  gradient?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 'var(--font-size-sm)' }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-heading)' }}>
          {value} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>({pct}%)</span>
        </span>
      </div>
      <ProgressBar pct={pct} height={14} tone={tone} color={color} gradient={gradient} variant="3d" />
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

function changeOf(percent: string | null | undefined) {
  return percent === null || percent === undefined ? null : { percent: Number(percent), text: 'compared with the same period last year' };
}

/** Good when zero or more, a problem when below zero. */
function signTone(value: string | number): StatTone {
  return Number(value) < 0 ? 'rose' : 'teal';
}

function TileSkeleton({ label }: { label: string }) {
  return (
    <div className="stat-tile tone-slate" aria-hidden="true">
      <div className="stat-tile-head"><span className="stat-tile-label">{label}</span></div>
      <div className="skeleton" style={{ height: 22, width: '70%' }} />
      <div className="skeleton" style={{ height: 10, width: '50%', marginTop: 6 }} />
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
  const money = (value: string | number) => formatMoney(value, settings);
  const margin = data?.profit.gross_margin_percent;

  return (
    <section aria-labelledby="financial-position-title" style={{ display: 'grid', gap: 8, flexShrink: 0 }}>
      <div className="dashboard-section-head">
        <h2 className="analytics-section-title" id="financial-position-title">Financial Position</h2>
        <span className="dashboard-section-note">{subtitle}</span>
      </div>
      {error ? (
        <InlineAlert tone="danger">Unable to load the money figures: {error.message}. Refresh the page and try again.</InlineAlert>
      ) : isLoading || !data ? (
        <div className="stat-grid" aria-busy="true" aria-label="Loading Financial Position">
          {MONEY_TILE_LABELS.map(label => <TileSkeleton key={label} label={label} />)}
        </div>
      ) : (
        <StatGrid label="Financial Position">
          <StatTile
            label="Revenue" tone="blue" icon={<IconTrendingUp />}
            value={money(data.profit.revenue)}
            change={changeOf(data.profit.revenue_change_percent)}
            help="Income from sales and other revenue accounts posted in the period."
          />
          <StatTile
            label="Gross Profit" tone={signTone(data.profit.gross_profit)} icon={<IconChartBar />}
            value={money(data.profit.gross_profit)}
            progress={margin !== null && margin !== undefined ? Number(margin) : undefined}
            detail={margin === null || margin === undefined ? 'Gross margin not available' : `Gross margin ${formatNumber(margin, settings)}%`}
            help="Revenue less the cost of the goods sold. The bar shows the gross margin."
          />
          <StatTile
            label="Net Profit" tone={signTone(data.profit.net_profit)} icon={<IconCoin />}
            value={money(data.profit.net_profit)}
            change={changeOf(data.profit.net_profit_change_percent)}
            detail={Number(data.profit.net_profit) < 0 ? 'Loss for the period' : undefined}
            help="Revenue less all expenses posted in the period. A negative figure is a loss."
          />
          <StatTile
            label="Receivables" tone="amber" icon={<IconUsers />}
            value={money(data.position.receivables)}
            detail="Customers owe us"
            href="/reports?report=receivables-aging" linkLabel="View Receivables Aging"
            help="Open customer balances. Select the tile to see how long they have been owed."
          />
          <StatTile
            label="Payables" tone="violet" icon={<IconTruckDelivery />}
            value={money(data.position.payables)}
            detail="We owe suppliers"
            href="/reports?report=payables-aging" linkLabel="View Payables Aging"
            help="Open supplier balances. Select the tile to see how long they have been due."
          />
          <StatTile
            label="Cash And Bank" tone={signTone(data.position.cash_and_bank)} icon={<IconBuildingBank />}
            value={money(data.position.cash_and_bank)}
            detail="Cash in hand and in banks"
            help="Balance of all cash and bank accounts today."
          />
          <StatTile
            label="Stock Value" tone="blue" icon={<IconPackage />}
            value={money(data.position.stock_value)}
            detail="Stock on hand at cost"
            href="/reports?report=stock-valuation" linkLabel="View Stock Valuation"
            help="Quantity on hand valued at weighted average cost."
          />
        </StatGrid>
      )}
    </section>
  );
}

const DASHBOARD_HELP = (
  <>
    <p>The Dashboard gives a quick view of your accounts, vouchers, and the current Fiscal Year.</p>
    <p>Each tile and chart has its own short help. Money figures use posted vouchers only. Drafts do not change balances.</p>
  </>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading, error } = useDashboardSummary();
  const { data: settings } = useGeneralSettings();
  const theme = useChartTheme();


  if (isLoading || error || !data) {
    return (
      <main className="page-shell">
        <PageHeader title="Dashboard" description="Accounts, vouchers, and the current fiscal year at a glance." help={DASHBOARD_HELP} />
        {error && <InlineAlert tone="danger">Could not load the Dashboard: {error.message}. Refresh the page and try again.</InlineAlert>}
        {error && <FinancialPosition settings={settings} />}
        {isLoading && (
          <section className="panel">
            <LoadingState message="Loading Dashboard…" description="Fetching KPIs, chart summaries, and accounting metrics" minHeight={280} />
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
  const axis = compactAxis(settings);

  // Chart data and one-sentence findings.
  const monthlyPoints = vouchers.monthlyVolume.map(row => ({ monthKey: row.month, label: row.month, total: Number(row.total), count: row.count }));
  const monthlyAverage = monthlyPoints.length > 0 ? monthlyPoints.reduce((sum, row) => sum + row.total, 0) / monthlyPoints.length : 0;
  const peakMonth = monthlyPoints.reduce<(typeof monthlyPoints)[number] | null>((best, row) => (!best || row.total > best.total ? row : best), null);
  const monthlyHeadline = peakMonth && peakMonth.total > 0
    ? `${peakMonth.label} was the busiest month with ${formatMoney(peakMonth.total, settings)} posted in ${formatCount(peakMonth.count, settings)} vouchers.`
    : undefined;
  const statusHeadline = vouchers.total > 0
    ? `${formatCount(vouchers.posted, settings)} of ${formatCount(vouchers.total, settings)} vouchers are posted${vouchers.draft > 0 ? `; ${formatCount(vouchers.draft, settings)} drafts wait to be posted.` : '.'}`
    : undefined;
  const largestType = [...accountTypeData].sort((left, right) => right.value - left.value)[0];
  const accountHeadline = largestType
    ? `${largestType.name} is the largest group: ${formatCount(largestType.value, settings)} of ${formatCount(accounts.total, settings)} accounts (${pctOf(largestType.value)}%).`
    : undefined;
  const rankedTypes = voucherTypeData
    .map(row => ({ name: row.name === row.type ? row.type : `${row.type} · ${row.name}`, value: Number(row.total), count: row.count }))
    .sort((left, right) => right.value - left.value);
  const typeTotal = rankedTypes.reduce((sum, row) => sum + row.value, 0);
  const typeHeadline = rankedTypes[0]
    ? `${rankedTypes[0].name} carries the most, ${typeTotal > 0 ? (rankedTypes[0].value / typeTotal * 100).toFixed(1) : '0'}% of the posted amount.`
    : undefined;

  const description = fiscalYear
    ? `Fiscal Year ${fiscalYear.name} · ${fiscalYear.currentPeriod ? `Current Period ${fiscalYear.currentPeriod.name}` : 'No Open Period'}`
    : 'No Active Fiscal Year';

  return (
    <main className="page-shell">
      <PageHeader title="Dashboard" description={description} help={DASHBOARD_HELP} />

      <div style={scrollStyle}>
        {/* Money tiles: only for users who may see financial reports */}
        <FinancialPosition settings={settings} />

        {/* Row 1: accounts and vouchers */}
        <section aria-labelledby="activity-title" style={{ display: 'grid', gap: 8, flexShrink: 0 }}>
          <div className="dashboard-section-head">
            <h2 className="analytics-section-title" id="activity-title">Accounts And Vouchers</h2>
          </div>
          <StatGrid label="Accounts And Vouchers">
            <StatTile
              label="Total Accounts" tone="blue" icon={<IconListTree />}
              value={formatCount(accounts.total, settings)}
              progress={accounts.total > 0 ? accounts.active / accounts.total * 100 : 0}
              detail={`${formatCount(accounts.active, settings)} active · ${formatCount(accounts.posting, settings)} posting`}
              help="Accounts in the Chart of Accounts. The bar shows how many are active."
            />
            <StatTile
              label="Posted Vouchers" tone="teal" icon={<IconCircleCheck />}
              value={formatCount(vouchers.posted, settings)}
              suffix={`/ ${formatCount(vouchers.total, settings)}`}
              progress={vouchers.total > 0 ? vouchers.posted / vouchers.total * 100 : 0}
              detail="Posted to the ledger"
              help="Vouchers posted to the ledger, out of all vouchers."
            />
            <StatTile
              label="Draft Vouchers" tone={vouchers.draft > 0 ? 'amber' : 'teal'} icon={<IconPencil />}
              value={formatCount(vouchers.draft, settings)}
              suffix={`/ ${formatCount(vouchers.total, settings)}`}
              detail={vouchers.draft > 0 ? 'Waiting to be posted' : 'Nothing waiting'}
              help="Vouchers saved as draft that do not affect the ledger until they are posted."
            />
            <StatTile
              label="Fiscal Year" tone="violet" icon={<IconCalendarStats />}
              value={fiscalYear ? titleCase(fiscalYear.status) : 'Not Set'}
              suffix={fiscalYear ? `/ ${fiscalYear.name}` : undefined}
              progress={fiscalYear ? fyPct : undefined}
              detail={fiscalYear ? `${formatCount(fiscalYear.closedPeriods, settings)} of ${formatCount(fiscalYear.totalPeriods, settings)} periods closed` : 'No active fiscal year'}
              help="The current fiscal year. The bar shows how many of its periods are closed."
            />
          </StatGrid>
        </section>

        <h2 className="analytics-section-title">Vouchers And Accounts</h2>
        {/* Row 2: monthly amount + voucher status */}
        <div className="analytics-row-main">
          <ChartCard
            title="Posted Amount By Month"
            subtitle="Last 6 months; the dashed line is the monthly average"
            headline={monthlyHeadline}
            help="Total amount of vouchers posted in each of the last 6 months."
            metric={{ label: 'Monthly Average', value: formatMoney(monthlyAverage, settings) }}
            table={{
              columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'total', label: 'Posted Amount', numeric: true }],
              rows: vouchers.monthlyVolume.map(row => ({ month: row.month, count: formatCount(row.count, settings), total: formatMoney(row.total, settings) })),
            }}
          >
            {monthlyPoints.length === 0 ? (
              <EmptyNote>No posted vouchers in the last 6 months.</EmptyNote>
            ) : (
              <MonthlyColumnChart
                variant="3d"
                data={monthlyPoints}
                dataKey="total"
                seriesName="Posted Amount"
                average={monthlyAverage}
                format={value => formatMoney(value, settings)}
                axis={axis}
                tooltipTitle={point => String(point.label)}
                height={230}
              />
            )}
          </ChartCard>

          <ChartCard
            title="Voucher Status"
            subtitle="All vouchers by where they stand"
            headline={statusHeadline}
            help="Posted vouchers are in the ledger. Drafts do not affect balances until they are posted. Voided vouchers are cancelled."
            table={{
              columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
              rows: statusData.map(row => ({ status: row.name, count: formatCount(row.value, settings), share: `${vouchers.total > 0 ? Math.round(row.value / vouchers.total * 100) : 0}%` })),
            }}
          >
            <DonutChart
              variant="3d"
              items={statusData.map(row => ({ name: row.name, value: row.value, color: statusColor(theme, row.name) }))}
              centerValue={formatCount(vouchers.total, settings)}
              centerLabel="vouchers"
              format={value => formatCount(value, settings)}
            />
          </ChartCard>
        </div>

        {/* Row 3: accounts by type + posted amount by voucher type */}
        <div className="layout-cols-2">
          <ChartCard
            title="Accounts By Type"
            subtitle="Chart of Accounts by account type"
            headline={accountHeadline}
            help="How the accounts in the Chart of Accounts split across Asset, Liability, Equity, Revenue, and Expense."
            table={{
              columns: [{ key: 'type', label: 'Type' }, { key: 'count', label: 'Accounts', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
              rows: accountTypeData.map(row => ({ type: row.name, count: formatCount(row.value, settings), share: `${pctOf(row.value)}%` })),
            }}
          >
            <DonutChart
              variant="3d"
              items={accountTypeData.map(row => ({ name: row.name, value: row.value, color: accountTypeColor(theme, row.name) }))}
              centerValue={formatCount(accounts.total, settings)}
              centerLabel="accounts"
              format={value => formatCount(value, settings)}
            />
          </ChartCard>

          <ChartCard
            title="Posted Amount By Voucher Type"
            subtitle="Amount and share of all posted vouchers"
            headline={typeHeadline}
            help="Posted voucher amounts grouped by voucher type, largest first."
            table={{
              columns: [{ key: 'type', label: 'Voucher Type' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'total', label: 'Posted Amount', numeric: true }],
              rows: rankedTypes.map(row => ({ type: row.name, count: formatCount(row.count, settings), total: formatMoney(row.value, settings) })),
            }}
          >
            <RankedBars
              variant="3d"
              items={rankedTypes}
              total={typeTotal}
              format={value => formatMoney(value, settings)}
              limit={5}
              countLabel={value => `${formatCount(value, settings)} Vouchers`}
            />
          </ChartCard>
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
                  <ProgressBar pct={fyPct} height={14} tone="teal" variant="3d" ariaLabel={`${fiscalYear.name} progress`} />
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
            <MeterRow label="Total Accounts" value={String(accounts.total)} pct={100} tone="blue" />
            <MeterRow label="Active" value={String(accounts.active)} pct={pctOf(accounts.active)} tone="blue" />
            <MeterRow label="Inactive" value={String(accounts.inactive)} pct={pctOf(accounts.inactive)} tone="slate" />
            <MeterRow label="Posting Accounts" value={String(accounts.posting)} pct={pctOf(accounts.posting)} tone="teal" />
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
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 400, color: 'var(--color-text-muted)' }}>{axis(Number(r.total))}</div>
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
