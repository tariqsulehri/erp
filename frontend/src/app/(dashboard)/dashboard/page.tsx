'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
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
import {
  CapsuleBenchmarkChart,
  type CapsuleBenchmarkPillar,
  CategoryGradePillars,
  ChartCard,
  type GradePillarItem,
  PipelineDonutChart,
  type PipelineDonutItem,
  TargetBenchmarkBars,
  type TargetBenchmarkRow,
} from '@/components/analytics/ProCharts';
import { compactAxis } from '@/components/analytics/chart-data';
import { StatGrid, StatTile, type StatTone } from '@/components/ui/StatTile';
import { useChartTheme } from '@/components/analytics/chart-palette';
import { Badge } from '@/components/ui/Badge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
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
  const [targetTab, setTargetTab] = useState<'departments' | 'managers'>('departments');
  const [targetCloseTab, setTargetCloseTab] = useState<'own' | 'attainment'>('own');

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
  const pctOf = (n: number) => (accounts.total > 0 ? Math.round((n / accounts.total) * 100) : 0);

  const fyPct = fiscalYear
    ? Math.round((fiscalYear.closedPeriods / (fiscalYear.totalPeriods || 1)) * 100)
    : 0;
  const axis = compactAxis(settings);

  const description = fiscalYear
    ? `Fiscal Year ${fiscalYear.name} · ${fiscalYear.currentPeriod ? `Current Period ${fiscalYear.currentPeriod.name}` : 'No Open Period'}`
    : 'No Active Fiscal Year';

  // ── Card 1: Promotion / Voucher Pipeline ──
  const pipelineItems: PipelineDonutItem[] = [
    {
      name: 'ready for promotion',
      count: 0,
      share: 0,
      color: '#22c55e',
      gradient: ['#22c55e', '#16a34a'],
    },
    {
      name: 'nearly ready',
      count: 0,
      share: 0,
      color: '#3b82f6',
      gradient: ['#3b82f6', '#1d4ed8'],
    },
    {
      name: 'not ready yet',
      count: 33,
      share: 80,
      color: '#f97316',
      gradient: ['#f97316', '#ea580c'],
    },
    {
      name: 'still to be assessed',
      count: 8,
      share: 20,
      color: '#94a3b8',
      gradient: ['#94a3b8', '#64748b'],
    },
  ];

  // ── Card 2: Teams against target ──
  const departmentTargetRows: TargetBenchmarkRow[] = [
    {
      name: 'Engineering',
      subtitle: '10 people',
      achievedPercent: 27.2,
      targetPercent: 66.1,
      variancePoints: -38.9,
      gradient: ['#1d4ed8', '#3b82f6'],
    },
    {
      name: 'DevOps',
      subtitle: '28 people',
      achievedPercent: 48.2,
      targetPercent: 68.1,
      variancePoints: -19.9,
      gradient: ['#1d4ed8', '#3b82f6'],
    },
  ];

  const managerTargetRows: TargetBenchmarkRow[] = [
    {
      name: 'Core Platform',
      subtitle: '16 people',
      achievedPercent: 34.5,
      targetPercent: 65.0,
      variancePoints: -30.5,
      gradient: ['#1d4ed8', '#3b82f6'],
    },
    {
      name: 'Product Delivery',
      subtitle: '22 people',
      achievedPercent: 52.8,
      targetPercent: 70.0,
      variancePoints: -17.2,
      gradient: ['#1d4ed8', '#3b82f6'],
    },
  ];

  // ── Card 3: How close people are to their target ──
  const closePillars: CapsuleBenchmarkPillar[] = [
    {
      count: 14,
      countUnit: 'people',
      fillPercent: 42,
      badgeLabel: '42%',
      title: 'Far behind',
      subtitle: '25+ points below',
      gradient: ['#ef4444', '#b91c1c'],
    },
    {
      count: 11,
      countUnit: 'people',
      fillPercent: 33,
      badgeLabel: '33%',
      title: 'Behind',
      subtitle: '10–25 points below',
      gradient: ['#f97316', '#ea580c'],
    },
    {
      count: 8,
      countUnit: 'people',
      fillPercent: 24,
      badgeLabel: '24%',
      title: 'Close',
      subtitle: 'within 10 points',
      gradient: ['#38bdf8', '#0284c7'],
    },
    {
      count: 0,
      countUnit: 'people',
      fillPercent: 0,
      badgeLabel: '0%',
      title: 'On target',
      subtitle: 'all skills met',
      gradient: ['#94a3b8', '#64748b'],
    },
  ];

  // ── Card 4: People by grade ──
  const gradeItems: GradePillarItem[] = [
    { id: 'g13', count: 1, countUnit: 'person', percentage: 2, label: 'G13', subLabel: 'too few', gradient: ['#1e293b', '#0f172a'] },
    { id: 'g14', count: 11, countUnit: 'people', percentage: 27, label: 'G14', subLabel: '0 ready', gradient: ['#2563eb', '#1d4ed8'] },
    { id: 'g15', count: 18, countUnit: 'people', percentage: 44, label: 'G15', subLabel: 'ready', gradient: ['#2563eb', '#1d4ed8'] },
    { id: 'g16', count: 4, countUnit: 'people', percentage: 10, label: 'G16', subLabel: '0 ready', gradient: ['#2563eb', '#1d4ed8'] },
    { id: 'g17', count: 3, countUnit: 'people', percentage: 7, label: 'G17', subLabel: '0 ready', gradient: ['#1e293b', '#0f172a'] },
    { id: 'g18', count: 2, countUnit: 'people', percentage: 5, label: 'G18', subLabel: 'too few', gradient: ['#1e293b', '#0f172a'] },
    { id: 'g19', count: 1, countUnit: 'person', percentage: 2, label: 'G19', subLabel: 'too few', gradient: ['#1e293b', '#0f172a'] },
    { id: 'g21', count: 1, countUnit: 'person', percentage: 2, label: 'G21', subLabel: 'too few', gradient: ['#1e293b', '#0f172a'] },
  ];

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

        <h2 className="analytics-section-title">Performance Analytics & Pipeline</h2>
        <div className="dashboard-visuals-grid">
          {/* Card 1: Promotion / Voucher Pipeline */}
          <ChartCard
            title="Promotion pipeline"
            subtitle="Where all 41 people stand on the way to their next grade."
            headline="0 of 41 are ready for promotion. 8 still need a result before they can be judged."
            help="Status distribution across technical readiness, assessments, and next promotion grade."
            table={{
              columns: [
                { key: 'status', label: 'Status' },
                { key: 'count', label: 'People', numeric: true },
                { key: 'share', label: 'Share', numeric: true },
              ],
              rows: pipelineItems.map(item => ({
                status: item.name,
                count: formatCount(item.count, settings),
                share: `${item.share}%`,
              })),
            }}
          >
            <PipelineDonutChart
              items={pipelineItems}
              totalCount={41}
              totalLabel="people"
            />
          </ChartCard>

          {/* Card 2: Teams against target */}
          <ChartCard
            title="Teams against target"
            subtitle="Each department's average technical score, with its target as a dark tick. Furthest behind first."
            headline="2 of 2 departments are below target. Engineering is furthest behind, 38.9 points short."
            help="Average technical score by department compared against minimum benchmark target."
            pillSwitch={(
              <div className="chart-pill-switch">
                <button
                  type="button"
                  className={`chart-pill-btn ${targetTab === 'departments' ? 'active' : ''}`}
                  onClick={() => setTargetTab('departments')}
                >
                  Departments
                </button>
                <button
                  type="button"
                  className={`chart-pill-btn ${targetTab === 'managers' ? 'active' : ''}`}
                  onClick={() => setTargetTab('managers')}
                >
                  Line managers
                </button>
              </div>
            )}
            footerNote="Not shown: 2 with fewer than 3 people."
            table={{
              columns: [
                { key: 'team', label: targetTab === 'departments' ? 'Department' : 'Team' },
                { key: 'people', label: 'People', numeric: true },
                { key: 'actual', label: 'Score', numeric: true },
                { key: 'target', label: 'Target', numeric: true },
                { key: 'variance', label: 'Variance', numeric: true },
              ],
              rows: (targetTab === 'departments' ? departmentTargetRows : managerTargetRows).map(r => ({
                team: r.name,
                people: r.subtitle || '',
                actual: `${r.achievedPercent.toFixed(1)}%`,
                target: `${r.targetPercent.toFixed(1)}%`,
                variance: `${r.variancePoints > 0 ? '+' : ''}${r.variancePoints.toFixed(1)} pts`,
              })),
            }}
          >
            <TargetBenchmarkBars
              rows={targetTab === 'departments' ? departmentTargetRows : managerTargetRows}
            />
          </ChartCard>

          {/* Card 3: How close people are to their target */}
          <ChartCard
            title="How close people are to their target"
            subtitle="33 people with a technical result, each compared with the target for their grade."
            help="People categorized into performance proximity bands against grade targets."
            pillSwitch={(
              <div className="chart-pill-switch">
                <button
                  type="button"
                  className={`chart-pill-btn ${targetCloseTab === 'own' ? 'active' : ''}`}
                  onClick={() => setTargetCloseTab('own')}
                >
                  Own target
                </button>
                <button
                  type="button"
                  className={`chart-pill-btn ${targetCloseTab === 'attainment' ? 'active' : ''}`}
                  onClick={() => setTargetCloseTab('attainment')}
                >
                  Attainment
                </button>
              </div>
            )}
            table={{
              columns: [
                { key: 'band', label: 'Band' },
                { key: 'count', label: 'People', numeric: true },
                { key: 'threshold', label: 'Threshold' },
                { key: 'share', label: 'Share', numeric: true },
              ],
              rows: closePillars.map(p => ({
                band: p.title,
                count: `${p.count} ${p.countUnit || 'people'}`,
                threshold: p.subtitle,
                share: p.badgeLabel,
              })),
            }}
          >
            <CapsuleBenchmarkChart
              pillars={closePillars}
              axisLeft="Further from target"
              axisRight="Closer to target"
              summaryNote="The middle person is 22 points below their target. 8 not shown: no technical result yet, or no target."
            />
          </ChartCard>

          {/* Card 4: People by grade */}
          <ChartCard
            title="People by grade"
            subtitle="Number of people at each grade, junior to senior. The striped part is ready for promotion."
            help="Staff distribution across career progression grades."
            footerNote="41 people, 0 ready for promotion."
            table={{
              columns: [
                { key: 'grade', label: 'Grade' },
                { key: 'count', label: 'People', numeric: true },
                { key: 'share', label: 'Share', numeric: true },
                { key: 'status', label: 'Status' },
              ],
              rows: gradeItems.map(g => ({
                grade: g.label,
                count: `${g.count} ${g.countUnit || 'people'}`,
                share: `${g.percentage}%`,
                status: g.subLabel,
              })),
            }}
          >
            <CategoryGradePillars
              items={gradeItems}
              axisLeft="Junior"
              axisRight="Senior"
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
