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
 * At steps 2 and 3 the user can also create a new header account inline.
 */

import { Fragment, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft, IconCheck, IconChevronRight, IconPlus } from '@tabler/icons-react';
import {
  accountsQueryKey,
  useChildAccounts,
  useCreateAccount,
  useNextAccountCode,
  useTopLevelAccounts,
  type AccountListItem,
  type CreateAccountInput,
} from '@/lib/api/accounts';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { DateField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';

type Account = AccountListItem;
type NormalBalance = 'Debit' | 'Credit';
type AccountType = CreateAccountInput['account_type'];

/* ── Step progress ─────────────────────────────────────────────────── */
const STEPS = ['Category', 'Group', 'Sub-Group', 'Account Details'];

function StepBar({ current }: { current: number }) {
  return (
    <ol aria-label="Steps" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 20px', padding: 0, listStyle: 'none', flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const num    = i + 1;
        const done   = num < current;
        const active = num === current;

        return (
          <li
            key={label}
            aria-current={active ? 'step' : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flex: i < STEPS.length - 1 ? '1 1 0' : undefined, minWidth: 0 }}
          >
            <span style={{
              width: 24, height: 24, borderRadius: 'var(--radius-full)', flexShrink: 0,
              display: 'inline-grid', placeItems: 'center',
              fontSize: 'var(--font-size-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
              border: '1px solid',
              borderColor: active ? 'var(--color-primary)' : done ? 'var(--color-primary)' : 'var(--color-border)',
              background: active ? 'var(--color-primary)' : done ? 'var(--color-primary-light)' : 'var(--color-surface)',
              color: active ? 'var(--color-on-primary)' : done ? 'var(--color-primary-text)' : 'var(--color-text-muted)',
            }}>
              {done ? <IconCheck size={14} stroke={1.8} aria-label="Done" /> : num}
            </span>
            <span style={{
              fontSize: 'var(--font-size-sm)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
              color: active ? 'var(--color-heading)' : 'var(--color-text-muted)',
            }}>
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span aria-hidden style={{ flex: 1, minWidth: 16, height: 1, background: 'var(--color-border)' }} />
            )}
          </li>
        );
      })}
    </ol>
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

  const items: { account: Account; step: number }[] = [{ account: category, step: 1 }];
  if (group)    items.push({ account: group, step: 2 });
  if (subgroup) items.push({ account: subgroup, step: 3 });

  return (
    <nav aria-label="Selected Accounts" style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
      {items.map((item, i) => (
        <Fragment key={item.step}>
          {i > 0 && <IconChevronRight size={14} stroke={1.8} aria-hidden style={{ color: 'var(--color-text-light)' }} />}
          <Button variant="ghost" size="sm" onClick={() => onBack(item.step)} title="Go back to this step">
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.account.code}</span>
            <span>{item.account.name}</span>
          </Button>
        </Fragment>
      ))}
    </nav>
  );
}

/* ── Account selection row ──────────────────────────────────────────── */
interface AccountCardProps {
  account:  Account;
  selected: boolean;
  onClick:  () => void;
}

function AccountCard({ account, selected, onClick }: AccountCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 12px', borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background: selected ? 'var(--color-table-row-selected)' : 'var(--color-surface)',
        boxShadow: selected ? 'inset 0 0 0 1px var(--color-primary)' : 'none',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        color: 'var(--color-text)',
        transition: 'background var(--transition)',
      }}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-heading)', flexShrink: 0, minWidth: 92 }}>
        {account.code}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-heading)' }}>
          {account.name}
        </span>
        {account.description && (
          <span style={{ display: 'block', marginTop: 2, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {account.description}
          </span>
        )}
      </span>
      {selected
        ? <IconCheck size={16} stroke={1.8} aria-hidden style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
        : <IconChevronRight size={16} stroke={1.8} aria-hidden style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />}
    </button>
  );
}

