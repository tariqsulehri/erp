'use client';

/**
 * BrandsPage — Product brand configuration master.
 * List (search filter, table) + SidePanel for create and edit.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductBrand,
  useDeleteProductBrand,
  useProductBrands,
  useUpdateProductBrand,
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

interface BrandRow {
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

export default function BrandsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { data: brands = [], isLoading, error: loadError, refetch } = useProductBrands();
  const refreshBrands = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductBrand();
  const updateMut = useUpdateProductBrand();
  const deleteMut = useDeleteProductBrand();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(b: BrandRow) {
    setEditId(b.id);
    setForm({
      code: b.code,
      name: b.name,
      description: b.description ?? '',
      notes: b.notes ?? '',
      sort_order: b.sort_order ?? b.sortOrder ?? 0,
      is_active: b.is_active ?? b.isActive ?? true,
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
      setFormError('Enter a Brand Code and Name.');
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
            refreshBrands();
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
          refreshBrands();
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
          refreshBrands();
          setDeleteTarget(null);
        },
        onError: err => {
          setBannerError(err.message);
          setDeleteTarget(null);
        },
      },
    );
  }

  const allBrands = brands as BrandRow[];
  const filtered = useMemo(() => {
    if (!search.trim()) return allBrands;
    const q = search.toLowerCase();
    return allBrands.filter(
      b =>
        b.code.toLowerCase().includes(q) ||
        b.name.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q)),
    );
  }, [allBrands, search]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Brands"
        description="Configure product manufacturers, labels, and brands."
        help={(
          <>
            <p>Brands help categorize and filter products across inventory, purchases, and sales.</p>
            <p>Click New Brand to register a brand code and name.</p>
            <p>You cannot delete a Brand if products are linked to it. Make it inactive instead.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Brand</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SearchField label="Search Brands" value={search} onChange={setSearch} placeholder="Search brands by code, name, notes…" />
            <div className="filter-bar-end">
              <span>
                {filtered.length} {filtered.length === 1 ? 'Brand' : 'Brands'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Code</th>
                  <th style={{ width: 200 }}>Brand Name</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Brands…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={6} title="Brands Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && filtered.length === 0 && (
                  search
                    ? <TableMessageRow colSpan={6} title="No Brands Matched" description="Try a different search keyword or clear the search filter." />
                    : <TableMessageRow colSpan={6} title="No Brands Yet" description="Add your first brand to start tagging products." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Brand</Button>} />
                )}
                {!isLoading && filtered.map(b => {
                  const isEditing = editId === b.id && showForm;
                  const active = b.is_active ?? b.isActive ?? true;
                  return (
                    <tr key={b.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(b)}>
                      <td className="cell-strong">{b.code}</td>
                      <td>{b.name}</td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.notes || '—'}
                      </td>
                      <td>
                        <Badge variant={active ? 'success' : 'neutral'}>
                          {active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(b)} aria-label={`Edit Brand ${b.name}`} title="Edit Brand" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: b.id, name: b.name })} aria-label={`Delete Brand ${b.name}`} title="Delete Brand" />
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
            title={editId ? 'Edit Brand' : 'New Brand'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Brand'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="Brand Code" value={form.code} onChange={v => set('code', v.toUpperCase())} required placeholder="e.g. BRD-001" />
            <TextField label="Brand Name" value={form.name} onChange={v => set('name', v)} required placeholder="e.g. Acme Corp" />
            <TextField label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Brief summary" />
            <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Additional internal notes, supplier contacts, etc." rows={3} />
            <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={v => set('sort_order', Number(v) || 0)} />
            <CheckboxField label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Brand?"
        message={`Are you sure you want to delete brand "${deleteTarget?.name}"? If products are using this brand, deletion will be blocked to preserve data integrity.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
