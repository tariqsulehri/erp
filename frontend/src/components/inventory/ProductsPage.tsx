'use client';

/**
 * ProductsPage — inventory products master.
 *
 *   LIST   → product list (filter bar, table, pagination)
 *   FORM   → full-page create/edit form with actions at the top
 *   DETAIL → product list with the product detail panel beside it
 */

import { useState } from 'react';
import { IconPlus } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProductDetailPanel } from './ProductDetailPanel';
import { ProductForm } from './ProductForm';
import { ProductList } from './ProductList';
import type { PageMode } from './ProductShared';

export default function ProductsPage() {
  const [mode,       setMode]       = useState<PageMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId,     setEditId]     = useState<string | undefined>(undefined);

  function openNew()               { setEditId(undefined); setSelectedId(null); setMode('form'); }
  function openEdit(id: string)    { setEditId(id);        setSelectedId(null); setMode('form'); }
  function openDetail(id: string)  { setSelectedId(id);    setMode('detail'); }
  function backToList()            { setMode('list'); }
  function handleSaved(id: string) { setSelectedId(id); setMode('detail'); }

  if (mode === 'form') {
    return <ProductForm editId={editId} onSaved={handleSaved} onCancel={backToList} />;
  }

  const detailOpen = mode === 'detail' && Boolean(selectedId);

  return (
    <main className="page-shell">
      <PageHeader
        title="Products"
        description="Items you buy, sell, or keep in stock, with their prices and stock levels."
        actions={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={openNew}>New Product</Button>}
      />

      <div className={`split-view${detailOpen ? ' has-side' : ''}`}>
        <ProductList
          selectedId={selectedId}
          onSelect={openDetail}
          onNew={openNew}
          onEdit={openEdit}
          detailOpen={detailOpen}
        />

        {detailOpen && selectedId && (
          <section className="panel side-panel">
            <ProductDetailPanel
              id={selectedId}
              onClose={() => { setSelectedId(null); setMode('list'); }}
              onEdit={openEdit}
            />
          </section>
        )}
      </div>
    </main>
  );
}
