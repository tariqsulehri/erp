'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconArrowLeft, IconCheck, IconPackage, IconPencil, IconPlus, IconRefresh } from '@tabler/icons-react';
import { type BranchPayload, type BranchRow, branchesQueryKey, useBranchesList, useCreateBranch, useUpdateBranch } from '@/lib/api/branches';
import { useCitiesList } from '@/lib/api/geography';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { CheckboxField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { BranchStockView } from './BranchStockView';

const EMPTY_FORM = {
  code: '',
  name: '',
  manager_name: '',
  city: '',
  phone: '',
  email: '',
  address: '',
  description: '',
  is_default: false,
  is_active: true,
};

type StatusFilter = 'All' | 'Active' | 'Inactive';
type Notice = { tone: 'success' | 'danger'; text: string } | null;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function BranchManagementPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<Notice>(null);
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('All');
  const [page, setPage] = useState(1);
  const [stockBranch, setStockBranch] = useState<BranchRow | null>(null);

  const branchesQuery = useBranchesList({ page, limit: 50, search: search.trim() || undefined, status });
  const citiesQuery = useCitiesList({ limit: 200, status: 'Active' });
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const saving = createBranch.isPending || updateBranch.isPending;

  // Branch stores the city name; keep an older saved name selectable even if it is not in the City master.
  const cityOptions = useMemo(() => {
    const options = (citiesQuery.data?.data ?? []).map(city => ({
      value: city.name,
      label: city.state_name ? `${city.name} (${city.state_name})` : city.name,
      searchText: `${city.name} ${city.state_name ?? ''}`,
    }));
    if (form.city && !options.some(option => option.value === form.city)) options.unshift({ value: form.city, label: form.city, searchText: form.city });
    return [{ value: '', label: 'No City', searchText: '' }, ...options];
  }, [citiesQuery.data, form.city]);

  const branches = branchesQuery.data?.data ?? [];
  const total = branchesQuery.data?.pagination.total ?? 0;
  const isFiltered = Boolean(search) || status !== 'All';
  const listError = branchesQuery.error ? friendlyErrorMessage(branchesQuery.error, 'Could not load Branches. Please try again.') : '';

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: branchesQueryKey });
  }

  function applySearch() {
    setSearch(searchText.trim());
    setPage(1);
  }

  function openNew() {
    setEditId('');
    setForm(EMPTY_FORM);
    setNotice(null);
    setShowForm(true);
  }

  function openEdit(branch: BranchRow) {
    setEditId(branch.id);
    setForm({
      code: branch.code,
      name: branch.name,
      manager_name: branch.manager_name ?? '',
      city: branch.city ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      address: branch.address ?? '',
      description: branch.description ?? '',
      is_default: branch.is_default,
      is_active: branch.is_active,
    });
    setNotice(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId('');
    setForm(EMPTY_FORM);
  }

  function validate() {
    if (!form.code.trim()) return 'Enter a Branch Code.';
    if (!form.name.trim()) return 'Enter a Branch Name.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email is not correct. Use a format like name@company.com.';
    return '';
  }

  function saveBranch(event?: FormEvent) {
    event?.preventDefault();
    const validationMessage = validate();
    if (validationMessage) {
      setNotice({ tone: 'danger', text: validationMessage });
      return;
    }

    const payload: BranchPayload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      manager_name: form.manager_name.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      is_default: form.is_default,
      is_active: form.is_active,
    };

    const onSuccess = () => {
      refresh();
      setNotice({ tone: 'success', text: `Branch ${payload.code} saved.` });
      if (!editId) closeForm();
    };
    const onError = (error: Error) => setNotice({ tone: 'danger', text: friendlyErrorMessage(error, 'Could not save Branch. Please try again.') });

    if (editId) updateBranch.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createBranch.mutate(payload, { onSuccess, onError });
  }

  if (stockBranch) return <BranchStockView branch={stockBranch} onBack={() => setStockBranch(null)} />;

  if (showForm) {
    return (
      <form className="page-shell" onSubmit={saveBranch} noValidate>
        <PageHeader
          title={editId ? `Edit Branch ${form.code}` : 'New Branch'}
          description="A Branch is a shop that holds its own stock and sells. It receives stock from Warehouses by Stock Transfer."
          help={(
            <>
              <p>Enter the Branch details and click Save Branch.</p>
              <p>Branch Code and Branch Name are required. The code cannot be the same as another Branch.</p>
              <p>The Default Branch is selected first on new transactions. Clear Active to stop using a Branch on new transactions.</p>
            </>
          )}
          actions={(
            <>
              <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={closeForm}>Back To List</Button>
              <Button variant="primary" type="submit" icon={<IconCheck size={16} stroke={1.8} />} loading={saving}>Save Branch</Button>
            </>
          )}
        />

        {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}

        <section className="panel" style={{ overflow: 'auto' }}>
          <div className="panel-body">
            <div className="form-section">
              <h2 className="form-section-title">Branch Details</h2>
              <div className="form-grid">
                <TextField label="Branch Code" required value={form.code} onChange={value => setField('code', value.toUpperCase())} placeholder="BR-001" />
                <div className="span-2">
                  <TextField label="Branch Name" required value={form.name} onChange={value => setField('name', value)} placeholder="Lahore Main Branch" />
                </div>
                <TextField label="Manager Name" value={form.manager_name} onChange={value => setField('manager_name', value)} />
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Contact And Location</h2>
              <div className="form-grid">
                <FieldLabel label="City">
                  <SearchableSelect value={form.city} options={cityOptions} onChange={value => setField('city', value)} placeholder={citiesQuery.isLoading ? 'Loading Cities' : 'Search City'} disabled={citiesQuery.isLoading} />
                </FieldLabel>
                <TextField label="Phone" value={form.phone} onChange={value => setField('phone', value)} inputProps={{ type: 'tel' }} />
                <div className="span-2">
                  <TextField label="Email" value={form.email} onChange={value => setField('email', value)} inputProps={{ type: 'email' }} placeholder="branch@company.com" />
                </div>
                <div className="span-2">
                  <TextareaField label="Address" value={form.address} onChange={value => setField('address', value)} rows={2} />
                </div>
                <div className="span-2">
                  <TextareaField label="Description" value={form.description} onChange={value => setField('description', value)} rows={2} />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h2 className="form-section-title">Settings</h2>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <CheckboxField label="Default Branch" checked={form.is_default} onChange={value => setField('is_default', value)} />
                <CheckboxField label="Active" checked={form.is_active} onChange={value => setField('is_active', value)} />
              </div>
              <p className="form-hint">The Default Branch is selected first on new transactions. Inactive Branches cannot be used on new transactions.</p>
            </div>
          </div>
        </section>
      </form>
    );
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Branches"
        description="Shops in each city. Each Branch holds its own stock, receives stock from Warehouses, and makes sales."
        help={(
          <>
            <p>Use this screen to see and manage your Branches (shops).</p>
            <ul>
              <li>New Branch adds a shop.</li>
              <li>The box icon shows the stock held at a Branch.</li>
              <li>The pencil, or a double-click on a row, opens the Branch to change it.</li>
            </ul>
            <p>A Branch gets stock only from a Warehouse, by Stock Transfer.</p>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={refresh} loading={branchesQuery.isFetching && !branchesQuery.isLoading}>Refresh</Button>
            <Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Branch</Button>
          </>
        )}
      />

      {notice && <InlineAlert tone={notice.tone}>{notice.text}</InlineAlert>}
      {listError && <InlineAlert tone="danger">{listError}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField
              label="Search Branches"
              value={searchText}
              onChange={setSearchText}
              onSubmit={applySearch}
              placeholder="Search by Code, Name, City, or Manager, then press Enter"
            />
          </div>
          <SegmentedControl label="Status Filter" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          {(search || searchText) && (
            <Button variant="ghost" onClick={() => { setSearchText(''); setSearch(''); setPage(1); }}>Clear</Button>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Code</th>
                <th>Branch Name</th>
                <th style={{ width: 170 }}>City</th>
                <th style={{ width: 180 }}>Manager</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 96 }}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {branchesQuery.isLoading && <TableMessageRow colSpan={6} title="Loading Branches…" loading />}
              {!branchesQuery.isLoading && branches.length === 0 && (
                isFiltered
                  ? <TableMessageRow colSpan={6} title="No Branches Match" description="Change the search text or the status filter to see more Branches." />
                  : <TableMessageRow colSpan={6} title="No Branches Yet" description="Add your first Branch, then send it stock from a Warehouse by Stock Transfer." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Branch</Button>} />
              )}
              {!branchesQuery.isLoading && branches.map(branch => (
                <tr key={branch.id} onDoubleClick={() => openEdit(branch)}>
                  <td className="cell-strong">{branch.code}</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{branch.name}</span>
                      {branch.is_default && <Badge variant="info">Default</Badge>}
                    </span>
                  </td>
                  <td className={branch.city ? undefined : 'cell-muted'}>{branch.city || 'Not Set'}</td>
                  <td className={branch.manager_name ? undefined : 'cell-muted'}>{branch.manager_name || 'Not Set'}</td>
                  <td><Badge variant={branch.is_active ? 'success' : 'neutral'}>{branch.is_active ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="cell-actions">
                    <span className="row-actions">
                      <Button variant="ghost" size="sm" icon={<IconPackage size={16} stroke={1.8} />} onClick={() => setStockBranch(branch)} aria-label={`View Stock At ${branch.code}`} title="View Stock" />
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(branch)} aria-label={`Edit Branch ${branch.code}`} title="Edit Branch" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={branchesQuery.data?.pagination.pages || 1}
          totalRecords={total}
          recordLabel={total === 1 ? 'Branch' : 'Branches'}
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}
