'use client';

/**
 * OriginsPage — Product Origin configuration master.
 * List (search filter, table) + SidePanel for create and edit.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductOrigin,
  useDeleteProductOrigin,
  useProductOrigins,
  useUpdateProductOrigin,
} from '@/lib/api/products';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckboxField, NumericField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { friendlyErrorMessage } from '@/lib/erp-utils';

interface OriginRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  notes: string | null;
  sort_order?: number;
  sortOrder?: number;
  is_active?: boolean;
  isActive?: boolean;
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  notes: '',
  sort_order: 0,
  is_active: true,
};

type FormState = typeof EMPTY_FORM;

export default function OriginsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { data: origins = [], isLoading, error: loadError, refetch } = useProductOrigins();
  const refreshOrigins = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductOrigin();
  const updateMut = useUpdateProductOrigin();
  const deleteMut = useDeleteProductOrigin();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(o: OriginRow) {
    setEditId(o.id);
    setForm({
      code: o.code,
      name: o.name,
      description: o.description ?? '',
      notes: o.notes ?? '',
      sort_order: o.sort_order ?? o.sortOrder ?? 0,
      is_active: o.is_active ?? o.isActive ?? true,
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setSaving(false);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Enter an Origin Code and Name.');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      notes: form.notes.trim() || undefined,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };

    if (editId) {
      updateMut.mutate(
        { id: editId, data: payload },
        {
          onSuccess: () => {
            refreshOrigins();
            closeForm();
          },
          onError: err => {
            setFormError(err.message);
            setSaving(false);
          },
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: () => {
          refreshOrigins();
          closeForm();
        },
        onError: err => {
          setFormError(err.message);
          setSaving(false);
        },
      });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    deleteMut.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          refreshOrigins();
          setDeleteTarget(null);
        },
        onError: err => {
          setBannerError(err.message);
          setDeleteTarget(null);
        },
      },
    );
  }

  const allOrigins = origins as OriginRow[];
  const filtered = useMemo(() => {
    if (!search.trim()) return allOrigins;
    const q = search.toLowerCase();
    return allOrigins.filter(
      o =>
        o.code.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.notes && o.notes.toLowerCase().includes(q)),
    );
  }, [allOrigins, search]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Product Origins"
        description="Countries and regions of origin for manufacturing, customs, and compliance."
        help={(
          <>
            <p>Product Origins document where items were produced or imported from.</p>
            <p>Click New Origin to register a country or region.</p>
            <p>Deletion is restricted when products reference this origin.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Origin</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SearchField label="Search Origins" value={search} onChange={setSearch} placeholder="Search origins by code, name, notes…" />
            <div className="filter-bar-end">
              <span>
                {filtered.length} {filtered.length === 1 ? 'Origin' : 'Origins'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Code</th>
                  <th style={{ width: 220 }}>Origin Name</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Origins…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={6} title="Origins Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && filtered.length === 0 && (
                  search
                    ? <TableMessageRow colSpan={6} title="No Origins Matched" description="Try a different search keyword or clear the search filter." />
                    : <TableMessageRow colSpan={6} title="No Origins Yet" description="Add your first Origin (e.g. Germany, Japan, USA, Pakistan)." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Origin</Button>} />
                )}
                {!isLoading && filtered.map(o => {
                  const isEditing = editId === o.id && showForm;
                  const active = o.is_active ?? o.isActive ?? true;
                  return (
                    <tr key={o.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(o)}>
                      <td className="cell-strong">{o.code}</td>
                      <td>{o.name}</td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.notes || '—'}
                      </td>
                      <td>
                        <Badge variant={active ? 'success' : 'neutral'}>
                          {active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(o)} aria-label={`Edit Origin ${o.name}`} title="Edit Origin" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: o.id, name: o.name })} aria-label={`Delete Origin ${o.name}`} title="Delete Origin" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {showForm && (
          <SidePanel
            title={editId ? 'Edit Origin' : 'New Origin'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Origin'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="Origin Code" value={form.code} onChange={v => set('code', v.toUpperCase())} required placeholder="e.g. ORG-DE" />
            <TextField label="Origin Name" value={form.name} onChange={v => set('name', v)} required placeholder="e.g. Germany" />
            <TextField label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Country / Region details" />
            <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Customs, duty tariff codes, or certificate notes" rows={3} />
            <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={v => set('sort_order', Number(v) || 0)} />
            <CheckboxField label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Origin?"
        message={`Are you sure you want to delete Origin "${deleteTarget?.name}"? If products reference this origin, deletion will be blocked to maintain data integrity.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
