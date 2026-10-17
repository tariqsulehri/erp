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
import {
  IconBuildingBank,
  IconCalendarDue,
  IconCheck,
  IconClipboardCheck,
  IconNotebook,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, DateField, NumericField, SelectField, TextareaField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
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
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const PDC_STATUS_BADGE: Record<PDCStatus, BadgeVariant> = {
  Pending: 'warning',
  Deposited: 'success',
  Matured: 'info',
  Returned: 'danger',
  Cancelled: 'neutral',
};

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

function maskAccountNumber(value: string) {
  const clean = value.trim();
  if (clean.length <= 4) return clean;
  return `****-${clean.slice(-4)}`;
}

function negativeStyle(value: number | null | undefined): React.CSSProperties | undefined {
  return Number(value ?? 0) < 0 ? { color: 'var(--color-negative)' } : undefined;
}

/** Grid, not flex, so stacked panels keep their height and the tab body scrolls. */
const tabBodyStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignContent: 'start',
  gap: 12,
};

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

  function cancelEntry() {
    onEntryOpenChange(false);
    setEditingId('');
    setForm(blankBankForm());
  }

  if (entryOpen) {
    return (
      <div style={tabBodyStyle}>
        {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">{editingId ? 'Edit Bank Account' : 'New Bank Account'}</h2>
              <p className="page-head-desc">Bank details, linked account, branch, and contact information.</p>
            </div>
            <div className="row-actions" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={cancelEntry} disabled={saving}>Cancel</Button>
              <Button variant="primary" onClick={saveBankAccount} loading={saving}>{editingId ? 'Save Changes' : 'Save Bank Account'}</Button>
            </div>
          </div>

          <div className="panel-body">
            <section className="form-section">
              <h3 className="form-section-title">Account Details</h3>
              <div className="form-grid">
                <TextField label="Code" required value={form.code} onChange={value => patchForm({ code: value })} />
                <div className="span-2">
                  <FieldLabel label="Linked Account" required>
                    <SearchableSelect
                      value={form.ledger_account_id}
                      options={accountOptions}
                      onChange={value => patchForm({ ledger_account_id: value })}
                      placeholder={supportQuery.isLoading ? 'Loading Accounts…' : 'Search Linked Account'}
                      disabled={supportQuery.isLoading || supportQuery.isError}
                    />
                  </FieldLabel>
                  {supportQuery.isFetching && <p className="form-hint">Loading Linked Accounts…</p>}
                </div>
                <SelectField
                  label="Account Type"
                  value={form.account_type ?? ''}
                  options={ACCOUNT_TYPE_OPTIONS}
                  onChange={value => patchForm({ account_type: value })}
                />
                <TextField label="Account Title" required value={form.account_title} onChange={value => patchForm({ account_title: value })} />
                <TextField label="Account Number" required value={form.account_number} onChange={value => patchForm({ account_number: value })} />
                <TextField label="Bank Name" required value={form.bank_name} onChange={value => patchForm({ bank_name: value })} />
                <TextField label="Branch Name" value={form.branch_name ?? ''} onChange={value => patchForm({ branch_name: value })} />
                <TextField label="Branch Code" value={form.branch_code ?? ''} onChange={value => patchForm({ branch_code: value })} />
                <TextField label="IBAN" value={form.iban ?? ''} onChange={value => patchForm({ iban: value })} />
                <TextField label="SWIFT Code" value={form.swift_code ?? ''} onChange={value => patchForm({ swift_code: value })} />
                <TextField label="Currency" value={form.currency_code} onChange={value => patchForm({ currency_code: value.toUpperCase().slice(0, 3) })} />
                <NumericField label="Opening Balance" value={String(form.opening_balance || '')} onChange={value => patchForm({ opening_balance: numericValue(value) })} />
                <DateField label="Opening Balance Date" value={form.opening_balance_date ?? ''} onChange={value => patchForm({ opening_balance_date: value })} />
              </div>
            </section>

            <section className="form-section">
              <h3 className="form-section-title">Contact And Address</h3>
              <div className="form-grid">
                <TextField label="Contact Person" value={form.contact_name ?? ''} onChange={value => patchForm({ contact_name: value })} />
                <TextField label="Phone 1" value={form.phone_1 ?? ''} onChange={value => patchForm({ phone_1: value })} />
                <TextField label="Phone 2" value={form.phone_2 ?? ''} onChange={value => patchForm({ phone_2: value })} />
                <TextField label="Mobile Number" value={form.mobile_number ?? ''} onChange={value => patchForm({ mobile_number: value })} />
                <TextField label="Fax Number" value={form.fax_number ?? ''} onChange={value => patchForm({ fax_number: value })} />
                <TextField label="Email Address" value={form.email ?? ''} onChange={value => patchForm({ email: value })} />
                <TextField label="Website" value={form.website ?? ''} onChange={value => patchForm({ website: value })} />
                <TextField label="Post Code" value={form.post_code ?? ''} onChange={value => patchForm({ post_code: value })} />
                <TextField label="Country" value={form.country ?? ''} onChange={value => patchForm({ country: value })} />
                <TextField label="City" value={form.city ?? ''} onChange={value => patchForm({ city: value })} />
                <TextField label="Area" value={form.area ?? ''} onChange={value => patchForm({ area: value })} />
                <div style={{ alignSelf: 'end' }}>
                  <CheckboxField label="Inactive" checked={!form.is_active} onChange={checked => patchForm({ is_active: !checked })} />
                </div>
                <div className="span-all">
                  <TextareaField label="Address" value={form.address ?? ''} onChange={value => patchForm({ address: value })} rows={3} />
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={tabBodyStyle}>
      {message && <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>}
      {listQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(listQuery.error, 'Unable to load Bank Accounts.')}</InlineAlert>}

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Bank Accounts</h2>
          <div className="filter-bar-end">
            {listQuery.isFetching && accounts.length > 0 && <span>Refreshing…</span>}
            <span>{activeCount} Active</span>
            <span aria-hidden>·</span>
            <span>Currency {formatSettings.currencyCode}</span>
            <span aria-hidden>·</span>
            <span>
              Total Balance{' '}
              <strong style={{ fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums', ...negativeStyle(totalBalance) }}>
                {formatMoney(totalBalance, settings)}
              </strong>
            </span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Account Title</th>
                <th style={{ width: 140 }}>Account Number</th>
                <th style={{ width: '26%' }}>Linked Account</th>
                <th className="num" style={{ width: 170 }}>Current Balance</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && accounts.length === 0 && <TableMessageRow colSpan={6} title="Loading Bank Accounts…" loading />}
              {!listQuery.isLoading && accounts.length === 0 && (
                <TableMessageRow
                  colSpan={6}
                  title="No Bank Accounts Yet"
                  description="Add a Bank Account to track balances, cheque books, and reconciliation."
                  action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={startNew}>New Bank Account</Button>}
                />
              )}
              {accounts.map((acct: any) => (
                <tr key={acct.id} className={editingId === acct.id ? 'is-selected' : undefined} onDoubleClick={() => startEdit(acct)}>
                  <td className="cell-stack">
                    <span className="cell-strong">{acct.account_title}</span>
                    <span className="cell-sub">{acct.bank_name} · {acct.branch_name || 'Branch Not Set'}</span>
                  </td>
                  <td className="cell-muted">{maskAccountNumber(acct.account_number)}</td>
                  <td className={acct.ledger_account_code ? undefined : 'cell-muted'}>
                    {acct.ledger_account_code ? `${acct.ledger_account_code} - ${acct.ledger_account_name}` : 'Not Set'}
                  </td>
                  <td className="num" style={negativeStyle(Number(acct.current_balance ?? 0))}>{formatMoney(Number(acct.current_balance ?? 0), settings)}</td>
                  <td><Badge variant={acct.is_active ? 'success' : 'neutral'}>{acct.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="cell-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconPencil size={16} stroke={1.8} />}
                      onClick={() => startEdit(acct)}
                      aria-label={`Edit Bank Account ${acct.account_title}`}
                      title="Edit Bank Account"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ── PDC Tab ─────────────────────────────────────────────────────────── */
function PDCTab({
  settings,
  entryOpen,
  onEntryOpenChange,
}: {
  settings?: AppFormatSettingsSource | null;
  entryOpen: boolean;
  onEntryOpenChange: (open: boolean) => void;
}) {
  const [pdcType, setPdcType] = useState<'all' | PDCType>('all');
  const [statusFilter, setStatusFilter] = useState<PDCStatus | 'all'>('all');
  const [pdcs, setPdcs] = useState(SAMPLE_PDCS);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    type: 'received' as PDCType,
    chequeNo: '',
    party: '',
    bank: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    account: 'Main Operating Account',
  });

  const filtered = pdcs.filter(p => {
    if (pdcType !== 'all' && p.type !== pdcType) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const totalPending  = pdcs.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const totalMatured  = pdcs.filter(p => p.status === 'Matured').reduce((s, p) => s + p.amount, 0);
  const totalReturned = pdcs.filter(p => p.status === 'Returned').reduce((s, p) => s + p.amount, 0);

  function updatePdcStatus(id: string, nextStatus: PDCStatus, actionLabel: string) {
    setPdcs(rows => rows.map(row => row.id === id ? { ...row, status: nextStatus } : row));
    setMessage(`${actionLabel} completed for cheque.`);
  }

  function savePdc() {
    if (!form.chequeNo.trim()) return setMessage('Cheque No. is required.');
    if (!form.party.trim()) return setMessage('Party is required.');
    if (!form.bank.trim()) return setMessage('Bank is required.');
    if (numericValue(form.amount) <= 0) return setMessage('Amount must be greater than zero.');
    setPdcs(rows => [{
      id: String(Date.now()),
      type: form.type,
      chequeNo: form.chequeNo.trim(),
      party: form.party.trim(),
      bank: form.bank.trim(),
      amount: numericValue(form.amount),
      dueDate: form.dueDate,
      status: 'Pending' as PDCStatus,
      account: form.account.trim() || 'Main Operating Account',
    }, ...rows]);
    setForm({
      type: 'received',
      chequeNo: '',
      party: '',
      bank: '',
      amount: '',
      dueDate: new Date().toISOString().slice(0, 10),
      account: 'Main Operating Account',
    });
    onEntryOpenChange(false);
    setMessage('Post-Dated Cheque added.');
  }

  const pendingCount = pdcs.filter(p => p.status === 'Pending').length;
  const maturedCount = pdcs.filter(p => p.status === 'Matured').length;
  const returnedCount = pdcs.filter(p => p.status === 'Returned').length;
  const messageIsError = Boolean(message) && !/added|completed/i.test(message);

  return (
    <div style={tabBodyStyle}>
      {message && <InlineAlert tone={messageIsError ? 'danger' : 'success'}>{message}</InlineAlert>}

      {entryOpen && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">New Post-Dated Cheque</h2>
              <p className="page-head-desc">Record a received or issued cheque so you can track it until it clears.</p>
            </div>
            <div className="row-actions" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={() => onEntryOpenChange(false)}>Cancel</Button>
              <Button variant="primary" onClick={savePdc}>Save Cheque</Button>
            </div>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <SelectField
                label="Type"
                required
                value={form.type}
                options={[{ value: 'received', label: 'Received' }, { value: 'issued', label: 'Issued' }]}
                onChange={value => setForm(current => ({ ...current, type: value as PDCType }))}
              />
              <TextField label="Cheque Number" required value={form.chequeNo} onChange={value => setForm(current => ({ ...current, chequeNo: value }))} />
              <TextField label="Party" required value={form.party} onChange={value => setForm(current => ({ ...current, party: value }))} />
              <TextField label="Bank" required value={form.bank} onChange={value => setForm(current => ({ ...current, bank: value }))} />
              <NumericField label="Amount" required value={form.amount} onChange={value => setForm(current => ({ ...current, amount: value }))} />
              <DateField label="Due Date" required value={form.dueDate} onChange={value => setForm(current => ({ ...current, dueDate: value }))} />
              <div className="span-2">
                <TextField label="Bank Account" value={form.account} onChange={value => setForm(current => ({ ...current, account: value }))} />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="filter-bar">
          <SegmentedControl
            label="Cheque Type"
            value={pdcType}
            options={[{ value: 'all', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'issued', label: 'Issued' }]}
            onChange={setPdcType}
          />
          <select
            className="form-input"
            aria-label="Filter By Status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as PDCStatus | 'all')}
            style={{ width: 160 }}
          >
            <option value="all">All Statuses</option>
            {(['Pending', 'Matured', 'Deposited', 'Returned', 'Cancelled'] as PDCStatus[]).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="filter-bar-end" style={{ flexWrap: 'wrap', gap: 16 }}>
            <span>Pending ({pendingCount}) <strong style={totalFigureStyle}>{formatMoney(totalPending, settings)}</strong></span>
            <span>Matured ({maturedCount}) <strong style={totalFigureStyle}>{formatMoney(totalMatured, settings)}</strong></span>
            <span>Returned ({returnedCount}) <strong style={totalFigureStyle}>{formatMoney(totalReturned, settings)}</strong></span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Type</th>
                <th style={{ width: 140 }}>Cheque Number</th>
                <th>Party</th>
                <th style={{ width: 90 }}>Bank</th>
                <th className="num" style={{ width: 150 }}>Amount</th>
                <th style={{ width: 190 }}>Due Date</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 160 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <TableMessageRow colSpan={8} title="No Cheques Match" description="Change the Type or Status filter to see more cheques." />
              )}
              {filtered.map(pdc => {
                const overdue = pdc.status === 'Pending' && isOverdue(pdc.dueDate);
                return (
                  <tr key={pdc.id}>
                    <td><Badge variant={pdc.type === 'received' ? 'info' : 'neutral'}>{pdc.type === 'received' ? 'Received' : 'Issued'}</Badge></td>
                    <td className="cell-strong">{pdc.chequeNo}</td>
                    <td>{pdc.party}</td>
                    <td className="cell-muted">{pdc.bank}</td>
                    <td className="num">{formatMoney(pdc.amount, settings)}</td>
                    <td>
                      <span style={overdue ? { color: 'var(--color-negative)' } : undefined}>{formatDate(pdc.dueDate, settings)}</span>
                      {overdue && <Badge variant="danger" style={{ marginLeft: 6 }}>Overdue</Badge>}
                    </td>
                    <td><Badge variant={PDC_STATUS_BADGE[pdc.status]}>{pdc.status}</Badge></td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        {pdc.status === 'Pending' && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => updatePdcStatus(pdc.id, 'Deposited', 'Deposit')}>Deposit</Button>
                            <Button variant="ghost" size="sm" onClick={() => updatePdcStatus(pdc.id, 'Returned', 'Return')}>Return</Button>
                          </>
                        )}
                        {pdc.status === 'Matured' && (
                          <Button variant="ghost" size="sm" onClick={() => updatePdcStatus(pdc.id, 'Deposited', 'Clear')}>Clear</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <InlineAlert tone="info">
        A received cheque is held until its due date (Pending, then Matured, then Deposited or Returned).
        Issued cheques are tracked as liabilities until the bank clears them.
        Journal entries will post automatically once the voucher module is live.
      </InlineAlert>
    </div>
  );
}

/* ── Reconciliation Tab ──────────────────────────────────────────────── */
function ReconciliationTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const [period, setPeriod] = useState('2026-03');
  const [rows, setRows] = useState(SAMPLE_RECON);
  const [message, setMessage] = useState('');

  const cleared   = rows.filter(r => r.cleared);
  const uncleared = rows.filter(r => !r.cleared);

  const glBalance     = rows.reduce((s, r) => s + (r.gl_amount ?? 0), 0);
  const bankBalance   = rows.reduce((s, r) => s + (r.bank_amount ?? 0), 0);
  const difference    = glBalance - bankBalance;

  function matchRow(id: string) {
    setRows(current => current.map(row => row.id === id ? {
      ...row,
      cleared: true,
      bank_amount: row.bank_amount ?? row.gl_amount ?? 0,
      gl_amount: row.gl_amount ?? row.bank_amount ?? 0,
    } : row));
    setMessage('Item matched and moved to Cleared Items.');
  }

  return (
    <div style={tabBodyStyle}>
      {message && <InlineAlert tone="success">{message}</InlineAlert>}

      <section className="panel">
        <div className="filter-bar">
          <div className="filter-grid" style={{ flex: '1 1 auto', minWidth: 0 }}>
            <FieldLabel label="Bank Account">
              <select className="form-input">
                {SAMPLE_BANK_ACCOUNTS.map(a => <option key={a.id}>{a.name}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Period">
              <input className="form-input" type="month" value={period} onChange={e => setPeriod(e.target.value)} />
            </FieldLabel>
            <Button variant="primary" onClick={() => setMessage(`Statement loaded for ${period}.`)}>Load Statement</Button>
          </div>
        </div>
        <div className="filter-bar" style={{ borderBottom: 'none' }}>
          <div className="filter-bar-end" style={{ flexWrap: 'wrap', gap: 16 }}>
            <span>Book Balance <strong style={{ ...totalFigureStyle, ...negativeStyle(glBalance) }}>{formatMoney(glBalance, settings)}</strong></span>
            <span>Bank Statement Balance <strong style={{ ...totalFigureStyle, ...negativeStyle(bankBalance) }}>{formatMoney(bankBalance, settings)}</strong></span>
            <span>
              Difference{' '}
              <strong style={{ ...totalFigureStyle, ...(Math.abs(difference) < 0.01 ? {} : { color: 'var(--color-negative)' }) }}>{formatMoney(difference, settings)}</strong>
            </span>
          </div>
        </div>
      </section>

      <ReconciliationTable
        title="Uncleared Items"
        rows={uncleared}
        settings={settings}
        emptyTitle="No Uncleared Items"
        emptyDescription="Every book and bank item in this period is matched."
        renderLast={row => (
          <Button variant="ghost" size="sm" icon={<IconCheck size={16} stroke={1.8} />} onClick={() => matchRow(row.id)}>Match</Button>
        )}
        lastHeader="Actions"
      />

      <ReconciliationTable
        title="Cleared Items"
        rows={cleared}
        settings={settings}
        emptyTitle="No Cleared Items Yet"
        emptyDescription="Matched items appear here."
        renderLast={() => <Badge variant="success">Cleared</Badge>}
        lastHeader="Status"
      />

      <InlineAlert tone="info">
        Bank reconciliation matches book entries against the bank statement.
        Unmatched book items are usually outstanding cheques; unmatched bank items are timing differences or errors.
        Statement import (CSV or MT940) will be available once the voucher module is complete.
      </InlineAlert>
    </div>
  );
}

type ReconRow = typeof SAMPLE_RECON[number];

function ReconciliationTable({
  title,
  rows,
  settings,
  emptyTitle,
  emptyDescription,
  renderLast,
  lastHeader,
}: {
  title: string;
  rows: ReconRow[];
  settings?: AppFormatSettingsSource | null;
  emptyTitle: string;
  emptyDescription: string;
  renderLast: (row: ReconRow) => React.ReactNode;
  lastHeader: string;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span className="filter-bar-end">{rows.length} {rows.length === 1 ? 'Item' : 'Items'}</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 120 }}>Date</th>
              <th>Description</th>
              <th className="num" style={{ width: 170 }}>Book Amount</th>
              <th className="num" style={{ width: 170 }}>Bank Amount</th>
              <th style={{ width: 120, textAlign: 'right' }}>{lastHeader}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <TableMessageRow colSpan={5} title={emptyTitle} description={emptyDescription} />}
            {rows.map(row => (
              <tr key={row.id}>
                <td className="cell-muted">{formatDate(row.date, settings)}</td>
                <td>{row.description}</td>
                <td className={row.gl_amount === null ? 'num cell-muted' : 'num'} style={negativeStyle(row.gl_amount)}>
                  {row.gl_amount === null ? 'Not Set' : formatMoney(row.gl_amount, settings)}
                </td>
                <td className={row.bank_amount === null ? 'num cell-muted' : 'num'} style={negativeStyle(row.bank_amount)}>
                  {row.bank_amount === null ? 'Not Set' : formatMoney(row.bank_amount, settings)}
                </td>
                <td className="cell-actions">{renderLast(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const totalFigureStyle: React.CSSProperties = {
  fontWeight: 600,
  color: 'var(--color-heading)',
  fontVariantNumeric: 'tabular-nums',
};

const ACCOUNT_TYPE_OPTIONS = ['Current', 'Savings', 'Payroll', 'Deposit', 'Other'].map(value => ({ value, label: value }));

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function BankPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [bankEntryOpen, setBankEntryOpen] = useState(false);
  const [pdcEntryOpen, setPdcEntryOpen] = useState(false);
  const { data: generalSettings } = useGeneralSettings();

  const TABS: Array<TabItem<Tab>> = [
    { value: 'accounts', label: 'Bank Accounts', icon: <IconBuildingBank size={16} stroke={1.8} /> },
    { value: 'cheque-books', label: 'Cheque Books', icon: <IconNotebook size={16} stroke={1.8} /> },
    { value: 'pdc', label: 'Post-Dated Cheques', icon: <IconCalendarDue size={16} stroke={1.8} /> },
    { value: 'reconciliation', label: 'Reconciliation', icon: <IconClipboardCheck size={16} stroke={1.8} /> },
  ];

  return (
    <main className="page-shell">
      <PageHeader
        title="Bank"
        description="Bank accounts, cheque books, post-dated cheques, and reconciliation."
        actions={(
          <>
            {activeTab === 'pdc' && !pdcEntryOpen && (
              <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setPdcEntryOpen(true)}>New Post-Dated Cheque</Button>
            )}
            {activeTab === 'accounts' && !bankEntryOpen && (
              <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => setBankEntryOpen(true)}>New Bank Account</Button>
            )}
          </>
        )}
      />

      <Tabs label="Bank Views" value={activeTab} onChange={setActiveTab} items={TABS} />

      <div role="tabpanel" aria-labelledby={`tab-${activeTab}`} style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'accounts'       && <BankAccountsTab settings={generalSettings} entryOpen={bankEntryOpen} onEntryOpenChange={setBankEntryOpen} />}
        {activeTab === 'cheque-books'   && <ChequeBooksTab settings={generalSettings} />}
        {activeTab === 'pdc'            && <PDCTab settings={generalSettings} entryOpen={pdcEntryOpen} onEntryOpenChange={setPdcEntryOpen} />}
        {activeTab === 'reconciliation' && <ReconciliationTab settings={generalSettings} />}
      </div>
    </main>
  );
}
