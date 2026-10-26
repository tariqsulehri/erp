'use client';

/**
 * Bank Module
 *
 * Tabs:
 *  Accounts        — Bank accounts registered in the system
 *  Cheque Books    — Bank cheque books and cheque leaves
 */

import { useEffect, useState } from 'react';
import { formatMoney, normalizeFormatSettings, type AppFormatSettingsSource } from '@/lib/app-settings';
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
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { ChequeBooksTab } from '@/components/bank/ChequeBooksTab';

// Post-Dated Cheques and Reconciliation return once they are built on saved data (they only showed samples).
type Tab = 'accounts' | 'cheque-books';

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

// New bank accounts start in the company currency from Regional Settings.
const blankBankForm = (currencyCode: string): BankAccountPayload => ({
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
  currency_code: currencyCode,
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
  const [form, setForm] = useState<BankAccountPayload>(() => blankBankForm(formatSettings.currencyCode));
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
      setForm(blankBankForm(formatSettings.currencyCode));
      setMessage(null);
    }
    setEntryWasOpen(entryOpen);
  }, [editingId, entryOpen, entryWasOpen, formatSettings.currencyCode]);

  function patchForm(patch: Partial<BankAccountPayload>) {
    setForm(current => ({ ...current, ...patch }));
  }

  function startNew() {
    setEditingId('');
    setForm(blankBankForm(formatSettings.currencyCode));
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
      setForm(blankBankForm(formatSettings.currencyCode));
      onEntryOpenChange(false);
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Bank Account.') });
    }
  }

  function cancelEntry() {
    onEntryOpenChange(false);
    setEditingId('');
    setForm(blankBankForm(formatSettings.currencyCode));
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
                  description="Add a Bank Account to track balances and cheque books."
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

const ACCOUNT_TYPE_OPTIONS = ['Current', 'Savings', 'Payroll', 'Deposit', 'Other'].map(value => ({ value, label: value }));

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function BankPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const [bankEntryOpen, setBankEntryOpen] = useState(false);
  const { data: generalSettings } = useGeneralSettings();

  const TABS: Array<TabItem<Tab>> = [
    { value: 'accounts', label: 'Bank Accounts', icon: <IconBuildingBank size={16} stroke={1.8} /> },
    { value: 'cheque-books', label: 'Cheque Books', icon: <IconNotebook size={16} stroke={1.8} /> },
  ];

  return (
    <main className="page-shell">
      <PageHeader
        title="Bank"
        description="Bank accounts and cheque books."
        actions={(
          <>
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
      </div>
    </main>
  );
}
