'use client';

/**
 * CategoriesPage — hierarchical product category management.
 * List (tree table with expand / collapse) + SidePanel for create and edit.
 * Cycle-safe parent selector: a category cannot be moved under itself or its own children.
 */

import { useState, useMemo, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconChevronRight, IconPencil, IconPlus, IconSubtask, IconTrash } from '@tabler/icons-react';
import {
  productsQueryKey,
  useCreateProductCategory,
  useDeleteProductCategory,
  useProductCategories,
  useUpdateProductCategory,
} from '@/lib/api/products';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckboxField, NumericField, SelectField, TextField, TextareaField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { SidePanel } from '@/components/ui/SidePanel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { friendlyErrorMessage } from '@/lib/erp-utils';

/* Types */
interface CategoryRow {
  id:          string;
  code:        string;
  name:        string;
  description: string | null;
  notes:       string | null;
  parent_id:   string | null;
  depth:       number;
  path:        string;
  sort_order:  number;
  is_active:   boolean;
}
interface TreeNode extends CategoryRow { children: TreeNode[]; }
interface FlatRow   { node: TreeNode; level: number; }
interface SelectOpt { id: string; label: string; disabled: boolean; }

const EMPTY_FORM = { code: '', name: '', description: '', notes: '', parent_id: '', sort_order: 0, is_active: true };
type FormState = typeof EMPTY_FORM;

/** Indentation per tree level, on the 4px spacing grid. */
const TREE_INDENT_PX = 20;

/* Tree utilities (pure) */
function buildTree(flat: CategoryRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const c of flat) map.set(c.id, { ...c, children: [] });
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    const parent = node.parent_id ? map.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  function sort(ns: TreeNode[]) {
    ns.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    ns.forEach(n => sort(n.children));
  }
  sort(roots);
  return roots;
}

function flattenForTable(nodes: TreeNode[], collapsed: Set<string>, level = 0): FlatRow[] {
  const rows: FlatRow[] = [];
  nodes.forEach(node => {
    rows.push({ node, level });
    if (node.children.length && !collapsed.has(node.id))
      rows.push(...flattenForTable(node.children, collapsed, level + 1));
  });
  return rows;
}

function flattenForSelect(nodes: TreeNode[], excludeId: string | null, depth = 0, ancestorExcluded = false): SelectOpt[] {
  const result: SelectOpt[] = [];
  for (const node of nodes) {
    const selfExcluded = node.id === excludeId;
    const disabled     = selfExcluded || ancestorExcluded;
    // Native <option> text cannot be padded, so non-breaking spaces show the tree level.
    const indent       = '    '.repeat(depth);
    result.push({ id: node.id, label: `${indent}${node.code} - ${node.name}`, disabled });
    if (node.children.length) result.push(...flattenForSelect(node.children, excludeId, depth + 1, disabled));
  }
  return result;
}

