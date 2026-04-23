'use client';

/**
 * CategoriesPage — Professional hierarchical product category management.
 *
 * Features:
 *  - Tree table with box-drawing chars (├── └── │) showing full hierarchy
 *  - Expand / collapse subtrees per node
 *  - "+Child" action pre-fills parent_id for instant child creation
 *  - Cycle-safe parent selector (descendants are disabled options)
 *  - Path breadcrumb shown in form and as hover title on name cell
 *  - Depth badge (L0, L1, L2…) per row
 *  - Styled confirmation modal (no browser.confirm())
 *  - Search that preserves ancestor nodes in results
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ════════════════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════════════════ */
interface CategoryRow {
  id:           string;
  code:         string;
  name:         string;
  description:  string | null;
  parent_id:    string | null;
  parent?:      { id: string; name: string } | null;
  depth:        number;
  path:         string;
  sort_order:   number;
  is_active:    boolean;
}

interface TreeNode extends CategoryRow {
  children: TreeNode[];
}

interface FlatRow {
  node:              TreeNode;
  continuationLines: boolean[];
  isLast:            boolean;
}

interface SelectOption {
  id:       string;
  label:    string;
  disabled: boolean;
}

const EMPTY_FORM = {
  code:        '',
  name:        '',
  description: '',
  parent_id:   '',
  sort_order:  0,
  is_active:   true,
};
type FormState = typeof EMPTY_FORM;

/* ════════════════════════════════════════════════════════════════════
   Tree utilities  (pure functions — no side-effects)
   ════════════════════════════════════════════════════════════════════ */

/** O(n) tree reconstruction from flat path-sorted array. */
function buildTree(flat: CategoryRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const c of flat) map.set(c.id, { ...c, children: [] });
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  /* Sort each level by sort_order then name */
  function sortChildren(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    nodes.forEach(n => sortChildren(n.children));
  }
  sortChildren(roots);
  return roots;
}

/** Flatten tree to rows while computing box-drawing context per row. */
function flattenForTable(nodes: TreeNode[], collapsed: Set<string>, contLines: boolean[] = []): FlatRow[] {
  const rows: FlatRow[] = [];
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    rows.push({ node, continuationLines: contLines, isLast });
    if (node.children.length > 0 && !collapsed.has(node.id)) {
      rows.push(...flattenForTable(node.children, collapsed, [...contLines, !isLast]));
    }
  });
  return rows;
}

/** Flatten tree to indented <select> options.  Descendants of excludeId are disabled. */
function flattenForSelect(nodes: TreeNode[], excludeId: string | null, depth = 0, ancestorExcluded = false): SelectOption[] {
  const result: SelectOption[] = [];
  for (const node of nodes) {
    const selfExcluded = node.id === excludeId;
    const disabled     = selfExcluded || ancestorExcluded;
    const indent       = '\u00a0\u00a0'.repeat(depth * 2);          // &nbsp; pairs
    const connector    = depth > 0 ? '└─\u00a0' : '';
    result.push({ id: node.id, label: indent + connector + node.code + ' — ' + node.name, disabled });
    if (node.children.length > 0) {
      result.push(...flattenForSelect(node.children, excludeId, depth + 1, disabled));
    }
  }
  return result;
}

/** Box-drawing prefix string using JetBrains Mono / monospace. */
function treePrefix(contLines: boolean[], isLast: boolean): string {
  if (contLines.length === 0) return '';
  return contLines.map(c => (c ? '│   ' : '    ')).join('') + (isLast ? '└── ' : '├── ');
}

/* ════════════════════════════════════════════════════════════════════
   Confirm Modal
   ════════════════════════════════════════════════════════════════════ */
