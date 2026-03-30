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
import { trpc } from '@/lib/trpc/client';

interface ImportTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

/** Icon badge colours per template code */
const TEMPLATE_COLORS: Record<string, { bg: string; text: string }> = {
  TRADING:       { bg: '#dbeafe', text: '#1d4ed8' },
  MANUFACTURING: { bg: '#fef9c3', text: '#b45309' },
  SERVICES:      { bg: '#dcfce7', text: '#15803d' },
};

export function ImportTemplateModal({ open, onClose, onDone }: ImportTemplateModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  /* ── Data ─────────────────────────────────────────────────────────── */
  const { data: templates, isLoading: loadingTemplates } =
    trpc.accounts.listTemplates.useQuery(undefined, { enabled: open });

  const importMutation = trpc.accounts.importTemplate.useMutation({
    onSuccess: () => {
      onDone();
      onClose();
      setSelected(null);
    },
  });

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleImport = () => {
    if (!selected) return;
    importMutation.mutate({ templateCode: selected });
  };

  const handleClose = () => {
    if (importMutation.isPending) return; // block close during import
    setSelected(null);
    importMutation.reset();
    onClose();
  };

  if (!open) return null;

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)', width: 520, maxWidth: 'calc(100vw - 32px)',
        zIndex: 1001,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Import COA Template
            </h2>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
              Select a template to create all its accounts in your company
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={importMutation.isPending}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', padding: 4, borderRadius: 'var(--radius-sm)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Error */}
          {importMutation.error && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {importMutation.error.message}
            </div>
          )}

          {loadingTemplates ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div className="spinner" />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {templates?.map((t) => {
                const colors = TEMPLATE_COLORS[t.code] ?? { bg: '#f1f5f9', text: '#475569' };
                const isSelected = selected === t.code;
                return (
                  <button
                    key={t.code}
                    onClick={() => setSelected(t.code)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '14px 16px', border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      borderRadius: 'var(--radius)', background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      cursor: 'pointer', textAlign: 'left', transition: 'var(--transition)',
                    }}
                  >
                    {/* Icon badge */}
                    <span style={{
                      flexShrink: 0, width: 38, height: 38, borderRadius: 'var(--radius)',
                      background: colors.bg, color: colors.text,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.6875rem', fontFamily: 'monospace',
                    }}>
                      {t.code.slice(0, 3)}
                    </span>

                    {/* Text */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                          {t.name}
                        </span>
                        <span style={{
                          fontSize: '0.6875rem', fontWeight: 600, padding: '1px 6px',
                          background: colors.bg, color: colors.text, borderRadius: 10,
                        }}>
                          {t.accountCount} accounts
                        </span>
                      </div>
                      <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                        {t.description}
                      </p>
                    </div>

                    {/* Selected checkmark */}
                    {isSelected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" fill="var(--color-primary)"/>
                        <polyline points="8 12 11 15 16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Warning note */}
          <div style={{
            marginTop: 16, padding: '10px 12px', background: '#fefce8',
            borderRadius: 'var(--radius)', border: '1px solid #fde68a',
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#d97706" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 2L2 20h20L12 2zm0 14h-1v-4h1v4zm0 2a1 1 0 110 2 1 1 0 010-2z"/>
            </svg>
            <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
              Accounts that already exist in your company will be skipped. This action cannot be undone.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '16px 24px', borderTop: '1px solid var(--color-border)',
        }}>
          <button className="btn btn-secondary" onClick={handleClose} disabled={importMutation.isPending}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!selected || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)', width: 14, height: 14 }} />
                Importing...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
                Import Template
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
