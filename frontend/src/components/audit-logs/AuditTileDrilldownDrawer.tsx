'use client';

import { useState } from 'react';
import {
  IconCheck,
  IconExternalLink,
  IconEye,
  IconShieldCheck,
  IconUserCheck,
} from '@tabler/icons-react';
import { useAuditLogs, type AuditLogRow } from '@/lib/api/audit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { actionBadgeVariant, formatAuditDate } from './audit-helpers';

export interface TileDrilldownConfig {
  tileId: string;
  title: string;
  description?: string;
  category?: string;
  action?: string;
  entityName?: string;
  fourEyes?: 'all' | 'verified' | 'single';
  todayOnly?: boolean;
}

interface AuditTileDrilldownDrawerProps {
  config: TileDrilldownConfig | null;
  onClose: () => void;
  onInspectLog: (log: AuditLogRow) => void;
  onOpenInExplorer: (filters: {
    action?: string;
    entity?: string;
    category?: string;
    fourEyes?: 'all' | 'verified' | 'single';
  }) => void;
}

export function AuditTileDrilldownDrawer({
  config,
  onClose,
  onInspectLog,
  onOpenInExplorer,
}: AuditTileDrilldownDrawerProps) {
  const [limit, setLimit] = useState<10 | 20>(20);

  const startOfToday = config?.todayOnly
    ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    : undefined;

  const logsQuery = useAuditLogs({
    page: 1,
    limit,
    action: config?.action,
    category: config?.category,
    entity_name: config?.entityName,
    four_eyes: config?.fourEyes,
    from_date: startOfToday,
  });

  if (!config) return null;

  const rows = logsQuery.data?.data ?? [];
  const totalInDb = logsQuery.data?.pagination?.total ?? 0;

  const handleOpenExplorer = () => {
    onOpenInExplorer({
      action: config.action,
      entity: config.entityName,
      category: config.category,
      fourEyes: config.fourEyes,
    });
    onClose();
  };

  return (
    <Drawer
      open={Boolean(config)}
      title={`Recent Activities: ${config.title}`}
      size="lg"
      onClose={onClose}
      headerActions={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 10 / 20 toggle */}
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
              onClick={() => setLimit(10)}
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: limit === 10 ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: limit === 10 ? 'var(--color-surface)' : 'transparent',
                color: limit === 10 ? 'var(--color-heading)' : 'var(--color-text-muted)',
                boxShadow: limit === 10 ? 'var(--shadow-xs)' : 'none',
              }}
            >
              First 10
            </button>
            <button
              type="button"
              onClick={() => setLimit(20)}
              style={{
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-2xs)',
                fontWeight: limit === 20 ? 600 : 500,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: limit === 20 ? 'var(--color-surface)' : 'transparent',
                color: limit === 20 ? 'var(--color-heading)' : 'var(--color-text-muted)',
                boxShadow: limit === 20 ? 'var(--shadow-xs)' : 'none',
              }}
            >
              First 20
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            icon={<IconExternalLink size={14} />}
            onClick={handleOpenExplorer}
            title="Open filtered dataset in full Log Explorer"
          >
            Log Explorer
          </Button>
        </div>
      )}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>
            Displaying first <strong>{rows.length}</strong> of <strong>{totalInDb}</strong> matching entries in database.
          </span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Context explanation bar */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 'var(--font-size-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: 'var(--color-heading)' }}>Filter Scope:</span>
            <span style={{ color: 'var(--color-text)' }}>
              {config.description ?? config.title}
            </span>
          </div>

          <span
            style={{
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border-subtle)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
              color: 'var(--color-primary)',
            }}
          >
            {totalInDb} total records
          </span>
        </div>

        {logsQuery.isLoading ? (
          <LoadingState message="Retrieving real audit telemetry records from database…" minHeight={240} />
        ) : rows.length === 0 ? (
          <div className="empty-state" style={{ padding: '36px 16px' }}>
            <div className="empty-desc">No activity records found matching this tile filter.</div>
          </div>
        ) : (
          <div className="table-scroll" style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <table className="data-table" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Timestamp</th>
                  <th style={{ width: 170 }}>Operator</th>
                  <th style={{ width: 100 }}>Action</th>
                  <th style={{ width: 120 }}>Entity</th>
                  <th>Description &amp; Four-Eyes Proof</th>
                  <th style={{ width: 100 }}>IP Address</th>
                  <th style={{ width: 70, textAlign: 'right' }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(log => {
                  const isFourEyes = log.four_eyes_verified === true || log.action === 'APPROVE';
                  const isSingleOp = log.single_operator === true;

                  return (
                    <tr
                      key={log.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onInspectLog(log)}
                    >
                      <td className="cell-muted" style={{ whiteSpace: 'nowrap' }}>
                        {formatAuditDate(log.created_at)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="cell-strong" style={{ fontSize: 'var(--font-size-xs)' }}>
                            {log.user_name}
                          </span>
                          {log.user_email && (
                            <span className="cell-sub" style={{ fontSize: 'var(--font-size-2xs)' }}>
                              {log.user_email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{log.entity_name}</span>
                        {log.entity_id && (
                          <span className="cell-sub" style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-2xs)' }}>
                            {log.entity_id.length > 10 ? `${log.entity_id.slice(0, 8)}…` : log.entity_id}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ color: 'var(--color-heading)' }}>
                            {log.description || '—'}
                          </span>

                          {/* Four-Eyes / Maker-Checker governance status indicator */}
                          {isFourEyes && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                                <span>4-Eyes Dual Control</span>
                              </span>
                            </div>
                          )}

                          {isSingleOp && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                                  fontWeight: 500,
                                }}
                              >
                                <IconUserCheck size={12} />
                                <span>Single-Operator Direct</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="cell-muted" style={{ fontFamily: 'var(--font-code)', fontSize: 'var(--font-size-2xs)' }}>
                        {log.ip_address || '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-icon"
                          aria-label="Inspect Log"
                          onClick={e => {
                            e.stopPropagation();
                            onInspectLog(log);
                          }}
                        >
                          <IconEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Drawer>
  );
}
