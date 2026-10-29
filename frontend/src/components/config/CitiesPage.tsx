'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import { citiesQueryKey, useCreateCity, useCitiesList, useUpdateCity, useStatesList, type CityRow } from '@/lib/api/geography';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckboxField, SelectField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

const EMPTY_FORM = { name: '', state_id: '', is_active: true };
type FormState = typeof EMPTY_FORM;
type StatusFilter = 'All' | 'Active' | 'Inactive';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function CitiesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filterStateId, setFilterStateId] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('All');

  const citiesQuery = useCitiesList({
    page,
    limit: 25,
    search: search.trim() || undefined,
    state_id: filterStateId || undefined,
    status: status === 'All' ? undefined : status,
  });
  const { data: statesData } = useStatesList({ limit: 200, status: 'Active' });
  const createMut = useCreateCity();
  const updateMut = useUpdateCity();
  const saving = createMut.isPending || updateMut.isPending;

  const activeStates = statesData?.data ?? [];
  const cities = citiesQuery.data?.data ?? [];
  const pagination = citiesQuery.data?.pagination ?? { total: 0, page: 1, limit: 25, pages: 1 };
  const isFiltered = Boolean(search.trim() || filterStateId || status !== 'All');

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, state_id: filterStateId });
    setFormError('');
    setSavedMessage('');
    setShowForm(true);
  }

  function openEdit(row: CityRow) {
    setEditId(row.id);
    setForm({ name: row.name, state_id: row.state_id, is_active: row.is_active });
    setFormError('');
    setSavedMessage('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.state_id) return setFormError('Select a State Or Province.');
    if (!form.name.trim()) return setFormError('Enter a City Name.');
    setFormError('');

    const payload = { name: form.name.trim(), state_id: form.state_id, is_active: form.is_active };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: citiesQueryKey });
      setSavedMessage(`City ${payload.name} saved.`);
      closeForm();
    };
    const onError = (error: Error) => setFormError(friendlyErrorMessage(error, 'Could not save City. Please try again.'));

    if (editId) updateMut.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createMut.mutate(payload, { onSuccess, onError });
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Cities"
        description="Cities inside each State Or Province. Areas belong to a City."
        help={(
          <>
            <p>Use this screen to keep the list of Cities used in addresses.</p>
            <p>Click New City and choose its State Or Province. Click the pencil or double-click a row to change it.</p>
            <p>Clear Active to stop a City from being chosen on new records. Old records keep it.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New City</Button>}
      />

      {savedMessage && <InlineAlert tone="success">{savedMessage}</InlineAlert>}
      {citiesQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(citiesQuery.error, 'Could not load Cities. Please try again.')}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField label="Search Cities" value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Search by City Name" />
            </div>
            <div style={{ width: 170 }}>
              <SearchableSelect
                value={filterStateId}
                options={activeStates.map(state => ({ value: state.id, label: state.name }))}
                onChange={value => { setFilterStateId(value); setPage(1); }}
                placeholder="All States"
                ariaLabel="Filter By State Or Province"
              />
            </div>
            <div style={{ width: 140 }}>
              <SearchableSelect
                value={status}
                options={STATUS_OPTIONS}
                placeholder="Status"
                hidePlaceholderOption
                onChange={value => { setStatus((value || 'All') as StatusFilter); setPage(1); }}
                ariaLabel="Status Filter"
              />
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>City Name</th>
                  <th style={{ width: '26%' }}>State Or Province</th>
                  <th className="num" style={{ width: 130 }}>Active Areas</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {citiesQuery.isLoading && <TableMessageRow colSpan={5} title="Loading Cities…" loading />}
                {!citiesQuery.isLoading && cities.length === 0 && (
                  isFiltered
                    ? <TableMessageRow colSpan={5} title="No Cities Match" description="Change the search text or the filters to see more Cities." />
                    : <TableMessageRow colSpan={5} title="No Cities Yet" description="Add a City to a State Or Province, then add its Areas." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New City</Button>} />
                )}
                {!citiesQuery.isLoading && cities.map(city => (
                  <tr key={city.id} className={editId === city.id ? 'is-selected' : undefined} onDoubleClick={() => openEdit(city)}>
                    <td className="cell-strong">{city.name}</td>
                    <td className="cell-muted">{city.state_name ?? 'Not Set'}</td>
                    <td className="num">{city.active_area_count ?? 0}</td>
                    <td><Badge variant={city.is_active ? 'success' : 'neutral'}>{city.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="cell-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(city)} aria-label={`Edit City ${city.name}`} title="Edit City" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationBar
            page={page}
            totalPages={pagination.pages || 1}
            totalRecords={pagination.total}
            recordLabel={pagination.total === 1 ? 'City' : 'Cities'}
            onPageChange={setPage}
          />
        </section>

        {showForm && (
          <SidePanel
            title={editId ? 'Edit City' : 'New City'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save City'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <SelectField
              label="State Or Province"
              required
              value={form.state_id}
              placeholder="Select State Or Province"
              options={activeStates.map(state => ({ value: state.id, label: state.name }))}
              onChange={value => setField('state_id', value)}
              disabled={saving}
            />
            <TextField label="City Name" required value={form.name} onChange={value => setField('name', value)} placeholder="For example Lahore" disabled={saving} />
            <CheckboxField label="Active" checked={form.is_active} onChange={value => setField('is_active', value)} disabled={saving} />
            <p className="form-hint" style={{ marginTop: -8 }}>Inactive Cities stay on old records but cannot be chosen on new ones.</p>
          </SidePanel>
        )}
      </div>
    </main>
  );
}
