'use client';

/**
 * ColorsPage — Product Color configuration master.
 * List (search filter, table with color swatch preview) + SidePanel for create and edit.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductColor,
  useDeleteProductColor,
  useProductColors,
  useUpdateProductColor,
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
import { FALLBACK_COLOUR_HEX, NEW_COLOUR_HEX } from './product-colour-defaults';

interface ColorRow {
  id: string;
  code: string;
  name: string;
  hex_code?: string | null;
  hexCode?: string | null;
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
  hex_code: NEW_COLOUR_HEX,
  description: '',
  notes: '',
  sort_order: 0,
  is_active: true,
};

type FormState = typeof EMPTY_FORM;

export default function ColorsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bannerError, setBannerError] = useState('');
  const [formError, setFormError] = useState('');

  const queryClient = useQueryClient();
  const { data: colors = [], isLoading, error: loadError, refetch } = useProductColors();
  const refreshColors = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductColor();
  const updateMut = useUpdateProductColor();
  const deleteMut = useDeleteProductColor();

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(c: ColorRow) {
    setEditId(c.id);
    setForm({
      code: c.code,
      name: c.name,
      hex_code: c.hex_code ?? c.hexCode ?? NEW_COLOUR_HEX,
      description: c.description ?? '',
      notes: c.notes ?? '',
      sort_order: c.sort_order ?? c.sortOrder ?? 0,
      is_active: c.is_active ?? c.isActive ?? true,
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
      setFormError('Enter a Color Code and Name.');
      return;
    }
    setSaving(true);
    setFormError('');

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      hex_code: form.hex_code.trim() || undefined,
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
            refreshColors();
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
          refreshColors();
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
          refreshColors();
          setDeleteTarget(null);
        },
        onError: err => {
          setBannerError(err.message);
          setDeleteTarget(null);
        },
      },
    );
  }

  const allColors = colors as ColorRow[];
  const filtered = useMemo(() => {
    if (!search.trim()) return allColors;
    const q = search.toLowerCase();
    return allColors.filter(
      c =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.hex_code && c.hex_code.toLowerCase().includes(q)) ||
        (c.hexCode && c.hexCode.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q)),
    );
  }, [allColors, search]);

  return (
    <main className="page-shell">
      <PageHeader
        title="Product Colors"
        description="Manage color variations, codes, hex shades, and finish notes."
        help={(
          <>
            <p>Colors represent product shades, paint finishes, and variant color codes.</p>
            <p>Click New Color to register a color code, title, and color hex preview.</p>
            <p>Deletion is restricted when products reference this color.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Color</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <SearchField label="Search Colors" value={search} onChange={setSearch} placeholder="Search colors by code, name, hex, notes…" />
            <div className="filter-bar-end">
              <span>
                {filtered.length} {filtered.length === 1 ? 'Color' : 'Colors'}
              </span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 120 }}>Code</th>
                  <th style={{ width: 220 }}>Color Name</th>
                  <th style={{ width: 120 }}>Swatch</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 84 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={7} title="Loading Colors…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={7} title="Colors Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && filtered.length === 0 && (
                  search
                    ? <TableMessageRow colSpan={7} title="No Colors Matched" description="Try a different search keyword or clear the search filter." />
                    : <TableMessageRow colSpan={7} title="No Colors Yet" description="Add your first Color (e.g. Midnight Black, Pearl White, Royal Blue)." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Color</Button>} />
                )}
                {!isLoading && filtered.map(c => {
                  const isEditing = editId === c.id && showForm;
                  const active = c.is_active ?? c.isActive ?? true;
                  const hex = c.hex_code ?? c.hexCode;
                  return (
                    <tr key={c.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(c)}>
                      <td className="cell-strong">{c.code}</td>
                      <td>{c.name}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {hex ? (
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                backgroundColor: hex,
                                border: '1px solid var(--color-border-subtle)',
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                            />
                          ) : null}
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>
                            {hex || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.description || '—'}
                      </td>
                      <td className="cell-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.notes || '—'}
                      </td>
                      <td>
                        <Badge variant={active ? 'success' : 'neutral'}>
                          {active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(c)} aria-label={`Edit Color ${c.name}`} title="Edit Color" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: c.id, name: c.name })} aria-label={`Delete Color ${c.name}`} title="Delete Color" />
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
            title={editId ? 'Edit Color' : 'New Color'}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Color'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            <TextField label="Color Code" value={form.code} onChange={v => set('code', v.toUpperCase())} required placeholder="e.g. CLR-BLK" />
            <TextField label="Color Name" value={form.name} onChange={v => set('name', v)} required placeholder="e.g. Jet Black" />
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <TextField label="Hex Code" value={form.hex_code} onChange={v => set('hex_code', v)} placeholder={FALLBACK_COLOUR_HEX} />
              </div>
              <input
                type="color"
                value={form.hex_code?.startsWith('#') && form.hex_code.length === 7 ? form.hex_code : FALLBACK_COLOUR_HEX}
                onChange={e => set('hex_code', e.target.value)}
                style={{
                  width: 40,
                  height: 38,
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  padding: 2,
                  backgroundColor: 'var(--color-surface)',
                }}
                title="Choose Color Swatch"
              />
            </div>
            <TextField label="Description" value={form.description} onChange={v => set('description', v)} placeholder="Finish or shade description" />
            <TextareaField label="Notes" value={form.notes} onChange={v => set('notes', v)} placeholder="Dye specifications, RAL/Pantone references, etc." rows={3} />
            <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={v => set('sort_order', Number(v) || 0)} />
            <CheckboxField label="Active" checked={form.is_active} onChange={v => set('is_active', v)} />
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Color?"
        message={`Are you sure you want to delete Color "${deleteTarget?.name}"? If products reference this color, deletion will be blocked to maintain data integrity.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
