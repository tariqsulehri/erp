'use client';

/**
 * Bank Module
 *
 * Tabs:
 *  Accounts        — Bank accounts registered in the system
 *  Cheque Books    — Bank cheque books and cheque leaves
 *  Post-Dated Cheques (PDC) — Received and issued PDCs with status tracking
 *  Reconciliation  — Bank reconciliation statement (match GL vs bank statement)
 */

import { useEffect, useState } from 'react';
import { formatDate, formatMoney, normalizeFormatSettings, type AppFormatSettingsSource } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  type BankAccountPayload,
  useBankAccountsList,
  useBankAccountsSupportData,
  useCreateBankAccount,
  useInvalidateBankAccounts,
  useUpdateBankAccount,
} from '@/lib/api/bank-accounts';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { ChequeBooksTab } from '@/components/bank/ChequeBooksTab';

type Tab = 'accounts' | 'cheque-books' | 'pdc' | 'reconciliation';
type PDCType = 'received' | 'issued';
type PDCStatus = 'Pending' | 'Deposited' | 'Matured' | 'Returned' | 'Cancelled';

/* ── Sample data (replace with tRPC queries once bank module is built) ── */
const SAMPLE_BANK_ACCOUNTS = [
  { id: '1', name: 'Main Operating Account', bank: 'HBL', branch: 'Main Branch', accountNo: '****-1234', balance: 2_450_000, is_active: true },
  { id: '2', name: 'Savings Account',        bank: 'MCB', branch: 'Gulberg',     accountNo: '****-5678', balance:   850_000, is_active: true },
  { id: '3', name: 'Payroll Account',        bank: 'UBL', branch: 'Defence',     accountNo: '****-9012', balance:   120_000, is_active: true },
];

