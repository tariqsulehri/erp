'use client';

/**
 * UomPage — Professional Units of Measure management.
 *
 * UI highlights:
 *  - Type-coloured filter pills with SVG icons
 *  - Table row hover via <style> block + icon action buttons
 *  - Form header uses a dynamic gradient keyed to the selected UOM type
 *  - CSS toggle switches for is_active / is_default (no raw checkboxes)
 *  - Styled ConfirmModal with warning icon (replaces inline modal)
 *  - Type selector buttons include inline SVG icons per measurement category
 */

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  productsQueryKey,
  useCreateProductUom,
  useDeleteProductUom,
  useProductUnitsOfMeasure,
  useUpdateProductUom,
} from '@/lib/api/products';

/* ═══════════════════════════════════════════════════════════════════════════
   Types / constants
═══════════════════════════════════════════════════════════════════════════ */
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

import type { ReactElement } from 'react';

/* Per-type: accent colour, gradient, icon (SVG path data) */
const UOM_META: Record<UomType, { color: string; grad: string; bg: string; border: string }> = {
  Quantity: { color: '#1d4ed8', grad: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)', bg: 'rgba(29,78,216,0.08)',   border: 'rgba(29,78,216,0.25)'  },
  Weight:   { color: '#15803d', grad: 'linear-gradient(135deg,#14532d,#15803d)', bg: 'rgba(21,128,61,0.08)',   border: 'rgba(21,128,61,0.25)'  },
  Volume:   { color: '#0891b2', grad: 'linear-gradient(135deg,#164e63,#0891b2)', bg: 'rgba(8,145,178,0.08)',   border: 'rgba(8,145,178,0.25)'  },
  Length:   { color: '#d97706', grad: 'linear-gradient(135deg,#78350f,#d97706)', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.25)'  },
  Area:     { color: '#7c3aed', grad: 'linear-gradient(135deg,#4c1d95,#7c3aed)', bg: 'rgba(124,58,237,0.08)',  border: 'rgba(124,58,237,0.25)' },
  Time:     { color: '#db2777', grad: 'linear-gradient(135deg,#831843,#db2777)', bg: 'rgba(219,39,119,0.08)',  border: 'rgba(219,39,119,0.25)' },
  Other:    { color: '#475569', grad: 'linear-gradient(135deg,#1e293b,#475569)', bg: 'rgba(71,85,105,0.08)',   border: 'rgba(71,85,105,0.25)'  },
};

/* SVG icon JSX per type */
const UOM_ICONS: Record<UomType, ReactElement> = {
  Quantity: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
      <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
    </svg>
  ),
  Weight: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 18H2z"/><circle cx="12" cy="8" r="2"/>
    </svg>
  ),
  Volume: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5L3 21h18L19 3h-4"/><path d="M9 3a3 3 0 006 0"/>
    </svg>
  ),
  Length: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18"/><path d="M3 6v12"/><path d="M21 6v12"/>
      <path d="M8 9v6"/><path d="M13 9v6"/><path d="M18 9v6"/>
    </svg>
  ),
  Area: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/>
    </svg>
  ),
  Time: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  Other: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  ),
};

const EMPTY_FORM = { name: '', abbreviation: '', uom_type: 'Quantity' as UomType, is_active: true, is_default: false };
type FormState = typeof EMPTY_FORM;

