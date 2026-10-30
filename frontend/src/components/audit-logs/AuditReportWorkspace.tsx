'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  IconChartInfographic,
  IconChevronDown,
  IconChevronUp,
  IconEye,
  IconRefresh,
  IconShieldCheck,
  IconUserCheck,
} from '@tabler/icons-react';
import { useAuditLogs, useAuditLogStats, type AuditLogRow } from '@/lib/api/audit';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate, formatCount } from '@/lib/app-settings';
import { ChartCard, DonutChart, MonthlyColumnChart } from '@/components/analytics/ProCharts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, TextField } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { Tabs } from '@/components/ui/Tabs';
import { reportFilterGridStyle } from '@/components/reports/LedgerReportStyles';
import { ReportActions } from '@/components/reports/ReportActions';
import type { ReportDocument, ReportRow } from '@/components/reports/report-output';
import { actionBadgeVariant, actionThemeColor, formatAuditDate } from './audit-helpers';
import { AuditLogDetailDrawer } from './AuditLogDetailDrawer';
import { useChartTheme } from '@/hooks/useChartTheme';

export type AuditReportAngle =
  | 'trail-summary'
  | 'four-eyes'
  | 'auth-activity'
  | 'sensitive-ops'
  | 'module-mutations';

interface AuditReportWorkspaceProps {
  onInspectLog?: (log: AuditLogRow) => void;
  initialAngle?: AuditReportAngle;
  hideSubTabs?: boolean;
}

const ACTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Actions' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'APPROVE', label: 'APPROVE (4-Eyes)' },
  { value: 'POST', label: 'POST' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'VOID', label: 'VOID' },
  { value: 'REVERSE', label: 'REVERSE' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'PASSWORD_RESET', label: 'PASSWORD_RESET' },
];

const MODULE_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Modules' },
  { value: 'Voucher', label: 'Voucher' },
  { value: 'Account', label: 'Account' },
  { value: 'Product', label: 'Product / Item' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'FiscalYear', label: 'Fiscal Year' },
  { value: 'User', label: 'User' },
];

const FOUR_EYES_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Operations' },
  { value: 'verified', label: '4-Eyes Verified Only' },
  { value: 'single', label: 'Single-Operator Direct Only' },
];

