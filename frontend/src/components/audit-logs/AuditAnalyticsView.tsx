'use client';

import { useState } from 'react';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarStats,
  IconCheck,
  IconClock,
  IconDatabase,
  IconEye,
  IconFilter,
  IconHistory,
  IconKey,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconRotate,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useAuditLogs, type AuditLogRow, type AuditLogStats } from '@/lib/api/audit';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatCount } from '@/lib/app-settings';
import { ChartCard, DonutChart, MonthlyColumnChart, RankedBars } from '@/components/analytics/ProCharts';
import { useChartTheme } from '@/components/analytics/chart-palette';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DashboardPanel } from '@/components/ui/DashboardPanel';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatGrid, StatTile } from '@/components/ui/StatTile';
import { actionBadgeVariant, actionThemeColor, formatAuditDate } from './audit-helpers';
import type { TileDrilldownConfig } from './AuditTileDrilldownDrawer';

interface AuditAnalyticsViewProps {
  stats: AuditLogStats;
  settings?: AppFormatSettingsSource | null;
  onInspect: (log: AuditLogRow) => void;
  onSwitchToExplorer: (filters?: {
    action?: string;
    entity?: string;
    user?: string;
    category?: string;
    fourEyes?: 'all' | 'verified' | 'single';
  }) => void;
  onTileClick?: (config: TileDrilldownConfig) => void;
}

