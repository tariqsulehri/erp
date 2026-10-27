'use client';

/**
 * CustomersPage — Accounts Receivable sub-ledger master.
 * List (search, business type, status) → full-page form with Identity, Contact, and Financial sections.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { IconArrowLeft, IconCheck, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCitiesList } from '@/lib/api/geography';
import {
  useCreateCustomer,
  useCustomerAccounts,
  useCustomerNextCode,
  useCustomerStats,
  useCustomersList,
  useDeleteCustomer,
  useUpdateCustomer,
} from '@/lib/api/parties';
import type { CreateCustomerInput } from '@/modules/customers/customer.schema';
import { CUSTOMER_TYPES } from '@/modules/customers/customer.schema';
import { APP_CURRENCY_OPTIONS, defaultAppFormatSettings, formatMoney } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, NumericField, SelectField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { LinkedAccountNotice, PARTY_BUSINESS_TYPE_LABELS, PARTY_STATUS_OPTIONS, type PartyAccountOption, type PartyStatusFilter } from '@/components/parties/PartyShared';

interface CustomerRow {
  id: string; code: string; name: string; trade_name?: string | null;
  customer_type: string; tax_registration_no?: string | null;
  party_type: 'Customer' | 'Customer And Supplier'; main_role: 'Customer';
  email?: string | null; phone?: string | null; mobile?: string | null;
  billing_address?: string | null; shipping_address?: string | null;
  city?: string | null; country?: string | null; postal_code?: string | null;
  payment_terms_days: number; credit_limit: number; currency_code: string;
  ar_account_id?: string | null; advance_account_id?: string | null;
  ar_account_code?: string | null; ar_account_name?: string | null;
  is_active: boolean; notes?: string | null;
}

type BusinessType = 'individual' | 'company' | 'government';

const EMPTY_FORM: CreateCustomerInput = {
  name: '', code: '', trade_name: '', customer_type: 'company',
  party_type: 'Customer', main_role: 'Customer',
  tax_registration_no: '', email: '', phone: '', mobile: '',
  billing_address: '', shipping_address: '', city: '', country: '', postal_code: '',
  payment_terms_days: 30, credit_limit: 0, currency_code: defaultAppFormatSettings.currencyCode,
  ar_account_id: undefined, advance_account_id: undefined,
  is_active: true, notes: '',
};

const TYPE_FILTER_OPTIONS: Array<{ value: '' | BusinessType; label: string }> = [
  { value: '', label: 'All Types' },
  ...CUSTOMER_TYPES.map(type => ({ value: type as BusinessType, label: PARTY_BUSINESS_TYPE_LABELS[type] ?? type })),
];

export default function CustomersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCustomerInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | BusinessType>('');
  const [statusFilter, setStatusFilter] = useState<PartyStatusFilter>('Active');

  const listQuery = useCustomersList({
    search: search || undefined,
    type: typeFilter || undefined,
    is_active: statusFilter === 'Active' ? true : undefined,
    page: 1, limit: 200,
  });
  const { data: statsData } = useCustomerStats();
  const { data: nextCode } = useCustomerNextCode(!editId && showForm);
  const { data: accounts = [] } = useCustomerAccounts();
  const { data: generalSettings } = useGeneralSettings();
  const citiesQuery = useCitiesList({ limit: 200, status: 'Active' });
  const createMut = useCreateCustomer();
  const updateMut = useUpdateCustomer();
  const deleteMut = useDeleteCustomer();
  const saving = createMut.isPending || updateMut.isPending;

  const rows = (listQuery.data?.data ?? []) as CustomerRow[];
  const isFiltered = Boolean(search || typeFilter);
  const linkedAccount = (accounts as PartyAccountOption[]).find(account => account.id === form.ar_account_id);

  // Customers store the city name; keep an older saved name selectable even if it is not in the City master.
  const cityOptions = useMemo(() => {
    const options = (citiesQuery.data?.data ?? []).map(city => ({
      value: city.name,
      label: city.state_name ? `${city.name} (${city.state_name})` : city.name,
      searchText: `${city.name} ${city.state_name ?? ''}`,
    }));
    if (form.city && !options.some(option => option.value === form.city)) options.unshift({ value: form.city, label: form.city, searchText: form.city });
    return [{ value: '', label: 'No City', searchText: '' }, ...options];
  }, [citiesQuery.data, form.city]);

  function setF<K extends keyof CreateCustomerInput>(key: K, value: CreateCustomerInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, code: nextCode ?? '', currency_code: generalSettings?.currency_code ?? EMPTY_FORM.currency_code });
    setFormError('');
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(c: CustomerRow) {
    setEditId(c.id);
    setForm({
      code: c.code, name: c.name, trade_name: c.trade_name ?? '',
      customer_type: c.customer_type as BusinessType,
      party_type: (c.party_type ?? 'Customer') as 'Customer' | 'Customer And Supplier',
      main_role: 'Customer',
      tax_registration_no: c.tax_registration_no ?? '',
      email: c.email ?? '', phone: c.phone ?? '', mobile: c.mobile ?? '',
      billing_address: c.billing_address ?? '', shipping_address: c.shipping_address ?? '',
      city: c.city ?? '', country: c.country ?? '', postal_code: c.postal_code ?? '',
      payment_terms_days: c.payment_terms_days, credit_limit: c.credit_limit,
      currency_code: c.currency_code,
      ar_account_id: c.ar_account_id ?? undefined,
      advance_account_id: c.advance_account_id ?? undefined,
      is_active: c.is_active, notes: c.notes ?? '',
    });
    setFormError('');
    setNotice(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function applySearch() {
    setSearch(searchText.trim());
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return setFormError('Enter the Customer Name.');
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setFormError('Email is not correct. Use a format like accounts@company.com.');
    setFormError('');
    const payload = {
      ...form,
      code: form.code?.trim().toUpperCase() || undefined,
      email: form.email?.trim() || undefined,
      trade_name: form.trade_name?.trim() || undefined,
      tax_registration_no: form.tax_registration_no?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      mobile: form.mobile?.trim() || undefined,
      billing_address: form.billing_address?.trim() || undefined,
      shipping_address: form.shipping_address?.trim() || undefined,
      city: form.city?.trim() || undefined,
      country: form.country?.trim() || undefined,
      postal_code: form.postal_code?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    const callbacks = {
      onSuccess: () => {
        setNotice({ tone: 'success' as const, text: `Customer ${payload.name} saved.` });
        closeForm();
      },
      onError: (error: Error) => setFormError(friendlyErrorMessage(error, 'Could not save Customer. Please try again.')),
    };
    if (editId) updateMut.mutate({ id: editId, ...payload }, callbacks);
    else createMut.mutate(payload, callbacks);
  }

  if (showForm) {
    return (
      <form className="page-shell" onSubmit={handleSubmit} noValidate>
        <PageHeader
          title={editId ? `Edit Customer ${form.code ?? ''}`.trim() : 'New Customer'}
          description="A Customer buys from us. Each Customer gets one Linked Account in Accounts Receivable."
          help={(
            <>
              <p>Enter the Customer details and click Save. Only Customer Name is required.</p>
              <p>When you save a new Customer, the system creates its Linked Account in Accounts Receivable for you.</p>
              <p>Tick Also Works As Supplier if this party also sells to us. Both sides then use the same Linked Account.</p>
            </>
          )}
          actions={(
            <>
              <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={closeForm}>Back To List</Button>
              <Button variant="primary" type="submit" icon={<IconCheck size={16} stroke={1.8} />} loading={saving}>{editId ? 'Save Changes' : 'Save Customer'}</Button>
            </>
          )}
        />

        {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}

        <section className="panel" style={{ overflow: 'auto' }}>
          <div className="panel-body">
            <div className="form-section">
              <h2 className="form-section-title">Identity</h2>
              <div className="form-grid">
                <TextField label="Customer Code" value={form.code ?? ''} onChange={value => setF('code', value.toUpperCase())} placeholder={nextCode ?? 'CUS-0001'} inputProps={{ maxLength: 20 }} />
                <div className="span-2">
                  <TextField label="Customer Name" required value={form.name} onChange={value => setF('name', value)} placeholder="ABC Corporation Ltd." inputProps={{ maxLength: 200 }} />
                </div>
                <TextField label="Trade Name" value={form.trade_name ?? ''} onChange={value => setF('trade_name', value)} placeholder="Optional short name" inputProps={{ maxLength: 200 }} />
                <div>
                  <span className="field-label" aria-hidden>Business Type</span>
                  <SegmentedControl
                    label="Business Type"
                    value={form.customer_type as BusinessType}
                    options={CUSTOMER_TYPES.map(type => ({ value: type as BusinessType, label: PARTY_BUSINESS_TYPE_LABELS[type] ?? type }))}
                    onChange={value => setF('customer_type', value)}
                  />
                </div>
                <TextField label="Tax Registration No." value={form.tax_registration_no ?? ''} onChange={value => setF('tax_registration_no', value)} placeholder="VAT, GST, or NTN" inputProps={{ maxLength: 50 }} />
                <div className="span-2" style={{ display: 'flex', gap: 24, alignItems: 'end', minHeight: 52, flexWrap: 'wrap' }}>
                  <CheckboxField
                    label="Also Works As Supplier"
                    checked={form.party_type === 'Customer And Supplier'}
                    onChange={checked => setForm(current => ({ ...current, party_type: checked ? 'Customer And Supplier' : 'Customer', main_role: 'Customer' }))}
                  />
                  <CheckboxField label="Active" checked={form.is_active} onChange={value => setF('is_active', value)} />
                </div>
              </div>
              {form.party_type === 'Customer And Supplier' && (
                <p className="form-hint">This party can also supply items to us. Main Role stays Customer and both sides use the same Linked Account.</p>
              )}
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Contact And Address</h2>
              <div className="form-grid">
                <div className="span-2">
                  <TextField label="Email" value={form.email ?? ''} onChange={value => setF('email', value)} placeholder="accounts@customer.com" inputProps={{ type: 'email', maxLength: 200 }} />
                </div>
                <TextField label="Phone" value={form.phone ?? ''} onChange={value => setF('phone', value)} inputProps={{ type: 'tel', maxLength: 30 }} />
                <TextField label="Mobile" value={form.mobile ?? ''} onChange={value => setF('mobile', value)} inputProps={{ type: 'tel', maxLength: 30 }} />
                <FieldLabel label="City">
                  <SearchableSelect value={form.city ?? ''} options={cityOptions} onChange={value => setF('city', value)} placeholder={citiesQuery.isLoading ? 'Loading Cities' : 'Search City'} disabled={citiesQuery.isLoading} />
                </FieldLabel>
                <TextField label="Country" value={form.country ?? ''} onChange={value => setF('country', value)} inputProps={{ maxLength: 100 }} />
                <TextField label="Postal Code" value={form.postal_code ?? ''} onChange={value => setF('postal_code', value)} inputProps={{ maxLength: 20 }} />
                <div />
                <div className="span-2">
                  <TextareaField label="Billing Address" value={form.billing_address ?? ''} onChange={value => setF('billing_address', value)} rows={2} />
                </div>
                <div className="span-2">
                  <TextareaField label="Delivery Address" value={form.shipping_address ?? ''} onChange={value => setF('shipping_address', value)} placeholder="Leave blank if the same as the Billing Address" rows={2} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Financial</h2>
              <div className="form-grid">
                <NumericField
                  label="Payment Terms (Days)"
                  value={String(form.payment_terms_days ?? 0)}
                  decimalPlaces={0}
                  onChange={value => setF('payment_terms_days', Math.max(0, Math.min(365, Number(value) || 0)))}
                />
                <NumericField label="Credit Limit" value={String(form.credit_limit ?? 0)} decimalPlaces={2} onChange={value => setF('credit_limit', Number(value) || 0)} />
                <SelectField
                  label="Currency"
                  value={form.currency_code ?? ''}
                  options={APP_CURRENCY_OPTIONS.map(currency => ({ value: currency.code, label: currency.code }))}
                  onChange={value => setF('currency_code', value)}
                />
                <div />
                <div className="span-2">
                  <LinkedAccountNotice isEdit={Boolean(editId)} account={linkedAccount} />
                </div>
                <div className="span-2">
                  <TextareaField label="Notes" value={form.notes ?? ''} onChange={value => setF('notes', value)} placeholder="Internal notes, not printed" rows={2} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </form>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Customers"
        description="People and businesses who buy from us. Each Customer has a Linked Account in Accounts Receivable."
        help={(
          <>
            <p>Use this screen to see and manage your Customers.</p>
            <ul>
              <li>New Customer adds a Customer.</li>
              <li>The pencil, or a double-click on a row, opens a Customer to change it.</li>
              <li>Delete does not remove the Customer. It marks the Customer Inactive and hides it from new transactions.</li>
            </ul>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Customer</Button>}
      />

      {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}
      {listQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(listQuery.error, 'Could not load Customers. Please try again.')}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField label="Search Customers" value={searchText} onChange={setSearchText} onSubmit={applySearch} placeholder="Search by Name, Code, or Email, then press Enter" />
          </div>
          <select className="form-input" aria-label="Filter By Business Type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as '' | BusinessType)} style={{ width: 160 }}>
            {TYPE_FILTER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <SegmentedControl label="Status Filter" value={statusFilter} options={PARTY_STATUS_OPTIONS} onChange={setStatusFilter} />
          {(search || searchText) && <Button variant="ghost" onClick={() => { setSearchText(''); setSearch(''); }}>Clear</Button>}
          <div className="filter-bar-end">
            <span>{statsData?.active ?? 0} Active of {statsData?.total ?? 0}</span>
            <span aria-hidden>·</span>
            <span>Total Credit Limit <strong style={{ color: 'var(--color-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(statsData?.total_credit_limit ?? 0, generalSettings)}</strong></span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Code</th>
                <th>Customer Name</th>
                <th style={{ width: 210 }}>Linked Account</th>
                <th className="num" style={{ width: 150 }}>Credit Limit</th>
                <th style={{ width: 90 }}>Terms</th>
                <th style={{ width: 230 }}>Contact</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={8} title="Loading Customers…" loading />}
              {!listQuery.isLoading && rows.length === 0 && (
                isFiltered
                  ? <TableMessageRow colSpan={8} title="No Customers Match" description="Change the search text or the filters to see more Customers." />
                  : <TableMessageRow colSpan={8} title="No Customers Yet" description="Add your first Customer. A Linked Account is created for it automatically." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Customer</Button>} />
              )}
              {!listQuery.isLoading && rows.map(c => (
                <tr key={c.id} onDoubleClick={() => openEdit(c)}>
                  <td className="cell-strong">{c.code}</td>
                  <td className="cell-stack">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      {c.party_type === 'Customer And Supplier' && <Badge variant="info">Also Supplier</Badge>}
                    </span>
                    <span className="cell-sub">{[PARTY_BUSINESS_TYPE_LABELS[c.customer_type], c.trade_name].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="cell-stack">
                    {c.ar_account_code
                      ? <><span>{c.ar_account_code}</span><span className="cell-sub">{c.ar_account_name}</span></>
                      : <span className="cell-muted">Not Assigned</span>}
                  </td>
                  <td className="num">{formatMoney(c.credit_limit ?? 0, generalSettings)}</td>
                  <td>Net {c.payment_terms_days}</td>
                  <td className="cell-stack">
                    {c.email || c.phone
                      ? <><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{c.email || c.phone}</span>{c.email && c.phone && <span className="cell-sub">{c.phone}</span>}</>
                      : <span className="cell-muted">Not Set</span>}
                  </td>
                  <td><Badge variant={c.is_active ? 'success' : 'neutral'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="cell-actions">
                    <span className="row-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(c)} aria-label={`Edit Customer ${c.name}`} title="Edit Customer" />
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: c.id, name: c.name })} aria-label={`Delete Customer ${c.name}`} title="Delete Customer" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Delete Customer?"
        message={`"${deleteTarget?.name}" will be marked inactive and hidden from new transactions.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id, {
          onSuccess: () => { setNotice({ tone: 'success', text: `Customer ${deleteTarget.name} marked inactive.` }); setDeleteTarget(null); },
          onError: (error: Error) => { setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Could not delete Customer. Please try again.') }); setDeleteTarget(null); },
        })}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
