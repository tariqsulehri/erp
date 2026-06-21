'use client';

/**
 * ProductsPage — full professional inventory products CRUD.
 *
 * 3-mode layout (same pattern as VoucherEntryPage):
 *   LIST   → full-width dense table, all filters/sorts
 *   FORM   → full work-area create/edit form, tabbed
 *   DETAIL → 58/42 split: table left, product card right
 */

import { useState } from 'react';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProductForm } from './ProductForm';
import { ProductList } from './ProductList';
import type { PageMode } from './ProductShared';

/* ═══════════════════════════════════════════════════════════════════
   PRODUCT FORM — full work area (create + edit)
   ═══════════════════════════════════════════════════════════════════ */
export default function ProductsPage() {
  const [mode,       setMode]       = useState<PageMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId,     setEditId]     = useState<string | undefined>(undefined);

  function openNew()               { setEditId(undefined); setSelectedId(null); setMode('form'); }
  function openEdit(id: string)    { setEditId(id);        setSelectedId(null); setMode('form'); }
  function openDetail(id: string)  { setSelectedId(id);    setMode('detail'); }
  function backToList()            { setMode('list'); }
  function handleSaved(id: string) { setSelectedId(id); setMode('detail'); }

  return (
    <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* FORM MODE — full work area */}
      {mode === 'form' && (
        <ProductForm
          editId={editId}
          onSaved={handleSaved}
          onCancel={backToList}
        />
      )}

      {/* LIST + DETAIL modes */}
      {mode !== 'form' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{
            flex: mode === 'detail' ? '0 0 58%' : '1',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
            borderRight: mode === 'detail' ? '1.5px solid var(--color-border)' : 'none',
            transition: 'flex 0.18s ease',
          }}>
            <ProductList
              selectedId={selectedId}
              onSelect={openDetail}
              onNew={openNew}
              onEdit={openEdit}
              detailOpen={mode === 'detail'}
            />
          </div>

          {mode === 'detail' && selectedId && (
            <div style={{ flex: '0 0 42%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ProductDetailPanel
                id={selectedId}
                onClose={() => { setSelectedId(null); setMode('list'); }}
                onEdit={openEdit}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