export function AuditAnalyticsView({
  stats,
  settings,
  onInspect,
  onSwitchToExplorer,
  onTileClick,
}: AuditAnalyticsViewProps) {
  const theme = useChartTheme();
  const { metrics, fourEyesMetrics, categoryCounts, dailyActivity, byAction, byEntity, topUsers, recentCritical } = stats;

  const total = metrics.totalEvents;
  const avgDaily = dailyActivity.length > 0
    ? Math.round(dailyActivity.reduce((sum, d) => sum + d.count, 0) / dailyActivity.length)
    : 0;

  // Selected quick category filter for the dynamic feed below
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeDateRange, setActiveDateRange] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [fourEyesFilter, setFourEyesFilter] = useState<'all' | 'verified' | 'single'>('all');
  const [queryLimit, setQueryLimit] = useState<number>(20);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compute from_date for preset filters
  const computeFromDate = (preset: string) => {
    if (preset === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }
    if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString();
    }
    if (preset === '14d') {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      return d.toISOString();
    }
    if (preset === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString();
    }
    return undefined;
  };

  // Dynamic feed query responding to category clicks or special request filters
  const dynamicLogsQuery = useAuditLogs({
    page: 1,
    limit: queryLimit,
    category: activeCategory !== 'all' ? activeCategory : undefined,
    action: actionFilter || undefined,
    entity_name: entityFilter || undefined,
    four_eyes: fourEyesFilter !== 'all' ? fourEyesFilter : undefined,
    from_date: computeFromDate(activeDateRange),
    search: searchQuery.trim() || undefined,
  });

  const recentList = dynamicLogsQuery.data?.data ?? stats.recentActivities ?? (stats.recentCritical as unknown as AuditLogRow[]) ?? [];
  const dynamicTotal = dynamicLogsQuery.data?.pagination?.total ?? total;

  // Trigger tile drilldown drawer
  const handleTileClick = (config: TileDrilldownConfig) => {
    if (onTileClick) {
      onTileClick(config);
    } else {
      onSwitchToExplorer({
        action: config.action,
        entity: config.entityName,
        category: config.category,
        fourEyes: config.fourEyes,
      });
    }
  };

  // Data shaping for charts
  const monthlyPoints = dailyActivity.map(d => ({
    monthKey: d.day,
    label: d.label,
    count: d.count,
  }));

  const donutItems = byAction.map(a => ({
    name: a.action,
    value: a.count,
    color: actionThemeColor(theme, a.action),
  }));

  const rankedEntityItems = byEntity.map(e => ({
    name: e.entity,
    value: e.count,
  }));

  // Quick category list
  const categories = [
    {
      id: 'all',
      label: 'All Operations',
      count: categoryCounts?.all ?? total,
      tone: 'blue',
      icon: <IconHistory size={16} />,
      config: { tileId: 'all', title: 'All Enterprise Activities', description: 'Complete stream of immutable audit logs' },
    },
    {
      id: 'approvals',
      label: '4-Eyes & Approvals',
      count: categoryCounts?.approvals ?? (byAction.find(a => a.action === 'APPROVE')?.count ?? 0) + (byAction.find(a => a.action === 'POST')?.count ?? 0),
      tone: 'teal',
      icon: <IconShieldCheck size={16} />,
      config: { tileId: 'approvals', title: 'Approvals & Dual-Control Posts', description: 'Maker-Checker verified approvals and ledger posts', category: 'approvals' },
    },
    {
      id: 'updates',
      label: 'Updates & Edits',
      count: categoryCounts?.updates ?? (byAction.find(a => a.action === 'UPDATE')?.count ?? 0),
      tone: 'violet',
      icon: <IconPencil size={16} />,
      config: { tileId: 'updates', title: 'Updated & Modified Records', description: 'Modifications to accounts, items, and parties', category: 'updates' },
    },
    {
      id: 'deletions',
      label: 'Deletions & Voids',
      count: categoryCounts?.deletions ?? metrics.criticalActions,
      tone: 'rose',
      icon: <IconTrash size={16} />,
      config: { tileId: 'deletions', title: 'Deletions, Voids & Reversals', description: 'Voided vouchers, purged records, and reversals', category: 'deletions' },
    },
    {
      id: 'logins',
      label: 'Logins & Auth',
      count: categoryCounts?.logins ?? (byAction.find(a => a.action === 'LOGIN')?.count ?? 0),
      tone: 'amber',
      icon: <IconKey size={16} />,
      config: { tileId: 'logins', title: 'User Sign-Ins & Authentication', description: 'User login events and credential resets', category: 'logins' },
    },
    {
      id: 'creations',
      label: 'Creations & Drafts',
      count: categoryCounts?.creations ?? (byAction.find(a => a.action === 'CREATE')?.count ?? 0),
      tone: 'slate',
      icon: <IconPlus size={16} />,
      config: { tileId: 'creations', title: 'Created Records & Draft Documents', description: 'Draft vouchers, new master accounts, and items', category: 'creations' },
    },
  ];

  const handleResetSpecialQuery = () => {
    setActiveCategory('all');
    setActiveDateRange('all');
    setActionFilter('');
    setEntityFilter('');
    setFourEyesFilter('all');
    setQueryLimit(20);
    setSearchQuery('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: Executive KPI Metrics - All Interactive */}
      <section aria-labelledby="audit-kpis-title" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="audit-kpis-title" className="analytics-section-title" style={{ margin: 0 }}>
            Telemetry &amp; Governance KPIs
          </h2>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
            Click any tile to inspect recent 10/20 entries
          </span>
        </div>

        <StatGrid label="Audit Governance Metrics">
          <StatTile
            label="Total Events Logged"
            tone="blue"
            icon={<IconHistory />}
            value={formatCount(metrics.totalEvents, settings)}
            detail="Click to inspect all recent activity"
            help="Total operational events tracked across users, inventory, accounting, and configuration. Click to view recent entries."
            onClick={() => handleTileClick({
              tileId: 'total-events',
              title: 'Total System Activities',
              description: 'Latest events across all modules and operations',
            })}
          />
          <StatTile
            label="Active Operators"
            tone="teal"
            icon={<IconUsers />}
            value={formatCount(metrics.activeUsers, settings)}
            detail="Distinct active accounts"
            help="Number of distinct users who have performed recorded changes in the enterprise."
            onClick={() => handleTileClick({
              tileId: 'active-operators',
              title: 'Active Operator Activities',
              description: 'Operational entries categorized by active team members',
            })}
          />
          <StatTile
            label="Sensitive Actions"
            tone={metrics.criticalActions > 0 ? 'rose' : 'slate'}
            icon={<IconAlertTriangle />}
            value={formatCount(metrics.criticalActions, settings)}
            detail="Deletions, resets &amp; voids"
            help="Critical administrative actions such as deletions, password resets, voids, or cancellations. Click to inspect recent sensitive actions."
            onClick={() => handleTileClick({
              tileId: 'sensitive-actions',
              title: 'Sensitive & Security Actions',
              description: 'Critical deletions, password resets, voids, and reversals',
              category: 'deletions',
            })}
          />
          <StatTile
            label="24-Hour Velocity"
            tone="violet"
            icon={<IconCalendarStats />}
            value={formatCount(metrics.todayEvents, settings)}
            detail="Events logged today"
            help="Number of audit entries recorded since midnight today. Click to inspect today's telemetry."
            onClick={() => handleTileClick({
              tileId: 'today-velocity',
              title: '24-Hour Velocity (Today)',
              description: 'Events recorded across all modules since midnight today',
              todayOnly: true,
            })}
          />
          <StatTile
            label="Primary Target Entity"
            tone="amber"
            icon={<IconDatabase />}
            value={metrics.topEntity ?? 'None'}
            detail="Highest mutation volume"
            help="The entity or module undergoing the highest frequency of user and system updates. Click to inspect."
            onClick={() => handleTileClick({
              tileId: 'top-entity',
              title: `${metrics.topEntity ?? 'Entity'} Activity Log`,
              description: `Audit trail for the primary module: ${metrics.topEntity ?? 'All'}`,
              entityName: metrics.topEntity ?? undefined,
            })}
          />
        </StatGrid>
      </section>

      {/* Row 2: Action Category Interactive Cards (Clickable for Recent 10/20) */}
      <section aria-labelledby="action-categories-title" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span id="action-categories-title" style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-heading)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Action Categories &amp; Quick Drilldowns
          </span>
          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
            Filter in-place or click to slide over full details
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {categories.map(cat => {
            const isSelected = activeCategory === cat.id;
            return (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveCategory(cat.id);
                  handleTileClick(cat.config);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveCategory(cat.id);
                    handleTileClick(cat.config);
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: isSelected ? 'var(--color-surface)' : 'var(--color-surface-subtle)',
                  border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-subtle)',
                  boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: `var(--color-${cat.tone})` }}>
                    {cat.icon}
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-heading)' }}>
                      {cat.label}
                    </span>
                  </div>
                  <IconArrowRight size={13} style={{ color: 'var(--color-text-muted)' }} />
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatCount(cat.count, settings)}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                    {total > 0 ? `${Math.round((cat.count / total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Row 3: Daily Activity Trend & Action Distribution */}
      <div className="layout-cols-2">
        <ChartCard
          title="Daily Activity (Last 14 Days)"
          subtitle="Audit volume frequency; dashed line indicates daily average"
          headline={`${formatCount(total, settings)} total events recorded across the enterprise`}
          metric={{ label: 'Daily Average', value: `${formatCount(avgDaily, settings)} events/day` }}
          help="Histogram of all user and system modifications recorded over the last two weeks."
          table={{
            columns: [
              { key: 'day', label: 'Date' },
              { key: 'count', label: 'Events Recorded', numeric: true },
            ],
            rows: dailyActivity.map(d => ({
              day: d.label,
              count: formatCount(d.count, settings),
            })),
          }}
        >
          {dailyActivity.length === 0 || total === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-desc">No events recorded during this 14-day window.</div>
            </div>
          ) : (
            <MonthlyColumnChart
              variant="3d"
              data={monthlyPoints}
              dataKey="count"
              seriesName="Events"
              average={avgDaily}
              format={val => `${formatCount(val, settings)} events`}
              axis={val => formatCount(val, settings)}
              tooltipTitle={point => String(point.label)}
              height={220}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Activity By Action Type"
          subtitle="Proportion of operations across standard lifecycle actions"
          headline={byAction[0] ? `${byAction[0].action} represents ${byAction[0].percentage}% of all operations` : 'No action data available'}
          help="Distribution of actions categorized by Create, Update, Delete, Post, and Reset."
          table={{
            columns: [
              { key: 'action', label: 'Action Type' },
              { key: 'count', label: 'Count', numeric: true },
              { key: 'share', label: 'Share', numeric: true },
            ],
            rows: byAction.map(a => ({
              action: a.action,
              count: formatCount(a.count, settings),
              share: `${a.percentage}%`,
            })),
          }}
        >
          {donutItems.length === 0 || total === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-desc">No operations recorded yet.</div>
            </div>
          ) : (
            <DonutChart
              variant="3d"
              items={donutItems}
              centerValue={formatCount(total, settings)}
              centerLabel="events"
              format={val => formatCount(val, settings)}
            />
          )}
        </ChartCard>
      </div>

      {/* Row 4: Four-Eyes Principle Governance Intelligence */}
      <section
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-surface)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-primary)',
              }}
            >
              <IconShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 700, color: 'var(--color-heading)' }}>
                  Four-Eyes Principle Governance Intelligence
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-2xs)',
                    fontWeight: 700,
                    backgroundColor: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    color: 'var(--color-primary)',
                  }}
                >
                  Dual-Control Policy
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Mandates that sensitive financial ledger operations are created by a Maker and authorized by a distinct Checker.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Dual-Control Compliance Rate
              </span>
              <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>
                {fourEyesMetrics?.dualControlRate ?? 100}%
              </span>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<IconFilter size={14} />}
              onClick={() => {
                setFourEyesFilter('verified');
                handleTileClick({
                  tileId: 'four-eyes',
                  title: 'Four-Eyes Dual-Control Compliance Trail',
                  description: 'All ledger events authorized under Maker-Checker verification',
                  fourEyes: 'verified',
                });
              }}
            >
              Inspect 4-Eyes Records
            </Button>
          </div>
        </div>

        {/* Four-Eyes Telemetry Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              <IconCheck size={14} style={{ color: 'var(--color-primary)' }} />
              <span>Verified Dual-Control Operations</span>
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-heading)' }}>
              {formatCount(fourEyesMetrics?.fourEyesVerifiedCount ?? 0, settings)}
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              Distinct Maker and Checker verified
            </span>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              <IconUserCheck size={14} style={{ color: 'var(--color-amber)' }} />
              <span>Direct Single-Operator Postings</span>
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-heading)' }}>
              {formatCount(fourEyesMetrics?.singleOperatorCount ?? 0, settings)}
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              Self-authorized or direct admin actions
            </span>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              <IconClock size={14} style={{ color: 'var(--color-primary)' }} />
              <span>Pending Four-Eyes Reviews</span>
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-heading)' }}>
              {formatCount(fourEyesMetrics?.pendingApprovals ?? 0, settings)}
            </div>
            <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
              Vouchers awaiting authorization
            </span>
          </div>
        </div>
      </section>

      {/* Row 5: Affected Entities & Top Operators */}
      <div className="layout-cols-2">
        <ChartCard
          title="Top Affected Modules &amp; Entities"
          subtitle="Entities and documents receiving the most modifications"
          headline={byEntity[0] ? `${byEntity[0].entity} is the most frequently altered module` : 'No entity data'}
          help="Ranking of models undergoing changes, calculated by total operations."
          table={{
            columns: [
              { key: 'entity', label: 'Entity Name' },
              { key: 'count', label: 'Operations', numeric: true },
              { key: 'share', label: 'Share', numeric: true },
            ],
            rows: byEntity.map(e => ({
              entity: e.entity,
              count: formatCount(e.count, settings),
              share: `${e.percentage}%`,
            })),
          }}
        >
          {rankedEntityItems.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-desc">No entity modifications recorded.</div>
            </div>
          ) : (
            <RankedBars
              variant="3d"
              items={rankedEntityItems}
              total={total}
              format={val => formatCount(val, settings)}
              limit={6}
              countLabel={count => `${formatCount(count, settings)} Operations`}
            />
          )}
        </ChartCard>

        {/* Top Operators Leaderboard */}
        <DashboardPanel
          title="Most Active Operators"
          bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {topUsers.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-desc">No operator activity recorded yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topUsers.map((user, idx) => {
                const pct = total > 0 ? Math.round((user.count / total) * 100) : 0;
                return (
                  <div
                    key={`${user.userName}-${idx}`}
                    style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}
                    onClick={() => handleTileClick({
                      tileId: `operator-${idx}`,
                      title: `Activity by ${user.userName}`,
                      description: `Operational audit records performed by ${user.userName}`,
                    })}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: idx === 0 ? 'var(--color-primary-subtle, var(--color-surface-subtle))' : 'var(--color-surface-subtle)',
                          border: '1px solid var(--color-border-subtle)',
                          fontSize: 'var(--font-size-2xs)',
                          fontWeight: 700,
                          color: idx === 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                        }}>
                          {idx + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-heading)', fontSize: 'var(--font-size-sm)' }}>
                            {user.userName}
                          </span>
                          {user.userEmail && (
                            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {user.userEmail}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontWeight: 700, color: 'var(--color-heading)', fontSize: 'var(--font-size-sm)' }}>
                          {formatCount(user.count, settings)}
                        </span>{' '}
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>
                    <ProgressBar pct={pct} height={8} tone={idx === 0 ? 'blue' : 'slate'} variant="3d" />
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>
      </div>

      {/* Row 6: Live System Recent Activities Feed & Special Request Controls */}
      <DashboardPanel
        title="Recent Security & Sensitive Operations"
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<IconRotate size={14} />}
              onClick={handleResetSpecialQuery}
              title="Reset query filters to all recent activities"
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSwitchToExplorer({ action: actionFilter || undefined, entity: entityFilter || undefined })}
            >
              Explore All in Log Explorer
            </Button>
          </div>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Special Request Filter Bar */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-surface-subtle)',
              border: '1px solid var(--color-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-heading)' }}>
                <IconFilter size={15} />
                <span>Special Request Activity Query</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                  Display Limit:
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    padding: 2,
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  {[10, 20, 50].map(lim => (
                    <button
                      key={lim}
                      type="button"
                      onClick={() => setQueryLimit(lim)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: 'var(--font-size-2xs)',
                        fontWeight: queryLimit === lim ? 700 : 500,
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: queryLimit === lim ? 'var(--color-primary)' : 'transparent',
                        color: queryLimit === lim ? 'var(--color-surface)' : 'var(--color-text-muted)',
                      }}
                    >
                      {lim}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Inputs Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {/* Date Range Preset */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Date Range
                </label>
                <select
                  value={activeDateRange}
                  onChange={e => setActiveDateRange(e.target.value)}
                  className="select-input"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 8px', height: 32 }}
                >
                  <option value="all">All Dates</option>
                  <option value="today">Today (Last 24h)</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="14d">Last 14 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>

              {/* Event Type / Action */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Action / Event Type
                </label>
                <select
                  value={actionFilter}
                  onChange={e => setActionFilter(e.target.value)}
                  className="select-input"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 8px', height: 32 }}
                >
                  <option value="">All Actions</option>
                  <option value="LOGIN">LOGIN (Sign-In)</option>
                  <option value="APPROVE">APPROVE (Four-Eyes Approval)</option>
                  <option value="POST">POST (Ledger Post)</option>
                  <option value="UPDATE">UPDATE (Record Modified)</option>
                  <option value="DELETE">DELETE (Record Deleted)</option>
                  <option value="VOID">VOID (Voucher Voided)</option>
                  <option value="REVERSE">REVERSE (Voucher Reversed)</option>
                  <option value="CREATE">CREATE (Draft Created)</option>
                  <option value="PASSWORD_RESET">PASSWORD_RESET (Security)</option>
                </select>
              </div>

              {/* Target Entity */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Module / Entity
                </label>
                <select
                  value={entityFilter}
                  onChange={e => setEntityFilter(e.target.value)}
                  className="select-input"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 8px', height: 32 }}
                >
                  <option value="">All Modules</option>
                  <option value="Voucher">Voucher</option>
                  <option value="Account">Account</option>
                  <option value="Product">Product / Item</option>
                  <option value="Customer">Customer</option>
                  <option value="Supplier">Supplier</option>
                  <option value="FiscalYear">Fiscal Year</option>
                  <option value="User">User</option>
                </select>
              </div>

              {/* Four-Eyes Filter */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Four-Eyes Governance
                </label>
                <select
                  value={fourEyesFilter}
                  onChange={e => setFourEyesFilter(e.target.value as 'all' | 'verified' | 'single')}
                  className="select-input"
                  style={{ fontSize: 'var(--font-size-xs)', padding: '5px 8px', height: 32 }}
                >
                  <option value="all">All Operations</option>
                  <option value="verified">4-Eyes Verified Only</option>
                  <option value="single">Single-Operator Direct Only</option>
                </select>
              </div>

              {/* Keyword Search */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                  Search Query
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <IconSearch size={14} style={{ position: 'absolute', left: 8, color: 'var(--color-text-muted)' }} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Operator, ID, or description…"
                    className="text-input"
                    style={{ fontSize: 'var(--font-size-xs)', paddingLeft: 28, height: 32 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Activity Feed Table */}
          {recentList.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <div className="empty-desc">No events found matching this special request.</div>
            </div>
          ) : (
            <div className="table-scroll" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>Timestamp</th>
                    <th style={{ width: 160 }}>Operator</th>
                    <th style={{ width: 100 }}>Action</th>
                    <th style={{ width: 120 }}>Entity</th>
                    <th>Description &amp; Governance Details</th>
                    <th style={{ width: 100 }}>IP Address</th>
                    <th style={{ width: 70, textAlign: 'right' }}>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {recentList.slice(0, queryLimit).map(log => {
                    const isFourEyes = log.four_eyes_verified === true || log.action === 'APPROVE';
                    const isSingleOp = log.single_operator === true;

                    return (
                      <tr
                        key={log.id}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onInspect(log)}
                      >
                        <td className="cell-muted" style={{ whiteSpace: 'nowrap' }}>
                          {formatAuditDate(log.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="cell-strong">{log.user_name}</span>
                            {log.user_email && <span className="cell-sub">{log.user_email}</span>}
                          </div>
                        </td>
                        <td>
                          <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{log.entity_name}</span>
                          {log.entity_id && (
                            <span className="cell-sub" style={{ fontFamily: 'var(--font-code)' }}>
                              {log.entity_id.length > 10 ? `${log.entity_id.slice(0, 8)}…` : log.entity_id}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span>{log.description || '—'}</span>

                            {isFourEyes && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 'var(--font-size-2xs)',
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                }}
                              >
                                <IconShieldCheck size={12} />
                                <span>4-Eyes Verified</span>
                              </span>
                            )}

                            {isSingleOp && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  fontSize: 'var(--font-size-2xs)',
                                  color: 'var(--color-text-muted)',
                                }}
                              >
                                <IconUserCheck size={12} />
                                <span>Single-Operator Direct</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="cell-muted" style={{ fontFamily: 'var(--font-code)' }}>
                          {log.ip_address || '—'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-icon"
                            aria-label="Inspect Log"
                            onClick={e => {
                              e.stopPropagation();
                              onInspect(log);
                            }}
                          >
                            <IconEye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
            <span>
              Showing first {Math.min(recentList.length, queryLimit)} of {dynamicTotal} entries in database.
            </span>
            <span>Click any record to inspect full audit payload</span>
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
