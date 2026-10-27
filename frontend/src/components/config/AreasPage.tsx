'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import {
  areasQueryKey,
  useCreateArea,
  useAreasList,
  useUpdateArea,
  useCitiesList,
  useStatesList,
  type AreaRow,
} from '@/lib/api/geography';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckboxField, SelectField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

const EMPTY_FORM = { name: '', state_id: '', city_id: '', is_active: true };
type FormState = typeof EMPTY_FORM;
type StatusFilter = 'All' | 'Active' | 'Inactive';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function AreasPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const [search, setSearch] = useState('');
  const [filterStateId, setFilterStateId] = useState('');
  const [filterCityId, setFilterCityId] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('All');

  const areasQuery = useAreasList({
    page,
    limit: 25,
    search: search.trim() || undefined,
    city_id: filterCityId || undefined,
    status: status === 'All' ? undefined : status,
  });
  const { data: statesData } = useStatesList({ limit: 200, status: 'Active' });
  // Load cities per selected state from the backend (backend caps limit at 200)
  const { data: toolbarCitiesData } = useCitiesList({ limit: 200, status: 'Active', state_id: filterStateId || undefined });
  const { data: formCitiesData, isFetching: formCitiesLoading } = useCitiesList({ limit: 200, status: 'Active', state_id: form.state_id || undefined });
  const createMut = useCreateArea();
  const updateMut = useUpdateArea();
  const saving = createMut.isPending || updateMut.isPending;

  const activeStates = statesData?.data ?? [];
  const areas = areasQuery.data?.data ?? [];
  const pagination = areasQuery.data?.pagination ?? { total: 0, page: 1, limit: 25, pages: 1 };
  const isFiltered = Boolean(search.trim() || filterCityId || status !== 'All');

  const filterToolbarCities = useMemo(() => {
    const cities = toolbarCitiesData?.data ?? [];
    return filterStateId ? cities.filter(city => city.state_id === filterStateId) : cities;
  }, [filterStateId, toolbarCitiesData]);

  const formCities = useMemo(() => {
    if (!form.state_id) return [];
    return (formCitiesData?.data ?? []).filter(city => city.state_id === form.state_id);
  }, [form.state_id, formCitiesData]);

  function openNew() {
    setEditId(null);
    setForm({ ...EMPTY_FORM, state_id: filterStateId, city_id: filterCityId });
    setFormError('');
    setSavedMessage('');
    setShowForm(true);
  }

  function openEdit(row: AreaRow) {
    setEditId(row.id);
    setForm({ name: row.name, state_id: row.state_id ?? '', city_id: row.city_id, is_active: row.is_active });
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
    // Changing the State clears the City, because the City list depends on the State.
    setForm(current => ({ ...current, [key]: value, ...(key === 'state_id' ? { city_id: '' } : {}) }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.state_id) return setFormError('Select a State Or Province.');
    if (!form.city_id) return setFormError('Select a City.');
    if (!form.name.trim()) return setFormError('Enter an Area Name.');
    setFormError('');

    const payload = { name: form.name.trim(), city_id: form.city_id, is_active: form.is_active };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: areasQueryKey });
      setSavedMessage(`Area ${payload.name} saved.`);
      closeForm();
    };
    const onError = (error: Error) => setFormError(friendlyErrorMessage(error, 'Could not save Area. Please try again.'));

    if (editId) updateMut.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createMut.mutate(payload, { onSuccess, onError });
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="Areas"
        description="Neighborhoods, sectors, or business zones inside a City. Used on customer and supplier addresses."
        help={(
          <>
            <p>Use this screen to keep the list of Areas inside each City.</p>
            <p>Click New Area, choose the State and City, then enter the Area Name. Click the pencil or double-click a row to change it.</p>
            <p>Clear Active to stop an Area from being chosen on new records. Old records keep it.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Area</Button>}
      />

      {savedMessage && <InlineAlert tone="success">{savedMessage}</InlineAlert>}
      {areasQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(areasQuery.error, 'Could not load Areas. Please try again.')}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField label="Search Areas" value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Search by Area Name" />
            </div>
            <select
              className="form-input"
              aria-label="Filter By State Or Province"
              value={filterStateId}
              onChange={event => { setFilterStateId(event.target.value); setFilterCityId(''); setPage(1); }}
              style={{ width: 150 }}
            >
              <option value="">All States</option>
              {activeStates.map(state => <option key={state.id} value={state.id}>{state.name}</option>)}
            </select>
            <select
              className="form-input"
              aria-label="Filter By City"
              value={filterCityId}
              onChange={event => { setFilterCityId(event.target.value); setPage(1); }}
              style={{ width: 150 }}
            >
              <option value="">All Cities</option>
              {filterToolbarCities.map(city => <option key={city.id} value={city.id}>{city.name}</option>)}
            </select>
            <SegmentedControl label="Status Filter" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>Area Name</th>
                  <th style={{ width: '22%' }}>City</th>
                  <th style={{ width: '22%' }}>State Or Province</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {areasQuery.isLoading && <TableMessageRow colSpan={5} title="Loading Areas…" loading />}
                {!areasQuery.isLoading && areas.length === 0 && (
                  isFiltered
                    ? <TableMessageRow colSpan={5} title="No Areas Match" description="Change the search text or the filters to see more Areas." />
                    : <TableMessageRow colSpan={5} title="No Areas Yet" description="Add an Area to use it on customer and supplier addresses." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Area</Button>} />
                )}
                {!areasQuery.isLoading && areas.map(area => (
                  <tr key={area.id} className={editId === area.id ? 'is-selected' : undefined} onDoubleClick={() => openEdit(area)}>
                    <td className="cell-strong">{area.name}</td>
                    <td>{area.city_name ?? 'Not Set'}</td>
                    <td className="cell-muted">{area.state_name ?? 'Not Set'}</td>
                    <td><Badge variant={area.is_active ? 'success' : 'neutral'}>{area.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="cell-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(area)} aria-label={`Edit Area ${area.name}`} title="Edit Area" />
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
            recordLabel={pagination.total === 1 ? 'Area' : 'Areas'}
            onPageChange={setPage}
          />
        </section>

        {showForm && (
          <SidePanel
            title={editId ? 'Edit Area' : 'New Area'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Area'}</Button>
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
            <SelectField
              label="City"
              required
              value={form.city_id}
              placeholder={!form.state_id ? 'Select A State First' : formCitiesLoading ? 'Loading Cities…' : formCities.length ? 'Select City' : 'No Cities In This State'}
              options={formCities.map(city => ({ value: city.id, label: city.name }))}
              onChange={value => setField('city_id', value)}
              disabled={saving || !form.state_id}
            />
            <TextField label="Area Name" required value={form.name} onChange={value => setField('name', value)} placeholder="For example DHA Phase 1" disabled={saving} />
            <CheckboxField label="Active" checked={form.is_active} onChange={value => setField('is_active', value)} disabled={saving} />
            <p className="form-hint" style={{ marginTop: -8 }}>Inactive Areas stay on old records but cannot be chosen on new ones.</p>
          </SidePanel>
        )}
      </div>
    </main>
  );
}
