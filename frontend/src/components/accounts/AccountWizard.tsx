'use client';

/**
 * AccountWizard
 *
 * 4-step guided account creation:
 *   Step 1 — Pick Category   (X000 accounts)
 *   Step 2 — Pick Group      (XX00 accounts under selected category)
 *   Step 3 — Pick Sub-Group  (XXX0 accounts under selected group)
 *   Step 4 — Enter details   (code auto-assigned; user provides name)
 *
 * At steps 2 & 3 the user can also create a new header account inline.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import type { Account } from '@/modules/accounts/account.entity';

/* ── colour palette per account type ──────────────────────────────── */
const TYPE_COLOR: Record<string, string> = {
  Asset:     '#2563eb',
  Liability: '#dc2626',
  Equity:    '#7c3aed',
  Revenue:   '#16a34a',
  Expense:   '#d97706',
};

const CATEGORY_ICON: Record<string, string> = {
  '1000': '🏦',
  '2000': '📋',
  '3000': '📊',
  '4000': '💰',
  '5000': '💸',
};

/* ── Step progress bar ─────────────────────────────────────────────── */
const STEPS = ['Category', 'Group', 'Sub-Group', 'Account Details'];

function StepBar({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {STEPS.map((label, i) => {
        const num   = i + 1;
        const done  = num < current;
        const active = num === current;
        const color  = done || active ? 'var(--color-primary)' : 'var(--color-border)';

        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : undefined }}>
            {/* Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: done ? 'var(--color-primary)' : active ? 'var(--color-primary)' : 'var(--color-surface)',
                border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
                color: done || active ? 'white' : 'var(--color-text-muted)',
                flexShrink: 0,
              }}>
                {done ? '✓' : num}
              </div>
              <span style={{
                fontSize: '0.6875rem', fontWeight: active ? 700 : 400,
                color: active ? 'var(--color-primary)' : done ? 'var(--color-text)' : 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 6px', marginBottom: 20,
                background: done ? 'var(--color-primary)' : 'var(--color-border)',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Breadcrumb trail ──────────────────────────────────────────────── */
interface BreadcrumbProps {
  category: Account | null;
  group:    Account | null;
  subgroup: Account | null;
  onBack:   (step: number) => void;
}

function Breadcrumb({ category, group, subgroup, onBack }: BreadcrumbProps) {
  if (!category) return null;

  const items: { label: string; step: number }[] = [
    { label: `${category.code} ${category.name}`, step: 1 },
  ];
  if (group)    items.push({ label: `${group.code} ${group.name}`, step: 2 });
  if (subgroup) items.push({ label: `${subgroup.code} ${subgroup.name}`, step: 3 });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      marginBottom: 20, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)',
    }}>
      {items.map((item, i) => (
        <span key={item.step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <span>›</span>}
          <button
            onClick={() => onBack(item.step)}
            style={{
              border: 'none', padding: '2px 6px',
              cursor: 'pointer', borderRadius: 4,
              background: 'var(--color-primary-light)', color: 'var(--color-primary)',
              fontFamily: 'monospace', fontWeight: 600, fontSize: 'var(--font-size-xs)',
            }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}

/* ── Account selection card ─────────────────────────────────────────── */
interface AccountCardProps {
  account:  Account;
  selected: boolean;
  onClick:  () => void;
}

function AccountCard({ account, selected, onClick }: AccountCardProps) {
  const color = TYPE_COLOR[account.account_type] ?? '#64748b';
  const num   = parseInt(account.code, 10);
  const level = num % 1000 === 0 ? 1 : num % 100 === 0 ? 2 : 3;

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        padding: '14px 16px', borderRadius: 'var(--radius)',
        border: `2px solid ${selected ? color : 'var(--color-border)'}`,
        background: selected ? `${color}08` : 'var(--color-surface)',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'all 0.15s', outline: 'none',
        boxShadow: selected ? `0 0 0 3px ${color}20` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        {level === 1 && (
          <span style={{ fontSize: 18 }}>
            {CATEGORY_ICON[account.code] ?? '📁'}
          </span>
        )}
        <span style={{
          fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem',
          color, background: `${color}15`, padding: '2px 8px', borderRadius: 4,
        }}>
          {account.code}
        </span>
        <span style={{
          fontWeight: 600, fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text)', flex: 1,
        }}>
          {account.name}
        </span>
        {selected && (
          <span style={{
            width: 18, height: 18, borderRadius: '50%',
            background: color, color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>✓</span>
        )}
      </div>
      {account.description && (
        <span style={{
          marginTop: 6, fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)', paddingLeft: level === 1 ? 26 : 0,
        }}>
          {account.description}
        </span>
      )}
    </button>
  );
}

/* ── Inline "Create New" card ──────────────────────────────────────── */
interface NewAccountCardProps {
  parentCode:    string;
  parentType:    string;
  parentBalance: 'Debit' | 'Credit';
  isPosting:     boolean;
  label:         string;
  onCreated:     (account: Account) => void;
}

function NewAccountCard({
  parentCode, parentType, parentBalance, isPosting, label, onCreated,
}: NewAccountCardProps) {
  const [open,  setOpen]  = useState(false);
  const [name,  setName]  = useState('');
  const [error, setError] = useState('');

  const utils = trpc.useUtils();

  const nextCodeQuery = trpc.accounts.getNextCode.useQuery(
    { parentCode },
    { enabled: open },
  );

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: (result) => {
      utils.accounts.getChildren.invalidate({ parentCode });
      setOpen(false);
      setName('');
      setError('');
      onCreated(result.account as Account);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const nextCode = nextCodeQuery.data?.code;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!nextCode)    { setError('No available code in this range'); return; }
    setError('');
    createMutation.mutate({
      code:           nextCode,
      name:           name.trim(),
      account_type:   parentType as any,
      normal_balance: parentBalance,
      is_posting:     isPosting,
      is_system:      false,
    });
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '14px 16px', borderRadius: 'var(--radius)',
          border: '2px dashed var(--color-border)',
          background: 'transparent', cursor: 'pointer', width: '100%',
          color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
          fontWeight: 500, transition: 'all 0.15s',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'var(--color-border)', color: 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, flexShrink: 0,
        }}>+</span>
        {label}
      </button>
    );
  }

  return (
    <div style={{
      padding: '16px', borderRadius: 'var(--radius)',
      border: '2px dashed var(--color-primary)',
      background: 'var(--color-primary-light)',
    }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{
            fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem',
            color: 'var(--color-primary)', background: 'white',
            padding: '2px 8px', borderRadius: 4, border: '1px solid #bfdbfe',
          }}>
            {nextCode ?? '—'}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
            Auto-assigned code
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            type="text"
            className="form-input"
            placeholder="Account name..."
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ flex: 1 }}
            disabled={createMutation.isPending}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMutation.isPending || !nextCode}
            style={{ whiteSpace: 'nowrap' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create & Select'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setOpen(false); setName(''); setError(''); }}
            disabled={createMutation.isPending}
          >
            Cancel
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-danger)' }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

/* ── Loading / Empty states ─────────────────────────────────────────── */
function LoadingCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: 56, borderRadius: 'var(--radius)',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          animation: 'pulse 1.5s infinite',
        }} />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: '32px 16px', textAlign: 'center',
      color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)',
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        style={{ marginBottom: 8, opacity: 0.4 }}>
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <p>{message}</p>
    </div>
  );
}

