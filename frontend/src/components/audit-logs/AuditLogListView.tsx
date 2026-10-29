'use client';

import { IconEye, IconRotate, IconX } from '@tabler/icons-react';
import type { AuditLogRow } from '@/lib/api/audit';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatCount } from '@/lib/app-settings';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import {
  ACTION_OPTIONS,
  ENTITY_OPTIONS,
  actionBadgeVariant,
  formatAuditDate,
} from './audit-helpers';

interface AuditLogListViewProps {
  logs: AuditLogRow[];
  total: number;
  pages: number;
  page: number;
  isLoading: boolean;
  error: Error | null;
  search: string;
  action: string;
  entityName: string;
  fromDate: string;
  toDate: string;
  selectedLog: AuditLogRow | null;
  settings?: AppFormatSettingsSource | null;
  onSearchChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onEntityChange: (value: string) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onResetFilters: () => void;
  onPageChange: (page: number) => void;
  onSelectLog: (log: AuditLogRow) => void;
  onRefetch: () => void;
}

export function AuditLogListView({
  logs,
  total,
  pages,
  page,
  isLoading,
  error,
  search,
  action,
  entityName,
  fromDate,
  toDate,
  selectedLog,
  settings,
  onSearchChange,
  onActionChange,
  onEntityChange,
  onFromDateChange,
  onToDateChange,
  onResetFilters,
  onPageChange,
  onSelectLog,
  onRefetch,
}: AuditLogListViewProps) {
  const hasActiveFilters = Boolean(search || action || entityName || fromDate || toDate);

  return (
    <section className="panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Enhanced Filter Bar */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 10, padding: 12 }}>
        <div className="filter-bar-grow" style={{ minWidth: 220 }}>
          <SearchField
            label="Search Audit Trail"
            value={search}
            onChange={onSearchChange}
            placeholder="Search by user, email, description, or entity ID…"
          />
        </div>

        <div style={{ width: 170 }}>
          <SearchableSelect
            placeholder="All Actions"
            ariaLabel="Filter by Action"
            value={action}
            options={ACTION_OPTIONS}
            onChange={onActionChange}
          />
        </div>

        <div style={{ width: 170 }}>
          <SearchableSelect
            placeholder="All Entities"
            ariaLabel="Filter by Entity"
            value={entityName}
            options={ENTITY_OPTIONS}
            onChange={onEntityChange}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            aria-label="From Date"
            value={fromDate}
            onChange={e => onFromDateChange(e.target.value)}
            className="input-field"
            style={{ width: 130, height: 32, fontSize: 'var(--font-size-xs)' }}
          />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>to</span>
          <input
            type="date"
            aria-label="To Date"
            value={toDate}
            onChange={e => onToDateChange(e.target.value)}
            className="input-field"
            style={{ width: 130, height: 32, fontSize: 'var(--font-size-xs)' }}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="secondary"
            size="sm"
            icon={<IconX size={14} />}
            onClick={onResetFilters}
            title="Clear all active filters"
          >
            Clear Filters
          </Button>
        )}

        <div className="filter-bar-end" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          {formatCount(total, settings)} {total === 1 ? 'Record' : 'Records'}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="table-scroll">
        <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 840 }}>
          <thead>
            <tr>
              <th style={{ width: 160 }}>Timestamp</th>
              <th style={{ width: 180 }}>Operator</th>
              <th style={{ width: 110 }}>Action</th>
              <th style={{ width: 140 }}>Entity</th>
              <th>Description</th>
              <th style={{ width: 110 }}>IP Address</th>
              <th style={{ width: 60, textAlign: 'center' }}>Inspect</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableMessageRow colSpan={7} title="Loading Audit Records…" loading />}
            {!isLoading && error && (
              <TableMessageRow
                colSpan={7}
                title="Audit Logs Could Not Be Loaded"
                description={friendlyErrorMessage(error, 'Please check your connection and try again.')}
                action={<Button icon={<IconRotate size={14} />} onClick={onRefetch}>Try Again</Button>}
              />
            )}
            {!isLoading && !error && logs.length === 0 && (
              <TableMessageRow
                colSpan={7}
                title="No Audit Records Found"
                description={hasActiveFilters ? 'No actions match the current filter criteria. Try clearing some filters.' : 'No audit records have been generated yet.'}
                action={hasActiveFilters ? <Button variant="secondary" onClick={onResetFilters}>Clear Filters</Button> : undefined}
              />
            )}
            {!isLoading && logs.map(log => {
              const isSelected = selectedLog?.id === log.id;
              return (
                <tr
                  key={log.id}
                  className={isSelected ? 'is-selected' : undefined}
                  onClick={() => onSelectLog(log)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                    {formatAuditDate(log.created_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="cell-strong">{log.user_name}</span>
                      {log.user_email && <span className="cell-sub">{log.user_email}</span>}
                    </div>
                  </td>
                  <td>
                    <Badge variant={actionBadgeVariant(log.action)}>
                      {log.action}
                    </Badge>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{log.entity_name}</span>
                    {log.entity_id && (
                      <span className="cell-sub" style={{ fontFamily: 'var(--font-code)' }}>
                        {log.entity_id.length > 12 ? `${log.entity_id.slice(0, 8)}…` : log.entity_id}
                      </span>
                    )}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.description || '—'}
                  </td>
                  <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-code)' }}>
                    {log.ip_address || '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn-icon"
                      aria-label="Inspect Log Record"
                      onClick={e => {
                        e.stopPropagation();
                        onSelectLog(log);
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

      <PaginationBar
        page={page}
        totalPages={pages}
        totalRecords={total}
        onPageChange={onPageChange}
      />
    </section>
  );
}
