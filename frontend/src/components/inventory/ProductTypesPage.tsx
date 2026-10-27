'use client';

/**
 * ProductTypesPage — Product Type configuration master.
 * List (search filter, table) + SidePanel for create and edit.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductType,
  useDeleteProductType,
  useProductTypes,
  useUpdateProductType,
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

interface ProductTypeRow {
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

export default function ProductTypesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { data: productTypes = [], isLoading, error: loadError, refetch } = useProductTypes();
  const refreshProductTypes = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductType();
  const updateMut = useUpdateProductType();
  const deleteMut = useDeleteProductType();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(pt: ProductTypeRow) {
    setEditId(pt.id);
    setForm({
      code: pt.code,
      name: pt.name,
      description: pt.description ?? '',
      notes: pt.notes ?? '',
      sort_order: pt.sort_order ?? pt.sortOrder ?? 0,
      is_active: pt.is_active ?? pt.isActive ?? true,
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
      setFormError('Enter a Product Type Code and Name.');
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
            refreshProductTypes();
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
          refreshProductTypes();
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
          refreshProductTypes();
          setDeleteTarget(null);
        },
        onError: err => {
          setBannerError(err.message);
          setDeleteTarget(null);
        },
      },
    );
  }

  const allTypes = productTypes as ProductTypeRow[];
  const filtered = useMemo(() => {
    if (!search.trim()) return allTypes;
    const q = search.toLowerCase();
    return allTypes.filter(
      pt =>
        pt.code.toLowerCase().includes(q) ||
        pt.name.toLowerCase().includes(q) ||
        (pt.description && pt.description.toLowerCase().includes(q)) ||
        (pt.notes && pt.notes.toLowerCase().includes(q)),
    );
  }, [allTypes, search]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Product Types"
        description="Classify products by physical and commercial nature (e.g., Raw Materials, Finished Goods, Services)."
        help={(
          <>
            <p>Product Types classify items according to how they are processed, accounted for, and stocked.</p>
            <p>Click New Product Type to register a classification.</p>
            <p>Deletion is restricted when products reference this type. Set to Inactive instead.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Product Type</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SearchField label="Search Product Types" value={search} onChange={setSearch} placeholder="Search product types by code, name, notes…" />
            <div className="filter-bar-end">
              <span>
                {filtered.length} {filtered.length === 1 ? 'Product Type' : 'Product Types'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Code</th>
                  <th style={{ width: 220 }}>Type Name</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Product Types…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={6} title="Product Types Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && filtered.length === 0 && (
                  search
                    ? <TableMessageRow colSpan={6} title="No Product Types Matched" description="Try a different search keyword or clear the search filter." />
                    : <TableMessageRow colSpan={6} title="No Product Types Yet" description="Add your first Product Type (e.g. Finished Goods, Raw Material, Service)." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Product Type</Button>} />
                )}
                {!isLoading && filtered.map(pt => {
                  const isEditing = editId === pt.id && showForm;
                  const active = pt.is_active ?? pt.isActive ?? true;
                  return (
                    <tr key={pt.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(pt)}>
                      <td className="cell-strong">{pt.code}</td>
                      <td>{pt.name}</td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pt.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pt.notes || '—'}
                      </td>
                      <td>
                        <Badge variant={active ? 'success' : 'neutral'}>
                          {active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(pt)} aria-label={`Edit Product Type ${pt.name}`} title="Edit Product Type" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: pt.id, name: pt.name })} aria-label={`Delete Product Type ${pt.name}`} title="Delete Product Type" />
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
            title={editId ? 'Edit Product Type' : 'New Product Type'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Product Type'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="Product Type Code" value={form.code} onChange={v => set('code', v.toUpperCase())} required placeholder="e.g. PT-RAW" />
            <TextField label="Product Type Name" value={form.name} onChange={v => set('name', v)} required placeholder="e.g. Raw Material" />
            <TextField label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Brief summary" />
            <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Tax handling or inventory policy notes" rows={3} />
            <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={v => set('sort_order', Number(v) || 0)} />
            <CheckboxField label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Product Type?"
        message={`Are you sure you want to delete Product Type "${deleteTarget?.name}"? If products reference this type, deletion will be blocked to maintain data integrity.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
