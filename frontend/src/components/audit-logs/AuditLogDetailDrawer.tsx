'use client';

import { useState } from 'react';
import { IconCheck, IconCopy, IconFilter, IconUser, IconWorld } from '@tabler/icons-react';
import type { AuditLogRow } from '@/lib/api/audit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { actionBadgeVariant, formatAuditDate } from './audit-helpers';

interface AuditLogDetailDrawerProps {
  log: AuditLogRow | null;
  onClose: () => void;
  onFilterUser?: (userName: string) => void;
  onFilterEntity?: (entityName: string) => void;
}

export function AuditLogDetailDrawer({
  log,
  onClose,
  onFilterUser,
  onFilterEntity,
}: AuditLogDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'formatted' | 'raw'>('formatted');

  if (!log) return null;

  const handleCopy = () => {
    const text = JSON.stringify(log.details ?? log, null, 2);
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailsObj = log.details && typeof log.details === 'object' ? log.details : null;
  const detailKeys = detailsObj ? Object.keys(detailsObj) : [];

  return (
    <Drawer
      open={Boolean(log)}
      title="Audit Log Details"
      size="lg"
      onClose={onClose}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {onFilterUser && log.user_name && (
              <Button
                variant="secondary"
                size="sm"
                icon={<IconUser size={14} />}
                onClick={() => {
                  onFilterUser(log.user_name);
                  onClose();
                }}
              >
                Filter By This User
              </Button>
            )}
            {onFilterEntity && log.entity_name && (
              <Button
                variant="secondary"
                size="sm"
                icon={<IconFilter size={14} />}
                onClick={() => {
                  onFilterEntity(log.entity_name);
                  onClose();
                }}
              >
                Filter By {log.entity_name}
              </Button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Structured Metadata Grid */}
        <section aria-label="Event Overview" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 12,
          padding: 16,
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--color-surface-subtle)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Action Type
            </span>
            <div style={{ marginTop: 4 }}>
              <Badge variant={actionBadgeVariant(log.action)}>{log.action}</Badge>
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Timestamp
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-heading)' }}>
              {formatAuditDate(log.created_at)}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Performed By
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>
              {log.user_name}
            </span>
            {log.user_email && (
              <span style={{ display: 'block', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {log.user_email}
              </span>
            )}
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              IP Address
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-code)', color: 'var(--color-heading)' }}>
              <IconWorld size={14} style={{ color: 'var(--color-text-muted)' }} />
              {log.ip_address || 'Internal System'}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Target Entity
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>
              {log.entity_name}
            </span>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: 'var(--font-size-2xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Entity ID
            </span>
            <span style={{ display: 'block', marginTop: 4, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-code)', color: 'var(--color-text-muted)' }}>
              {log.entity_id || '—'}
            </span>
          </div>
        </section>

        {/* Description Section */}
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Event Description
          </h3>
          <div style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-heading)',
            lineHeight: 1.5,
          }}>
            {log.description || 'No description provided for this audit event.'}
          </div>
        </div>

        {/* Payload / Metadata Viewer */}
        {detailsObj && detailKeys.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('formatted')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: activeTab === 'formatted' ? 600 : 400,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'formatted' ? 'var(--color-surface-subtle)' : 'transparent',
                    color: activeTab === 'formatted' ? 'var(--color-heading)' : 'var(--color-text-muted)',
                  }}
                >
                  Formatted Fields
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('raw')}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: activeTab === 'raw' ? 600 : 400,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'raw' ? 'var(--color-surface-subtle)' : 'transparent',
                    color: activeTab === 'raw' ? 'var(--color-heading)' : 'var(--color-text-muted)',
                  }}
                >
                  Raw JSON
                </button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                icon={copied ? <IconCheck size={14} style={{ color: 'var(--color-success-text)' }} /> : <IconCopy size={14} />}
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy Payload'}
              </Button>
            </div>

            {activeTab === 'formatted' ? (
              <div style={{
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}>
                <table className="data-table" style={{ margin: 0, fontSize: 'var(--font-size-xs)' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 180 }}>Property</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailKeys.map(key => {
                      const val = detailsObj[key];
                      const rendered = typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val);
                      return (
                        <tr key={key}>
                          <td style={{ fontWeight: 600, color: 'var(--color-heading)', fontFamily: 'var(--font-code)' }}>
                            {key}
                          </td>
                          <td style={{ wordBreak: 'break-all', fontFamily: 'var(--font-code)' }}>
                            {rendered}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre
                style={{
                  margin: 0,
                  padding: 14,
                  backgroundColor: 'var(--color-surface-alt)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-code)',
                  overflowX: 'auto',
                  maxHeight: 340,
                  border: '1px solid var(--color-border-subtle)',
                  color: 'var(--color-heading)',
                }}
              >
                {JSON.stringify(detailsObj, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

