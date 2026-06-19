'use client';

/**
 * AccountSlideOver
 *
 * Right-side panel for viewing, editing, and managing a single account.
 *
 * Tabs:
 *   Details  — edit name, description, opening balance; activate/deactivate
 *   Clone    — create a sibling account under the same parent
 *   History  — immutable audit trail of all changes
 *
 * Fixes:
 *   - Fetches fresh data via getById so edits are never stale
 *   - Deactivate requires confirmation before executing
 */

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Account } from '@/modules/accounts/account.entity';

/* ── Helpers ─────────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  Asset: '#2563eb', Liability: '#dc2626', Equity: '#7c3aed',
  Revenue: '#16a34a', Expense: '#d97706',
};

const LEVEL_LABEL: Record<number, { label: string; color: string }> = {
  1: { label: 'Category',        color: '#dbeafe' },
  2: { label: 'Group',           color: '#e0e7ff' },
  3: { label: 'Sub-Group',       color: '#f3e8ff' },
  4: { label: 'Posting Account', color: '#dcfce7' },
};

function codeLevel(code: string): number {
  const n = parseInt(code, 10);
  if (n % 1000 === 0) return 1;
  if (n % 100  === 0) return 2;
  if (n % 10   === 0) return 3;
  return 4;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: '0.6875rem', fontWeight: 600, letterSpacing: 0, color: 'var(--color-text-muted)', marginBottom: 4,
      }}>{label}</div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>{children}</div>
    </div>
  );
}

type Tab = 'details' | 'clone' | 'history';

/* ── Details tab ─────────────────────────────────────────────────────── */
function DetailsTab({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [name,        setName]        = useState(account.name);
  const [desc,        setDesc]        = useState(account.description ?? '');
  const [obAmount,    setObAmount]    = useState(account.opening_balance?.toString() ?? '');
  const [obDate,      setObDate]      = useState(
    account.opening_balance_date
      ? new Date(account.opening_balance_date).toISOString().slice(0, 10)
      : '',
  );
  const [dirty,       setDirty]       = useState(false);
  const [saveErr,     setSaveErr]     = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* Reset when account changes */
  useEffect(() => {
    setName(account.name);
    setDesc(account.description ?? '');
    setObAmount(account.opening_balance?.toString() ?? '');
    setObDate(account.opening_balance_date
      ? new Date(account.opening_balance_date).toISOString().slice(0, 10)
      : '');
    setDirty(false);
    setSaveErr('');
  }, [account.id]);

  const utils = trpc.useUtils();

  const updateMutation = trpc.accounts.update.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      utils.accounts.getById.invalidate({ id: account.id });
      utils.accounts.getHierarchy.invalidate();
      setDirty(false);
      setSaveErr('');
      onSaved();
    },
    onError: err => setSaveErr(err.message),
  });

  const toggleMutation = trpc.accounts.toggleActive.useMutation({
    onSuccess: () => {
      utils.accounts.list.invalidate();
      utils.accounts.getById.invalidate({ id: account.id });
      utils.accounts.getHierarchy.invalidate();
      setConfirmOpen(false);
      onSaved();
    },
    onError: err => setSaveErr(err.message),
  });

  const isBusy = updateMutation.isPending || toggleMutation.isPending;

  const handleSave = () => {
    setSaveErr('');
    updateMutation.mutate({
      id:   account.id,
      data: {
        name:                 name.trim(),
        description:          desc.trim() || undefined,
        opening_balance:      obAmount !== '' ? parseFloat(obAmount) : undefined,
        opening_balance_date: obDate || undefined,
      },
    });
  };

  return (
    <>
      {/* Read-only metadata grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        padding: 16, background: 'var(--color-bg)',
        borderRadius: 'var(--radius)', border: '1px solid var(--color-border)',
        marginBottom: 20,
      }}>
        <Field label="Account Type">
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: TYPE_COLOR[account.account_type] ?? '#64748b',
            background: `${TYPE_COLOR[account.account_type] ?? '#64748b'}15`,
            padding: '2px 8px', borderRadius: 4,
          }}>{account.account_type}</span>
        </Field>
        <Field label="Normal Balance">
          <span style={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: account.normal_balance === 'Debit' ? '#1d4ed8' : '#b91c1c',
          }}>{account.normal_balance}</span>
        </Field>
        <Field label="Posting">
          {account.is_posting
            ? <span style={{ color: '#0891b2', fontWeight: 600, fontSize: '0.8125rem' }}>✓ Posting Account</span>
            : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>Header Only</span>}
        </Field>
        <Field label="Status">
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: '0.8125rem', fontWeight: 600,
            color: account.is_active ? '#16a34a' : '#6b7280',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: account.is_active ? '#16a34a' : '#d1d5db',
            }} />
            {account.is_active ? 'Active' : 'Inactive'}
          </span>
        </Field>
      </div>

      {/* Editable fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="form-group">
          <label className="form-label">Account Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
          <input type="text" className="form-input"
            value={name}
            onChange={e => { setName(e.target.value); setDirty(true); }}
            disabled={isBusy} maxLength={100}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span></label>
          <textarea className="form-input"
            value={desc}
            onChange={e => { setDesc(e.target.value); setDirty(true); }}
            disabled={isBusy} rows={2} style={{ resize: 'vertical' }}
            placeholder="Brief description of this account..."
          />
        </div>

        {/* Opening balance — posting accounts only */}
        {account.is_posting && (
          <div style={{
            padding: 14, borderRadius: 'var(--radius)',
            border: '1px solid #bfdbfe', background: '#f0f9ff',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>
              Opening Balance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.6875rem' }}>Amount</label>
                <input type="number" className="form-input"
                  value={obAmount}
                  onChange={e => { setObAmount(e.target.value); setDirty(true); }}
                  disabled={isBusy}
                  placeholder="0.00" step="0.01"
                  style={{ height: 34 }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.6875rem' }}>As of Date</label>
                <input type="date" className="form-input"
                  value={obDate}
                  onChange={e => { setObDate(e.target.value); setDirty(true); }}
                  disabled={isBusy}
                  style={{ height: 34 }}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
              Enter the balance brought forward from your previous system.
            </p>
          </div>
        )}
      </div>

      {saveErr && (
        <div className="alert alert-danger" style={{ marginTop: 14 }}>{saveErr}</div>
      )}

      {/* Footer actions */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn-primary"
          onClick={handleSave}
          disabled={!dirty || isBusy || !name.trim()}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {updateMutation.isPending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
            : 'Save Changes'}
        </button>

        {!account.is_system && (
          <button
            onClick={() => account.is_active ? setConfirmOpen(true) : toggleMutation.mutate({ id: account.id, is_active: true })}
            disabled={isBusy}
            style={{
              width: '100%',
              padding: '8px 16px', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${account.is_active ? 'var(--color-danger)' : '#16a34a'}`,
              background: 'transparent', cursor: 'pointer',
              color: account.is_active ? 'var(--color-danger)' : '#16a34a',
              fontWeight: 600, fontSize: 'var(--font-size-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {toggleMutation.isPending
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Updating…</>
              : account.is_active ? 'Deactivate Account' : 'Activate Account'}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate Account"
        message={`"${account.code} — ${account.name}" will be hidden from transaction dropdowns. You can reactivate it at any time.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate({ id: account.id, is_active: false })}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* ── Clone tab ───────────────────────────────────────────────────────── */
function CloneTab({ account, onCloned }: { account: Account; onCloned: (a: Account) => void }) {
  const [name,  setName]  = useState(`${account.name} (Copy)`);
  const [error, setError] = useState('');

  const utils = trpc.useUtils();

  const cloneMutation = trpc.accounts.clone.useMutation({
    onSuccess: result => {
      utils.accounts.list.invalidate();
      utils.accounts.getHierarchy.invalidate();
      setError('');
      onCloned(result.account as Account);
    },
    onError: err => setError(err.message),
  });

  const level = codeLevel(account.code);

  if (level === 1) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        Top-level category accounts cannot be cloned.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        padding: 14, borderRadius: 'var(--radius)',
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
      }}>
        Creates a new account under the same parent as{' '}
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
          {account.code}
        </span>, with the next available code. Copies type, balance direction, posting flag, and description.
      </div>

      <div className="form-group">
        <label className="form-label">New Account Name <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <input type="text" className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={cloneMutation.isPending}
          maxLength={100}
          autoFocus
        />
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {cloneMutation.data && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius)',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          fontSize: 'var(--font-size-sm)', color: '#16a34a', fontWeight: 600,
        }}>
          ✓ Created as{' '}
          <span style={{ fontFamily: 'monospace' }}>{cloneMutation.data.account.code}</span>
          {' — '}{cloneMutation.data.account.name}
        </div>
      )}

      <button className="btn btn-primary"
        onClick={() => cloneMutation.mutate({ sourceId: account.id, newName: name.trim() })}
        disabled={cloneMutation.isPending || !name.trim()}
        style={{ justifyContent: 'center' }}
      >
        {cloneMutation.isPending
          ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Cloning…</>
          : 'Clone Account'}
      </button>
    </div>
  );
}

/* ── History tab ─────────────────────────────────────────────────────── */
const ACTION_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  created:     { color: '#16a34a', bg: '#f0fdf4', label: 'Created'     },
  updated:     { color: '#2563eb', bg: '#eff6ff', label: 'Updated'     },
  activated:   { color: '#16a34a', bg: '#f0fdf4', label: 'Activated'   },
  deactivated: { color: '#dc2626', bg: '#fef2f2', label: 'Deactivated' },
  cloned:      { color: '#7c3aed', bg: '#f5f3ff', label: 'Cloned'      },
};

