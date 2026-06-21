'use client';

/**
 * CategoriesPage — Professional hierarchical product category management.
 *
 * UI highlights:
 *  - KPI stat chips (active / inactive / roots / max-depth)
 *  - Tree table with box-drawing chars — lines colored #94a3b8 (visible on both themes)
 *  - Per-depth colour-coded badges: L0 blue → L1 indigo → L2 violet → L3 purple → L4 pink
 *  - Row hover + editing-row left-accent via <style> block (no JS re-renders)
 *  - Icon action buttons (pencil / trash / plus-child) that fade in on hover
 *  - Consistent dark-navy gradient form header for both create and edit modes
 *  - Cycle-safe parent selector; path breadcrumb preview in form
 *  - Styled ConfirmModal — no browser.confirm()
 */

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  productsQueryKey,
  useCreateProductCategory,
  useDeleteProductCategory,
  useProductCategories,
  useUpdateProductCategory,
} from '@/lib/api/products';

/* ═══════════════════════════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════════════════════════ */
interface CategoryRow {
  id:          string;
  code:        string;
  name:        string;
  description: string | null;
  parent_id:   string | null;
  depth:       number;
  path:        string;
  sort_order:  number;
  is_active:   boolean;
}
interface TreeNode extends CategoryRow { children: TreeNode[]; }
interface FlatRow   { node: TreeNode; continuationLines: boolean[]; isLast: boolean; }
interface SelectOpt { id: string; label: string; disabled: boolean; }

const EMPTY_FORM = { code: '', name: '', description: '', parent_id: '', sort_order: 0, is_active: true };
type FormState = typeof EMPTY_FORM;

/* ═══════════════════════════════════════════════════════════════════════════
   Depth colour palette
═══════════════════════════════════════════════════════════════════════════ */
const DEPTH_PALETTE = [
  { bg: '#dbeafe', color: '#1d4ed8', border: '#bfdbfe' }, // L0 blue
  { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' }, // L1 indigo
  { bg: '#ede9fe', color: '#7c3aed', border: '#ddd6fe' }, // L2 violet
  { bg: '#f3e8ff', color: '#9333ea', border: '#e9d5ff' }, // L3 purple
  { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' }, // L4 pink
  { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }, // L5+ slate
];
const dc = (d: number) => DEPTH_PALETTE[Math.min(d, DEPTH_PALETTE.length - 1)];

/* ═══════════════════════════════════════════════════════════════════════════
   Tree utilities (pure)
═══════════════════════════════════════════════════════════════════════════ */
function buildTree(flat: CategoryRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const c of flat) map.set(c.id, { ...c, children: [] });
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id)!.children.push(node);
    else roots.push(node);
  }
  function sort(ns: TreeNode[]) {
    ns.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    ns.forEach(n => sort(n.children));
  }
  sort(roots);
  return roots;
}

function flattenForTable(nodes: TreeNode[], collapsed: Set<string>, cont: boolean[] = []): FlatRow[] {
  const rows: FlatRow[] = [];
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1;
    rows.push({ node, continuationLines: cont, isLast });
    if (node.children.length && !collapsed.has(node.id))
      rows.push(...flattenForTable(node.children, collapsed, [...cont, !isLast]));
  });
  return rows;
}

function flattenForSelect(nodes: TreeNode[], excludeId: string | null, depth = 0, ancestorExcluded = false): SelectOpt[] {
  const result: SelectOpt[] = [];
  for (const node of nodes) {
    const selfExcluded = node.id === excludeId;
    const disabled     = selfExcluded || ancestorExcluded;
    const indent       = '\u00a0\u00a0'.repeat(depth * 2);
    const connector    = depth > 0 ? '└─\u00a0' : '';
    result.push({ id: node.id, label: indent + connector + node.code + ' — ' + node.name, disabled });
    if (node.children.length) result.push(...flattenForSelect(node.children, excludeId, depth + 1, disabled));
  }
  return result;
}

function treePrefix(contLines: boolean[], isLast: boolean): string {
  if (!contLines.length) return '';
  return contLines.map(c => (c ? '│   ' : '    ')).join('') + (isLast ? '└── ' : '├── ');
}

