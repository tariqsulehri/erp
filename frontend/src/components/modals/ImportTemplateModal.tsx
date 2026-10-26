'use client';

/**
 * ImportTemplateModal
 *
 * Displays available COA templates and lets the admin pick one to import.
 * All accounts from the selected template are created in the current company.
 *
 * Props:
 *   open    — controls visibility
 *   onClose — called when the modal should close (cancel or success)
 *   onDone  — called after a successful import so the parent can refetch
 */

import { useState } from 'react';
import { IconCircleCheckFilled, IconDownload, IconX } from '@tabler/icons-react';
import { useAccountTemplates, useImportAccountTemplate } from '@/lib/api/accounts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';

interface ImportTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function ImportTemplateModal({ open, onClose, onDone }: ImportTemplateModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  /* ── Data ─────────────────────────────────────────────────────────── */
  const { data: templates, isLoading: loadingTemplates } =
    useAccountTemplates(open);

  const importMutation = useImportAccountTemplate();

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleImport = () => {
    if (!selected) return;
    importMutation.mutate({ templateCode: selected }, {
      onSuccess: () => {
        onDone();
        onClose();
        setSelected(null);
      },
    });
  };

  const handleClose = () => {
    if (importMutation.isPending) return; // block close during import
    setSelected(null);
    onClose();
  };

  if (!open) return null;

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) handleClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="import-template-title" style={{ maxWidth: 560 }}>
        <div className="panel-header" style={{ padding: '14px 20px' }}>
          <div>
            <h2 id="import-template-title" className="dialog-title" style={{ margin: 0 }}>Import Chart Of Accounts Template</h2>
            <p className="dialog-message">Choose a template to create all of its accounts in your company.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={handleClose} disabled={importMutation.isPending} aria-label="Close" title="Close" />
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {importMutation.error && <InlineAlert tone="danger">{importMutation.error.message}</InlineAlert>}

          {loadingTemplates ? (
            <div className="loading-overlay" style={{ padding: 32 }}><div className="spinner" /></div>
          ) : (
            <div role="radiogroup" aria-label="Templates" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {templates?.map(t => {
                const isSelected = selected === t.code;
                return (
                  <button
                    key={t.code}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(t.code)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px',
                      border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      boxShadow: isSelected ? '0 0 0 1px var(--color-primary)' : 'none',
                      borderRadius: 'var(--radius-lg)',
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: 'var(--color-text)',
                      textAlign: 'left',
                      transition: 'background var(--transition), border-color var(--transition)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-md)', color: 'var(--color-heading)' }}>{t.name}</span>
                        <Badge variant="neutral">{t.accountCount} Accounts</Badge>
                      </div>
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>{t.description}</p>
                    </div>
                    {isSelected && <IconCircleCheckFilled size={20} aria-hidden style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}

          <InlineAlert tone="warning">Accounts that already exist in your company are skipped. This import cannot be undone.</InlineAlert>
        </div>

        <div className="dialog-footer">
          <Button variant="secondary" onClick={handleClose} disabled={importMutation.isPending}>Cancel</Button>
          <Button variant="primary" icon={<IconDownload size={16} stroke={1.8} />} onClick={handleImport} disabled={!selected} loading={importMutation.isPending}>
            {importMutation.isPending ? 'Importing…' : 'Import Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}