function HistoryTab({ accountId }: { accountId: string }) {
  const { data, isLoading, error } = trpc.accounts.getHistory.useQuery({ accountId });

  if (isLoading) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger">{error.message}</div>;
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        No changes recorded yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map(entry => {
        const s = ACTION_STYLE[entry.action] ?? { color: '#6b7280', bg: '#f1f5f9', label: entry.action };
        const changes = entry.changes as Record<string, { from: unknown; to: unknown }> | null;

        return (
          <div key={entry.id} style={{
            padding: 12, borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: changes ? 8 : 0 }}>
              <span style={{
                fontSize: '0.6875rem', fontWeight: 700,
                color: s.color, background: s.bg,
                padding: '2px 8px', borderRadius: 8,
              }}>{s.label}</span>
              {entry.changed_by && (
                <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                  by {entry.changed_by}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>

            {changes && Object.entries(changes).map(([field, diff]) => (
              <div key={field} style={{
                fontSize: '0.6875rem', display: 'flex', alignItems: 'center', gap: 6,
                color: 'var(--color-text-muted)',
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{field}</span>
                <span style={{ color: '#dc2626', textDecoration: 'line-through', fontFamily: 'monospace' }}>
                  {String(diff.from ?? '—')}
                </span>
                <span>→</span>
                <span style={{ color: '#16a34a', fontFamily: 'monospace' }}>
                  {String(diff.to ?? '—')}
                </span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
interface AccountSlideOverProps {
  account:  Account | null;
  onClose:  () => void;
  onSaved:  () => void;
}

export function AccountSlideOver({ account, onClose, onSaved }: AccountSlideOverProps) {
  const [tab, setTab] = useState<Tab>('details');

  /* Fetch fresh account data so the panel is never stale after a save */
  const { data: fresh } = trpc.accounts.getById.useQuery(
    { id: account?.id ?? '' },
    { enabled: !!account?.id },
  );

  /* Use fresh data when available, fall back to prop while loading */
  const current = (fresh ?? account) as Account | null;

  /* Reset to details tab when a different account is opened */
  useEffect(() => { setTab('details'); }, [account?.id]);

  if (!current) return null;

  const color = TYPE_COLOR[current.account_type] ?? '#64748b';
  const level = codeLevel(current.code);
  const levelMeta = LEVEL_LABEL[level];

  const TAB_ITEMS: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details'  },
    { id: 'clone',   label: 'Clone'    },
    { id: 'history', label: 'History'  },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.25)',
        animation: 'fadeIn 0.15s ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, zIndex: 50,
        background: 'var(--color-surface)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.2s ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'monospace', fontWeight: 800, fontSize: '1.125rem',
                color, background: `${color}15`, padding: '2px 10px', borderRadius: 6,
              }}>{current.code}</span>
              <span style={{
                fontSize: '0.6875rem', fontWeight: 600,
                background: levelMeta.color, color: '#374151',
                padding: '2px 8px', borderRadius: 4,
              }}>{levelMeta.label}</span>
              {current.is_system && (
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  color: '#92400e', background: '#fef3c7',
                  padding: '2px 6px', borderRadius: 3,
                }}>SYS</span>
              )}
            </div>
            <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)', wordBreak: 'break-word' }}>
              {current.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', padding: 4, borderRadius: 4,
            display: 'flex', alignItems: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg)',
        }}>
          {TAB_ITEMS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, padding: '10px 0', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 'var(--font-size-xs)', fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              transition: 'all 0.15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {tab === 'details' && <DetailsTab account={current} onSaved={onSaved} />}
          {tab === 'clone'   && <CloneTab   account={current} onCloned={onSaved} />}
          {tab === 'history' && <HistoryTab accountId={current.id} />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn       { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      `}</style>
    </>
  );
}
