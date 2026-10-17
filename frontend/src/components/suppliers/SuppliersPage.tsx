'use client';

/**
 * SuppliersPage — Accounts Payable sub-ledger master.
 * List (search, business type, status) → full-page form with Identity, Contact, Financial, and Bank sections.
 */

import { useMemo, useState, type FormEvent } from 'react';
import { IconArrowLeft, IconCheck, IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import { useGeneralSettings } from '@/lib/api/settings';
import { useCitiesList } from '@/lib/api/geography';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSupplierAccounts,
  useSupplierNextCode,
  useSupplierStats,
  useSuppliersList,
  useUpdateSupplier,
} from '@/lib/api/parties';
import type { CreateSupplierInput } from '@/modules/suppliers/supplier.schema';
import { SUPPLIER_TYPES } from '@/modules/suppliers/supplier.schema';
import { APP_CURRENCY_OPTIONS } from '@/lib/app-settings';
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

interface SupplierRow {
  id: string; code: string; name: string; trade_name?: string | null;
  supplier_type: string; tax_registration_no?: string | null;
  party_type: 'Supplier' | 'Customer And Supplier'; main_role: 'Supplier';
  email?: string | null; phone?: string | null; mobile?: string | null;
  address?: string | null;
  city?: string | null; country?: string | null; postal_code?: string | null;
  payment_terms_days: number; currency_code: string;
  ap_account_id?: string | null; advance_account_id?: string | null;
  bank_name?: string | null; bank_account_no?: string | null;
  bank_swift_code?: string | null; bank_iban?: string | null;
  is_active: boolean; notes?: string | null;
}

type BusinessType = 'individual' | 'company' | 'government';

const EMPTY_FORM: CreateSupplierInput = {
  name: '', code: '', trade_name: '', supplier_type: 'company',
  party_type: 'Supplier', main_role: 'Supplier',
  tax_registration_no: '', email: '', phone: '', mobile: '',
  address: '', city: '', country: '', postal_code: '',
  payment_terms_days: 30, currency_code: 'PKR',
  ap_account_id: undefined, advance_account_id: undefined,
  bank_name: '', bank_account_no: '', bank_swift_code: '', bank_iban: '',
  is_active: true, notes: '',
};

const TYPE_FILTER_OPTIONS: Array<{ value: '' | BusinessType; label: string }> = [
  { value: '', label: 'All Types' },
  ...SUPPLIER_TYPES.map(type => ({ value: type as BusinessType, label: PARTY_BUSINESS_TYPE_LABELS[type] ?? type })),
];

