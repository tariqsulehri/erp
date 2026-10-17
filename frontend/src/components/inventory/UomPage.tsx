'use client';

/**
 * UomPage — Units of Measure management.
 * List (filtered by measurement type) + SidePanel for create and edit.
 */

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductUom,
  useDeleteProductUom,
  useProductUnitsOfMeasure,
  useUpdateProductUom,
} from '@/lib/api/products';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckboxField, SelectField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';

/* Types / constants */
interface UomRow {
  id:           string;
  name:         string;
  abbreviation: string;
  uom_type:     string;
  is_active:    boolean;
  is_default:   boolean;
}

type UomType = 'Quantity' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Time' | 'Other';
const UOM_TYPES: UomType[] = ['Quantity', 'Weight', 'Volume', 'Length', 'Area', 'Time', 'Other'];

const EMPTY_FORM = { name: '', abbreviation: '', uom_type: 'Quantity' as UomType, is_active: true, is_default: false };
type FormState = typeof EMPTY_FORM;

export default function UomPage() {
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError,  setBannerError]  = useState('');
  const [formError,    setFormError]    = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');

  const queryClient = useQueryClient();

  /* Queries / mutations */
  const { data: uoms = [], isLoading } = useProductUnitsOfMeasure();
  const refreshUom = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductUom();
  const updateMut = useUpdateProductUom();
  const deleteMut = useDeleteProductUom();

  /* Helpers */
  function openNew() {
    setEditId(null); setForm(EMPTY_FORM); setFormError(''); setShowForm(true);
  }
  function openEdit(u: UomRow) {
    setEditId(u.id);
    setForm({ name: u.name, abbreviation: u.abbreviation, uom_type: u.uom_type as UomType, is_active: u.is_active, is_default: u.is_default });
    setFormError(''); setShowForm(true);
  }
  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setFormError(''); setSaving(false);
  }
  function set<K extends keyof FormState>(key: K, value: FormState[K]) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.abbreviation.trim()) {
      setFormError('Enter a Unit Name and an Abbreviation.'); return;
    }
    setSaving(true); setFormError('');
    const payload = { name: form.name.trim(), abbreviation: form.abbreviation.trim(), uom_type: form.uom_type, is_active: form.is_active, is_default: form.is_default };
    if (editId) {
      updateMut.mutate(
        { id: editId, data: payload },
        { onSuccess: () => { refreshUom(); closeForm(); }, onError: error => { setFormError(error.message); setSaving(false); } },
      );
    } else {
      createMut.mutate(
        payload,
        { onSuccess: () => { refreshUom(); closeForm(); }, onError: error => { setFormError(error.message); setSaving(false); } },
      );
    }
  }

  /* Derived */
  const allUoms  = uoms as UomRow[];
  const filtered = typeFilter ? allUoms.filter(u => u.uom_type === typeFilter) : allUoms;

  const typeCounts = UOM_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allUoms.filter(u => u.uom_type === t).length;
    return acc;
  }, {});

  const activeTypes = UOM_TYPES.filter(t => typeCounts[t] > 0);
  const typeOptions: Array<{ value: string; label: string }> = [
    { value: '', label: `All (${allUoms.length})` },
    ...activeTypes.map(t => ({ value: t as string, label: `${t} (${typeCounts[t]})` })),
  ];

  return (
    <main className="page-shell">
      <PageHeader
        title="Units Of Measure"
        description="Units used to count, weigh, or measure products, such as Piece, Kilogram, or Litre."
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Unit</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SegmentedControl label="Type Filter" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
            <div className="filter-bar-end">
              <span>
                {allUoms.length} {allUoms.length === 1 ? 'Unit' : 'Units'} Across {activeTypes.length} {activeTypes.length === 1 ? 'Type' : 'Types'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Abbreviation</th>
                  <th>Unit Name</th>
                  <th style={{ width: 140 }}>Type</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={5} title="Loading Units…" loading />}
                {!isLoading && filtered.length === 0 && (
                  typeFilter
                    ? <TableMessageRow colSpan={5} title={`No ${typeFilter} Units`} description="Choose All or a different Type to see more Units." />
                    : <TableMessageRow colSpan={5} title="No Units Yet" description="Add your first Unit Of Measure, such as Piece or Kilogram." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Unit</Button>} />
                )}
                {!isLoading && filtered.map(u => {
                  const isEditing = editId === u.id && showForm;
                  return (
                    <tr key={u.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(u)}>
                      <td className="cell-strong">{u.abbreviation}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</span>
                          {u.is_default && <Badge variant="info">Default</Badge>}
                        </span>
                      </td>
                      <td className="cell-muted">{u.uom_type}</td>
                      <td><Badge variant={u.is_active ? 'success' : 'neutral'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(u)} aria-label={`Edit Unit ${u.name}`} title="Edit Unit" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: u.id, name: `${u.name} (${u.abbreviation})` })} aria-label={`Delete Unit ${u.name}`} title="Delete Unit" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && filtered.length > 0 && (
            <div className="panel-footer" style={{ justifyContent: 'flex-start', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Showing {filtered.length} of {allUoms.length} {allUoms.length === 1 ? 'Unit' : 'Units'}{typeFilter ? ` (Type: ${typeFilter})` : ''}
            </div>
          )}
        </section>

        {showForm && (
          <SidePanel
            title={editId ? 'Edit Unit Of Measure' : 'New Unit Of Measure'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Unit'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}

            <TextField label="Unit Name" required value={form.name} onChange={value => set('name', value)} placeholder="Kilogram" inputProps={{ maxLength: 80 }} />
            <div>
              <TextField label="Abbreviation" required value={form.abbreviation} onChange={value => set('abbreviation', value)} placeholder="kg" inputProps={{ maxLength: 20 }} />
              <p className="form-hint">Must be unique. Shown on product forms and reports.</p>
            </div>

            <SelectField
              label="Type"
              required
              value={form.uom_type}
              options={UOM_TYPES.map(t => ({ value: t, label: t }))}
              onChange={value => set('uom_type', value as UomType)}
            />

            <div>
              <CheckboxField label="Active" checked={form.is_active} onChange={value => set('is_active', value)} />
              <p className="form-hint" style={{ marginTop: 0 }}>Inactive Units cannot be assigned to products.</p>
            </div>

            <div>
              <CheckboxField label="Default For This Type" checked={form.is_default} onChange={value => set('is_default', value)} />
              <p className="form-hint" style={{ marginTop: 0 }}>Selected first when adding {form.uom_type} products.</p>
            </div>

            {form.is_default && (
              <InlineAlert tone="info">Saving will remove the Default mark from the current Default {form.uom_type} Unit in this company.</InlineAlert>
            )}
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Delete Unit Of Measure?"
        message={`"${deleteTarget?.name}" will be permanently removed. Units assigned to products cannot be deleted.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(
          { id: deleteTarget.id },
          {
            onSuccess: () => { refreshUom(); setBannerError(''); setDeleteTarget(null); },
            onError: error => { setBannerError(error.message); setDeleteTarget(null); },
          },
        )}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