const SAMPLE_PDCS = [
  { id: '1', type: 'received' as PDCType, chequeNo: 'MC-001234', party: 'ABC Trading Co.',    bank: 'MCB', amount: 350_000,  dueDate: '2026-04-15', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
  { id: '2', type: 'received' as PDCType, chequeNo: 'HBL-9876',  party: 'XYZ Suppliers Ltd', bank: 'HBL', amount: 120_000,  dueDate: '2026-04-02', status: 'Matured'   as PDCStatus, account: 'Main Operating Account' },
  { id: '3', type: 'received' as PDCType, chequeNo: 'UBL-5544',  party: 'National Services',  bank: 'UBL', amount:  85_000,  dueDate: '2026-03-20', status: 'Deposited' as PDCStatus, account: 'Main Operating Account' },
  { id: '4', type: 'received' as PDCType, chequeNo: 'ABL-3312',  party: 'Fast Logistics',     bank: 'ABL', amount:  45_000,  dueDate: '2026-03-10', status: 'Returned'  as PDCStatus, account: 'Main Operating Account' },
  { id: '5', type: 'issued'   as PDCType, chequeNo: 'HBL-00112', party: 'Office Rentals LLC', bank: 'HBL', amount: 210_000,  dueDate: '2026-04-30', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
  { id: '6', type: 'issued'   as PDCType, chequeNo: 'HBL-00113', party: 'Raw Material Corp',  bank: 'HBL', amount: 680_000,  dueDate: '2026-05-15', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
];

const SAMPLE_RECON = [
  { id: '1', date: '2026-03-01', description: 'Customer Payment — ABC Trading',  gl_amount: 350_000,  bank_amount: 350_000,  cleared: true  },
  { id: '2', date: '2026-03-05', description: 'Supplier Payment — Raw Materials', gl_amount: -200_000, bank_amount: -200_000, cleared: true  },
  { id: '3', date: '2026-03-12', description: 'Cheque #HBL-8899 Deposit',         gl_amount: 120_000,  bank_amount: 120_000,  cleared: true  },
  { id: '4', date: '2026-03-18', description: 'Online Transfer — Payroll',         gl_amount: -450_000, bank_amount: -450_000, cleared: true  },
  { id: '5', date: '2026-03-22', description: 'PDC Deposit — XYZ Suppliers',       gl_amount: 85_000,   bank_amount: null,     cleared: false },
  { id: '6', date: '2026-03-25', description: 'Bank Charges — March',              gl_amount: null,     bank_amount: -1_800,   cleared: false },
  { id: '7', date: '2026-03-28', description: 'Interest Income — Savings',         gl_amount: null,     bank_amount: 3_200,    cleared: false },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<PDCStatus, { bg: string; color: string }> = {
  Pending:    { bg: '#fef3c7', color: '#92400e' },
  Deposited:  { bg: '#dcfce7', color: '#15803d' },
  Matured:    { bg: '#dbeafe', color: '#1d4ed8' },
  Returned:   { bg: '#fee2e2', color: '#b91c1c' },
  Cancelled:  { bg: '#f1f5f9', color: '#64748b' },
};

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

function maskAccountNumber(value: string) {
  const clean = value.trim();
  if (clean.length <= 4) return clean;
  return `****-${clean.slice(-4)}`;
}

function BankMessage({ message }: { message: { kind: 'success' | 'error'; text: string } }) {
  return (
    <div style={{
      marginBottom: 12,
      padding: '8px 12px',
      border: `1px solid ${message.kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
      background: message.kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
      color: message.kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
      fontSize: '0.78rem',
      fontWeight: 750,
    }}>
      {message.text}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--color-heading)', fontWeight: 900 }}>{children}</h3>;
}

function InlineSpinner({ light = false, size = 14 }: { light?: boolean; size?: number }) {
  return (
    <div
      className="spinner"
      style={{
        width: size,
        height: size,
        borderWidth: 2,
        ...(light ? { borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' } : {}),
      }}
    />
  );
}

/* ── Bank Accounts Tab ───────────────────────────────────────────────── */
interface BankAccountsTabProps {
  settings?: AppFormatSettingsSource | null;
  entryOpen: boolean;
  onEntryOpenChange: (open: boolean) => void;
}

const blankBankForm = (): BankAccountPayload => ({
  code: '',
  ledger_account_id: '',
  bank_name: '',
  branch_name: '',
  branch_code: '',
  account_title: '',
  account_number: '',
  account_type: 'Current',
  iban: '',
  swift_code: '',
  currency_code: 'PKR',
  opening_balance: 0,
  opening_balance_date: '',
  contact_name: '',
  address: '',
  post_code: '',
  country: '',
  city: '',
  area: '',
  phone_1: '',
  phone_2: '',
  mobile_number: '',
  fax_number: '',
  email: '',
  website: '',
  notes: '',
  is_default: false,
  is_active: true,
});

function BankAccountsTab({ settings, entryOpen, onEntryOpenChange }: BankAccountsTabProps) {
  const supportQuery = useBankAccountsSupportData();
  const listQuery = useBankAccountsList({ page: 1, limit: 50 });
  const createBankAccount = useCreateBankAccount();
  const updateBankAccount = useUpdateBankAccount();
  const invalidateBankAccounts = useInvalidateBankAccounts();
  const formatSettings = normalizeFormatSettings(settings);
  const [form, setForm] = useState<BankAccountPayload>(blankBankForm);
  const [editingId, setEditingId] = useState('');
  const [entryWasOpen, setEntryWasOpen] = useState(entryOpen);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const saving = createBankAccount.isPending || updateBankAccount.isPending;
  const accounts = listQuery.data?.data ?? [];
  const totalBalance = accounts.reduce((sum: number, account: any) => sum + Number(account.current_balance ?? 0), 0);
  const activeCount = accounts.filter((account: any) => account.is_active).length;
  const accountOptions = (supportQuery.data?.accounts ?? []).map((account: any) => ({
    value: account.id,
    label: `${account.code} - ${account.name}`,
    searchText: `${account.code} ${account.name}`,
  }));

  useEffect(() => {
    if (entryOpen && !entryWasOpen && !editingId) {
      setForm(blankBankForm());
      setMessage(null);
    }
    setEntryWasOpen(entryOpen);
  }, [editingId, entryOpen, entryWasOpen]);

  function patchForm(patch: Partial<BankAccountPayload>) {
    setForm(current => ({ ...current, ...patch }));
  }

  function startNew() {
    setEditingId('');
    setForm(blankBankForm());
    setMessage(null);
    onEntryOpenChange(true);
  }

  function startEdit(account: any) {
    setEditingId(account.id);
    setForm({
      code: account.code ?? '',
      ledger_account_id: account.ledger_account_id ?? '',
      bank_name: account.bank_name ?? '',
      branch_name: account.branch_name ?? '',
      branch_code: account.branch_code ?? '',
      account_title: account.account_title ?? '',
      account_number: account.account_number ?? '',
      account_type: account.account_type ?? 'Current',
      iban: account.iban ?? '',
      swift_code: account.swift_code ?? '',
      currency_code: account.currency_code ?? formatSettings.currencyCode,
      opening_balance: Number(account.opening_balance ?? 0),
      opening_balance_date: String(account.opening_balance_date ?? '').slice(0, 10),
      contact_name: account.contact_name ?? '',
      address: account.address ?? '',
      post_code: account.post_code ?? '',
      country: account.country ?? '',
      city: account.city ?? '',
      area: account.area ?? '',
      phone_1: account.phone_1 ?? '',
      phone_2: account.phone_2 ?? '',
      mobile_number: account.mobile_number ?? '',
      fax_number: account.fax_number ?? '',
      email: account.email ?? '',
      website: account.website ?? '',
      notes: account.notes ?? '',
      is_default: Boolean(account.is_default),
      is_active: Boolean(account.is_active),
    });
    setMessage(null);
    onEntryOpenChange(true);
  }

  function validateForm() {
    if (!form.code.trim()) return 'Code is required.';
    if (!form.ledger_account_id) return 'Linked Account is required.';
    if (!form.bank_name.trim()) return 'Bank Name is required.';
    if (!form.account_title.trim()) return 'Account Title is required.';
    if (!form.account_number.trim()) return 'Account Number is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email is not valid.';
    if (numericValue(String(form.opening_balance)) < 0) return 'Opening Balance cannot be negative.';
    return '';
  }

  async function saveBankAccount() {
    const validationMessage = validateForm();
    if (validationMessage) {
      setMessage({ kind: 'error', text: validationMessage });
      return;
    }

    try {
      const payload = {
        ...form,
        code: form.code.trim(),
        bank_name: form.bank_name.trim(),
        account_title: form.account_title.trim(),
        account_number: form.account_number.trim(),
        currency_code: form.currency_code.trim().toUpperCase() || formatSettings.currencyCode,
        opening_balance: numericValue(String(form.opening_balance)),
      };
      const result = editingId
        ? await updateBankAccount.mutateAsync({ id: editingId, input: payload })
        : await createBankAccount.mutateAsync(payload);
      await invalidateBankAccounts();
      setMessage({ kind: 'success', text: result.message ?? 'Bank Account saved successfully.' });
      setEditingId('');
      setForm(blankBankForm());
      onEntryOpenChange(false);
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Bank Account.') });
    }
  }

  if (entryOpen) {
    return (
      <div>
        {message && <BankMessage message={message} />}
        <div style={formShellStyle}>
          <div style={formToolbarStyle}>
            <div>
              <h2 style={formTitleStyle}>{editingId ? 'Edit Bank Account' : 'Add Bank Account'}</h2>
              <p style={formSubtitleStyle}>Bank details, linked account, branch, and contact information</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" type="button" onClick={() => { onEntryOpenChange(false); setEditingId(''); setForm(blankBankForm()); }} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" type="button" onClick={saveBankAccount} disabled={saving} style={{ minWidth: 92, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                {saving ? <><InlineSpinner light />Saving...</> : 'Save'}
              </button>
            </div>
          </div>

          <section style={formSectionStyle}>
            <SectionTitle>Account Details</SectionTitle>
            <div style={formGridStyle}>
              <TextField label="Code" required value={form.code} onChange={value => patchForm({ code: value })} />
              <FieldLabel label="Linked Account" required>
                <SearchableSelect
                  value={form.ledger_account_id}
                  options={accountOptions}
                  onChange={value => patchForm({ ledger_account_id: value })}
                  placeholder={supportQuery.isLoading ? 'Loading Accounts' : 'Search Linked Account'}
                  disabled={supportQuery.isLoading || supportQuery.isError}
                />
                {supportQuery.isFetching && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 700 }}>
                    <InlineSpinner size={12} /> Loading Linked Accounts...
                  </div>
                )}
              </FieldLabel>
              <TextField label="Account Title" required value={form.account_title} onChange={value => patchForm({ account_title: value })} />
              <TextField label="Account Number" required value={form.account_number} onChange={value => patchForm({ account_number: value })} />
              <TextField label="Bank Name" required value={form.bank_name} onChange={value => patchForm({ bank_name: value })} />
              <TextField label="Branch Name" value={form.branch_name ?? ''} onChange={value => patchForm({ branch_name: value })} />
              <TextField label="Branch Code" value={form.branch_code ?? ''} onChange={value => patchForm({ branch_code: value })} />
              <FieldLabel label="Account Type">
                <select className="form-input" value={form.account_type ?? ''} onChange={event => patchForm({ account_type: event.currentTarget.value })}>
                  <option value="Current">Current</option>
                  <option value="Savings">Savings</option>
                  <option value="Payroll">Payroll</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Other">Other</option>
                </select>
              </FieldLabel>
              <TextField label="IBAN" value={form.iban ?? ''} onChange={value => patchForm({ iban: value })} />
              <TextField label="SWIFT Code" value={form.swift_code ?? ''} onChange={value => patchForm({ swift_code: value })} />
              <TextField label="Currency" value={form.currency_code} onChange={value => patchForm({ currency_code: value.toUpperCase().slice(0, 3) })} />
              <NumericField label="Opening Balance" value={String(form.opening_balance || '')} onChange={value => patchForm({ opening_balance: numericValue(value) })} />
              <DateField label="Opening Balance Date" value={form.opening_balance_date ?? ''} onChange={value => patchForm({ opening_balance_date: value })} />
            </div>
          </section>

          <section style={formSectionStyle}>
            <SectionTitle>Contact And Address</SectionTitle>
            <div style={formGridStyle}>
              <TextField label="Contact" value={form.contact_name ?? ''} onChange={value => patchForm({ contact_name: value })} />
              <TextField label="Phone 1" value={form.phone_1 ?? ''} onChange={value => patchForm({ phone_1: value })} />
              <TextField label="Phone 2" value={form.phone_2 ?? ''} onChange={value => patchForm({ phone_2: value })} />
              <TextField label="Mobile Number" value={form.mobile_number ?? ''} onChange={value => patchForm({ mobile_number: value })} />
              <TextField label="Fax Number" value={form.fax_number ?? ''} onChange={value => patchForm({ fax_number: value })} />
              <TextField label="Email" value={form.email ?? ''} onChange={value => patchForm({ email: value })} />
              <TextField label="Website" value={form.website ?? ''} onChange={value => patchForm({ website: value })} />
              <TextField label="Post Code" value={form.post_code ?? ''} onChange={value => patchForm({ post_code: value })} />
              <TextField label="Country" value={form.country ?? ''} onChange={value => patchForm({ country: value })} />
              <TextField label="City" value={form.city ?? ''} onChange={value => patchForm({ city: value })} />
              <TextField label="Area" value={form.area ?? ''} onChange={value => patchForm({ area: value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', fontWeight: 700, alignSelf: 'end' }}>
                <input type="checkbox" checked={!form.is_active} onChange={event => patchForm({ is_active: !event.currentTarget.checked })} />
                Inactive
              </label>
            </div>
            <div style={{ marginTop: 8 }}>
              <FieldLabel label="Address">
                <textarea className="form-input" value={form.address ?? ''} onChange={event => patchForm({ address: event.currentTarget.value })} rows={3} />
              </FieldLabel>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div>
      {message && <BankMessage message={message} />}
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Bank Balance', value: formatMoney(totalBalance, settings), color: '#2563eb' },
          { label: 'Active Accounts',    value: activeCount, color: '#16a34a' },
          { label: 'Currency',           value: formatSettings.currencyCode, color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Account cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {listQuery.isFetching && accounts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 750 }}>
            <InlineSpinner size={13} /> Refreshing Bank Accounts...
          </div>
        )}
        {listQuery.isLoading && accounts.length === 0 && (
          <div style={emptyStateStyle}>
            <InlineSpinner size={18} />
            <span>Loading Bank Accounts...</span>
          </div>
        )}
        {!listQuery.isLoading && accounts.length === 0 && (
          <div style={emptyStateStyle}>
            <div style={{ fontWeight: 800, color: 'var(--color-heading)' }}>No Bank Accounts Found</div>
            <button className="btn btn-primary" type="button" onClick={startNew} style={{ marginTop: 10 }}>Add Bank Account</button>
          </div>
        )}
        {accounts.map((acct: any) => (
          <div key={acct.id} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                <path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path d="M8 9V7a4 4 0 018 0v2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{acct.account_title}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {acct.bank_name} · {acct.branch_name || '-'} · {maskAccountNumber(acct.account_number)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Linked Account: {acct.ledger_account_code} - {acct.ledger_account_name}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#2563eb' }}>
                {formatMoney(Number(acct.current_balance ?? 0), settings)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: acct.is_active ? '#16a34a' : '#94a3b8' }}>
                {acct.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
            <button onClick={() => startEdit(acct)} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}>
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── PDC Tab ─────────────────────────────────────────────────────────── */
function PDCTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const [pdcType, setPdcType] = useState<'all' | PDCType>('all');
  const [statusFilter, setStatusFilter] = useState<PDCStatus | 'all'>('all');

  const filtered = SAMPLE_PDCS.filter(p => {
    if (pdcType !== 'all' && p.type !== pdcType) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const totalPending  = SAMPLE_PDCS.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const totalMatured  = SAMPLE_PDCS.filter(p => p.status === 'Matured').reduce((s, p) => s + p.amount, 0);
  const totalReturned = SAMPLE_PDCS.filter(p => p.status === 'Returned').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Pending PDCs',   value: formatMoney(totalPending, settings),  count: SAMPLE_PDCS.filter(p=>p.status==='Pending').length,  color: '#d97706' },
          { label: 'Matured (Due)',  value: formatMoney(totalMatured, settings),  count: SAMPLE_PDCS.filter(p=>p.status==='Matured').length,  color: '#1d4ed8' },
          { label: 'Returned',       value: formatMoney(totalReturned, settings), count: SAMPLE_PDCS.filter(p=>p.status==='Returned').length, color: '#b91c1c' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {k.label}
              <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 700,
                background: `${k.color}15`, color: k.color, padding: '1px 6px', borderRadius: 10 }}>
                {k.count}
              </span>
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {/* Type toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {(['all', 'received', 'issued'] as const).map(t => (
            <button key={t} onClick={() => setPdcType(t)} style={{
              padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
              background: pdcType === t ? 'var(--color-primary)' : 'var(--color-surface)',
              color: pdcType === t ? 'white' : 'var(--color-text-muted)',
            }}>
              {t === 'all' ? 'All' : t === 'received' ? 'Received' : 'Issued'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as PDCStatus | 'all')}
          style={{
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--font-size-xs)', cursor: 'pointer',
          }}
        >
          <option value="all">All Statuses</option>
          {(['Pending', 'Matured', 'Deposited', 'Returned', 'Cancelled'] as PDCStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Type', 'Cheque No.', 'Party', 'Bank', 'Amount', 'Due Date', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((pdc, i) => {
              const overdue = pdc.status === 'Pending' && isOverdue(pdc.dueDate);
              const ss = STATUS_STYLE[pdc.status];
              return (
                <tr key={pdc.id} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background: overdue ? '#fff7ed' : 'transparent',
                }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: pdc.type === 'received' ? '#dcfce7' : '#fee2e2',
                      color: pdc.type === 'received' ? '#15803d' : '#b91c1c',
                    }}>
                      {pdc.type === 'received' ? 'RCV' : 'ISS'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>
                    {pdc.chequeNo}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    {pdc.party}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {pdc.bank}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>
                    {formatMoney(pdc.amount, settings)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ color: overdue ? '#b91c1c' : 'var(--color-text)' }}>
                      {formatDate(pdc.dueDate, settings)}
                    </span>
                    {overdue && (
                      <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700,
                        background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: 3 }}>
                        OVERDUE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: ss.bg, color: ss.color,
                    }}>
                      {pdc.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {pdc.status === 'Pending' && (
                        <>
                          <button style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                            borderRadius: 4, border: '1px solid #16a34a', background: 'transparent',
                            color: '#16a34a', cursor: 'pointer',
                          }}>
                            Deposit
                          </button>
                          <button style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                            borderRadius: 4, border: '1px solid #b91c1c', background: 'transparent',
                            color: '#b91c1c', cursor: 'pointer',
                          }}>
                            Return
                          </button>
                        </>
                      )}
                      {pdc.status === 'Matured' && (
                        <button style={{
                          padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                          borderRadius: 4, border: '1px solid #1d4ed8', background: 'transparent',
                          color: '#1d4ed8', cursor: 'pointer',
                        }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No PDCs match the selected filters.
          </div>
        )}
      </div>

      <div style={{
        marginTop: 12, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 'var(--font-size-xs)', color: '#1e40af',
      }}>
        PDC workflow: Received cheque is recorded and held until due date (Pending → Matured → Deposited or Returned).
        Issued cheques are tracked as liabilities until cleared by the bank.
        Full journal entries will post automatically once the voucher module is live.
      </div>
    </div>
  );
}

/* ── Reconciliation Tab ──────────────────────────────────────────────── */
function ReconciliationTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const [period, setPeriod] = useState('2026-03');

  const cleared   = SAMPLE_RECON.filter(r => r.cleared);
  const uncleared = SAMPLE_RECON.filter(r => !r.cleared);

  const glBalance     = SAMPLE_RECON.reduce((s, r) => s + (r.gl_amount ?? 0), 0);
  const bankBalance   = SAMPLE_RECON.reduce((s, r) => s + (r.bank_amount ?? 0), 0);
  const difference    = glBalance - bankBalance;

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Bank Account
          </label>
          <select style={{
            padding: '7px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {SAMPLE_BANK_ACCOUNTS.map(a => <option key={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Period
          </label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-sm)',
            }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--color-primary)', color: 'white',
            fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer',
          }}>
            Load Statement
          </button>
        </div>
      </div>

      {/* Summary boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'GL Book Balance',   value: glBalance,   color: '#2563eb' },
          { label: 'Bank Statement Bal',value: bankBalance, color: '#16a34a' },
          { label: 'Difference',        value: difference,  color: Math.abs(difference) < 0.01 ? '#16a34a' : '#b91c1c' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: `1px solid ${Math.abs(difference) < 0.01 || k.label !== 'Difference' ? 'var(--color-border)' : '#fca5a5'}`,
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: k.color }}>
              {formatMoney(Math.abs(k.value), settings)}
              {k.value < 0 && <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>(Cr)</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Uncleared items */}
      <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
        Uncleared Items
        <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 600,
          background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>
          {uncleared.length}
        </span>
      </h3>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Date', 'Description', 'GL Amount', 'Bank Amount', 'Action'].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uncleared.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: i < uncleared.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {formatDate(row.date, settings)}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>{row.description}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: row.gl_amount ? (row.gl_amount > 0 ? '#16a34a' : '#b91c1c') : '#94a3b8' }}>
                  {row.gl_amount != null ? `${row.gl_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.gl_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: row.bank_amount ? (row.bank_amount > 0 ? '#16a34a' : '#b91c1c') : '#94a3b8' }}>
                  {row.bank_amount != null ? `${row.bank_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.bank_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button style={{
                    padding: '3px 12px', fontSize: '0.6875rem', fontWeight: 600,
                    borderRadius: 4, border: '1px solid #16a34a', background: 'transparent',
                    color: '#16a34a', cursor: 'pointer',
                  }}>
                    Match
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cleared items */}
      <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
        Cleared Items
        <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 600,
          background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 10 }}>
          {cleared.length}
        </span>
      </h3>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Date', 'Description', 'GL Amount', 'Bank Amount', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cleared.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: i < cleared.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {formatDate(row.date, settings)}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>{row.description}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: (row.gl_amount ?? 0) > 0 ? '#16a34a' : '#b91c1c' }}>
                  {row.gl_amount != null ? `${row.gl_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.gl_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: (row.bank_amount ?? 0) > 0 ? '#16a34a' : '#b91c1c' }}>
                  {row.bank_amount != null ? `${row.bank_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.bank_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: '#dcfce7', color: '#15803d' }}>
                    Cleared
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 12, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 'var(--font-size-xs)', color: '#1e40af',
      }}>
        Bank reconciliation matches GL transactions against the imported bank statement.
        Unmatched GL items = outstanding cheques. Unmatched bank items = timing differences or errors.
        Full statement import (CSV/MT940) will be available once the voucher module is complete.
      </div>
    </div>
  );
}

const formShellStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  boxShadow: 'var(--shadow-sm)',
};

const formToolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderBottom: '1px solid var(--color-border)',
};

const formTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  color: 'var(--color-heading)',
  fontWeight: 900,
};

const formSubtitleStyle: React.CSSProperties = {
  margin: '3px 0 0',
  fontSize: '0.76rem',
  color: 'var(--color-text-muted)',
  fontWeight: 700,
};

const formSectionStyle: React.CSSProperties = {
  padding: 14,
  borderBottom: '1px solid var(--color-border-subtle)',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(180px, 1fr))',
  gap: 10,
  alignItems: 'end',
};

const emptyStateStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  padding: 28,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
};

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function BankPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [bankEntryOpen, setBankEntryOpen] = useState(false);
  const { data: generalSettings } = useGeneralSettings();

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'accounts',       label: 'Bank Accounts',      icon: 'M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM8 9V7a4 4 0 018 0v2' },
    { id: 'cheque-books',   label: 'Cheque Books',       icon: 'M4 7h16a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zm3 4h5m-5 3h9m1-5v6' },
    { id: 'pdc',            label: 'Post-Dated Cheques', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'reconciliation', label: 'Reconciliation',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="page-subtitle">Bank accounts, cheque books, post-dated cheques, and reconciliation</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'pdc' && (
            <button className="btn btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              New PDC
            </button>
          )}
          {activeTab === 'accounts' && (
            <button className="btn btn-primary" type="button" onClick={() => setBankEntryOpen(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              Add Bank Account
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--color-border)',
        marginBottom: 24,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'var(--transition)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={tab.icon}/>
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'accounts'       && <BankAccountsTab settings={generalSettings} entryOpen={bankEntryOpen} onEntryOpenChange={setBankEntryOpen} />}
      {activeTab === 'cheque-books'   && <ChequeBooksTab settings={generalSettings} />}
      {activeTab === 'pdc'            && <PDCTab settings={generalSettings} />}
      {activeTab === 'reconciliation' && <ReconciliationTab settings={generalSettings} />}
    </div>
  );
}