export function AuditReportWorkspace({
  onInspectLog,
  initialAngle = 'trail-summary',
  hideSubTabs = false,
}: AuditReportWorkspaceProps) {
  const { data: settings } = useGeneralSettings();
  const theme = useChartTheme();

  // Active angle / sub-tab
  const [activeAngle, setActiveAngle] = useState<AuditReportAngle>(initialAngle);
  const [showOverviewPanel, setShowOverviewPanel] = useState<boolean>(true);
  const [internalSelectedLog, setInternalSelectedLog] = useState<AuditLogRow | null>(null);

  // Sync angle if controlled externally
  useEffect(() => {
    if (initialAngle && initialAngle !== activeAngle) {
      setActiveAngle(initialAngle);
      setPage(1);
    }
  }, [initialAngle]);

  // Filters state (matching sample report toolbar)
  const [search, setSearch] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [fourEyesFilter, setFourEyesFilter] = useState<'all' | 'verified' | 'single'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  // Determine category & action constraints based on active sub-report angle
  const angleConstraints = useMemo(() => {
    switch (activeAngle) {
      case 'four-eyes':
        return {
          category: 'four_eyes',
          fourEyes: 'verified' as const,
          title: 'Four-Eyes & Dual-Control Governance Report',
        };
      case 'auth-activity':
        return {
          category: 'logins',
          title: 'User Authentication & Activity Report',
        };
      case 'sensitive-ops':
        return {
          category: 'deletions',
          title: 'Sensitive & Security Operations Report',
        };
      case 'module-mutations':
        return {
          category: 'updates',
          title: 'Module & Entity Mutation Report',
        };
      case 'trail-summary':
      default:
        return {
          category: undefined,
          fourEyes: undefined,
          title: 'Audit Trail Summary Report',
        };
    }
  }, [activeAngle]);

  const statsQuery = useAuditLogStats({
    from_date: dateFrom || undefined,
    to_date: dateTo || undefined,
  });

  const logsQuery = useAuditLogs({
    page,
    limit,
    search: search.trim() || undefined,
    action: actionFilter || undefined,
    entity_name: entityFilter || undefined,
    category: angleConstraints.category,
    four_eyes: fourEyesFilter !== 'all' ? fourEyesFilter : (angleConstraints.fourEyes ?? undefined),
    user_id: operatorId || undefined,
    from_date: dateFrom || undefined,
    to_date: dateTo || undefined,
  });

  const stats = statsQuery.data;
  const rows = logsQuery.data?.data ?? [];
  const total = logsQuery.data?.pagination?.total ?? 0;
  const totalPages = logsQuery.data?.pagination?.pages ?? 1;

  const handleRefresh = () => {
    void statsQuery.refetch();
    void logsQuery.refetch();
  };

  const handleAngleChange = (angle: AuditReportAngle) => {
    setActiveAngle(angle);
    setPage(1);
    if (angle === 'four-eyes') {
      setFourEyesFilter('verified');
      setActionFilter('');
    } else {
      setFourEyesFilter('all');
    }
  };

  const handleInspect = (log: AuditLogRow) => {
    if (onInspectLog) {
      onInspectLog(log);
    } else {
      setInternalSelectedLog(log);
    }
  };

  // Build ReportDocument for Print & Export CSV
  const buildReport = (): ReportDocument | null => {
    if (logsQuery.isLoading || rows.length === 0) return null;

    const columns: ReportDocument['columns'] = [
      { label: 'Timestamp', kind: 'date' },
      { label: 'Event ID' },
      { label: 'Operator' },
      { label: 'Action Type' },
      { label: 'Target Module' },
      { label: 'Document / Entity ID' },
      { label: 'Four-Eyes Status' },
      { label: 'IP Address' },
      { label: 'Event Description' },
    ];

    const reportRows: ReportRow[] = rows.map(r => ({
      cells: [
        r.created_at?.slice(0, 19).replace('T', ' '),
        r.id.slice(0, 8),
        r.user_name,
        r.action,
        r.entity_name,
        r.entity_id ?? '—',
        r.four_eyes_verified ? '4-Eyes Verified' : (r.single_operator ? 'Single-Operator' : 'Standard'),
        r.ip_address ?? '—',
        r.description ?? '',
      ],
    }));

    reportRows.push({
      cells: [
        '',
        `Totals For All ${total} Records`,
        `Operators: ${stats?.metrics.activeUsers ?? 1}`,
        `4-Eyes Rate: ${stats?.fourEyesMetrics?.dualControlRate ?? 100}%`,
        `Total Events: ${total}`,
        '',
        `Verified: ${stats?.fourEyesMetrics?.fourEyesVerifiedCount ?? 0}`,
        '',
        `Sensitive Actions: ${stats?.metrics.criticalActions ?? 0}`,
      ],
      style: 'total',
    });

    return {
      title: angleConstraints.title,
      subtitle: `${dateFrom ? formatDate(dateFrom, settings) : 'Earliest'} to ${dateTo ? formatDate(dateTo, settings) : 'Latest'} · Enterprise Immutable Audit Records`,
      columns,
      rows: reportRows,
      fileName: `audit-report-${activeAngle}-${new Date().toISOString().slice(0, 10)}`,
      note: totalPages > 1 ? `Showing page ${page} of ${totalPages}. The totals line covers all matching database records.` : undefined,
    };
  };

  // Shaped Data for Pro-Level Overview Panel Graphs (Strictly flat Calm Ledger standard)
  const monthlyPoints = useMemo(() => {
    return (stats?.dailyActivity ?? []).map(d => ({
      monthKey: d.day,
      month: d.day,
      label: d.label,
      count: d.count,
    }));
  }, [stats?.dailyActivity]);

  const avgDaily = useMemo(() => {
    const activity = stats?.dailyActivity ?? [];
    if (activity.length === 0) return 0;
    return Math.round(activity.reduce((sum, d) => sum + d.count, 0) / activity.length);
  }, [stats?.dailyActivity]);

  const donutActionItems = useMemo(() => {
    return (stats?.byAction ?? []).slice(0, 5).map(a => ({
      name: a.action,
      value: a.count,
      color: actionThemeColor(theme, a.action),
    }));
  }, [stats?.byAction, theme]);

  const topAction = stats?.byAction?.[0];

  const verifiedCount = stats?.fourEyesMetrics?.fourEyesVerifiedCount ?? 0;
  const singleOperatorCount = stats?.fourEyesMetrics?.singleOperatorCount ?? 0;
  const pendingApprovals = stats?.fourEyesMetrics?.pendingApprovals ?? 0;
  const totalEvaluated = stats?.fourEyesMetrics?.totalEvaluated ?? ((verifiedCount + singleOperatorCount) || 1);
  const dualRate = stats?.fourEyesMetrics?.dualControlRate ?? (totalEvaluated > 0 ? Math.round((verifiedCount / totalEvaluated) * 100) : 100);

  const fourEyesItems = useMemo(() => {
    const items = [
      { name: '4-Eyes Verified', value: verifiedCount, color: theme.series.teal },
      { name: 'Single-Operator', value: singleOperatorCount, color: theme.series.amber },
    ];
    if (pendingApprovals > 0) {
      items.push({ name: 'Pending Review', value: pendingApprovals, color: theme.series.slate });
    }
    return items;
  }, [verifiedCount, singleOperatorCount, pendingApprovals, theme]);

  const distinctOperators: SelectOption[] = useMemo(() => {
    const ops: SelectOption[] = [{ value: '', label: 'All Operators' }];
    (stats?.topUsers ?? []).forEach(u => {
      ops.push({
        value: u.userName,
        label: u.userName,
      });
    });
    return ops;
  }, [stats?.topUsers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub-report Tabs ("Different Angles as per Report Type and Data") */}
      {!hideSubTabs && (
        <Tabs
          label="Audit Report Angles"
          value={activeAngle}
          onChange={val => handleAngleChange(val as AuditReportAngle)}
          items={[
            { value: 'trail-summary', label: 'Audit Trail Summary' },
            { value: 'four-eyes', label: 'Four-Eyes & Dual-Control' },
            { value: 'auth-activity', label: 'User Activity & Auth' },
            { value: 'sensitive-ops', label: 'Sensitive Operations' },
            { value: 'module-mutations', label: 'Module Mutations' },
          ]}
        />
      )}

      {/* Pro Level Overview Panel with Standard Flat Calm Ledger Charts */}
      <section
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          backgroundColor: 'var(--color-surface)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-primary-subtle, var(--color-surface-subtle))',
                color: 'var(--color-primary)',
              }}
            >
              <IconChartInfographic size={16} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-heading)' }}>
                Executive Visual Overview · {angleConstraints.title}
              </h3>
              <p style={{ margin: 0, fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                Enterprise telemetry analysis featuring activity velocity, action lifecycle share, and four-eyes segregation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowOverviewPanel(prev => !prev)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-2xs)',
              fontWeight: 600,
              border: '1px solid var(--color-border-subtle)',
              backgroundColor: 'var(--color-surface-subtle)',
              color: 'var(--color-heading)',
              cursor: 'pointer',
            }}
          >
            <span>{showOverviewPanel ? 'Hide Overview Panel' : 'Show Overview Panel'}</span>
            {showOverviewPanel ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
          </button>
        </div>

        {showOverviewPanel && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14, paddingTop: 4 }}>
            {/* 1. Velocity Timeline Column Chart (Flat) */}
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
                rows: (stats?.dailyActivity ?? []).map(d => ({
                  day: d.label,
                  count: formatCount(d.count, settings),
                })),
              }}
            >
              {monthlyPoints.length === 0 || total === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-desc">No events recorded during this 14-day window.</div>
                </div>
              ) : (
                <MonthlyColumnChart
                  variant="flat"
                  data={monthlyPoints}
                  dataKey="count"
                  seriesName="Events"
                  average={avgDaily}
                  format={val => `${formatCount(val, settings)} events`}
                  axis={val => formatCount(val, settings)}
                  tooltipTitle={point => String(point.label)}
                  height={185}
                />
              )}
            </ChartCard>

            {/* 2. Action Type Distribution (Flat Donut Chart) */}
            <ChartCard
              title="Activity By Action Type"
              subtitle="Proportion of operations across standard lifecycle actions"
              headline={topAction ? `${topAction.action} represents ${topAction.percentage}% of all operations` : 'No action data available'}
              metric={{ label: 'Primary Action', value: topAction?.action ?? '—' }}
              help="Distribution of actions categorized by Create, Update, Delete, Post, Approve, and Reset."
              table={{
                columns: [
                  { key: 'action', label: 'Action Type' },
                  { key: 'count', label: 'Count', numeric: true },
                  { key: 'share', label: 'Share', numeric: true },
                ],
                rows: (stats?.byAction ?? []).map(a => ({
                  action: a.action,
                  count: formatCount(a.count, settings),
                  share: `${a.percentage}%`,
                })),
              }}
            >
              {donutActionItems.length === 0 || total === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-desc">No operations recorded yet.</div>
                </div>
              ) : (
                <DonutChart
                  variant="flat"
                  items={donutActionItems}
                  centerValue={formatCount(total, settings)}
                  centerLabel="events"
                  format={val => formatCount(val, settings)}
                />
              )}
            </ChartCard>

            {/* 3. Four-Eyes Governance & Dual Control (Flat Donut Chart - Matching Attached Sample!) */}
            <ChartCard
              title="Four-Eyes Dual Control"
              subtitle="Maker-checker segregation across transactions"
              headline={`${verifiedCount} of ${totalEvaluated} operations posted under dual control.`}
              metric={{ label: 'Dual-Control Rate', value: `${dualRate}%` }}
              help="Four-eyes dual control ensures critical ledger entries and mutations are posted or approved by an independent operator."
              table={{
                columns: [
                  { key: 'status', label: 'Verification Type' },
                  { key: 'count', label: 'Operations', numeric: true },
                  { key: 'share', label: 'Compliance Share', numeric: true },
                ],
                rows: fourEyesItems.map(item => ({
                  status: item.name,
                  count: formatCount(item.value, settings),
                  share: totalEvaluated > 0 ? `${Math.round((item.value / totalEvaluated) * 100)}%` : '0%',
                })),
              }}
            >
              {fourEyesItems.length === 0 || totalEvaluated === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px' }}>
                  <div className="empty-desc">No dual-control operations evaluated yet.</div>
                </div>
              ) : (
                <DonutChart
                  variant="flat"
                  items={fourEyesItems}
                  centerValue={`${dualRate}%`}
                  centerLabel="compliance"
                  format={val => formatCount(val, settings)}
                />
              )}
            </ChartCard>
          </div>
        )}
      </section>

      {/* Main Report Table Container (Matching Attached Screenshot Format) */}
      <section className="panel panel-fill">
        {/* Header Bar matching screenshot: "Title 9 Records" + Refresh button */}
        <div className="panel-header">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
            <h2 className="panel-title">{angleConstraints.title}</h2>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {formatCount(total, settings)} {total === 1 ? 'Record' : 'Records'}
            </span>
          </div>

          <Button
            size="sm"
            icon={<IconRefresh size={16} stroke={1.8} />}
            onClick={handleRefresh}
            title="Refresh Report Data"
          >
            Refresh
          </Button>
        </div>

        {/* Standardized Horizontal Filter Bar Grid (Identical to Sample) */}
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <TextField
              label="Search"
              value={search}
              placeholder="Document Number, Party, Or Reference"
              onChange={val => { setSearch(val); setPage(1); }}
            />

            <FieldLabel label="Operator / User">
              <SearchableSelect
                value={operatorId}
                options={distinctOperators}
                placeholder="All Operators"
                onChange={val => { setOperatorId(val); setPage(1); }}
              />
            </FieldLabel>

            <FieldLabel label="Event Action">
              <SearchableSelect
                value={actionFilter}
                options={ACTION_OPTIONS}
                placeholder="All Actions"
                onChange={val => { setActionFilter(val); setPage(1); }}
              />
            </FieldLabel>

            <FieldLabel label="Target Module">
              <SearchableSelect
                value={entityFilter}
                options={MODULE_OPTIONS}
                placeholder="All Modules"
                onChange={val => { setEntityFilter(val); setPage(1); }}
              />
            </FieldLabel>

            <FieldLabel label="Four-Eyes Status">
              <SearchableSelect
                value={fourEyesFilter}
                options={FOUR_EYES_OPTIONS}
                placeholder="All Operations"
                onChange={val => { setFourEyesFilter(val as 'all' | 'verified' | 'single'); setPage(1); }}
              />
            </FieldLabel>

            <DateField
              label="Date From"
              value={dateFrom}
              onChange={val => { setDateFrom(val); setPage(1); }}
            />

            <DateField
              label="Date To"
              value={dateTo}
              onChange={val => { setDateTo(val); setPage(1); }}
            />

            <ReportActions
              buildReport={buildReport}
              disabled={logsQuery.isLoading || rows.length === 0}
            />
          </div>
        </div>

        {/* Data Table Matching Sample Report */}
        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>Date</th>
                <th style={{ width: 140 }}>Document / Event ID</th>
                <th>Operator</th>
                <th style={{ width: 110 }}>Action</th>
                <th style={{ width: 130 }}>Module</th>
                <th>Target Reference</th>
                <th style={{ width: 150 }}>Four-Eyes Status</th>
                <th style={{ width: 110 }}>Client IP</th>
                <th>Description / Narration</th>
                <th style={{ width: 60, textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {logsQuery.isLoading && <TableMessageRow colSpan={10} title={`Loading ${angleConstraints.title}…`} loading />}
              {!logsQuery.isLoading && rows.length === 0 && (
                <TableMessageRow
                  colSpan={10}
                  title="No Audit Records Found"
                  description="Change the search criteria, the dates, or the filters to see more entries."
                />
              )}
              {!logsQuery.isLoading && rows.map(row => {
                const isFourEyes = row.four_eyes_verified === true || row.action === 'APPROVE';
                const isSingleOp = row.single_operator === true;

                return (
                  <tr
                    key={row.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => handleInspect(row)}
                  >
                    <td className="cell-muted" style={{ whiteSpace: 'nowrap' }}>
                      {formatAuditDate(row.created_at)}
                    </td>
                    <td className="cell-strong" style={{ fontFamily: 'var(--font-code)' }}>
                      LOG-{row.id.slice(0, 8)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-heading)' }}>
                          {row.user_name}
                        </span>
                        {row.user_email && (
                          <span style={{ fontSize: 'var(--font-size-2xs)', color: 'var(--color-text-muted)' }}>
                            {row.user_email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <Badge variant={actionBadgeVariant(row.action)}>{row.action}</Badge>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {row.entity_name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-xs)' }}>
                      {row.entity_id ? (row.entity_id.length > 14 ? `${row.entity_id.slice(0, 12)}…` : row.entity_id) : '—'}
                    </td>
                    <td>
                      {isFourEyes ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--color-surface-subtle)',
                            border: '1px solid var(--color-border-subtle)',
                            fontSize: 'var(--font-size-2xs)',
                            color: 'var(--color-primary)',
                            fontWeight: 600,
                          }}
                        >
                          <IconShieldCheck size={12} />
                          <span>4-Eyes Verified</span>
                        </span>
                      ) : isSingleOp ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: 'var(--color-surface-subtle)',
                            border: '1px solid var(--color-border-subtle)',
                            fontSize: 'var(--font-size-2xs)',
                            color: 'var(--color-text-muted)',
                          }}
                        >
                          <IconUserCheck size={12} />
                          <span>Single-Operator</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-2xs)' }}>Standard</span>
                      )}
                    </td>
                    <td className="cell-muted" style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-2xs)' }}>
                      {row.ip_address || '—'}
                    </td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.description || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-icon"
                        aria-label="Inspect Log Record"
                        onClick={e => {
                          e.stopPropagation();
                          handleInspect(row);
                        }}
                      >
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals Footer Matching Sample Screenshot */}
            <tfoot>
              {totalPages > 1 && (
                <tr>
                  <td colSpan={3}>Totals For This Page ({rows.length} records)</td>
                  <td className="num">
                    {rows.filter(r => r.four_eyes_verified).length} 4-Eyes
                  </td>
                  <td colSpan={2}></td>
                  <td>
                    {rows.filter(r => ['DELETE', 'VOID', 'REVERSE', 'CANCEL'].includes(r.action)).length} Sensitive
                  </td>
                  <td colSpan={3}></td>
                </tr>
              )}
              <tr>
                <td colSpan={3} style={{ fontWeight: 700 }}>
                  Totals For All {total} {total === 1 ? 'Record' : 'Records'}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                  {stats?.fourEyesMetrics?.fourEyesVerifiedCount ?? 0} Verified
                </td>
                <td colSpan={2} style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Dual-Control Rate: <strong>{stats?.fourEyesMetrics?.dualControlRate ?? 100}%</strong>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--color-heading)' }}>
                  {stats?.metrics.criticalActions ?? 0} Sensitive Actions
                </td>
                <td colSpan={3} style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Distinct Operators: <strong>{stats?.metrics.activeUsers ?? 1}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Bar */}
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalRecords={total}
          pageSize={limit}
          recordLabel={total === 1 ? 'Record' : 'Records'}
          onPageChange={setPage}
        />
      </section>

      {/* Internal Slide-Over Inspection Drawer (Fallback when onInspectLog is not provided) */}
      {!onInspectLog && (
        <AuditLogDetailDrawer
          log={internalSelectedLog}
          onClose={() => setInternalSelectedLog(null)}
        />
      )}
    </div>
  );
}
