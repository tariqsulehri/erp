'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { IconArrowDown, IconArrowUp, IconPencil, IconPlus } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useGeneralSettings } from '@/lib/api/settings';
import { useProductBrands, useProductCategories, useProductsList } from '@/lib/api/products';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { workplaceLabel } from '@/lib/auth/session-user';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import {
  MoneyCell,
  PRODUCT_TYPE_OPTIONS,
  SelectOption,
  STATUS_OPTIONS,
  STOCK_FILTER_OPTIONS,
  StatusBadge,
  StockIndicator,
  TypeBadge,
} from './ProductShared';

type SortColumn = 'sku' | 'name' | 'sale_price' | 'qty_on_hand';

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  ...STATUS_OPTIONS.map(option => ({ value: option.value, label: option.label })),
];

const sortButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

export function ProductList({ selectedId, onSelect, onNew, onEdit, detailOpen }: {
  selectedId: string | null; onSelect: (id: string) => void;
  onNew: () => void; onEdit: (id: string) => void; detailOpen: boolean;
}) {
  const { data: session } = useSession();
  // The backend returns stock for the user's own Branch or Warehouse, or the company total for All Branches users.
  const stockColumnLabel = !session?.user || session.user.accessLevel === 'ALL_BRANCHES'
    ? 'Total Stock'
    : `Stock At ${workplaceLabel(session.user)}`;
  const [searchText, setSearchText] = useState('');
  const [search,   setSearch]   = useState('');
  const [catFlt,   setCatFlt]   = useState('');
  const [brandFlt, setBrandFlt] = useState('');
  const [typeFlt,  setTypeFlt]  = useState('');
  const [statusFlt,setStatusFlt]= useState('Active');
  const [stockFlt, setStockFlt] = useState('');
  const [sortBy,   setSortBy]   = useState<string>('name');
  const [sortDir,  setSortDir]  = useState<'ASC'|'DESC'>('ASC');
  const [page,     setPage]     = useState(1);
  const LIMIT = 60;

  const { data: categories } = useProductCategories();
  const { data: brands }     = useProductBrands();
  const { data: generalSettings } = useGeneralSettings();
  const { data, isLoading, error }  = useProductsList({
    page, limit: LIMIT,
    search:       search    || undefined,
    category_id:  catFlt    || undefined,
    brand_id:     brandFlt  || undefined,
    product_type: typeFlt   || undefined,
    status:       statusFlt || undefined,
    stock_filter: stockFlt  || undefined,
    sort_by:      sortBy,
    sort_dir:     sortDir,
  });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;
  const isFiltered = Boolean(search || catFlt || brandFlt || typeFlt || stockFlt || (statusFlt && statusFlt !== 'Active'));
  // Keep the list readable next to the detail panel by hiding the least-used columns.
  const colSpan = detailOpen ? 9 : 11;

  const categoryFilterOptions = useMemo<SelectOption[]>(
    () => ((categories ?? []) as Array<{ id: string; code: string; name: string }>).map(c => ({
      value: c.id,
      label: `${c.code} — ${c.name}`,
      searchText: `${c.code} ${c.name}`,
    })),
    [categories],
  );
  const brandFilterOptions = useMemo<SelectOption[]>(
    () => ((brands ?? []) as Array<{ id: string; code: string; name: string }>).map(brand => ({
      value: brand.id,
      label: `${brand.code} — ${brand.name}`,
      searchText: `${brand.code} ${brand.name}`,
    })),
    [brands],
  );

  function toggleSort(col: SortColumn) {
    if (sortBy === col) setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(col); setSortDir('ASC'); }
  }

  function applySearch() {
    setSearch(searchText.trim());
    setPage(1);
  }

  function clearFilters() {
    setSearchText('');
    setSearch('');
    setCatFlt('');
    setBrandFlt('');
    setTypeFlt('');
    setStockFlt('');
    setPage(1);
  }

  function sortHeader(col: SortColumn, label: string, { numeric = false, width }: { numeric?: boolean; width?: number } = {}) {
    const active = sortBy === col;
    return (
      <th
        key={col}
        className={numeric ? 'num' : undefined}
        style={width ? { width } : undefined}
        aria-sort={active ? (sortDir === 'ASC' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" style={sortButtonStyle} onClick={() => toggleSort(col)} title={`Sort By ${label}`}>
          {label}
          {active && (sortDir === 'ASC'
            ? <IconArrowUp size={14} stroke={1.8} aria-hidden />
            : <IconArrowDown size={14} stroke={1.8} aria-hidden />)}
        </button>
      </th>
    );
  }

  const hasActiveFilters = Boolean(search || searchText || catFlt || brandFlt || typeFlt || stockFlt);

  return (
    <section className="panel panel-fill">
      <div className="filter-bar">
        <div className="filter-bar-grow">
          <SearchField
            label="Search Products"
            value={searchText}
            onChange={setSearchText}
            onSubmit={applySearch}
            placeholder="Search by SKU, Name, Brand, or Barcode, then press Enter"
          />
        </div>
        <div style={{ width: 180 }}>
          <SearchableSelect
            value={catFlt}
            options={categoryFilterOptions}
            onChange={nextCategory => { setCatFlt(nextCategory); setPage(1); }}
            placeholder="All Categories"
          />
        </div>
        <div style={{ width: 160 }}>
          <SearchableSelect
            value={brandFlt}
            options={brandFilterOptions}
            onChange={nextBrand => { setBrandFlt(nextBrand); setPage(1); }}
            placeholder="All Brands"
          />
        </div>
        <select className="form-input" aria-label="Filter By Product Type" value={typeFlt} onChange={event => { setTypeFlt(event.target.value); setPage(1); }} style={{ width: 150 }}>
          <option value="">All Types</option>
          {PRODUCT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className="form-input" aria-label="Filter By Stock Level" value={stockFlt} onChange={event => { setStockFlt(event.target.value); setPage(1); }} style={{ width: 200 }}>
          <option value="">All Stock Levels</option>
          {STOCK_FILTER_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <SegmentedControl label="Status Filter" value={statusFlt} options={STATUS_FILTER_OPTIONS} onChange={value => { setStatusFlt(value); setPage(1); }} />
        {hasActiveFilters && <Button variant="ghost" onClick={clearFilters}>Clear</Button>}
      </div>

      {error && (
        <div style={{ padding: '10px 16px 0' }}>
          <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Unable to load Products.')}</InlineAlert>
        </div>
      )}

      <div className="table-scroll">
        <table className="data-table" style={{ tableLayout: 'fixed', minWidth: detailOpen ? 820 : 1180 }}>
          <thead>
            <tr>
              <th className="num" style={{ width: 48 }}>No.</th>
              {sortHeader('sku', 'SKU', { width: 120 })}
              {sortHeader('name', 'Product Name')}
              {!detailOpen && <th style={{ width: 130 }}>Brand</th>}
              <th style={{ width: 130 }}>Type</th>
              {!detailOpen && <th style={{ width: 140 }}>Category</th>}
              {sortHeader('sale_price', 'Sale Rate', { numeric: true, width: 130 })}
              {!detailOpen && <th className="num" style={{ width: 130 }}>Min Sale Rate</th>}
              {sortHeader('qty_on_hand', stockColumnLabel, { numeric: true, width: 190 })}
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <TableSkeleton columns={colSpan} rowCount={6} ariaLabel="Loading Products…" />}
            {!isLoading && rows.length === 0 && (
              isFiltered
                ? <TableMessageRow colSpan={colSpan} title="No Products Match" description="Change the search text or the filters to see more Products." />
                : <TableMessageRow colSpan={colSpan} title="No Products Yet" description="Add your first Product to start buying, selling, and tracking stock." action={<Button variant="primary" icon={<IconPlus size={16} stroke={1.8} />} onClick={onNew}>New Product</Button>} />
            )}
            {!isLoading && rows.map((p, i: number) => (
              <tr
                key={p.id}
                className={selectedId === p.id ? 'is-selected' : undefined}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(p.id)}
              >
                <td className="num cell-muted">{(page - 1) * LIMIT + i + 1}</td>
                <td className="cell-strong" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.sku}</td>
                <td className="cell-stack">
                  <span className="cell-strong" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  {p.barcode && <span className="cell-sub">{p.barcode}</span>}
                </td>
                {!detailOpen && (
                  <td className={p.brand ? undefined : 'cell-muted'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.brand || 'Not Set'}
                  </td>
                )}
                <td><TypeBadge type={p.product_type} /></td>
                {!detailOpen && (
                  <td className={p.category?.name ? undefined : 'cell-muted'} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.category?.name ?? 'Not Set'}
                  </td>
                )}
                <td className="num"><MoneyCell value={p.sale_price} settings={generalSettings} /></td>
                {!detailOpen && (
                  <td className="num">
                    {p.min_sale_price ? <MoneyCell value={p.min_sale_price} muted settings={generalSettings} /> : <span className="cell-muted">Not Set</span>}
                  </td>
                )}
                <td className="num">
                  <StockIndicator onHand={p.qty_on_hand} minLevel={p.min_stock_level} reorderLevel={p.reorder_level} settings={generalSettings} />
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td className="cell-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconPencil size={16} stroke={1.8} />}
                    onClick={event => { event.stopPropagation(); onEdit(p.id); }}
                    aria-label={`Edit Product ${p.sku}`}
                    title="Edit Product"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationBar
        page={page}
        totalPages={pages}
        totalRecords={total}
        recordLabel={total === 1 ? 'Product' : 'Products'}
        onPageChange={setPage}
      />
    </section>
  );
}