/* ── Inline "Create New" row ───────────────────────────────────────── */
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

  const queryClient = useQueryClient();
  const nextCodeQuery = useNextAccountCode(parentCode, isPosting, open);
  const createMutation = useCreateAccount();

  const nextCode = nextCodeQuery.data?.code;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter an Account Name.'); return; }
    if (!nextCode)    { setError('No free code is left in this range.'); return; }
    setError('');
    createMutation.mutate({
      code:           nextCode,
      name:           name.trim(),
      account_type:   parentType as AccountType,
      normal_balance: parentBalance,
      is_posting:     isPosting,
      is_system:      false,
    }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: accountsQueryKey });
        setOpen(false);
        setName('');
        setError('');
        onCreated(result.account);
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  if (!open) {
    return (
      <div>
        <Button icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      style={{
        padding: 12, borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-alt)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
        New Code:{' '}
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-heading)' }}>
          {nextCodeQuery.isLoading ? 'Loading…' : (nextCode ?? 'Not Set')}
        </span>
        {' '}(assigned automatically)
      </div>

      <TextField
        label="Account Name"
        required
        value={name}
        onChange={setName}
        placeholder="For example Petty Cash"
        disabled={createMutation.isPending}
        inputProps={{ autoFocus: true, maxLength: 100 }}
      />

      {error && <p className="form-error" style={{ margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button
          variant="ghost"
          onClick={() => { setOpen(false); setName(''); setError(''); }}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!nextCode} loading={createMutation.isPending}>
          Create And Select
        </Button>
      </div>
    </form>
  );
}

/* ── Loading / Empty states ─────────────────────────────────────────── */
function LoadingCards() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true">
      <span className="sr-only" role="status">Loading Accounts…</span>
      {[1, 2, 3].map(i => (
        <div key={i} className="skeleton" aria-hidden style={{ height: 44, borderRadius: 'var(--radius)' }} />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <div className="empty-desc">{message}</div>
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

  const nextCodeQuery = useNextAccountCode(subgroup.code, true);
  const nextCode      = nextCodeQuery.data?.code;

  const queryClient = useQueryClient();
  const createMutation = useCreateAccount();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Enter an Account Name.'); return; }
    if (!nextCode)    { setError('No free code is left under this Sub-Group.'); return; }
    setError('');
    createMutation.mutate({
      code:                 nextCode,
      name:                 name.trim(),
      description:          desc.trim() || undefined,
      account_type:         subgroup.account_type as AccountType,
      normal_balance:       subgroup.normal_balance as NormalBalance,
      is_posting:           true,
      is_system:            false,
      opening_balance:      obAmt !== '' ? parseFloat(obAmt) : undefined,
      opening_balance_date: obDate || undefined,
    }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: accountsQueryKey });
        onSuccess(result.account);
      },
      onError: (err) => setError(err.message),
    });
  };

  const codeText = nextCodeQuery.isLoading ? 'Loading…' : (nextCode ?? 'No Free Code Left');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div style={{ marginBottom: 12 }}><InlineAlert tone="danger">{error}</InlineAlert></div>}

      <div className="form-section">
        <h3 className="form-section-title">Account Details</h3>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <TextField
            label="Account Code"
            value={codeText}
            disabled
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
          <TextField label="Account Type" value={subgroup.account_type} disabled />
          <TextField label="Normal Balance" value={subgroup.normal_balance} disabled />
          <div className="span-all">
            <TextField
              label="Account Name"
              required
              value={name}
              onChange={setName}
              placeholder="For example Cash In Hand"
              disabled={createMutation.isPending}
              inputProps={{ autoFocus: true, maxLength: 100 }}
            />
          </div>
          <div className="span-all">
            <TextareaField
              label="Description"
              value={desc}
              onChange={setDesc}
              placeholder="Short note about what this account is for"
              disabled={createMutation.isPending}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>
        <p className="form-hint">The code is assigned automatically from the selected Sub-Group.</p>
      </div>

      <div className="form-section">
        <h3 className="form-section-title">Opening Balance</h3>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          <TextField
            label="Amount"
            value={obAmt}
            onChange={setObAmt}
            placeholder="0.00"
            disabled={createMutation.isPending}
            inputProps={{ type: 'number', step: '0.01', inputMode: 'decimal' }}
            style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          />
          <DateField
            label="As Of Date"
            value={obDate}
            onChange={setObDate}
            disabled={createMutation.isPending}
          />
        </div>
        <p className="form-hint">Balance brought forward from your previous system. You can also set it later in the account details.</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button
          type="submit"
          variant="primary"
          icon={<IconCheck size={16} stroke={1.8} />}
          disabled={!nextCode || nextCodeQuery.isLoading}
          loading={createMutation.isPending}
        >
          Create Posting Account
        </Button>
      </div>
    </form>
  );
}