/* ── Step 4 — Account Details Form ──────────────────────────────────── */
interface DetailsStepProps {
  subgroup:  Account;
  onSuccess: (account: Account) => void;
}

function DetailsStep({ subgroup, onSuccess }: DetailsStepProps) {
  const [name,    setName]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [obAmt,   setObAmt]   = useState('');
  const [obDate,  setObDate]  = useState('');
  const [error,   setError]   = useState('');

  const nextCodeQuery = trpc.accounts.getNextCode.useQuery({ parentCode: subgroup.code });
  const nextCode      = nextCodeQuery.data?.code;

  const createMutation = trpc.accounts.create.useMutation({
    onSuccess: (result) => onSuccess(result.account as Account),
    onError:   (err)    => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Account name is required'); return; }
    if (!nextCode)    { setError('No available code under this sub-group'); return; }
    setError('');
    createMutation.mutate({
      code:                 nextCode,
      name:                 name.trim(),
      description:          desc.trim() || undefined,
      account_type:         subgroup.account_type as any,
      normal_balance:       subgroup.normal_balance,
      is_posting:           true,
      is_system:            false,
      opening_balance:      obAmt !== '' ? parseFloat(obAmt) : undefined,
      opening_balance_date: obDate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Auto-assigned code preview */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', borderRadius: 'var(--radius)',
        background: 'var(--color-primary-light)', border: '1px solid #bfdbfe',
        marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600, marginBottom: 2 }}>
            Auto-assigned Account Code
          </div>
          <div style={{
            fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem',
            color: 'var(--color-primary)', letterSpacing: '0.1em',
          }}>
            {nextCodeQuery.isLoading ? '…' : (nextCode ?? 'Full — no slots available')}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>
            Type / Balance
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
            {subgroup.account_type} · {subgroup.normal_balance}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">
          Account Name <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <input
          autoFocus
          type="text"
          className="form-input"
          placeholder="e.g. Cash in Hand"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={createMutation.isPending}
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label className="form-label">Description <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
        <textarea
          className="form-input"
          placeholder="Brief description of this account..."
          value={desc}
          onChange={e => setDesc(e.target.value)}
          disabled={createMutation.isPending}
          rows={2}
          style={{ resize: 'vertical' }}
        />
      </div>

      {/* Opening Balance */}
      <div style={{
        padding: '14px 16px', borderRadius: 'var(--radius)',
        border: '1px solid #bfdbfe', background: '#f0f9ff', marginBottom: 20,
      }}>
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 10 }}>
          Opening Balance <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optional)</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.6875rem' }}>Amount</label>
            <input type="number" className="form-input"
              placeholder="0.00" step="0.01"
              value={obAmt}
              onChange={e => setObAmt(e.target.value)}
              disabled={createMutation.isPending}
              style={{ height: 34 }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: '0.6875rem' }}>As of Date</label>
            <input type="date" className="form-input"
              value={obDate}
              onChange={e => setObDate(e.target.value)}
              disabled={createMutation.isPending}
              style={{ height: 34 }}
            />
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
          Balance brought forward from your previous system. Can be set later in account details.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={createMutation.isPending || !nextCode || nextCodeQuery.isLoading}
        style={{ width: '100%', justifyContent: 'center', padding: '10px 0' }}
      >
        {createMutation.isPending ? (
          <>
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Creating Account…
          </>
        ) : (
          'Create Posting Account'
        )}
      </button>
    </form>
  );
}

