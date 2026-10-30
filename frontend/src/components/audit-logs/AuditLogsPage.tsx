'use client';

import { useState } from 'react';
import {
  IconChartBar,
  IconDownload,
  IconList,
  IconRefresh,
} from '@tabler/icons-react';
import {
  useAuditLogs,
  useAuditLogStats,
  type AuditLogRow,
} from '@/lib/api/audit';
import { useGeneralSettings } from '@/lib/api/settings';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { backendGet } from '@/lib/api/backend-client';
import { AuditAnalyticsView } from './AuditAnalyticsView';
import { AuditLogDetailDrawer } from './AuditLogDetailDrawer';
import { AuditLogListView } from './AuditLogListView';
import { AuditTileDrilldownDrawer, type TileDrilldownConfig } from './AuditTileDrilldownDrawer';
import { exportAuditLogsToCsv } from './audit-helpers';

type AuditViewTab = 'dashboard' | 'explorer';

export default function AuditLogsPage() {
  const [activeTab, setActiveTab] = useState<AuditViewTab>('dashboard');
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);
  const [drilldownConfig, setDrilldownConfig] = useState<TileDrilldownConfig | null>(null);

  // Filter state for explorer
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityName, setEntityName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const { data: settings } = useGeneralSettings();
  const statsQuery = useAuditLogStats();

  const logsQuery = useAuditLogs({
    page,
    limit: 50,
    search: search.trim() || undefined,
    action: action || undefined,
    entity_name: entityName || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  });

  const handleRefresh = () => {
    void statsQuery.refetch();
    void logsQuery.refetch();
  };

  const handleResetFilters = () => {
    setSearch('');
    setAction('');
    setEntityName('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleSwitchToExplorer = (filters?: {
    action?: string;
    entity?: string;
    user?: string;
    category?: string;
    fourEyes?: 'all' | 'verified' | 'single';
  }) => {
    if (filters?.action) setAction(filters.action);
    if (filters?.entity) setEntityName(filters.entity);
    if (filters?.user) setSearch(filters.user);
    setPage(1);
    setActiveTab('explorer');
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      // Fetch up to 1000 records matching current search/filter
      const searchParams = new URLSearchParams();
      searchParams.set('page', '1');
      searchParams.set('limit', '1000');
      if (search.trim()) searchParams.set('search', search.trim());
      if (action) searchParams.set('action', action);
      if (entityName) searchParams.set('entity_name', entityName);
      if (fromDate) searchParams.set('from_date', fromDate);
      if (toDate) searchParams.set('to_date', toDate);

      const res = await backendGet<{ data: AuditLogRow[] }>(`/audit-logs?${searchParams.toString()}`);
      if (res?.data) {
        exportAuditLogsToCsv(res.data, `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
      }
    } catch (e) {
      console.error('Failed to export audit logs:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const isFetching = statsQuery.isFetching || logsQuery.isFetching;

  return (
    <main className="page-shell">
      <PageHeader
        title="Audit Logs &amp; Governance"
        description="Immutable enterprise audit trail, user activity telemetry, and security intelligence."
        help={(
          <>
            <p><strong>Analytics Dashboard:</strong> High-level trends, action frequency, target module distribution, and active operators.</p>
            <p><strong>Log Explorer:</strong> Searchable, filterable ledger of all administrative events with deep payload inspection.</p>
            <p>Audit records are immutable and cryptographically bound to authenticated user sessions.</p>
          </>
        )}
        actions={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* View Switcher Segmented Buttons */}
            <div
              style={{
                display: 'inline-flex',
                padding: 2,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: activeTab === 'dashboard' ? 600 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'dashboard' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'dashboard' ? 'var(--color-heading)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === 'dashboard' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <IconChartBar size={15} />
                <span>Analytics Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('explorer')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: activeTab === 'explorer' ? 600 : 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'explorer' ? 'var(--color-surface)' : 'transparent',
                  color: activeTab === 'explorer' ? 'var(--color-heading)' : 'var(--color-text-muted)',
                  boxShadow: activeTab === 'explorer' ? 'var(--shadow-xs)' : 'none',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <IconList size={15} />
                <span>Log Explorer</span>
              </button>
            </div>

            <Button
              variant="secondary"
              icon={<IconDownload size={15} />}
              onClick={handleExportCsv}
              loading={isExporting}
              title="Export records to CSV"
            >
              Export CSV
            </Button>

            <Button
              variant="secondary"
              icon={<IconRefresh size={15} />}
              onClick={handleRefresh}
              loading={isFetching}
              title="Refresh audit telemetry"
            >
              Refresh
            </Button>
          </div>
        )}
      />

      {/* Main Content Area with Smooth Vertical Scroll */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {statsQuery.error && (
          <InlineAlert tone="danger">
            Audit statistics could not be loaded: {statsQuery.error.message}. Please refresh.
          </InlineAlert>
        )}

        {activeTab === 'dashboard' && (
          <>
            {statsQuery.isLoading ? (
              <LoadingState message="Aggregating audit telemetry and activity trends…" minHeight={320} />
            ) : statsQuery.data ? (
              <AuditAnalyticsView
                stats={statsQuery.data}
                settings={settings}
                onInspect={log => setSelectedLog(log)}
                onSwitchToExplorer={handleSwitchToExplorer}
                onTileClick={config => setDrilldownConfig(config)}
              />
            ) : null}
          </>
        )}

        {activeTab === 'explorer' && (
          <AuditLogListView
            logs={logsQuery.data?.data ?? []}
            total={logsQuery.data?.pagination?.total ?? 0}
            pages={logsQuery.data?.pagination?.pages ?? 1}
            page={page}
            isLoading={logsQuery.isLoading}
            error={logsQuery.error}
            search={search}
            action={action}
            entityName={entityName}
            fromDate={fromDate}
            toDate={toDate}
            selectedLog={selectedLog}
            settings={settings}
            onSearchChange={val => { setSearch(val); setPage(1); }}
            onActionChange={val => { setAction(val); setPage(1); }}
            onEntityChange={val => { setEntityName(val); setPage(1); }}
            onFromDateChange={val => { setFromDate(val); setPage(1); }}
            onToDateChange={val => { setToDate(val); setPage(1); }}
            onResetFilters={handleResetFilters}
            onPageChange={setPage}
            onSelectLog={log => setSelectedLog(log)}
            onRefetch={() => void logsQuery.refetch()}
          />
        )}
      </div>

      {/* Detailed Slide-Over Inspection Drawer */}
      <AuditLogDetailDrawer
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
        onFilterUser={userName => handleSwitchToExplorer({ user: userName })}
        onFilterEntity={entity => handleSwitchToExplorer({ entity })}
      />

      {/* Interactive KPI & Category Tile Drilldown Drawer */}
      <AuditTileDrilldownDrawer
        config={drilldownConfig}
        onClose={() => setDrilldownConfig(null)}
        onInspectLog={log => setSelectedLog(log)}
        onOpenInExplorer={handleSwitchToExplorer}
      />
    </main>
  );
}