/** Loading error for one wizard step. */
function StepError({ error }: { error: unknown }) {
  return <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Unable to load accounts for this step.')}</InlineAlert>;
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

  /* Queries */
  const categoriesQ = useTopLevelAccounts();
  const groupsQ     = useChildAccounts(category?.code, !!category);
  const subgroupsQ  = useChildAccounts(group?.code, !!group);

  /* Back-navigation: reset downstream selections */
  const goBack = (toStep: number) => {
    if (toStep === 1) { setCategory(null); setGroup(null); setSubgroup(null); }
    if (toStep === 2) { setGroup(null); setSubgroup(null); }
    if (toStep === 3) { setSubgroup(null); }
    setStep(toStep);
  };

  /* ── Render ──────────────────────────────────────────────────────── */
  const intro = (text: React.ReactNode) => (
    <p style={{ margin: '0 0 12px', fontSize: 'var(--font-size-md)', color: 'var(--color-text-muted)' }}>{text}</p>
  );
  const accountRef = (account: Account) => (
    <strong style={{ color: 'var(--color-heading)', fontWeight: 600 }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{account.code}</span> {account.name}
    </strong>
  );
  const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

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
          {intro('Select the Main Category for the new account.')}
          {categoriesQ.isLoading && <LoadingCards />}
          {categoriesQ.error && <StepError error={categoriesQ.error} />}
          {categoriesQ.data && categoriesQ.data.length === 0 && (
            <EmptyState message="No Main Categories found. Import a Chart Of Accounts template first." />
          )}
          <div style={listStyle}>
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
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Step 2: Group ────────────────────────────────────── */}
      {step === 2 && category && (
        <div>
          {intro(<>Select a Group under {accountRef(category)}, or create a new one.</>)}
          {groupsQ.isLoading && <LoadingCards />}
          {groupsQ.error && <StepError error={groupsQ.error} />}
          <div style={listStyle}>
            {(groupsQ.data ?? []).map(acct => (
              <AccountCard
                key={acct.id}
                account={acct}
                selected={group?.id === acct.id}
                onClick={() => {
                  setGroup(acct);
                  setSubgroup(null);
                  setStep(3);
                }}
              />
            ))}
            <NewAccountCard
              parentCode={category.code}
              parentType={category.account_type}
              parentBalance={category.normal_balance as NormalBalance}
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
          {intro(<>Select a Sub-Group under {accountRef(group)}, or create a new one.</>)}
          {subgroupsQ.isLoading && <LoadingCards />}
          {subgroupsQ.error && <StepError error={subgroupsQ.error} />}
          <div style={listStyle}>
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
              parentBalance={group.normal_balance as NormalBalance}
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
          {intro(<>Enter the name of the new Posting Account under {accountRef(subgroup)}.</>)}
          <DetailsStep subgroup={subgroup} onSuccess={onSuccess} />
        </div>
      )}

      {/* ── Back button ──────────────────────────────────────── */}
      {step > 1 && (
        <div style={{ marginTop: 16 }}>
          <Button icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={() => goBack(step - 1)}>
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