export default function CategoriesPage() {
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState('');
  const [bannerError,  setBannerError]  = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [search,       setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();

  /* Queries / mutations */
  const { data: rawCats = [], isLoading, error: loadError, refetch } = useProductCategories();
  const refreshCategories = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductCategory();
  const updateMut = useUpdateProductCategory();
  const deleteMut = useDeleteProductCategory();

  /* Derived data */
  const allCats = rawCats as CategoryRow[];

  const filteredCats = useMemo(() => {
    let list = allCats;
    if (!showInactive) list = list.filter(c => c.is_active);
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchIds = new Set(
        list.filter(c => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)).map(c => c.id),
      );
      list.forEach(c => { if (matchIds.has(c.id) && c.path) c.path.split('/').forEach(pid => matchIds.add(pid)); });
      list = list.filter(c => matchIds.has(c.id));
    }
    return list;
  }, [allCats, search, showInactive]);

  const tree       = useMemo(() => buildTree(filteredCats),              [filteredCats]);
  const flatRows   = useMemo(() => flattenForTable(tree, collapsed),     [tree, collapsed]);
  const selectOpts = useMemo(() => flattenForSelect(buildTree(allCats), editId), [allCats, editId]);

  /* Actions */
  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function expandAll()   { setCollapsed(new Set()); }
  function collapseAll() {
    setCollapsed(new Set(flatRows.filter(r => r.node.children.length > 0).map(r => r.node.id)));
  }

  function openNew(parentPreset?: string) {
    setEditId(null); setForm({ ...EMPTY_FORM, parent_id: parentPreset ?? '' });
    setFormError(''); setSaving(false); setShowForm(true);
  }
  function openEdit(cat: CategoryRow) {
    setEditId(cat.id);
    setForm({ code: cat.code, name: cat.name, description: cat.description ?? '', notes: cat.notes ?? '', parent_id: cat.parent_id ?? '', sort_order: cat.sort_order, is_active: cat.is_active });
    setFormError(''); setSaving(false); setShowForm(true);
  }
  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setFormError(''); setSaving(false);
  }
  function setF<K extends keyof FormState>(key: K, value: FormState[K]) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { setFormError('Enter a Category Code.'); return; }
    if (!form.name.trim()) { setFormError('Enter a Category Name.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      code:        form.code.trim().toUpperCase(),
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      notes:       form.notes.trim() || undefined,
      parent_id:   form.parent_id || undefined,
      sort_order:  Number(form.sort_order),
      is_active:   form.is_active,
    };
    if (editId) {
      updateMut.mutate(
        { id: editId, data: payload },
        { onSuccess: () => { refreshCategories(); closeForm(); }, onError: error => { setFormError(error.message); setSaving(false); } },
      );
    } else {
      createMut.mutate(
        payload,
        { onSuccess: () => { refreshCategories(); closeForm(); }, onError: error => { setFormError(error.message); setSaving(false); } },
      );
    }
  }

  /* Helpers */
  function pathLabel(pathStr: string): string {
    if (!pathStr) return '';
    return pathStr.split('/').map(pid => allCats.find(c => c.id === pid)?.name ?? '…').join(' › ');
  }

  /* Counts */
  const totalActive   = allCats.filter(c =>  c.is_active).length;
  const totalInactive = allCats.filter(c => !c.is_active).length;
  const totalRoots    = allCats.filter(c => !c.parent_id).length;
  const isFiltered    = Boolean(search.trim()) || (!showInactive && totalInactive > 0);

  const editingCat  = editId ? allCats.find(c => c.id === editId) : undefined;
  const parentCat   = form.parent_id ? allCats.find(c => c.id === form.parent_id) : undefined;
  const panelTitle  = editId ? 'Edit Category' : form.parent_id ? 'New Sub Category' : 'New Top Level Category';

  return (
    <main className="page-shell">
      <PageHeader
        title="Product Categories"
        description="Group products into a tree of categories, up to 8 levels deep. Top level Categories are Level 0."
        help={(
          <>
            <p>Use Categories to group your products, for example Electronics, then Mobiles under it.</p>
            <p>Click New Category to add a top level Category. Use the Add Sub Category button on a row to add one under it.</p>
            <p>You cannot delete a Category that has Sub Categories or products. Make it inactive instead.</p>
          </>
        )}
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => openNew()}>New Category</Button>}
      />

      {bannerError && <InlineAlert tone="danger" onDismiss={() => setBannerError('')}>{bannerError}</InlineAlert>}

      <div className={`split-view${showForm ? ' has-side' : ''}`}>
        <section className="panel">
          <div className="filter-bar">
            <div className="filter-bar-grow">
              <SearchField label="Search Categories" value={search} onChange={setSearch} placeholder="Search by Code or Name" />
            </div>
            <CheckboxField label="Show Inactive" checked={showInactive} onChange={setShowInactive} />
            <Button variant="ghost" onClick={expandAll}>Expand All</Button>
            <Button variant="ghost" onClick={collapseAll}>Collapse All</Button>
            <div className="filter-bar-end">
              <span>{totalActive} Active</span>
              <span aria-hidden>·</span>
              <span>{totalInactive} Inactive</span>
              <span aria-hidden>·</span>
              <span>{totalRoots} Top Level</span>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th style={{ width: 140 }}>Code</th>
                  <th className="num" style={{ width: 90 }}>Level</th>
                  <th className="num" style={{ width: 100 }}>Sort Order</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 112 }}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableMessageRow colSpan={6} title="Loading Categories…" loading />}
                {!isLoading && loadError && (
                  <TableMessageRow colSpan={6} title="Categories Could Not Be Loaded" description={friendlyErrorMessage(loadError, 'Please check your connection and try again.')} action={<Button onClick={() => refetch()}>Try Again</Button>} />
                )}
                {!isLoading && !loadError && flatRows.length === 0 && (
                  isFiltered
                    ? <TableMessageRow colSpan={6} title="No Categories Match" description={`Change or clear the search text${showInactive ? '' : ', or tick Show Inactive,'} to see more Categories.`} />
                    : <TableMessageRow colSpan={6} title="No Categories Yet" description="Add a top level Category first, then add Sub Categories under it." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={() => openNew()}>New Category</Button>} />
                )}
                {!isLoading && flatRows.map(({ node: cat, level }) => {
                  const hasChildren = cat.children.length > 0;
                  const isEditing   = editId === cat.id && showForm;
                  const isCollapsed = collapsed.has(cat.id);

                  return (
                    <tr key={cat.id} className={isEditing ? 'is-selected' : undefined} onDoubleClick={() => openEdit(cat)}>
                      <td className={cat.description ? 'cell-stack' : undefined}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: level * TREE_INDENT_PX, minWidth: 0 }}>
                          {hasChildren ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={isCollapsed ? <IconChevronRight size={16} stroke={1.8} /> : <IconChevronDown size={16} stroke={1.8} />}
                              onClick={() => toggleCollapse(cat.id)}
                              aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${cat.name}`}
                              aria-expanded={!isCollapsed}
                              title={isCollapsed ? 'Expand' : 'Collapse'}
                            />
                          ) : (
                            <span aria-hidden style={{ width: 'var(--control-h-sm)', flexShrink: 0 }} />
                          )}
                          <span style={{ minWidth: 0, overflow: 'hidden' }} title={pathLabel(cat.path)}>
                            <span className={level === 0 ? 'cell-strong' : undefined} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cat.name}
                              {isCollapsed && hasChildren && (
                                <span className="cell-muted" style={{ marginLeft: 8, fontWeight: 400 }}>
                                  {cat.children.length} Sub {cat.children.length === 1 ? 'Category' : 'Categories'}
                                </span>
                              )}
                            </span>
                            {cat.description && <span className="cell-sub">{cat.description}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="cell-strong">{cat.code}</td>
                      <td className="num">Level {cat.depth}</td>
                      <td className="num cell-muted">{cat.sort_order}</td>
                      <td><Badge variant={cat.is_active ? 'success' : 'neutral'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="cell-actions">
                        <span className="row-actions">
                          <Button variant="ghost" size="sm" icon={<IconSubtask size={16} stroke={1.8} />} onClick={() => openNew(cat.id)} aria-label={`Add Sub Category Under ${cat.name}`} title="Add Sub Category" />
                          <Button variant="ghost" size="sm" icon={<IconPencil size={16} stroke={1.8} />} onClick={() => openEdit(cat)} aria-label={`Edit Category ${cat.name}`} title="Edit Category" />
                          <Button variant="ghost" size="sm" icon={<IconTrash size={16} stroke={1.8} />} onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })} aria-label={`Delete Category ${cat.name}`} title="Delete Category" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && flatRows.length > 0 && (
            <div className="panel-footer" style={{ justifyContent: 'flex-start', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Showing {flatRows.length} of {allCats.length} {allCats.length === 1 ? 'Category' : 'Categories'}
            </div>
          )}
        </section>

        {showForm && (
          <SidePanel
            title={panelTitle}
            onClose={closeForm}
            onSubmit={handleSubmit}
            footer={(
              <>
                <Button variant="ghost" onClick={closeForm} disabled={saving}>Cancel</Button>
                <Button variant="primary" type="submit" loading={saving}>{editId ? 'Save Changes' : 'Save Category'}</Button>
              </>
            )}
          >
            {formError && <InlineAlert tone="danger">{formError}</InlineAlert>}
            {editingCat && (
              <p className="form-hint" style={{ marginTop: 0 }}>Level {editingCat.depth}: {pathLabel(editingCat.path) || editingCat.name}</p>
            )}
            {!editId && parentCat && (
              <p className="form-hint" style={{ marginTop: 0 }}>Under: {parentCat.name}</p>
            )}

            <div>
              <TextField label="Category Code" required value={form.code} onChange={value => setF('code', value.toUpperCase())} placeholder="ELEC" inputProps={{ maxLength: 20 }} />
              <p className="form-hint">Must be unique in this company.</p>
            </div>
            <TextField label="Category Name" required value={form.name} onChange={value => setF('name', value)} placeholder="Electronics" inputProps={{ maxLength: 150 }} />

            <TextareaField label="Description" value={form.description} onChange={value => setF('description', value)} placeholder="Optional" maxLength={500} rows={2} />
            <TextareaField label="Notes" value={form.notes} onChange={value => setF('notes', value)} placeholder="Internal notes or hierarchy guidelines" maxLength={2000} rows={2} />

            <div>
              <SelectField
                label="Parent Category"
                value={form.parent_id}
                placeholder="None (Top Level)"
                options={selectOpts.map(opt => ({ value: opt.id, label: opt.label, disabled: opt.disabled }))}
                onChange={value => setF('parent_id', value)}
              />
              {parentCat && (
                <p className="form-hint">Full Path: {(pathLabel(parentCat.path) || parentCat.name) + ' › ' + (form.name || 'New Category')}</p>
              )}
            </div>

            <div>
              <NumericField label="Sort Order" value={String(form.sort_order)} decimalPlaces={0} onChange={value => setF('sort_order', Number(value) || 0)} inputProps={{ maxLength: 4 }} />
              <p className="form-hint">Lower numbers show first.</p>
            </div>

            <div>
              <CheckboxField label="Active" checked={form.is_active} onChange={value => setF('is_active', value)} />
              <p className="form-hint" style={{ marginTop: 0 }}>Inactive Categories cannot be chosen for new products.</p>
            </div>
          </SidePanel>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Delete Category?"
        message={`"${deleteTarget?.name}" will be deleted for good. You cannot delete a Category that has Sub Categories or products.`}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deleteTarget && deleteMut.mutate(
          { id: deleteTarget.id },
          {
            onSuccess: () => { refreshCategories(); setBannerError(''); setDeleteTarget(null); },
            onError: error => { setBannerError(error.message); setDeleteTarget(null); },
          },
        )}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}
