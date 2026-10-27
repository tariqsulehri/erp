'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SearchField } from '@/components/ui/SearchField';

export interface ProductOptionItem {
  id: string;
  sku: string;
  name: string;
  barcode?: string | null;
  sale_price?: number | string | null;
  cost_price?: number | string | null;
  qty_on_hand?: number | string | null;
  brand?: string | null;
  category?: string | null;
}

export function ProductSearchDialog({
  open,
  title = 'Search Products',
  products,
  onSelect,
  onClose,
}: {
  open: boolean;
  title?: string;
  products: ProductOptionItem[];
  onSelect: (product: ProductOptionItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <SearchField
          value={search}
          onChange={setSearch}
          label="Filter Products"
          placeholder="Filter by SKU, name, barcode, or brand..."
        />

        <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-subtle)', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ width: 120, padding: '8px 12px' }}>SKU</th>
                <th style={{ padding: '8px 12px' }}>Product Name</th>
                <th style={{ width: 100, padding: '8px 12px' }}>Brand</th>
                <th style={{ width: 100, textAlign: 'right', padding: '8px 12px' }}>Price</th>
                <th style={{ width: 90, textAlign: 'right', padding: '8px 12px' }}>On Hand</th>
                <th style={{ width: 80, textAlign: 'right', padding: '8px 12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)' }}>
                    No products found for "{search}".
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr
                    key={item.id}
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                  >
                    <td style={{ fontFamily: 'var(--font-family-mono)', fontWeight: 600, padding: '8px 12px' }}>
                      {item.sku}
                    </td>
                    <td style={{ fontWeight: 500, padding: '8px 12px' }}>
                      {item.name}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                      {item.brand || '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
                      {item.sale_price ? Number(item.sale_price).toFixed(2) : '0.00'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 12px', fontVariantNumeric: 'tabular-nums' }}>
                      {item.qty_on_hand ?? '0'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '6px 12px' }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          onSelect(item);
                          onClose();
                        }}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span>Showing {filtered.length} products. Double-click row to select.</span>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
