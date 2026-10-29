'use client';

import {
  IconAlertTriangle,
  IconCalendarStats,
  IconDatabase,
  IconEye,
  IconHistory,
  IconUsers,
} from '@tabler/icons-react';
import type { AuditLogRow, AuditLogStats } from '@/lib/api/audit';
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

interface AuditAnalyticsViewProps {
  stats: AuditLogStats;
  settings?: AppFormatSettingsSource | null;
  onInspect: (log: AuditLogRow) => void;
  onSwitchToExplorer: (filters?: { action?: string; entity?: string; user?: string }) => void;
}

export function AuditAnalyticsView({
  stats,
  settings,
  onInspect,
  onSwitchToExplorer,
}: AuditAnalyticsViewProps) {
  const theme = useChartTheme();
  const { metrics, dailyActivity, byAction, byEntity, topUsers, recentCritical } = stats;

  const total = metrics.totalEvents;
  const avgDaily = dailyActivity.length > 0
    ? Math.round(dailyActivity.reduce((sum, d) => sum + d.count, 0) / dailyActivity.length)
    : 0;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Row 1: Executive KPI Metrics */}
      <section aria-labelledby="audit-kpis-title" style={{ display: 'grid', gap: 8 }}>
        <h2 id="audit-kpis-title" className="analytics-section-title" style={{ margin: 0 }}>
          Telemetry &amp; Governance KPIs
        </h2>
        <StatGrid label="Audit Governance Metrics">
          <StatTile
            label="Total Events Logged"
            tone="blue"
            icon={<IconHistory />}
            value={formatCount(metrics.totalEvents, settings)}
            detail="Immutable system audit records"
            help="Total operational events tracked across users, inventory, accounting, and configuration."
          />
          <StatTile
            label="Active Operators"
            tone="teal"
            icon={<IconUsers />}
            value={formatCount(metrics.activeUsers, settings)}
            detail="Distinct active accounts"
            help="Number of distinct users who have performed recorded changes in the enterprise."
          />
          <StatTile
            label="Sensitive Actions"
            tone={metrics.criticalActions > 0 ? 'rose' : 'slate'}
            icon={<IconAlertTriangle />}
            value={formatCount(metrics.criticalActions, settings)}
            detail="Deletions, resets &amp; voids"
            help="Critical administrative actions such as deletions, password resets, voids, or cancellations."
          />
          <StatTile
            label="24-Hour Velocity"
            tone="violet"
            icon={<IconCalendarStats />}
            value={formatCount(metrics.todayEvents, settings)}
            detail="Events logged today"
            help="Number of audit entries recorded since midnight today."
          />
          <StatTile
            label="Primary Target Entity"
            tone="amber"
            icon={<IconDatabase />}
            value={metrics.topEntity ?? 'None'}
            detail="Highest mutation volume"
            help="The entity or module undergoing the highest frequency of user and system updates."
          />
        </StatGrid>
      </section>

      {/* Row 2: Daily Activity Trend & Action Distribution */}
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

      {/* Row 3: Affected Entities & Top Operators */}
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
                  <div key={`${user.userName}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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

      {/* Row 4: Recent Security & Sensitive Operations Feed */}
      <DashboardPanel
        title="Recent Security &amp; Sensitive Operations"
        actions={(
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSwitchToExplorer({ action: 'DELETE' })}
          >
            Explore All in Log Explorer
          </Button>
        )}
      >
        {recentCritical.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="empty-desc">No security-sensitive events recorded recently. All operations conform to standard lifecycle flows.</div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th style={{ width: 170 }}>Operator</th>
                  <th style={{ width: 110 }}>Action</th>
                  <th style={{ width: 130 }}>Entity</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>IP Address</th>
                  <th style={{ width: 80, textAlign: 'right' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {recentCritical.map(log => (
                  <tr key={log.id} style={{ cursor: 'pointer' }} onClick={() => onInspect(log as unknown as AuditLogRow)}>
                    <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                      {formatAuditDate(log.createdAt)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="cell-strong">{log.userName}</span>
                        {log.userEmail && <span className="cell-sub">{log.userEmail}</span>}
                      </div>
                    </td>
                    <td>
                      <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{log.entityName}</span>
                      {log.entityId && (
                        <span className="cell-sub" style={{ fontFamily: 'var(--font-code)' }}>
                          {log.entityId.length > 10 ? `${log.entityId.slice(0, 8)}…` : log.entityId}
                        </span>
                      )}
                    </td>
                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                      {log.description || '—'}
                    </td>
                    <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-code)' }}>
                      {log.ipAddress || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label="Inspect Log"
                        onClick={e => {
                          e.stopPropagation();
                          onInspect(log as unknown as AuditLogRow);
                        }}
                      >
                        <IconEye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
