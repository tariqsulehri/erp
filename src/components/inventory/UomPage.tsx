'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── Types ───────────────────────────────────────────────────────────────── */
interface UomRow {
  id:           string;
  name:         string;
  abbreviation: string;
  uom_type:     string;
  is_active:    boolean;
  is_default:   boolean;
  created_at:   string;
}

type UomType = 'Quantity' | 'Weight' | 'Volume' | 'Length' | 'Area' | 'Time' | 'Other';
const UOM_TYPES: UomType[] = ['Quantity', 'Weight', 'Volume', 'Length', 'Area', 'Time', 'Other'];

const UOM_TYPE_COLORS: Record<string, string> = {
  Quantity: '#1d4ed8',
  Weight:   '#15803d',
  Volume:   '#0891b2',
  Length:   '#d97706',
  Area:     '#7c3aed',
  Time:     '#db2777',
  Other:    '#64748b',
};

const EMPTY_FORM = {
  name:         '',
  abbreviation: '',
  uom_type:     'Quantity' as UomType,
  is_active:    true,
  is_default:   false,
};
type FormState = typeof EMPTY_FORM;

/* ── Main component ──────────────────────────────────────────────────────── */
export default function UomPage() {
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [error,     setError]     = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const utils = trpc.useUtils();

  /* ── Queries / Mutations ─────────────────────────────────────────────── */
  const { data: uoms = [], isLoading } = trpc.products.listUom.useQuery();

  const createMut = trpc.products.createUom.useMutation({
    onSuccess: () => { utils.products.listUom.invalidate(); closeForm(); },
    onError:   e  => { setError(e.message); setSaving(false); },
  });

  const updateMut = trpc.products.updateUom.useMutation({
    onSuccess: () => { utils.products.listUom.invalidate(); closeForm(); },
    onError:   e  => { setError(e.message); setSaving(false); },
  });

  const deleteMut = trpc.products.deleteUom.useMutation({
    onSuccess: () => { utils.products.listUom.invalidate(); setDeleteId(null); },
    onError:   e  => { setError(e.message); setDeleteId(null); },
  });

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(u: UomRow) {
    setEditId(u.id);
    setForm({
      name:         u.name,
      abbreviation: u.abbreviation,
      uom_type:     u.uom_type as UomType,
      is_active:    u.is_active,
      is_default:   u.is_default,
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
    if (!form.name.trim() || !form.abbreviation.trim()) {
      setError('Name and Abbreviation are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      name:         form.name.trim(),
      abbreviation: form.abbreviation.trim(),
      uom_type:     form.uom_type,
      is_active:    form.is_active,
      is_default:   form.is_default,
    };

    if (editId) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  /* ── Filtered list ───────────────────────────────────────────────────── */
  const allUoms = uoms as UomRow[];
  const filtered = typeFilter ? allUoms.filter(u => u.uom_type === typeFilter) : allUoms;

  /* Group counts for type pills */
  const typeCounts = UOM_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allUoms.filter(u => u.uom_type === t).length;
    return acc;
  }, {});

  /* ── Render ──────────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Units of Measure
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {allUoms.length} unit{allUoms.length !== 1 ? 's' : ''} across {Object.values(typeCounts).filter(n => n > 0).length} type{Object.values(typeCounts).filter(n => n > 0).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New UOM
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

      {/* ── Type filter pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button
          onClick={() => setTypeFilter('')}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
            border: `1px solid ${typeFilter === '' ? '#1d4ed8' : 'var(--color-border)'}`,
            background: typeFilter === '' ? 'rgba(29,78,216,0.1)' : 'var(--color-surface)',
            color: typeFilter === '' ? '#1d4ed8' : 'var(--color-text-muted)',
            cursor: 'pointer',
          }}
        >
          All ({allUoms.length})
        </button>
        {UOM_TYPES.filter(t => typeCounts[t] > 0).map(t => {
          const color = UOM_TYPE_COLORS[t];
          const active = typeFilter === t;
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(active ? '' : t)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                border: `1px solid ${active ? color : 'var(--color-border)'}`,
                background: active ? `${color}18` : 'var(--color-surface)',
                color: active ? color : 'var(--color-text-muted)',
                cursor: 'pointer',
              }}
            >
              {t} ({typeCounts[t]})
            </button>
          );
        })}
      </div>

      {/* ── Layout: table left + form right ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Table */}
        <div style={{ flex: showForm ? '0 0 56%' : 1, minWidth: 0 }}>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Abbreviation', 'Name', 'Type', 'Default', 'Status', ''].map(h => (
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
                      {typeFilter ? `No ${typeFilter} units found.` : 'No units yet. Click "New UOM" to add one.'}
                    </td>
                  </tr>
                ) : filtered.map((u, idx) => {
                  const typeColor = UOM_TYPE_COLORS[u.uom_type] ?? '#64748b';
                  const isEditing = editId === u.id && showForm;
                  return (
                    <tr key={u.id} style={{
                      background: isEditing ? 'rgba(29,78,216,0.06)' : idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)',
                      borderBottom: '1px solid var(--color-border)',
                    }}>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem',
                          color: typeColor,
                          background: `${typeColor}14`,
                          padding: '2px 8px', borderRadius: 5,
                        }}>
                          {u.abbreviation}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', fontSize: '0.84rem', color: 'var(--color-text)' }}>
                        {u.name}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{
                          fontSize: '0.72rem', fontWeight: 600,
                          padding: '2px 8px', borderRadius: 4,
                          background: `${typeColor}14`,
                          color: typeColor,
                        }}>
                          {u.uom_type}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                        {u.is_default && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em',
                          padding: '2px 7px', borderRadius: 4,
                          background: u.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                          color: u.is_active ? '#15803d' : '#64748b',
                        }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '3px 8px', marginRight: 4 }}
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
                          onClick={() => setDeleteId(u.id)}
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
            flex: '0 0 42%',
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
                {editId ? 'Edit Unit of Measure' : 'New Unit of Measure'}
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

              {/* Name */}
              <div className="form-group">
                <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="Kilogram"
                  maxLength={80}
                />
              </div>

              {/* Abbreviation */}
              <div className="form-group">
                <label className="form-label">Abbreviation <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  className="input"
                  value={form.abbreviation}
                  onChange={e => set('abbreviation', e.target.value)}
                  placeholder="kg"
                  maxLength={20}
                  style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem' }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Must be unique. Shown on product forms and reports.
                </p>
              </div>

              {/* UOM Type */}
              <div className="form-group">
                <label className="form-label">Type <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {UOM_TYPES.map(t => {
                    const color  = UOM_TYPE_COLORS[t];
                    const active = form.uom_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('uom_type', t)}
                        style={{
                          padding: '5px 12px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                          border: `1px solid ${active ? color : 'var(--color-border)'}`,
                          background: active ? `${color}18` : 'var(--color-surface-alt)',
                          color: active ? color : 'var(--color-text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => set('is_active', e.target.checked)}
                    style={{ width: 15, height: 15 }}
                  />
                  <span className="form-label" style={{ margin: 0 }}>Active</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={e => set('is_default', e.target.checked)}
                    style={{ width: 15, height: 15 }}
                  />
                  <span className="form-label" style={{ margin: 0 }}>Default for type</span>
                </label>
              </div>
              {form.is_default && (
                <div style={{ padding: '7px 10px', borderRadius: 6, fontSize: '0.78rem', background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.25)', color: '#0891b2' }}>
                  Marking this as default will automatically unset any existing default for <strong>{form.uom_type}</strong> units in this company.
                </div>
              )}

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
              Delete Unit of Measure?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              This cannot be undone. UOMs assigned to products cannot be deleted.
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