/* ═══════════════════════════════════════════════════════════════════════════
   Shared micro-components
═══════════════════════════════════════════════════════════════════════════ */
function ConfirmModal({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '28px 32px', width: 430, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} style={{ minWidth: 80 }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 22px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', background: '#dc2626', color: '#fff', minWidth: 90 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* SVG icon helpers */
const IcEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IcTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const IcPlusChild = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */
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

  /* ── Queries / mutations ── */
  const { data: rawCats = [], isLoading } = useProductCategories();
  const refreshCategories = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductCategory();
  const updateMut = useUpdateProductCategory();
  const deleteMut = useDeleteProductCategory();

  /* ── Derived data ── */
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

  /* ── Actions ── */
  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
    setForm({ code: cat.code, name: cat.name, description: cat.description ?? '', parent_id: cat.parent_id ?? '', sort_order: cat.sort_order, is_active: cat.is_active });
    setFormError(''); setSaving(false); setShowForm(true);
  }
  function closeForm() {
    setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setFormError(''); setSaving(false);
  }
  function setF(key: keyof FormState, value: unknown) { setForm(f => ({ ...f, [key]: value })); }

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

  /* ── Helpers ── */
  function pathLabel(pathStr: string): string {
    if (!pathStr) return '';
    return pathStr.split('/').map(pid => allCats.find(c => c.id === pid)?.name ?? '…').join(' › ');
  }

  /* ── Stats ── */
  const totalActive   = allCats.filter(c =>  c.is_active).length;
  const totalInactive = allCats.filter(c => !c.is_active).length;
  const totalRoots    = allCats.filter(c => !c.parent_id).length;
  const maxDepth      = allCats.reduce((m, c) => Math.max(m, c.depth ?? 0), 0);

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Scoped CSS: hover, editing accent, action-btn visibility ── */}
      <style>{`
        .cat-row td { transition: background 0.1s; }
        .cat-row:hover td { background: rgba(29,78,216,0.04) !important; }
        .cat-row.cat-editing td { background: rgba(29,78,216,0.07) !important; }
        .cat-row.cat-editing td:first-child { box-shadow: inset 3px 0 0 #1d4ed8; }
        .cat-actions { opacity: 0; transition: opacity 0.15s; display: inline-flex; align-items: center; gap: 2px; }
        .cat-row:hover .cat-actions,
        .cat-row.cat-editing .cat-actions { opacity: 1; }
        .cat-ibtn {
          background: transparent; border: none; cursor: pointer;
          padding: 5px; border-radius: 6px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.12s, color 0.12s;
        }
        .cat-ibtn:hover            { background: rgba(0,0,0,0.07); color: var(--color-text); }
        .cat-ibtn.add:hover        { background: rgba(21,128,61,0.1);  color: #15803d; }
        .cat-ibtn.edit:hover       { background: rgba(29,78,216,0.1);  color: #1d4ed8; }
        .cat-ibtn.del:hover        { background: rgba(220,38,38,0.1);  color: #dc2626; }
        .cat-ibtn.edit.active-edit { color: #1d4ed8; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(29,78,216,0.35)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/>
              <rect x="2" y="14" width="8" height="8" rx="1.5"/><rect x="14" y="14" width="8" height="8" rx="1.5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
              Product Categories
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              Hierarchical tree — up to 8 levels deep
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => openNew()}
          style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '9px 18px', fontWeight: 700 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Category
        </button>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, maxWidth: 560 }}>
        {([
          { label: 'Active',    value: totalActive,   col: '#15803d', bg: 'rgba(21,128,61,0.08)',   border: 'rgba(21,128,61,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: 'Inactive',  value: totalInactive, col: '#b45309', bg: 'rgba(180,83,9,0.08)',    border: 'rgba(180,83,9,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
          { label: 'Root cats', value: totalRoots,    col: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',   border: 'rgba(29,78,216,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg> },
          { label: 'Max depth', value: maxDepth,      col: '#7c3aed', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> },
        ] as const).map(s => (
          <div key={s.label} style={{ padding: '11px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: s.col, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: s.col, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: '0.64rem', color: s.col, fontWeight: 600, opacity: 0.75, marginTop: 2, letterSpacing: 0 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error banner ── */}
      {bannerError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {bannerError}
          <button onClick={() => setBannerError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.2rem', lineHeight: 1, fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 270 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="input" placeholder="Search code or name…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: '100%' }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)}
            style={{ width: 14, height: 14, accentColor: 'var(--color-primary)' }} />
          Show inactive
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn-ghost" onClick={expandAll}   style={{ fontSize: '0.78rem', padding: '5px 12px' }}>Expand all</button>
          <button className="btn-ghost" onClick={collapseAll} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>Collapse all</button>
        </div>
      </div>

      {/* ── Main split layout ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ─── Tree table ─── */}
        <div style={{ flex: showForm ? '0 0 57%' : 1, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { h: 'Code',         a: 'left'   },
                  { h: 'Name / Path',  a: 'left'   },
                  { h: 'Level',        a: 'center' },
                  { h: 'Order',        a: 'center' },
                  { h: 'Status',       a: 'center' },
                  { h: '',             a: 'right'  },
                ].map(({ h, a }) => (
                  <th key={h} style={{
                    padding: '10px 12px', textAlign: a as 'left' | 'center' | 'right',
                    fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0,
                    background: 'var(--color-table-head-bg)', color: 'var(--color-table-head-fg)',
                    borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading categories…
                  </div>
                </td></tr>
              ) : flatRows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '56px 24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 60, height: 60, borderRadius: 14, background: 'var(--color-surface-alt)', border: '2px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="2" y="3" width="8" height="8" rx="1.5"/><rect x="14" y="3" width="8" height="8" rx="1.5"/>
                        <rect x="2" y="14" width="8" height="8" rx="1.5"/><rect x="14" y="14" width="8" height="8" rx="1.5"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                        {search ? `No results for "${search}"` : 'No categories yet'}
                      </p>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {search ? 'Try a different search term' : 'Create your first root category to get started'}
                      </p>
                    </div>
                    {!search && (
                      <button className="btn-primary" onClick={() => openNew()} style={{ fontSize: '0.82rem' }}>
                        Create First Category
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                flatRows.map(({ node: cat, continuationLines, isLast }) => {
                  const prefix      = treePrefix(continuationLines, isLast);
                  const hasChildren = cat.children.length > 0;
                  const isEditing   = editId === cat.id && showForm;
                  const isCollapsed = collapsed.has(cat.id);
                  const badge       = dc(cat.depth);

                  return (
                    <tr key={cat.id} className={`cat-row${isEditing ? ' cat-editing' : ''}`}
                      style={{ borderBottom: '1px solid var(--color-border)' }}>

                      {/* Code + tree prefix */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {prefix && (
                            <span style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace", fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'pre', userSelect: 'none', lineHeight: 1 }}>
                              {prefix}
                            </span>
                          )}
                          {hasChildren ? (
                            <button onClick={() => toggleCollapse(cat.id)} title={isCollapsed ? 'Expand' : 'Collapse'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 2px', color: '#94a3b8', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}>
                                <polyline points="6 9 12 15 18 9"/>
                              </svg>
                            </button>
                          ) : (
                            <span style={{ width: 16, flexShrink: 0, display: 'inline-block' }} />
                          )}
                          <span style={{
                            fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '0.77rem',
                            color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                            padding: '2px 7px', borderRadius: 5, letterSpacing: '0.04em',
                          }}>
                            {cat.code}
                          </span>
                        </div>
                      </td>

                      {/* Name + description */}
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.84rem', color: 'var(--color-text)', fontWeight: cat.depth === 0 ? 700 : 500 }}
                          title={pathLabel(cat.path)}>
                          {cat.name}
                        </span>
                        {isCollapsed && hasChildren && (
                          <span style={{ marginLeft: 7, fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                            +{cat.children.length} sub
                          </span>
                        )}
                        {cat.description && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                            {cat.description}
                          </div>
                        )}
                      </td>

                      {/* Depth badge */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 800, fontFamily: 'monospace',
                          color: badge.color, background: badge.bg, border: `1px solid ${badge.border}`,
                          padding: '2px 7px', borderRadius: 4,
                        }}>
                          L{cat.depth}
                        </span>
                      </td>

                      {/* Sort */}
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {cat.sort_order}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 12,
                          background: cat.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                          color:      cat.is_active ? '#15803d' : '#64748b',
                          border: `1px solid ${cat.is_active ? '#86efac' : '#cbd5e1'}`,
                        }}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions — fade in on row hover */}
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <span className="cat-actions">
                          <button className="cat-ibtn add"  title="Add child category"  onClick={() => openNew(cat.id)}><IcPlusChild /></button>
                          <button className={`cat-ibtn edit${isEditing ? ' active-edit' : ''}`} title="Edit category" onClick={() => openEdit(cat)}><IcEdit /></button>
                          <button className="cat-ibtn del"  title="Delete category"     onClick={() => setDeleteTarget({ id: cat.id, name: cat.name })}><IcTrash /></button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {flatRows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', gap: 12 }}>
              <span>Showing <strong>{flatRows.length}</strong> of <strong>{allCats.length}</strong> categor{allCats.length === 1 ? 'y' : 'ies'}</span>
              {search && <span style={{ color: '#1d4ed8', fontWeight: 600 }}>Filtered by "{search}"</span>}
            </div>
          )}
        </div>

        {/* ─── Form panel ─── */}
        {showForm && (
          <div style={{ flex: '0 0 41%', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)', overflow: 'hidden', boxShadow: '0 6px 28px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>

            {/* Header — always dark-navy gradient */}
            <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg,#1e3a5f 0%,#1d4ed8 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                  {editId ? 'Edit Category' : form.parent_id ? 'New Child Category' : 'New Root Category'}
                </h3>
                {/* Subtitle: parent name for new child, or path for edit */}
                {!editId && form.parent_id && (() => {
                  const p = allCats.find(c => c.id === form.parent_id);
                  return p ? (
                    <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'rgba(255,255,255,0.65)' }}>
                      Under: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{p.name}</strong>
                    </p>
                  ) : null;
                })()}
                {editId && (() => {
                  const cat = allCats.find(c => c.id === editId);
                  if (!cat) return null;
                  const badge = dc(cat.depth);
                  return (
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ background: badge.bg, color: badge.color, padding: '1px 5px', borderRadius: 3, fontWeight: 700, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                        L{cat.depth}
                      </span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pathLabel(cat.path) || cat.name}
                      </span>
                    </p>
                  );
                })()}
              </div>
              <button onClick={closeForm}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: 7, padding: '5px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 15, overflowY: 'auto' }}>
              {formError && (
                <div style={{ padding: '9px 12px', borderRadius: 7, fontSize: '0.82rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {formError}
                </div>
              )}

              {/* Code + Name */}
              <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Code <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.code}
                    onChange={e => setF('code', e.target.value.toUpperCase())}
                    placeholder="ELEC" maxLength={20}
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: '0.08em' }} />
                  <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Unique per company</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.name}
                    onChange={e => setF('name', e.target.value)}
                    placeholder="Electronics" maxLength={150} />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="input" value={form.description}
                  onChange={e => setF('description', e.target.value)}
                  placeholder="Optional description…" maxLength={500} rows={2}
                  style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>

              {/* Parent category selector */}
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
                {/* Path breadcrumb preview */}
                {form.parent_id && (() => {
                  const parent = allCats.find(c => c.id === form.parent_id);
                  if (!parent) return null;
                  const preview = (pathLabel(parent.path) || parent.name) + ' › ' + (form.name || '(new)');
                  return (
                    <div style={{ marginTop: 7, padding: '6px 10px', background: 'rgba(29,78,216,0.05)', borderRadius: 6, border: '1px solid rgba(29,78,216,0.15)' }}>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: '#1d4ed8', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.4 }}>
                        <strong>Path: </strong>{preview}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Sort order + Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Sort Order</label>
                  <input className="input" type="number" min={0} max={9999} value={form.sort_order}
                    onChange={e => setF('sort_order', Number(e.target.value))} />
                  <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Lower = shown first</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.is_active}
                      onChange={e => setF('is_active', e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '0.84rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Active</span>
                  </label>
                </div>
              </div>

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--color-border)', marginTop: 2 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}
                  style={{ minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {saving
                    ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Saving…</>
                    : editId ? 'Save Changes' : 'Create Category'
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
          message={`"${deleteTarget.name}" will be permanently removed. Categories with child categories or assigned products cannot be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => deleteMut.mutate(
            { id: deleteTarget.id },
            {
              onSuccess: () => { refreshCategories(); setDeleteTarget(null); },
              onError: error => { setBannerError(error.message); setDeleteTarget(null); },
            },
          )}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