/* ═══════════════════════════════════════════════════════════════════════════
   ConfirmModal
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

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
═══════════════════════════════════════════════════════════════════════════ */
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

  /* ── Queries / mutations ── */
  const { data: uoms = [], isLoading } = useProductUnitsOfMeasure();
  const refreshUom = () => queryClient.invalidateQueries({ queryKey: productsQueryKey });

  const createMut = useCreateProductUom();
  const updateMut = useUpdateProductUom();
  const deleteMut = useDeleteProductUom();

  /* ── Helpers ── */
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
  function set(key: keyof FormState, value: unknown) { setForm(f => ({ ...f, [key]: value })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.abbreviation.trim()) {
      setFormError('Name and Abbreviation are required.'); return;
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

  /* ── Derived ── */
  const allUoms  = uoms as UomRow[];
  const filtered = typeFilter ? allUoms.filter(u => u.uom_type === typeFilter) : allUoms;

  const typeCounts = UOM_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allUoms.filter(u => u.uom_type === t).length;
    return acc;
  }, {});

  const activeMeta  = UOM_META[form.uom_type] ?? UOM_META.Other;
  const activeTypes = UOM_TYPES.filter(t => typeCounts[t] > 0);

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Scoped CSS ── */}
      <style>{`
        /* Row hover */
        .uom-row td { transition: background 0.1s; }
        .uom-row:hover td { background: rgba(29,78,216,0.04) !important; }
        .uom-row.uom-editing td { background: rgba(29,78,216,0.07) !important; }
        .uom-row.uom-editing td:first-child { box-shadow: inset 3px 0 0 #1d4ed8; }

        /* Action buttons fade in */
        .uom-actions { opacity: 0; transition: opacity 0.15s; display: inline-flex; align-items: center; gap: 2px; }
        .uom-row:hover .uom-actions,
        .uom-row.uom-editing .uom-actions { opacity: 1; }
        .uom-ibtn {
          background: transparent; border: none; cursor: pointer;
          padding: 5px; border-radius: 6px;
          display: inline-flex; align-items: center; justify-content: center;
          color: var(--color-text-muted);
          transition: background 0.12s, color 0.12s;
        }
        .uom-ibtn:hover       { background: rgba(0,0,0,0.07);        color: var(--color-text); }
        .uom-ibtn.edit:hover  { background: rgba(29,78,216,0.1);     color: #1d4ed8; }
        .uom-ibtn.del:hover   { background: rgba(220,38,38,0.1);     color: #dc2626; }

        /* CSS toggle switch */
        .uom-toggle { position: relative; display: inline-block; width: 40px; height: 22px; vertical-align: middle; flex-shrink: 0; }
        .uom-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .uom-slider {
          position: absolute; cursor: pointer; inset: 0;
          background: #cbd5e1; border-radius: 22px;
          transition: background 0.2s;
        }
        .uom-slider::before {
          content: ''; position: absolute;
          height: 16px; width: 16px; left: 3px; bottom: 3px;
          background: #fff; border-radius: 50%;
          transition: transform 0.2s;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .uom-toggle input:checked + .uom-slider.green { background: #15803d; }
        .uom-toggle input:checked + .uom-slider.blue  { background: #1d4ed8; }
        .uom-toggle input:checked + .uom-slider::before { transform: translateX(18px); }
        .uom-toggle input:disabled + .uom-slider { opacity: 0.5; cursor: not-allowed; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#134e4a,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(13,148,136,0.35)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12l4 18H2z"/><circle cx="12" cy="8" r="2.5"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
              Units of Measure
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
              {allUoms.length} unit{allUoms.length !== 1 ? 's' : ''} across {activeTypes.length} type{activeTypes.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button className="btn-primary" onClick={openNew}
          style={{ display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap', padding: '9px 18px', fontWeight: 700 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New UOM
        </button>
      </div>

      {/* ── Banner error ── */}
      {bannerError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {bannerError}
          <button onClick={() => setBannerError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.2rem', lineHeight: 1, fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* ── Type filter pills ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* "All" pill */}
        <button onClick={() => setTypeFilter('')} style={{
          padding: '5px 13px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
          border: `1px solid ${typeFilter === '' ? '#1d4ed8' : 'var(--color-border)'}`,
          background: typeFilter === '' ? 'rgba(29,78,216,0.1)' : 'var(--color-surface)',
          color: typeFilter === '' ? '#1d4ed8' : 'var(--color-text-muted)',
          display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          All <span style={{ fontVariantNumeric: 'tabular-nums' }}>({allUoms.length})</span>
        </button>

        {UOM_TYPES.filter(t => typeCounts[t] > 0).map(t => {
          const meta   = UOM_META[t];
          const active = typeFilter === t;
          return (
            <button key={t} onClick={() => setTypeFilter(active ? '' : t)} style={{
              padding: '5px 13px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${active ? meta.color : 'var(--color-border)'}`,
              background: active ? meta.bg : 'var(--color-surface)',
              color: active ? meta.color : 'var(--color-text-muted)',
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
            }}>
              <span style={{ color: active ? meta.color : 'var(--color-text-muted)' }}>{UOM_ICONS[t]}</span>
              {t} <span style={{ fontVariantNumeric: 'tabular-nums' }}>({typeCounts[t]})</span>
            </button>
          );
        })}
      </div>

      {/* ── Main split layout ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ─── Table ─── */}
        <div style={{ flex: showForm ? '0 0 56%' : 1, minWidth: 0, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  { h: 'Abbr.',   a: 'left'   },
                  { h: 'Name',    a: 'left'   },
                  { h: 'Type',    a: 'left'   },
                  { h: 'Default', a: 'center' },
                  { h: 'Status',  a: 'center' },
                  { h: '',        a: 'right'  },
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
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading units…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '52px 24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--color-surface-alt)', border: '2px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M6 3h12l4 18H2z"/><circle cx="12" cy="8" r="2.5"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                        {typeFilter ? `No ${typeFilter} units found` : 'No units yet'}
                      </p>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {typeFilter ? 'Try selecting a different type' : 'Add your first unit of measure'}
                      </p>
                    </div>
                    {!typeFilter && (
                      <button className="btn-primary" onClick={openNew} style={{ fontSize: '0.82rem' }}>
                        Add First Unit
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                filtered.map((u, idx) => {
                  const meta      = UOM_META[u.uom_type as UomType] ?? UOM_META.Other;
                  const isEditing = editId === u.id && showForm;
                  return (
                    <tr key={u.id} className={`uom-row${isEditing ? ' uom-editing' : ''}`}
                      style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)' }}>

                      {/* Abbreviation */}
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: '0.92rem',
                          color: meta.color, background: meta.bg, border: `1px solid ${meta.border}`,
                          padding: '3px 9px', borderRadius: 6,
                        }}>
                          {u.abbreviation}
                        </span>
                      </td>

                      {/* Name */}
                      <td style={{ padding: '9px 12px', fontSize: '0.84rem', color: 'var(--color-text)', fontWeight: 500 }}>
                        {u.name}
                      </td>

                      {/* Type pill */}
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: '0.72rem', fontWeight: 600,
                          padding: '3px 9px', borderRadius: 5,
                          background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                        }}>
                          <span style={{ color: meta.color }}>{UOM_ICONS[u.uom_type as UomType]}</span>
                          {u.uom_type}
                        </span>
                      </td>

                      {/* Default */}
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {u.is_default ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', fontWeight: 700, color: '#15803d', background: 'rgba(21,128,61,0.1)', padding: '2px 8px', borderRadius: 10, border: '1px solid #86efac' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            Default
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-border)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 12,
                          background: u.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)',
                          color:      u.is_active ? '#15803d' : '#64748b',
                          border: `1px solid ${u.is_active ? '#86efac' : '#cbd5e1'}`,
                        }}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <span className="uom-actions">
                          <button className={`uom-ibtn edit${isEditing ? ' active-edit' : ''}`} title="Edit unit" onClick={() => openEdit(u)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button className="uom-ibtn del" title="Delete unit"
                            onClick={() => setDeleteTarget({ id: u.id, name: `${u.name} (${u.abbreviation})` })}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-alt)', fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', gap: 12 }}>
              <span>Showing <strong>{filtered.length}</strong> of <strong>{allUoms.length}</strong> unit{allUoms.length === 1 ? '' : 's'}</span>
              {typeFilter && <span style={{ color: UOM_META[typeFilter as UomType]?.color ?? '#1d4ed8', fontWeight: 600 }}>Filtered: {typeFilter}</span>}
            </div>
          )}
        </div>

        {/* ─── Form panel ─── */}
        {showForm && (
          <div style={{ flex: '0 0 42%', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)', overflow: 'hidden', boxShadow: '0 6px 28px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>

            {/* Header — gradient keyed to selected type */}
            <div style={{ padding: '15px 20px', background: activeMeta.grad, borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff' }}>
                  {UOM_ICONS[form.uom_type]}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                    {editId ? 'Edit Unit of Measure' : 'New Unit of Measure'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'rgba(255,255,255,0.65)' }}>
                    {form.uom_type} · {editId ? 'Update existing unit' : 'Add to library'}
                  </p>
                </div>
              </div>
              <button onClick={closeForm}
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: 7, padding: '5px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 15, overflowY: 'auto' }}>
              {formError && (
                <div style={{ padding: '9px 12px', borderRadius: 7, fontSize: '0.82rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {formError}
                </div>
              )}

              {/* Name + Abbreviation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Kilogram" maxLength={80} />
                </div>
                <div className="form-group">
                  <label className="form-label">Abbr. <span style={{ color: '#dc2626' }}>*</span></label>
                  <input className="input" value={form.abbreviation}
                    onChange={e => set('abbreviation', e.target.value)}
                    placeholder="kg" maxLength={20}
                    style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: '1rem', textAlign: 'center', letterSpacing: '0.04em' }} />
                </div>
              </div>
              <p style={{ margin: '-8px 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Abbreviation must be unique — shown on product forms and reports.
              </p>

              {/* Type selector */}
              <div className="form-group">
                <label className="form-label">Type <span style={{ color: '#dc2626' }}>*</span></label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {UOM_TYPES.map(t => {
                    const meta   = UOM_META[t];
                    const active = form.uom_type === t;
                    return (
                      <button key={t} type="button" onClick={() => set('uom_type', t)}
                        style={{
                          padding: '6px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                          border: `1px solid ${active ? meta.color : 'var(--color-border)'}`,
                          background: active ? meta.bg : 'var(--color-surface-alt)',
                          color: active ? meta.color : 'var(--color-text-muted)',
                          display: 'flex', alignItems: 'center', gap: 5,
                          transition: 'all 0.15s',
                          boxShadow: active ? `0 0 0 2px ${meta.color}30` : 'none',
                        }}>
                        <span style={{ color: active ? meta.color : 'var(--color-text-muted)' }}>{UOM_ICONS[t]}</span>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Active toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--color-surface-alt)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Active</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>Inactive units cannot be assigned to products</div>
                  </div>
                  <label className="uom-toggle">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                    <span className="uom-slider green" />
                  </label>
                </div>

                {/* Default for type toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'var(--color-surface-alt)', borderRadius: 8, border: `1px solid ${form.is_default ? activeMeta.border : 'var(--color-border)'}`, transition: 'border-color 0.2s' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>Default for type</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
                      Pre-selected when adding <strong>{form.uom_type}</strong> products
                    </div>
                  </div>
                  <label className="uom-toggle">
                    <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} />
                    <span className="uom-slider blue" />
                  </label>
                </div>

                {/* Info note when default is on */}
                {form.is_default && (
                  <div style={{ padding: '8px 12px', borderRadius: 7, fontSize: '0.78rem', background: activeMeta.bg, border: `1px solid ${activeMeta.border}`, color: activeMeta.color, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Saving will automatically unset the existing default for <strong>{form.uom_type}</strong> in this company.
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 6, borderTop: '1px solid var(--color-border)', marginTop: 2 }}>
                <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}
                  style={{ minWidth: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  {saving
                    ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Saving…</>
                    : editId ? 'Save Changes' : 'Create Unit'
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
          title="Delete Unit of Measure?"
          message={`"${deleteTarget.name}" will be permanently removed. Units assigned to products cannot be deleted.`}
          confirmLabel="Delete"
          onConfirm={() => deleteMut.mutate(
            { id: deleteTarget.id },
            {
              onSuccess: () => { refreshUom(); setDeleteTarget(null); },
              onError: error => { setBannerError(error.message); setDeleteTarget(null); },
            },
          )}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
