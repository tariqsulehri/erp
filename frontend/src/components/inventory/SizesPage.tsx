'use client';

/**
 * SizesPage — Product Size configuration master.
 * List (search filter, table) + SidePanel for create and edit.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductSize,
  useDeleteProductSize,
  useProductSizes,
  useUpdateProductSize,
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

interface SizeRow {
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

export default function SizesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { data: sizes = [], isLoading, error: loadError, refetch } = useProductSizes();
  const refreshSizes = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductSize();
  const updateMut = useUpdateProductSize();
  const deleteMut = useDeleteProductSize();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(s: SizeRow) {
    setEditId(s.id);
    setForm({
      code: s.code,
      name: s.name,
      description: s.description ?? '',
      notes: s.notes ?? '',
      sort_order: s.sort_order ?? s.sortOrder ?? 0,
      is_active: s.is_active ?? s.isActive ?? true,
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
      setFormError('Enter a Size Code and Name.');
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
            refreshSizes();
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
          refreshSizes();
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
          refreshSizes();
          setDeleteTarget(null);
        },
        onError: err => {
          setBannerError(err.message);
          setDeleteTarget(null);
        },
      },
    );
  }

  const allSizes = sizes as SizeRow[];
  const filtered = useMemo(() => {
    if (!search.trim()) return allSizes;
    const q = search.toLowerCase();
    return allSizes.filter(
      s =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.notes && s.notes.toLowerCase().includes(q)),
    );
  }, [allSizes, search]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Product Sizes"
        description="Standardized sizes, dimensions, and specifications for items."
        help={(
          <>
            <p>Sizes specify the physical dimensions, apparel sizing, or container volume for products.</p>
            <p>Click New Size to register a size code and title.</p>
            <p>You cannot delete a Size that products are actively linked to.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Size</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SearchField label="Search Sizes" value={search} onChange={setSearch} placeholder="Search sizes by code, name, notes…" />
            <div className="filter-bar-end">
              <span>
                {filtered.length} {filtered.length === 1 ? 'Size' : 'Sizes'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Code</th>
                  <th style={{ width: 200 }}>Size Name</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Sizes…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={6} title="Sizes Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && filtered.length === 0 && (
                  search
                    ? <TableMessageRow colSpan={6} title="No Sizes Matched" description="Try a different search keyword or clear the search filter." />
                    : <TableMessageRow colSpan={6} title="No Sizes Yet" description="Add your first Size (e.g. Small, Medium, Large, XL, 500ml)." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Size</Button>} />
                )}
                {!isLoading && filtered.map(s => {
                  const isEditing = editId === s.id && showForm;
                  const active = s.is_active ?? s.isActive ?? true;
                  return (
                    <tr key={s.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(s)}>
                      <td className="cell-strong">{s.code}</td>
                      <td>{s.name}</td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.notes || '—'}
                      </td>
                      <td>
                        <Badge variant={active ? 'success' : 'neutral'}>
                          {active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(s)} aria-label={`Edit Size ${s.name}`} title="Edit Size" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: s.id, name: s.name })} aria-label={`Delete Size ${s.name}`} title="Delete Size" />
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
            title={editId ? 'Edit Size' : 'New Size'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Size'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="Size Code" value={form.code} onChange={v => set('code', v.toUpperCase())} required placeholder="e.g. SZ-XL" />
            <TextField label="Size Name" value={form.name} onChange={v => set('name', v)} required placeholder="e.g. Extra Large" />
            <TextField label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Dimensions or measurement standards" />
            <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Size specifications, packaging guidance, etc." rows={3} />
            <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={v => set('sort_order', Number(v) || 0)} />
            <CheckboxField label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Size?"
        message={`Are you sure you want to delete Size "${deleteTarget?.name}"? If products reference this size, deletion will be blocked to maintain data integrity.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