function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '28px 32px', width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
        </div>
        <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} style={{ minWidth: 80 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', background: '#dc2626', color: '#fff', minWidth: 90 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Main component
   ════════════════════════════════════════════════════════════════════ */
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

  const utils = trpc.useUtils();

  /* ── Queries / mutations ─────────────────────────────────────── */
  const { data: rawCats = [], isLoading } = trpc.products.listCategories.useQuery();

  const createMut = trpc.products.createCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); closeForm(); },
    onError:   e  => { setFormError(e.message); setSaving(false); },
  });
  const updateMut = trpc.products.updateCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); closeForm(); },
    onError:   e  => { setFormError(e.message); setSaving(false); },
  });
  const deleteMut = trpc.products.deleteCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); setDeleteTarget(null); },
    onError:   e  => { setBannerError(e.message); setDeleteTarget(null); },
  });

  /* ── Tree / filter ───────────────────────────────────────────── */
  const allCats = rawCats as CategoryRow[];

  const filteredCats = useMemo(() => {
    let list = allCats;
    if (!showInactive) list = list.filter(c => c.is_active);
    if (search.trim()) {
      const s = search.toLowerCase();
      const matchIds = new Set(
        list.filter(c => c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s)).map(c => c.id),
      );
      /* Include all ancestors so tree remains connected */
      list.forEach(c => {
        if (matchIds.has(c.id) && c.path)
          c.path.split('/').forEach(pid => matchIds.add(pid));
      });
      list = list.filter(c => matchIds.has(c.id));
    }
    return list;
  }, [allCats, search, showInactive]);

  const tree       = useMemo(() => buildTree(filteredCats), [filteredCats]);
  const flatRows   = useMemo(() => flattenForTable(tree, collapsed), [tree, collapsed]);
  const selectOpts = useMemo(() => flattenForSelect(buildTree(allCats), editId), [allCats, editId]);

  /* ── Expand / collapse ───────────────────────────────────────── */
  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function expandAll()   { setCollapsed(new Set()); }
  function collapseAll() {
    const ids = new Set<string>(flatRows.filter(r => r.node.children.length > 0).map(r => r.node.id));
    setCollapsed(ids);
  }

  /* ── Form helpers ────────────────────────────────────────────── */
  function openNew(parentPreset?: string) {
    setEditId(null);
    setForm({ ...EMPTY_FORM, parent_id: parentPreset ?? '' });
    setFormError(''); setSaving(false); setShowForm(true);
  }
  function openEdit(cat: CategoryRow) {
    setEditId(cat.id);
    setForm({ code: cat.code, name: cat.name, description: cat.description ?? '', parent_id: cat.parent_id ?? '', sort_order: cat.sort_order, is_active: cat.is_active });
    setFormError(''); setSaving(false); setShowForm(true);
  }
  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_FORM);
    setFormError(''); setSaving(false);
  }
  function setF(key: keyof FormState, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim()) { setFormError('Code is required.'); return; }
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      code:        form.code.trim().toUpperCase(),
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      parent_id:   form.parent_id || undefined,
      sort_order:  Number(form.sort_order),
      is_active:   form.is_active,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else        createMut.mutate(payload);
  }

  /* ── Breadcrumb path from path string ───────────────────────── */
  function pathLabel(pathStr: string, currentName: string): string {
    if (!pathStr) return currentName;
    const segments = pathStr.split('/');
    const names = segments.map(pid => allCats.find(c => c.id === pid)?.name ?? pid.slice(0, 8) + '…');
    return names.join(' › ');
  }

  /* ── Stats ───────────────────────────────────────────────────── */
  const totalActive   = allCats.filter(c => c.is_active).length;
  const totalInactive = allCats.filter(c => !c.is_active).length;
  const maxDepth      = allCats.reduce((m, c) => Math.max(m, c.depth ?? 0), 0);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.2 }}>
            Product Categories
          </h1>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            {[
              { label: 'Active',     value: totalActive,   color: '#15803d' },
              { label: 'Inactive',   value: totalInactive, color: '#b45309' },
              { label: 'Max depth',  value: maxDepth,      color: '#1d4ed8' },
            ].map(s => (
              <span key={s.label} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                <strong style={{ color: s.color, fontFamily: 'monospace' }}>{s.value}</strong> {s.label}
              </span>
            ))}
          </div>
        </div>
        <button className="btn-primary" onClick={() => openNew()} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Category
        </button>
      </div>

      {/* ── Error banner ── */}
      {bannerError && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {bannerError}
          <button onClick={() => setBannerError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 260 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input" placeholder="Search code or name…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: '100%' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--color-primary)' }} />
          Show inactive
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-ghost" onClick={expandAll}   style={{ fontSize: '0.78rem', padding: '4px 10px' }}>Expand all</button>
          <button className="btn-ghost" onClick={collapseAll} style={{ fontSize: '0.78rem', padding: '4px 10px' }}>Collapse all</button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ─── Tree table ─── */}
        <div style={{ flex: showForm ? '0 0 58%' : 1, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Code / Hierarchy', 'Name', 'Depth', 'Sort', 'Status', 'Actions'].map((h, i) => (
                  <th key={h} style={{
                    padding: '9px 10px', textAlign: i >= 4 ? 'center' : 'left',
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                    background: 'var(--color-table-head-bg)', color: 'var(--color-table-head-fg)',
                    borderBottom: '2px solid var(--color-border)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading categories…
                  </div>
                </td></tr>
              ) : flatRows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                  <p style={{ margin: '0 0 12px', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    {search ? `No categories match "${search}".` : 'No categories yet.'}
                  </p>
                  {!search && (
                    <button className="btn-primary" onClick={() => openNew()} style={{ fontSize: '0.8rem' }}>
                      Create First Category
                    </button>
                  )}
                </td></tr>
              ) : flatRows.map(({ node: cat, continuationLines, isLast }, idx) => {
                const prefix      = treePrefix(continuationLines, isLast);
                const hasChildren = cat.children.length > 0;
                const isEditing   = editId === cat.id && showForm;
                const isCollapsed = collapsed.has(cat.id);

                return (
                  <tr key={cat.id} style={{
                    background: isEditing ? 'rgba(29,78,216,0.05)' : idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)',
                    borderBottom: '1px solid var(--color-border)',
                  }}>
                    {/* Code + tree prefix */}
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {prefix && (
                          <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '0.75rem', color: 'var(--color-border)', whiteSpace: 'pre', lineHeight: 1, userSelect: 'none' }}>
                            {prefix}
                          </span>
                        )}
                        {hasChildren ? (
                          <button onClick={() => toggleCollapse(cat.id)} title={isCollapsed ? 'Expand' : 'Collapse'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                        ) : (
                          <span style={{ width: 15, display: 'inline-block' }} />
                        )}
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '0.8rem',
                          color: cat.depth === 0 ? '#1d4ed8' : 'var(--color-text)',
                          background: cat.depth === 0 ? 'rgba(29,78,216,0.08)' : 'transparent',
                          padding: cat.depth === 0 ? '1px 6px' : '0', borderRadius: 4,
                        }}>
                          {cat.code}
                        </span>
                      </div>
                    </td>

                    {/* Name + description + collapsed hint */}
                    <td style={{ padding: '7px 10px' }}>
                      <span style={{ fontSize: '0.84rem', color: 'var(--color-text)', fontWeight: cat.depth === 0 ? 600 : 400 }}
                        title={pathLabel(cat.path, cat.name)}>
                        {cat.name}
                      </span>
                      {cat.description && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{cat.description}</div>
                      )}
                      {isCollapsed && hasChildren && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-light)', marginLeft: 6, fontStyle: 'italic' }}>
                          {cat.children.length} sub-{cat.children.length === 1 ? 'category' : 'categories'} hidden
                        </span>
                      )}
                    </td>

                    {/* Depth badge */}
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)', padding: '1px 6px', borderRadius: 4 }}>
                        L{cat.depth}
                      </span>
                    </td>

                    {/* Sort order */}
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {cat.sort_order}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
                        padding: '2px 8px', borderRadius: 10,
                        background: cat.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                        color: cat.is_active ? '#15803d' : '#64748b',
                        border: `1px solid ${cat.is_active ? '#86efac' : '#cbd5e1'}`,
                      }}>
                        {cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn-ghost" title="Add child category" onClick={() => openNew(cat.id)}
                        style={{ fontSize: '0.72rem', padding: '3px 7px', marginRight: 3, color: '#15803d', fontWeight: 700 }}>
                        + Child
                      </button>
                      <button className="btn-ghost" onClick={() => openEdit(cat)}
                        style={{ fontSize: '0.72rem', padding: '3px 7px', marginRight: 3 }}>
                        Edit
                      </button>
                      <button className="btn-ghost" onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })}
                        style={{ fontSize: '0.72rem', padding: '3px 7px', color: '#dc2626' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {flatRows.length > 0 && (
            <div style={{ padding: '7px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {flatRows.length} of {allCats.length} categor{allCats.length === 1 ? 'y' : 'ies'}
            </div>
          )}
        </div>

        {/* ─── Form panel ─── */}
        {showForm && (
          <div style={{ flex: '0 0 40%', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-surface)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '12px 18px', background: editId ? '#1e3a5f' : 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: editId ? '#fff' : 'var(--color-text)' }}>
                  {editId ? 'Edit Category' : form.parent_id ? 'New Child Category' : 'New Root Category'}
                </h3>
                {form.parent_id && !editId && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: editId ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)' }}>
                    Under: <strong>{allCats.find(c => c.id === form.parent_id)?.name ?? ''}</strong>
                  </p>
                )}
              </div>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: editId ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)', lineHeight: 1, padding: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
              {formError && (
                <div style={{ padding: '9px 12px', borderRadius: 6, fontSize: '0.82rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626' }}>
                  {formError}
                </div>
              )}

              {/* Code + Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Code <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.code} onChange={e => setF('code', e.target.value.toUpperCase())}
                    placeholder="ELEC" maxLength={20}
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '0.06em' }} />
                  <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Unique per company</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Electronics" maxLength={150} />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="input" value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Optional description…" maxLength={500} />
              </div>

              {/* Parent — indented tree selector */}
              <div className="form-group">
                <label className="form-label">Parent Category</label>
                <select className="input" value={form.parent_id} onChange={e => setF('parent_id', e.target.value)}>
                  <option value="">(None — root level)</option>
                  {selectOpts.map(opt => (
                    <option key={opt.id} value={opt.id} disabled={opt.disabled}
                      style={{ fontFamily: "'JetBrains Mono',monospace", color: opt.disabled ? '#94a3b8' : undefined }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {/* Show path preview */}
                {form.parent_id && (() => {
                  const parent = allCats.find(c => c.id === form.parent_id);
                  if (!parent) return null;
                  const previewPath = parent.path + '/' + (form.name || '(new)');
                  return (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--color-primary)', fontFamily: "'JetBrains Mono',monospace" }}>
                      Path: {pathLabel(previewPath, form.name || '(new)')}
                    </p>
                  );
                })()}
              </div>

              {/* Sort order + Active */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Sort Order</label>
                  <input className="input" type="number" min={0} max={9999} value={form.sort_order}
                    onChange={e => setF('sort_order', Number(e.target.value))} />
                  <p style={{ margin: '3px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Lower = shown first</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Active</span>
                  </label>
                </div>
              </div>

              {/* Current path display in edit mode */}
              {editId && (() => {
                const cat = allCats.find(c => c.id === editId);
                return cat ? (
                  <div style={{ padding: '8px 12px', background: 'var(--color-surface-alt)', borderRadius: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                    Current path: <strong style={{ fontFamily: "'JetBrains Mono',monospace", color: 'var(--color-text)' }}>
                      {pathLabel(cat.path, cat.name)}
                    </strong>
                    <span style={{ marginLeft: 8, background: 'rgba(29,78,216,0.1)', color: '#1d4ed8', fontSize: '0.68rem', fontWeight: 700, padding: '1px 5px', borderRadius: 3 }}>
                      L{cat.depth}
                    </span>
                  </div>
                ) : null;
              })()}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 100 }}>
                  {saving
                    ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Saving…</>
                    : editId ? 'Save Changes' : 'Create'
                  }
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Category?"
          message={`"${deleteTarget.name}" will be permanently deleted. Categories with assigned products or child categories cannot be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => deleteMut.mutate({ id: deleteTarget.id })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
