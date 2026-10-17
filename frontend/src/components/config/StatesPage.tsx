'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus } from '@tabler/icons-react';
import { statesQueryKey, useCreateState, useStatesList, useUpdateState, type StateRow } from '@/lib/api/geography';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CheckboxField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

const EMPTY_FORM = { name: '', is_active: true };
type FormState = typeof EMPTY_FORM;
type StatusFilter = 'All' | 'Active' | 'Inactive';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' },
];

export default function StatesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('All');

  const statesQuery = useStatesList({
    page,
    limit: 25,
    search: search.trim() || undefined,
    status: status === 'All' ? undefined : status,
  });
  const createMut = useCreateState();
  const updateMut = useUpdateState();
  const saving = createMut.isPending || updateMut.isPending;

  const states = statesQuery.data?.data ?? [];
  const pagination = statesQuery.data?.pagination ?? { total: 0, page: 1, limit: 25, pages: 1 };
  const isFiltered = Boolean(search.trim() || status !== 'All');

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setSavedMessage('');
    setShowForm(true);
  }

  function openEdit(row: StateRow) {
    setEditId(row.id);
    setForm({ name: row.name, is_active: row.is_active });
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

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return setFormError('Enter a State Or Province Name.');
    setFormError('');

    const payload = { name: form.name.trim(), is_active: form.is_active };
    const onSuccess = () => {
      queryClient.invalidateQueries({ queryKey: statesQueryKey });
      setSavedMessage(`State Or Province ${payload.name} saved.`);
      closeForm();
    };
    const onError = (error: Error) => setFormError(friendlyErrorMessage(error, 'Unable to save State Or Province.'));

    if (editId) updateMut.mutate({ id: editId, data: payload }, { onSuccess, onError });
    else createMut.mutate(payload, { onSuccess, onError });
  }

  return (
    <main className="page-shell">
      <PageHeader
        title="States And Provinces"
        description="The top level of an address. Cities belong to a State Or Province."
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New State</Button>}
      />

      {savedMessage && <InlineAlert tone="success">{savedMessage}</InlineAlert>}
      {statesQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(statesQuery.error, 'Unable to load States.')}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField label="Search States" value={search} onChange={value => { setSearch(value); setPage(1); }} placeholder="Search by State Or Province Name" />
            </div>
            <SegmentedControl label="Status Filter" value={status} options={STATUS_OPTIONS} onChange={value => { setStatus(value); setPage(1); }} />
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>State Or Province</th>
                  <th className="num" style={{ width: 140 }}>Active Cities</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 64 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {statesQuery.isLoading && <TableMessageRow colSpan={4} title="Loading States…" loading />}
                {!statesQuery.isLoading && states.length === 0 && (
                  isFiltered
                    ? <TableMessageRow colSpan={4} title="No States Match" description="Change the search text or the status filter to see more States." />
                    : <TableMessageRow colSpan={4} title="No States Yet" description="Add a State Or Province, then add its Cities." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New State</Button>} />
                )}
                {!statesQuery.isLoading && states.map(state => (
                  <tr key={state.id} className={editId === state.id ? 'is-selected' : undefined} onDoubleClick={() => openEdit(state)}>
                    <td className="cell-strong">{state.name}</td>
                    <td className="num">{state.active_city_count ?? 0}</td>
                    <td><Badge variant={state.is_active ? 'success' : 'neutral'}>{state.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="cell-actions">
                      <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(state)} aria-label={`Edit State ${state.name}`} title="Edit State" />
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
            recordLabel={pagination.total === 1 ? 'State' : 'States'}
            onPageChange={setPage}
          />
        </section>

        {showForm && (
          <SidePanel
            title={editId ? 'Edit State Or Province' : 'New State Or Province'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save State'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="State Or Province Name" required value={form.name} onChange={value => setForm(current => ({ ...current, name: value }))} placeholder="For example Punjab" disabled={saving} />
            <CheckboxField label="Active" checked={form.is_active} onChange={value => setForm(current => ({ ...current, is_active: value }))} disabled={saving} />
            <p className="form-hint" style={{ marginTop: -8 }}>Inactive States stay on old records but cannot be chosen on new ones.</p>
          </SidePanel>
        )}
      </div>
    </main>
  );
}
