'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── Types ───────────────────────────────────────────────────────────────── */
interface CategoryRow {
  id:          string;
  code:        string;
  name:        string;
  description: string | null;
  parent_id:   string | null;
  parent?:     { id: string; name: string } | null;
  sort_order:  number;
  is_active:   boolean;
  created_at:  string;
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

/* ── Main component ──────────────────────────────────────────────────────── */
export default function CategoriesPage() {
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [form,        setForm]        = useState<FormState>(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');

  const utils = trpc.useUtils();

  /* ── Queries / Mutations ─────────────────────────────────────────────── */
  const { data: categories = [], isLoading } = trpc.products.listCategories.useQuery();

  const createMut = trpc.products.createCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); closeForm(); },
    onError:   e  => { setError(e.message); setSaving(false); },
  });

  const updateMut = trpc.products.updateCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); closeForm(); },
    onError:   e  => { setError(e.message); setSaving(false); },
  });

  const deleteMut = trpc.products.deleteCategory.useMutation({
    onSuccess: () => { utils.products.listCategories.invalidate(); setDeleteId(null); },
    onError:   e  => { setError(e.message); setDeleteId(null); },
  });

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditId(cat.id);
    setForm({
      code:        cat.code,
      name:        cat.name,
      description: cat.description ?? '',
      parent_id:   cat.parent_id ?? '',
      sort_order:  cat.sort_order,
      is_active:   cat.is_active,
    });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setSaving(false);
  }

  function set(key: keyof FormState, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      setError('Code and Name are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      code:        form.code.trim().toUpperCase(),
      name:        form.name.trim(),
      description: form.description.trim() || undefined,
      parent_id:   form.parent_id || undefined,
      sort_order:  Number(form.sort_order),
      is_active:   form.is_active,
    };

    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  /* ── Filtered list ───────────────────────────────────────────────────── */
  const filtered = (categories as CategoryRow[]).filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s);
  });

  /* ── Build parent options (exclude self and own children) ────────────── */
  const parentOptions = (categories as CategoryRow[]).filter(c => c.id !== editId);

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Product Categories
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {(categories as CategoryRow[]).length} categor{(categories as CategoryRow[]).length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Category
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && !showForm && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: '0.84rem',
        }}>
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* ── Layout: table left + form right ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Table side */}
        <div style={{ flex: showForm ? '0 0 58%' : 1, minWidth: 0 }}>
          {/* Search */}
          <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Search code or name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 240 }}
            />
          </div>

          {/* Table */}
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Code', 'Name', 'Parent', 'Sort', 'Status', ''].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: 'left',
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                      background: 'var(--color-table-head-bg)',
                      color: 'var(--color-table-head-fg)',
                      borderBottom: '2px solid var(--color-border)',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      Loading…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                      {search ? 'No categories match your search.' : 'No categories yet. Click "New Category" to add one.'}
                    </td>
                  </tr>
                ) : filtered.map((cat, idx) => {
                  const isEditing = editId === cat.id && showForm;
                  return (
                    <tr key={cat.id} style={{
                      background: isEditing ? 'rgba(29,78,216,0.06)' : idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text)' }}>
                        {cat.code}
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: '0.84rem', color: 'var(--color-text)' }}>
                        {cat.name}
                        {cat.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{cat.description}</div>
                        )}
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                        {cat.parent?.name ?? <span style={{ color: 'var(--color-text-light)', fontSize: '0.78rem' }}>—</span>}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                        {cat.sort_order}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
                          padding: '2px 7px', borderRadius: 4,
                          background: cat.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                          color: cat.is_active ? '#15803d' : '#64748b',
                        }}>
                          {cat.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '3px 8px', marginRight: 4 }}
                          onClick={() => openEdit(cat)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
                          onClick={() => setDeleteId(cat.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Form side */}
        {showForm && (
          <div style={{
            flex: '0 0 40%',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            background: 'var(--color-surface)',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}>
            {/* Form header */}
            <div style={{
              padding: '13px 18px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {editId ? 'Edit Category' : 'New Category'}
              </h3>
              <button
                onClick={closeForm}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', lineHeight: 1 }}
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {error && (
                <div style={{
                  padding: '9px 12px', borderRadius: 6, fontSize: '0.82rem',
                  background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)',
                  color: '#dc2626',
                }}>
                  {error}
                </div>
              )}

              {/* Code + Name side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Code <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    className="input"
                    value={form.code}
                    onChange={e => set('code', e.target.value.toUpperCase())}
                    placeholder="ELEC"
                    maxLength={20}
                    style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Electronics"
                    maxLength={150}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="input"
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Optional description…"
                />
              </div>

              {/* Parent category */}
              <div className="form-group">
                <label className="form-label">Parent Category</label>
                <select
                  className="input"
                  value={form.parent_id}
                  onChange={e => set('parent_id', e.target.value)}
                >
                  <option value="">(None — top level)</option>
                  {parentOptions.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Sort order + Active */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Sort Order</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={form.sort_order}
                    onChange={e => set('sort_order', Number(e.target.value))}
                  />
                </div>
                <div className="form-group" style={{ justifyContent: 'flex-end', display: 'flex', flexDirection: 'column' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => set('is_active', e.target.checked)}
                      style={{ width: 15, height: 15 }}
                    />
                    <span className="form-label" style={{ margin: 0 }}>Active</span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 90 }}>
                  {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 10,
            padding: '24px 28px', width: 380,
            boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Delete Category?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              This cannot be undone. Categories with assigned products cannot be deleted.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button
                className="btn-primary"
                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                onClick={() => deleteMut.mutate({ id: deleteId! })}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