export default function SuppliersPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSupplierInput>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | BusinessType>('');
  const [statusFilter, setStatusFilter] = useState<PartyStatusFilter>('Active');

  const listQuery = useSuppliersList({
    search: search || undefined,
    type: typeFilter || undefined,
    is_active: statusFilter === 'Active' ? true : undefined,
    page: 1, limit: 200,
  });
  const { data: statsData } = useSupplierStats();
  const { data: nextCode } = useSupplierNextCode(!editId && showForm);
  const { data: accounts = [] } = useSupplierAccounts();
  const { data: generalSettings } = useGeneralSettings();
  const citiesQuery = useCitiesList({ limit: 200, status: 'Active' });
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();
  const saving = createMut.isPending || updateMut.isPending;

  const rows = (listQuery.data?.data ?? []) as SupplierRow[];
  const isFiltered = Boolean(search || typeFilter);
  const linkedAccount = (accounts as PartyAccountOption[]).find(account => account.id === form.ap_account_id);

  // Suppliers store the city name; keep an older saved name selectable even if it is not in the City master.
  const cityOptions = useMemo(() => {
    const options = (citiesQuery.data?.data ?? []).map(city => ({
      value: city.name,
      label: city.state_name ? `${city.name} (${city.state_name})` : city.name,
      searchText: `${city.name} ${city.state_name ?? ''}`,
    }));
    if (form.city && !options.some(option => option.value === form.city)) options.unshift({ value: form.city, label: form.city, searchText: form.city });
    return [{ value: '', label: 'No City', searchText: '' }, ...options];
  }, [citiesQuery.data, form.city]);

  function setF<K extends keyof CreateSupplierInput>(key: K, value: CreateSupplierInput[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, code: nextCode ?? '', currency_code: generalSettings?.currency_code ?? EMPTY_FORM.currency_code });
    setFormError('');
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(s: SupplierRow) {
    setEditId(s.id);
    setForm({
      code: s.code, name: s.name, trade_name: s.trade_name ?? '',
      supplier_type: s.supplier_type as BusinessType,
      party_type: (s.party_type ?? 'Supplier') as 'Supplier' | 'Customer And Supplier',
      main_role: 'Supplier',
      tax_registration_no: s.tax_registration_no ?? '',
      email: s.email ?? '', phone: s.phone ?? '', mobile: s.mobile ?? '',
      address: s.address ?? '',
      city: s.city ?? '', country: s.country ?? '', postal_code: s.postal_code ?? '',
      payment_terms_days: s.payment_terms_days,
      currency_code: s.currency_code,
      ap_account_id: s.ap_account_id ?? undefined,
      advance_account_id: s.advance_account_id ?? undefined,
      bank_name: s.bank_name ?? '',
      bank_account_no: s.bank_account_no ?? '',
      bank_swift_code: s.bank_swift_code ?? '',
      bank_iban: s.bank_iban ?? '',
      is_active: s.is_active, notes: s.notes ?? '',
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
    if (!form.name.trim()) return setFormError('Enter the Supplier Name.');
    if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setFormError('Email is not valid. Use a format like accounts@company.com.');
    setFormError('');
    const payload = {
      ...form,
      code: form.code?.trim().toUpperCase() || undefined,
      email: form.email?.trim() || undefined,
      trade_name: form.trade_name?.trim() || undefined,
      tax_registration_no: form.tax_registration_no?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      mobile: form.mobile?.trim() || undefined,
      address: form.address?.trim() || undefined,
      city: form.city?.trim() || undefined,
      country: form.country?.trim() || undefined,
      postal_code: form.postal_code?.trim() || undefined,
      bank_name: form.bank_name?.trim() || undefined,
      bank_account_no: form.bank_account_no?.trim() || undefined,
      bank_swift_code: form.bank_swift_code?.trim() || undefined,
      bank_iban: form.bank_iban?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
    };
    const callbacks = {
      onSuccess: () => {
        setNotice({ tone: 'success' as const, text: `Supplier ${payload.name} saved.` });
        closeForm();
      },
      onError: (error: Error) => setFormError(friendlyErrorMessage(error, 'Unable to save Supplier.')),
    };
    if (editId) updateMut.mutate({ id: editId, ...payload }, callbacks);
    else createMut.mutate(payload, callbacks);
  }

  if (showForm) {
    return (
      <form className="page-shell" onSubmit={handleSubmit} noValidate>
        <PageHeader
          title={editId ? `Edit Supplier ${form.code ?? ''}`.trim() : 'New Supplier'}
          description="A Supplier sells to us. Each Supplier gets one Linked Account in Accounts Payable."
          actions={(
            <>
              <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={closeForm}>Back To List</Button>
              <Button variant="primary" type="submit" icon={<IconCheck size={16} stroke={1.8} />} loading={saving}>{editId ? 'Save Changes' : 'Save Supplier'}</Button>
            </>
          )}
        />

        {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}

        <section className="panel" style={{ overflow: 'auto' }}>
          <div className="panel-body">
            <div className="form-section">
              <h2 className="form-section-title">Identity</h2>
              <div className="form-grid">
                <TextField label="Supplier Code" value={form.code ?? ''} onChange={value => setF('code', value.toUpperCase())} placeholder={nextCode ?? 'SUP-0001'} inputProps={{ maxLength: 20 }} />
                <div className="span-2">
                  <TextField label="Supplier Name" required value={form.name} onChange={value => setF('name', value)} placeholder="Apex Machinery Parts" inputProps={{ maxLength: 200 }} />
                </div>
                <TextField label="Trade Name" value={form.trade_name ?? ''} onChange={value => setF('trade_name', value)} placeholder="Optional short name" inputProps={{ maxLength: 200 }} />
                <div>
                  <span className="field-label" aria-hidden>Business Type</span>
                  <SegmentedControl
                    label="Business Type"
                    value={form.supplier_type as BusinessType}
                    options={SUPPLIER_TYPES.map(type => ({ value: type as BusinessType, label: PARTY_BUSINESS_TYPE_LABELS[type] ?? type }))}
                    onChange={value => setF('supplier_type', value)}
                  />
                </div>
                <TextField label="Tax Registration No." value={form.tax_registration_no ?? ''} onChange={value => setF('tax_registration_no', value)} placeholder="VAT, GST, or NTN" inputProps={{ maxLength: 50 }} />
                <div className="span-2" style={{ display: 'flex', gap: 24, alignItems: 'end', minHeight: 52, flexWrap: 'wrap' }}>
                  <CheckboxField
                    label="Also Works As Customer"
                    checked={form.party_type === 'Customer And Supplier'}
                    onChange={checked => setForm(current => ({ ...current, party_type: checked ? 'Customer And Supplier' : 'Supplier', main_role: 'Supplier' }))}
                  />
                  <CheckboxField label="Active" checked={form.is_active} onChange={value => setF('is_active', value)} />
                </div>
              </div>
              {form.party_type === 'Customer And Supplier' && (
                <p className="form-hint">This party can also buy from us. Main Role stays Supplier and both sides use the same Linked Account.</p>
              )}
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Contact And Address</h2>
              <div className="form-grid">
                <div className="span-2">
                  <TextField label="Email" value={form.email ?? ''} onChange={value => setF('email', value)} placeholder="accounts@supplier.com" inputProps={{ type: 'email', maxLength: 200 }} />
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
                  <TextareaField label="Address" value={form.address ?? ''} onChange={value => setF('address', value)} rows={2} />
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
                <SelectField
                  label="Currency"
                  value={form.currency_code ?? ''}
                  options={APP_CURRENCY_OPTIONS.map(currency => ({ value: currency.code, label: currency.code }))}
                  onChange={value => setF('currency_code', value)}
                />
                <div className="span-2">
                  <LinkedAccountNotice isEdit={Boolean(editId)} account={linkedAccount} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Bank Details</h2>
              <div className="form-grid">
                <TextField label="Bank Name" value={form.bank_name ?? ''} onChange={value => setF('bank_name', value)} inputProps={{ maxLength: 100 }} />
                <TextField label="Account Number" value={form.bank_account_no ?? ''} onChange={value => setF('bank_account_no', value)} inputProps={{ maxLength: 50 }} />
                <TextField label="IBAN" value={form.bank_iban ?? ''} onChange={value => setF('bank_iban', value.toUpperCase())} inputProps={{ maxLength: 50 }} />
                <TextField label="SWIFT Code" value={form.bank_swift_code ?? ''} onChange={value => setF('bank_swift_code', value.toUpperCase())} inputProps={{ maxLength: 20 }} />
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
        title="Suppliers"
        description="People and businesses we buy from. Each Supplier has a Linked Account in Accounts Payable."
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Supplier</Button>}
      />

      {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}
      {listQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(listQuery.error, 'Unable to load Suppliers.')}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField label="Search Suppliers" value={searchText} onChange={setSearchText} onSubmit={applySearch} placeholder="Search by Name, Code, or Email, then press Enter" />
          </div>
          <select className="form-input" aria-label="Filter By Business Type" value={typeFilter} onChange={event => setTypeFilter(event.target.value as '' | BusinessType)} style={{ width: 160 }}>
            {TYPE_FILTER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <SegmentedControl label="Status Filter" value={statusFilter} options={PARTY_STATUS_OPTIONS} onChange={setStatusFilter} />
          {(search || searchText) && <Button variant="ghost" onClick={() => { setSearchText(''); setSearch(''); }}>Clear</Button>}
          <div className="filter-bar-end">
            <span>{statsData?.active ?? 0} Active of {statsData?.total ?? 0}</span>
            <span aria-hidden>·</span>
            <span>{statsData?.with_bank_details ?? 0} With Bank Details</span>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Code</th>
                <th>Supplier Name</th>
                <th style={{ width: 90 }}>Terms</th>
                <th style={{ width: 240 }}>Contact</th>
                <th style={{ width: 200 }}>Bank</th>
                <th style={{ width: 100 }}>Status</th>
                <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={7} title="Loading Suppliers…" loading />}
              {!listQuery.isLoading && rows.length === 0 && (
                isFiltered
                  ? <TableMessageRow colSpan={7} title="No Suppliers Match" description="Change the search text or the filters to see more Suppliers." />
                  : <TableMessageRow colSpan={7} title="No Suppliers Yet" description="Add your first Supplier. A Linked Account is created for it automatically." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Supplier</Button>} />
              )}
              {!listQuery.isLoading && rows.map(s => (
                <tr key={s.id} onDoubleClick={() => openEdit(s)}>
                  <td className="cell-strong">{s.code}</td>
                  <td className="cell-stack">
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <span className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                      {s.party_type === 'Customer And Supplier' && <Badge variant="info">Also Customer</Badge>}
                    </span>
                    <span className="cell-sub">{[PARTY_BUSINESS_TYPE_LABELS[s.supplier_type], s.trade_name].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td>Net {s.payment_terms_days}</td>
                  <td className="cell-stack">
                    {s.email || s.phone
                      ? <><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{s.email || s.phone}</span>{s.email && s.phone && <span className="cell-sub">{s.phone}</span>}</>
                      : <span className="cell-muted">Not Set</span>}
                  </td>
                  <td className="cell-stack">
                    {s.bank_account_no || s.bank_iban
                      ? <><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{s.bank_name || 'Bank'}</span><span className="cell-sub">{s.bank_iban || s.bank_account_no}</span></>
                      : <span className="cell-muted">Not Set</span>}
                  </td>
                  <td><Badge variant={s.is_active ? 'success' : 'neutral'}>{s.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="cell-actions">
                    <span className="row-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(s)} aria-label={`Edit Supplier ${s.name}`} title="Edit Supplier" />
                      <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: s.id, name: s.name })} aria-label={`Delete Supplier ${s.name}`} title="Delete Supplier" />
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
        title="Delete Supplier?"
        message={`"${deleteTarget?.name}" will be marked inactive and hidden from new transactions.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget.id, {
          onSuccess: () => { setNotice({ tone: 'success', text: `Supplier ${deleteTarget.name} marked inactive.` }); setDeleteTarget(null); },
          onError: (error: Error) => { setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Unable to delete Supplier.') }); setDeleteTarget(null); },
        })}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
