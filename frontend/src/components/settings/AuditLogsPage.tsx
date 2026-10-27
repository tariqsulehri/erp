'use client';

import { useState } from 'react';
import { IconHistory, IconX } from '@tabler/icons-react';
import { useAuditLogs, type AuditLogRow } from '@/lib/api/audit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SelectField } from '@/components/ui/FormFields';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { friendlyErrorMessage } from '@/lib/erp-utils';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'PASSWORD_RESET', label: 'Password Reset' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'POST', label: 'Post' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'Product', label: 'Product' },
  { value: 'User', label: 'User' },
  { value: 'Category', label: 'Category' },
  { value: 'Brand', label: 'Brand' },
  { value: 'ProductType', label: 'Product Type' },
  { value: 'Size', label: 'Size' },
  { value: 'Color', label: 'Color' },
  { value: 'Origin', label: 'Origin' },
  { value: 'Voucher', label: 'Voucher' },
];

function actionBadgeVariant(action: string): 'success' | 'info' | 'danger' | 'warning' | 'neutral' {
  switch (action.toUpperCase()) {
    case 'CREATE':
      return 'success';
    case 'UPDATE':
      return 'info';
    case 'DELETE':
      return 'danger';
    case 'PASSWORD_RESET':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entityName, setEntityName] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

  const { data, isLoading, error, refetch } = useAuditLogs({
    page,
    limit: 50,
    search: search.trim() || undefined,
    action: action || undefined,
    entity_name: entityName || undefined,
  });

  const logs = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;

  return (
    <main className="page-shell">
      <PageHeader
        title="Audit Log"
        description="A full record of what each user does across the enterprise."
        help={(
          <>
            <p>Audit records are immutable and track user creation, updates, password resets, and product modifications.</p>
            <p>Click on any log row to inspect detailed attribute changes and raw payloads.</p>
          </>
        )}
      />

      <div className={`split-view${selectedLog ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField
                label="Search Audit Logs"
                value={search}
                onChange={v => { setSearch(v); setPage(1); }}
                placeholder="Search by user, email, description, or entity ID…"
              />
            </div>
            <div style={{ width: 160 }}>
              <SelectField
                label="Action Filter"
                value={action}
                options={ACTION_OPTIONS}
                onChange={v => { setAction(v); setPage(1); }}
              />
            </div>
            <div style={{ width: 160 }}>
              <SelectField
                label="Entity Filter"
                value={entityName}
                options={ENTITY_OPTIONS}
                onChange={v => { setEntityName(v); setPage(1); }}
              />
            </div>
            <div className="filter-bar-end">
              <span>{total} {total === 1 ? 'Record' : 'Records'}</span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Timestamp</th>
                  <th style={{ width: 180 }}>User</th>
                  <th style={{ width: 110 }}>Action</th>
                  <th style={{ width: 140 }}>Entity</th>
                  <th>Description</th>
                  <th style={{ width: 110 }}>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Audit Records…" loading />}
                {!isLoading && error && (
                  <TableMessageRow
                    colSpan={6}
                    title="Audit Logs Could Not Be Loaded"
                    description={friendlyErrorMessage(error, 'Please check your connection and try again.')}
                    action={<Button onClick={() => refetch()}>Try Again</Button>}
                  />
                )}
                {!isLoading && !error && logs.length === 0 && (
                  <TableMessageRow
                    colSpan={6}
                    title="No Audit Records Found"
                    description="No actions matching the current search criteria have been recorded yet."
                  />
                )}
                {!isLoading && logs.map(log => {
                  const isSelected = selectedLog?.id === log.id;
                  const date = new Date(log.created_at);
                  const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr
                      key={log.id}
                      className={isSelected ? 'is-selected' : undefined}
                      onClick={() => setSelectedLog(log)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                        {formattedDate}
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
                          <span className="cell-sub" style={{ fontFamily: 'monospace' }}>
                            {log.entity_id.length > 12 ? `${log.entity_id.slice(0, 8)}…` : log.entity_id}
                          </span>
                        )}
                      </td>
                      <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace' }}>
                        {log.ip_address || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar page={page} totalPages={pages} totalRecords={total} onPageChange={setPage} />
        </section>

        {selectedLog && (
          <aside className="panel side-panel" style={{ width: 380, flexShrink: 0 }}>
            <div className="panel-header">
              <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconHistory size={18} stroke={1.8} />
                Audit Record Details
              </h2>
              <Button
                variant="ghost"
                size="sm"
                icon={<IconX size={16} stroke={1.8} />}
                onClick={() => setSelectedLog(null)}
                aria-label="Close Audit Details"
              />
            </div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>ACTION & TIME</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <Badge variant={actionBadgeVariant(selectedLog.action)}>{selectedLog.action}</Badge>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text)' }}>
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>PERFORMED BY</span>
                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedLog.user_name}</p>
                {selectedLog.user_email && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {selectedLog.user_email}
                  </p>
                )}
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>TARGET ENTITY</span>
                <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{selectedLog.entity_name}</p>
                {selectedLog.entity_id && (
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', color: 'var(--color-text-subtle)' }}>
                    ID: {selectedLog.entity_id}
                  </p>
                )}
              </div>

              <div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>DESCRIPTION</span>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)', lineHeight: 1.4 }}>
                  {selectedLog.description || 'No description provided'}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600 }}>METADATA & PAYLOAD</span>
                  <pre
                    style={{
                      margin: '4px 0 0',
                      padding: 12,
                      backgroundColor: 'var(--color-surface-sunken, #f8f9fa)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-size-xs)',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      maxHeight: 250,
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