/* ── Main Wizard ─────────────────────────────────────────────────────── */
interface AccountWizardProps {
  onSuccess: (account: Account) => void;
}

export function AccountWizard({ onSuccess }: AccountWizardProps) {
  const [step,     setStep]     = useState(1);
  const [category, setCategory] = useState<Account | null>(null);
  const [group,    setGroup]    = useState<Account | null>(null);
  const [subgroup, setSubgroup] = useState<Account | null>(null);

  const utils = trpc.useUtils();

  /* Queries */
  const categoriesQ = trpc.accounts.getTopLevel.useQuery();
  const groupsQ     = trpc.accounts.getChildren.useQuery(
    { parentCode: category?.code ?? '' },
    { enabled: !!category },
  );
  const subgroupsQ  = trpc.accounts.getChildren.useQuery(
    { parentCode: group?.code ?? '' },
    { enabled: !!group },
  );

  /* Back-navigation: reset downstream selections */
  const goBack = (toStep: number) => {
    if (toStep === 1) { setCategory(null); setGroup(null); setSubgroup(null); }
    if (toStep === 2) { setGroup(null); setSubgroup(null); }
    if (toStep === 3) { setSubgroup(null); }
    setStep(toStep);
  };

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <div>
      <StepBar current={step} />

      <Breadcrumb
        category={category}
        group={group}
        subgroup={subgroup}
        onBack={goBack}
      />

      {/* ── Step 1: Category ─────────────────────────────────── */}
      {step === 1 && (
        <div>
          <p style={{
            marginBottom: 16, fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-muted)',
          }}>
            Select the top-level category for the new account.
          </p>
          {categoriesQ.isLoading && <LoadingCards />}
          {categoriesQ.error && (
            <div className="alert alert-danger">{categoriesQ.error.message}</div>
          )}
          {categoriesQ.data && categoriesQ.data.length === 0 && (
            <EmptyState message="No categories found. Please import a COA template first." />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(categoriesQ.data ?? []).map(acct => (
              <AccountCard
                key={acct.id}
                account={acct}
                selected={category?.id === acct.id}
                onClick={() => {
                  setCategory(acct);
                  setGroup(null);
                  setSubgroup(null);
                  setStep(2);
                  utils.accounts.getChildren.prefetch({ parentCode: acct.code });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Group ────────────────────────────────────── */}
      {step === 2 && category && (
        <div>
          <p style={{ marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Select a group under <strong>{category.code} {category.name}</strong>, or create a new one.
          </p>
          {groupsQ.isLoading && <LoadingCards />}
          {groupsQ.error && (
            <div className="alert alert-danger">{groupsQ.error.message}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(groupsQ.data ?? []).map(acct => (
              <AccountCard
                key={acct.id}
                account={acct}
                selected={group?.id === acct.id}
                onClick={() => {
                  setGroup(acct);
                  setSubgroup(null);
                  setStep(3);
                  utils.accounts.getChildren.prefetch({ parentCode: acct.code });
                }}
              />
            ))}
            <NewAccountCard
              parentCode={category.code}
              parentType={category.account_type}
              parentBalance={category.normal_balance}
              isPosting={false}
              label="Create New Group"
              onCreated={(newAcct) => {
                setGroup(newAcct);
                setSubgroup(null);
                setStep(3);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Step 3: Sub-Group ────────────────────────────────── */}
      {step === 3 && group && (
        <div>
          <p style={{ marginBottom: 16, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Select a sub-group under <strong>{group.code} {group.name}</strong>, or create a new one.
          </p>
          {subgroupsQ.isLoading && <LoadingCards />}
          {subgroupsQ.error && (
            <div className="alert alert-danger">{subgroupsQ.error.message}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(subgroupsQ.data ?? []).map(acct => (
              <AccountCard
                key={acct.id}
                account={acct}
                selected={subgroup?.id === acct.id}
                onClick={() => {
                  setSubgroup(acct);
                  setStep(4);
                }}
              />
            ))}
            <NewAccountCard
              parentCode={group.code}
              parentType={group.account_type}
              parentBalance={group.normal_balance}
              isPosting={false}
              label="Create New Sub-Group"
              onCreated={(newAcct) => {
                setSubgroup(newAcct);
                setStep(4);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Step 4: Account Details ──────────────────────────── */}
      {step === 4 && subgroup && (
        <div>
          <p style={{ marginBottom: 20, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
            Enter the name for the new posting account under{' '}
            <strong>{subgroup.code} {subgroup.name}</strong>.
          </p>
          <DetailsStep subgroup={subgroup} onSuccess={onSuccess} />
        </div>
      )}

      {/* ── Back button ──────────────────────────────────────── */}
      {step > 1 && (
        <button
          onClick={() => goBack(step - 1)}
          className="btn btn-secondary"
          style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
      )}
    </div>
  );
}
