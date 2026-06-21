'use client';

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { useProductBrands, useProductCategories, useProductsList } from '@/lib/api/products';
import {
  fmtQty,
  MoneyCell,
  PRODUCT_TYPE_OPTIONS,
  SearchableSelect,
  SelectOption,
  STATUS_OPTIONS,
  STOCK_FILTER_OPTIONS,
  StatusBadge,
  StockIndicator,
  TypeBadge,
} from './ProductShared';

export function ProductList({ selectedId, onSelect, onNew, onEdit, detailOpen }: {
  selectedId: string | null; onSelect: (id: string) => void;
  onNew: () => void; onEdit: (id: string) => void; detailOpen: boolean;
}) {
  const [search,   setSearch]   = useState('');
  const [catFlt,   setCatFlt]   = useState('');
  const [brandFlt, setBrandFlt] = useState('');
  const [typeFlt,  setTypeFlt]  = useState('');
  const [statusFlt,setStatusFlt]= useState('Active');
  const [stockFlt, setStockFlt] = useState('');
  const [sortBy,   setSortBy]   = useState('name');
  const [sortDir,  setSortDir]  = useState<'ASC'|'DESC'>('ASC');
  const [page,     setPage]     = useState(1);
  const LIMIT = 60;

  const { data: categories } = useProductCategories();
  const { data: brands }     = useProductBrands();
  const { data: generalSettings } = useGeneralSettings();
  const { data, isLoading }  = useProductsList({
    page, limit: LIMIT,
    search:       search    || undefined,
    category_id:  catFlt    || undefined,
    brand_id:     brandFlt  || undefined,
    product_type: typeFlt   as any || undefined,
    status:       statusFlt as any || undefined,
    stock_filter: stockFlt  as any || undefined,
    sort_by:      sortBy    as any,
    sort_dir:     sortDir,
  });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;
  const categoryFilterOptions = useMemo<SelectOption[]>(
    () => (categories ?? []).map((c: any) => ({
      value: c.id,
      label: `${c.code} — ${c.name}`,
      searchText: `${c.code} ${c.name}`,
    })),
    [categories],
  );
  const brandFilterOptions = useMemo<SelectOption[]>(
    () => (brands ?? []).map((brand: any) => ({
      value: brand.id,
      label: `${brand.code} — ${brand.name}`,
      searchText: `${brand.code} ${brand.name}`,
    })),
    [brands],
  );

  function toggleSort(col: string) {
    if (sortBy === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortDir('ASC'); }
  }

  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'ASC' ? ' ↑' : ' ↓') : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '8px 16px',
        background: 'var(--color-surface)',
        borderBottom: '1.5px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--color-heading)' }}>Product Catalogue</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-border-subtle)', padding: '2px 8px', borderRadius: 10 }}>
          {total} item{total !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Filters */}
        <input className="form-input" placeholder="Search Code, Name, Brand, Barcode…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 10px', height: 32, width: 200 }}
        />
        <SearchableSelect
          value={catFlt}
          options={categoryFilterOptions}
          onChange={nextCategory => { setCatFlt(nextCategory); setPage(1); }}
          placeholder="All Categories"
          compact
          width={170}
        />
        <SearchableSelect
          value={brandFlt}
          options={brandFilterOptions}
          onChange={nextBrand => { setBrandFlt(nextBrand); setPage(1); }}
          placeholder="All Brands"
          compact
          width={150}
        />
        <SearchableSelect
          value={typeFlt}
          options={PRODUCT_TYPE_OPTIONS}
          onChange={nextType => { setTypeFlt(nextType); setPage(1); }}
          placeholder="All Types"
          compact
          width={145}
        />
        <SearchableSelect
          value={statusFlt}
          options={STATUS_OPTIONS}
          onChange={nextStatus => { setStatusFlt(nextStatus); setPage(1); }}
          placeholder="All Status"
          compact
          width={130}
        />
        <SearchableSelect
          value={stockFlt}
          options={STOCK_FILTER_OPTIONS}
          onChange={nextStockFilter => { setStockFlt(nextStockFilter); setPage(1); }}
          placeholder="All Stock"
          compact
          width={190}
        />

        <button className="btn btn-primary btn-sm" onClick={onNew} style={{ whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          New Product
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 38 }} />
            <col style={{ width: detailOpen ? 90  : 110  }} />
            <col style={{ width: detailOpen ? 170 : 260  }} />
            <col style={{ width: detailOpen ? 90  : 120  }} />
            <col style={{ width: detailOpen ? 90  : 120  }} />
            <col style={{ width: detailOpen ? 90  : 110  }} />
            <col style={{ width: detailOpen ? 125 : 150  }} />
            <col style={{ width: detailOpen ? 120 : 140  }} />
            <col style={{ width: detailOpen ? 105 : 125  }} />
            <col style={{ width: detailOpen ? 80  : 100  }} />
            <col style={{ width: 76 }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ background: 'var(--color-table-head-bg)', borderBottom: '2px solid var(--color-panel-header-border)' }}>
              {[
                { col: '',           label: '#',          sortable: false, align: 'left'   },
                { col: 'sku',        label: 'SKU',        sortable: true,  align: 'left'   },
                { col: 'name',       label: 'Product Name', sortable: true, align: 'left'  },
                { col: '',           label: 'Brand',      sortable: false, align: 'left'   },
                { col: '',           label: 'Type',       sortable: false, align: 'left'   },
                { col: '',           label: 'Category',   sortable: false, align: 'left'   },
                { col: 'sale_price', label: 'Sale Rate',  sortable: true,  align: 'right'  },
                { col: '',           label: 'Min Sale Rate', sortable: false, align: 'right' },
                { col: 'qty_on_hand',label: 'Stock On Hand', sortable: true,  align: 'right'  },
                { col: '',           label: 'Status',     sortable: false, align: 'center' },
                { col: '',           label: 'Actions',    sortable: false, align: 'center' },
              ].map(h => (
                <th key={h.label} onClick={() => h.sortable && toggleSort(h.col)}
                  style={{
                    padding: '7px 10px', textAlign: h.align as any,
                    fontSize: '0.6rem', fontWeight: 800,
                    letterSpacing: 0, color: 'var(--color-table-head-text)',
                    cursor: h.sortable ? 'pointer' : 'default', whiteSpace: 'nowrap',
                    userSelect: 'none',
                  }}>
                  {h.label}{h.sortable ? sortIcon(h.col) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Loading products…
                </div>
              </td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, fontSize: '0.9375rem' }}>No products found</p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>Click <strong>New Product</strong> to add your first item to inventory.</p>
                <button className="btn btn-primary btn-sm" onClick={onNew}>+ New Product</button>
              </td></tr>
            )}
            {rows.map((p: any, i: number) => {
              const active = selectedId === p.id;
              return (
                <tr key={p.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: active ? 'var(--color-table-row-selected)' : i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)',
                    cursor: 'pointer', transition: 'background var(--transition)',
                    outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1,
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-table-row-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)'; }}
                  onClick={() => onSelect(p.id)}
                >
                  <td style={TD}><span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{(page-1)*LIMIT + i+1}</span></td>
                  <td style={TD}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.775rem', color: 'var(--color-primary)' }}>{p.sku}</span>
                  </td>
                  <td style={{ ...TD, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      {p.barcode && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                          {p.barcode}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...TD, color: 'var(--color-text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.brand ?? '—'}
                  </td>
                  <td style={TD}><TypeBadge type={p.product_type} /></td>
                  <td style={{ ...TD, color: 'var(--color-text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.category?.name ?? '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <MoneyCell value={p.sale_price} settings={generalSettings} />
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    {p.min_sale_price ? <MoneyCell value={p.min_sale_price} muted settings={generalSettings} /> : '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <StockIndicator onHand={p.qty_on_hand} minLevel={p.min_stock_level} reorderLevel={p.reorder_level} settings={generalSettings} />
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}><StatusBadge status={p.status} /></td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <button className="btn btn-sm" style={{ padding: '2px 10px', fontSize: '0.7rem', background: 'var(--color-primary-light)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}
                      onClick={e => { e.stopPropagation(); onEdit(p.id); }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        padding: '6px 16px',
        background: 'var(--color-panel-footer-bg)',
        borderTop: '1.5px solid var(--color-panel-footer-border)',
        flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)',
      }}>
        <span>Page {page} of {pages} · {total} product{total !== 1 ? 's' : ''}</span>
        <button disabled={page === 1} onClick={() => setPage(p => p-1)} style={PG_BTN}>‹ Prev</button>
        <button disabled={page >= pages} onClick={() => setPage(p => p+1)} style={PG_BTN}>Next ›</button>
      </div>
    </div>
  );
}

const TD: React.CSSProperties  = { padding: '5px 10px', verticalAlign: 'middle' };
const PG_BTN: React.CSSProperties = {
  padding: '3px 12px', borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)',
};
