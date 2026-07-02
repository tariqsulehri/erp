'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '@/lib/app-settings';
import { productsQueryKey, useArchiveProduct, useProductDetail } from '@/lib/api/products';
import { useGeneralSettings } from '@/lib/api/settings';
import { fmtDate, fmtQty, PRODUCT_TYPE_META, StatusBadge, TypeBadge } from './ProductShared';

export function ProductDetailPanel({ id, onClose, onEdit }: {
  id: string; onClose: () => void; onEdit: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const { data: p, isLoading } = useProductDetail(id);
  const { data: generalSettings } = useGeneralSettings();
  const archiveMut = useArchiveProduct();

  if (isLoading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--color-text-muted)' }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading…
    </div>
  );
  if (!p) return null;

  const typeMeta   = PRODUCT_TYPE_META[p.product_type] ?? PRODUCT_TYPE_META.Finished;
  const margin     = parseFloat(p.sale_price) > 0
    ? (((parseFloat(p.sale_price) - parseFloat(p.cost_price)) / parseFloat(p.sale_price)) * 100).toFixed(1)
    : null;
  const isLowStock = p.min_stock_level && parseFloat(p.qty_on_hand) < parseFloat(p.min_stock_level);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '3px solid var(--color-primary)' }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px', background: 'var(--color-table-head-bg)',
        borderBottom: '2px solid var(--color-panel-header-border)',
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.875rem', color: 'var(--color-panel-list-fg)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 4 }}>{p.sku}</span>
            <StatusBadge status={p.status} />
            <TypeBadge   type={p.product_type} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#fff', margin: '0 0 2px', lineHeight: 1.3 }}>{p.name}</p>
          {p.brand && <p style={{ fontSize: '0.75rem', color: 'var(--color-panel-list-fg-muted)', margin: 0 }}>{p.brand}{p.model ? ` · ${p.model}` : ''}</p>}
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 8px', color: '#fff', flexShrink: 0, marginLeft: 8 }}>×</button>
      </div>

      {/* Body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* KPI row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0, borderBottom: '1.5px solid var(--color-border)',
        }}>
          {[
            { label: 'Cost Price',  value: formatMoney(p.cost_price, generalSettings),  color: 'var(--color-text)' },
            { label: 'Sale Price',  value: formatMoney(p.sale_price, generalSettings),  color: 'var(--color-debit)' },
            { label: 'Margin',      value: margin ? `${margin}%` : '—',   color: margin && parseFloat(margin) >= 20 ? 'var(--color-credit)' : 'var(--color-warning)' },
          ].map((k, i) => (
            <div key={k.label} style={{
              padding: '12px 14px',
              borderRight: i < 2 ? '1px solid var(--color-border)' : 'none',
              background: 'var(--color-table-row-even)',
            }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Stock row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0, borderBottom: '1.5px solid var(--color-border)',
        }}>
          {[
            { label: 'On Hand',   value: fmtQty(p.qty_on_hand, generalSettings),     color: isLowStock ? 'var(--color-warning)' : 'var(--color-text)' },
            { label: 'Reserved',  value: fmtQty(p.qty_reserved, generalSettings),    color: 'var(--color-text-muted)' },
            { label: 'Available', value: fmtQty((parseFloat(p.qty_on_hand)||0) - (parseFloat(p.qty_reserved)||0), generalSettings), color: 'var(--color-text)' },
          ].map((k, i) => (
            <div key={k.label} style={{ padding: '10px 14px', borderRight: i < 2 ? '1px solid var(--color-border)' : 'none' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Details rows */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Category',   value: p.category ? `${p.category.code} — ${p.category.name}` : '—' },
            { label: 'UOM',        value: p.uom       ? `${p.uom.abbreviation} (${p.uom.name})` : '—' },
            { label: 'Barcode',    value: p.barcode   ?? '—' },
            { label: 'Tax',        value: `${p.tax_category} · ${p.tax_rate}%` },
            { label: 'Min Level',  value: p.min_stock_level ? fmtQty(p.min_stock_level, generalSettings) : '—' },
            { label: 'Reorder Qty',value: p.reorder_qty     ? fmtQty(p.reorder_qty, generalSettings)     : '—' },
            { label: 'Created',    value: fmtDate(p.created_at, generalSettings) },
            { label: 'Updated',    value: fmtDate(p.updated_at, generalSettings) },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', minWidth: 100, flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text)', textAlign: 'right' }}>{row.value}</span>
            </div>
          ))}

          {/* Description / Notes */}
          {p.description && (
            <div style={{ paddingTop: 4 }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 5 }}>Description</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>{p.description}</p>
            </div>
          )}
          {p.notes && (
            <div style={{ marginTop: 4, padding: '10px 12px', background: 'var(--color-table-row-even)', borderRadius: 'var(--radius)', border: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 0, marginBottom: 4 }}>Notes</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.55 }}>{p.notes}</p>
            </div>
          )}
          {p.tags && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              {String(p.tags).split(',').filter((t: string) => t.trim()).map((tag: string) => (
                <span key={tag} style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                  background: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border)' }}>
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px', borderTop: '1.5px solid var(--color-panel-footer-border)',
        background: 'var(--color-panel-footer-bg)',
        display: 'flex', gap: 8, flexShrink: 0,
      }}>
        <button className="btn btn-primary btn-sm" onClick={() => onEdit(p.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Product
        </button>
        {p.status !== 'Discontinued' && (
          <button className="btn btn-sm"
            style={{ marginLeft: 'auto', background: 'var(--color-danger-bg)', border: '1.5px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}
            onClick={() => setShowArchiveConfirm(true)}
          >Archive</button>
        )}
      </div>

      {/* Archive confirm modal */}
      {showArchiveConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 12, padding: '28px 32px', width: 420, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(217,119,6,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2.5" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Archive Product?</h3>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '0.875rem', color: 'var(--color-text)', fontWeight: 600 }}>{p.name}</p>
            <p style={{ margin: '0 0 24px', fontSize: '0.84rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              This product will be marked <strong>Discontinued</strong> and hidden from active use. It will remain in historical records. You can reactivate it later by editing the status.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowArchiveConfirm(false)} style={{ minWidth: 80 }}>Cancel</button>
              <button
                disabled={archiveMut.isPending}
                onClick={() => {
                  archiveMut.mutate({ id: p.id }, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: productsQueryKey });
                      onClose();
                    },
                  });
                  setShowArchiveConfirm(false);
                }}
                style={{ padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', background: 'var(--color-warning)', color: '#fff', minWidth: 100 }}>
                {archiveMut.isPending ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
