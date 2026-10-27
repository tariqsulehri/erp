'use client';

/**
 * AccountSlideOver
 *
 * Side panel (beside the accounts list, not a modal) for viewing, editing, and managing a single account.
 * The parent places it inside `.split-view.has-side`.
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

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowRight, IconBan, IconCheck, IconCopy, IconX } from '@tabler/icons-react';
import {
  accountsQueryKey,
  useAccountDetail,
  useAccountHistory,
  useCloneAccount,
  useToggleAccountActive,
  useUpdateAccount,
  type AccountListItem,
} from '@/lib/api/accounts';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Tabs } from '@/components/ui/Tabs';
import { getAccountLevel, getAccountLevelLabel } from '@/modules/accounts/account-code';
import { accountTypeBadge } from '@/lib/ui/account-category-colors';

/* ── Helpers ─────────────────────────────────────────────────────────── */
function codeLevel(code: string): number {
  return getAccountLevel(code);
}

type Tab = 'details' | 'clone' | 'history';

const TAB_ITEMS: { value: Tab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'clone',   label: 'Copy'    },
  { value: 'history', label: 'History' },
];

/* ── Details tab ─────────────────────────────────────────────────────── */
function DetailsTab({ account, onSaved }: { account: AccountListItem; onSaved: () => void }) {
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

  /* Reset the form when a different account is opened (React's "adjust state while rendering" pattern). */
  const [loadedAccountId, setLoadedAccountId] = useState(account.id);
  if (loadedAccountId !== account.id) {
    setLoadedAccountId(account.id);
    setName(account.name);
    setDesc(account.description ?? '');
    setObAmount(account.opening_balance?.toString() ?? '');
    setObDate(account.opening_balance_date
      ? new Date(account.opening_balance_date).toISOString().slice(0, 10)
      : '');
    setDirty(false);
    setSaveErr('');
  }

  const queryClient = useQueryClient();

  const updateMutation = useUpdateAccount();
  const toggleMutation = useToggleAccountActive();

  const refreshAccountData = () => {
    queryClient.invalidateQueries({ queryKey: accountsQueryKey });
    onSaved();
  };

  const isBusy = updateMutation.isPending || toggleMutation.isPending;

  const handleSave = () => {
    setSaveErr('');
    updateMutation.mutate(
      {
        id: account.id,
        data: {
          name: name.trim(),
          description: desc.trim() || null,
          opening_balance: obAmount !== '' ? parseFloat(obAmount) : null,
          opening_balance_date: obDate || null,
        },
      },
      {
        onSuccess: () => {
          refreshAccountData();
          setDirty(false);
          setSaveErr('');
        },
        onError: error => setSaveErr(error.message),
      },
    );
  };

  const toggleActive = (isActive: boolean) => {
    toggleMutation.mutate(
      { id: account.id, is_active: isActive },
      {
        onSuccess: () => {
          refreshAccountData();
          setConfirmOpen(false);
        },
        onError: error => setSaveErr(error.message),
      },
    );
  };

  return (
    <>
      <div className="panel-body">
        {saveErr && <InlineAlert tone="danger">{saveErr}</InlineAlert>}

        {/* Read-only facts */}
        <dl className="detail-list" style={{ margin: 0 }}>
          <div className="detail-row">
            <dt>Account Type</dt>
            <dd><Badge variant={accountTypeBadge(account.account_type)}>{account.account_type}</Badge></dd>
          </div>
          <div className="detail-row">
            <dt>Normal Balance</dt>
            <dd>{account.normal_balance}</dd>
          </div>
          <div className="detail-row">
            <dt>Account Kind</dt>
            <dd>{account.is_posting ? 'Posting Account' : 'Heading Only'}</dd>
          </div>
          <div className="detail-row">
            <dt>Status</dt>
            <dd><Badge variant={account.is_active ? 'success' : 'neutral'}>{account.is_active ? 'Active' : 'Inactive'}</Badge></dd>
          </div>
        </dl>

        {/* Editable fields */}
        <TextField
          label="Account Name"
          required
          value={name}
          onChange={value => { setName(value); setDirty(true); }}
          disabled={isBusy}
          inputProps={{ maxLength: 100 }}
        />
        <TextareaField
          label="Description"
          value={desc}
          onChange={value => { setDesc(value); setDirty(true); }}
          disabled={isBusy}
          rows={2}
          placeholder="Short note about what this account is for"
          style={{ resize: 'vertical' }}
        />

        {/* Opening balance — posting accounts only */}
        {account.is_posting && (
          <div className="form-section" style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
            <h3 className="form-section-title">Opening Balance</h3>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <TextField
                label="Amount"
                value={obAmount}
                onChange={value => { setObAmount(value); setDirty(true); }}
                disabled={isBusy}
                placeholder="0.00"
                inputProps={{ type: 'number', step: '0.01', inputMode: 'decimal' }}
                style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              />
              <DateField
                label="As Of Date"
                value={obDate}
                onChange={value => { setObDate(value); setDirty(true); }}
                disabled={isBusy}
              />
            </div>
            <p className="form-hint">Enter the balance brought forward from your previous system.</p>
          </div>
        )}
      </div>

      <div className="panel-footer">
        {!account.is_system && (
          <Button
            icon={account.is_active ? <IconBan size={16} stroke={1.8} /> : <IconCheck size={16} stroke={1.8} />}
            onClick={() => account.is_active ? setConfirmOpen(true) : toggleActive(true)}
            disabled={updateMutation.isPending}
            loading={toggleMutation.isPending}
            style={{ marginRight: 'auto' }}
          >
            {account.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!dirty || toggleMutation.isPending || !name.trim()}
          loading={updateMutation.isPending}
        >
          Save Changes
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Deactivate Account"
        message={`"${account.code} — ${account.name}" will no longer show in lists on new transactions. You can make it active again at any time.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={toggleMutation.isPending}
        onConfirm={() => toggleActive(false)}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/* ── Clone tab ───────────────────────────────────────────────────────── */
function CloneTab({ account, onCloned }: { account: AccountListItem; onCloned: (a: AccountListItem) => void }) {
  const [name,  setName]  = useState(`${account.name} (Copy)`);
  const [error, setError] = useState('');

  const queryClient = useQueryClient();

  const cloneMutation = useCloneAccount();

  const level = codeLevel(account.code);

  if (level === 1) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <div className="empty-title">Cannot Copy A Main Category</div>
          <div className="empty-desc">You cannot copy a Main Category account. Open a Group, Sub-Group, or Posting Account instead.</div>
        </div>
      </div>
    );
  }

  const runClone = () => cloneMutation.mutate(
    { sourceId: account.id, newName: name.trim() },
    {
      onSuccess: result => {
        queryClient.invalidateQueries({ queryKey: accountsQueryKey });
        setError('');
        onCloned(result.account);
      },
      onError: error => setError(error.message),
    },
  );

  return (
    <>
      <div className="panel-body">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {cloneMutation.data && (
          <InlineAlert tone="success">
            Created as{' '}
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{cloneMutation.data.account.code}</span>
            {' — '}{cloneMutation.data.account.name}.
          </InlineAlert>
        )}

        <p className="form-hint" style={{ margin: 0, fontSize: 'var(--font-size-sm)' }}>
          Creates a new account under the same parent as{' '}
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-heading)' }}>{account.code}</span>,
          with the next free code. It copies the type, normal balance, Posting Account setting, and description.
        </p>

        <TextField
          label="New Account Name"
          required
          value={name}
          onChange={setName}
          disabled={cloneMutation.isPending}
          inputProps={{ maxLength: 100, autoFocus: true }}
        />
      </div>

      <div className="panel-footer">
        <Button
          variant="primary"
          icon={<IconCopy size={16} stroke={1.8} />}
          onClick={runClone}
          disabled={!name.trim()}
          loading={cloneMutation.isPending}
        >
          Copy Account
        </Button>
      </div>
    </>
  );
}

/* ── History tab ─────────────────────────────────────────────────────── */
const ACTION_STYLE: Record<string, { variant: 'success' | 'info' | 'danger' | 'neutral'; label: string }> = {
  created:     { variant: 'success', label: 'Created'     },
  updated:     { variant: 'info',    label: 'Updated'     },
  activated:   { variant: 'success', label: 'Activated'   },
  deactivated: { variant: 'danger',  label: 'Deactivated' },
  cloned:      { variant: 'neutral', label: 'Copied'      },
};

function HistoryTab({ accountId }: { accountId: string }) {
  const { data, isLoading, error } = useAccountHistory(accountId);
  const { data: generalSettings } = useGeneralSettings();

  const formatWhen = (value: string) => {
    const time = new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${formatDate(value, generalSettings)} ${time}`;
  };

  if (isLoading) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <span className="spinner" aria-hidden />
          <div className="empty-title">Loading History…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-body">
        <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Could not load account history. Please try again.')}</InlineAlert>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <div className="empty-title">No Changes Yet</div>
          <div className="empty-desc">Changes to this account will be listed here.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-body" style={{ gap: 8 }}>
      {data.map(entry => {
        const s = ACTION_STYLE[entry.action] ?? { variant: 'neutral' as const, label: entry.action };
        const changes = entry.changes as Record<string, { from: unknown; to: unknown }> | null;

        return (
          <div key={entry.id} style={{
            padding: '10px 12px', borderRadius: 'var(--radius)',
            border: '1px solid var(--color-border-subtle)', background: 'var(--color-surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: changes ? 8 : 0, flexWrap: 'wrap' }}>
              <Badge variant={s.variant}>{s.label}</Badge>
              {entry.changed_by && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  By {entry.changed_by}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {formatWhen(entry.created_at)}
              </span>
            </div>

            {changes && Object.entries(changes).map(([field, diff]) => (
              <div key={field} style={{
                fontSize: 'var(--font-size-xs)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                color: 'var(--color-text-muted)', lineHeight: 1.6,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{field}</span>
                <span style={{ textDecoration: 'line-through' }}>{String(diff.from ?? 'Not Set')}</span>
                <IconArrowRight size={14} stroke={1.8} aria-label="changed to" />
                <span style={{ color: 'var(--color-heading)', fontWeight: 500 }}>{String(diff.to ?? 'Not Set')}</span>
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
  account:  AccountListItem | null;
  onClose:  () => void;
  onSaved:  () => void;
}

export function AccountSlideOver({ account, onClose, onSaved }: AccountSlideOverProps) {
  const [tab, setTab] = useState<Tab>('details');

  /* Fetch fresh account data so the panel is never stale after a save */
  const { data: fresh } = useAccountDetail(account?.id, Boolean(account?.id));

  /* Use fresh data when available, fall back to prop while loading */
  const current = (fresh ?? account) as AccountListItem | null;

  /* Reset to details tab when a different account is opened */
  useEffect(() => { setTab('details'); }, [account?.id]);

  if (!current) return null;

  return (
    <aside className="panel side-panel" aria-label={`Account ${current.code}`}>
      {/* Header */}
      <div className="panel-header" style={{ alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <h2 className="panel-title" style={{ overflowWrap: 'anywhere' }}>{current.name}</h2>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4,
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)',
          }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)', fontWeight: 500 }}>{current.code}</span>
            <span aria-hidden>·</span>
            <span>{getAccountLevelLabel(current.code)}</span>
            {current.is_system && <Badge variant="info" title="System Account. It cannot be deactivated.">System</Badge>}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<IconX size={16} stroke={1.8} />}
          onClick={onClose}
          aria-label="Close Account Panel"
          title="Close Panel"
        />
      </div>

      <Tabs label="Account Panel Sections" value={tab} onChange={setTab} items={TAB_ITEMS} />

      {tab === 'details' && <DetailsTab account={current} onSaved={onSaved} />}
      {tab === 'clone'   && <CloneTab   account={current} onCloned={onSaved} />}
      {tab === 'history' && <HistoryTab accountId={current.id} />}
    </aside>
  );
}
