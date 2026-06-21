'use client';

import { useState } from 'react';
import {
  IconChartBar,
  IconCircleX,
  IconEye,
  IconFilePlus,
  IconListSearch,
  IconRefresh,
} from '@tabler/icons-react';
import { DateField, NumericField, SelectField, TextField, fieldStyle } from '@/components/ui/FormFields';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePurchaseReturnDetail, usePurchaseReturnsList } from '@/lib/api/purchase-returns';
import {
  badgeStyle,
  compactButtonStyle,
  detailMessageStyle,
  lineActionButtonStyle,
  purchaseDetailPanelStyle,
  purchaseListFooterStyle,
  statusBadgeStyle,
  tableCellStyle,
  tableHeadStyle,
  titleIconStyle,
  toolbarStyle,
} from '@/components/purchases/PurchaseVoucherStyles';
import type { PaymentType, SupplierOption, WarehouseOption } from '@/components/purchases/PurchaseVoucherTypes';

interface PostedPurchaseReturnsViewProps {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewReturn: () => void;
  onAnalytics: () => void;
}

export function PostedPurchaseReturnsView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewReturn,
  onAnalytics,
}: PostedPurchaseReturnsViewProps) {
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 350);

  const listQuery = usePurchaseReturnsList({
    page,
    limit: pageSize,
    status: 'Posted',
    search: debouncedSearch || undefined,
    supplier_id: supplierId || undefined,
    payment_type: paymentType as PaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = usePurchaseReturnDetail(selectedId);

  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

  function resetFilters() {
    setSearch('');
    setSupplierId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setPage(1);
    setSelectedId(null);
  }

  function updateFilter(action: () => void) {
    action();
    setPage(1);
    setSelectedId(null);
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconListSearch size={20} stroke={1.8} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Posted Purchase Returns</h1>
              <span style={badgeStyle('#166534', '#dcfce7')}>Posted Only</span>
              <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => listQuery.refetch()} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" onClick={onAnalytics} style={compactButtonStyle}><IconChartBar size={15} /> Analytics</button>
            <button className="btn-primary" type="button" onClick={onNewReturn} style={compactButtonStyle}><IconFilePlus size={15} /> New Return</button>
          </div>
        </div>
      </section>

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.3fr) minmax(210px, 0.9fr) 120px minmax(190px, 0.8fr) 118px 118px 112px 112px auto', gap: 7, alignItems: 'end' }}>
          <TextField label="Search" value={search} onChange={value => updateFilter(() => setSearch(value))} placeholder="Return No., Supplier, Reference" />
          <FieldLabel label="Supplier">
            <SearchableSelect value={supplierId} options={suppliers} onChange={value => updateFilter(() => setSupplierId(value))} placeholder="All Suppliers" />
          </FieldLabel>
          <SelectField label="Payment Type" value={paymentType} onChange={value => updateFilter(() => setPaymentType(value))} options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]} placeholder="All" />
          <FieldLabel label="Warehouse">
            <SearchableSelect value={warehouseId} options={warehouses} onChange={value => updateFilter(() => setWarehouseId(value))} placeholder="All Warehouses" />
          </FieldLabel>
          <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} />
          <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} />
          <NumericField label="Amount From" value={amountFrom} onChange={value => updateFilter(() => setAmountFrom(value))} />
          <NumericField label="Amount To" value={amountTo} onChange={value => updateFilter(() => setAmountTo(value))} />
          <button type="button" className="btn-secondary" onClick={resetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>Clear Filters</button>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0, 1fr) 390px' : '1fr', gap: 8, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: 1050, borderCollapse: 'collapse', fontSize: '0.74rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 128 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 124 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 58 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Return No.', 'Date', 'Supplier', 'Supplier Return No.', 'Type', 'Warehouse', 'Gross', 'Discount', 'Tax', 'Net Amount', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index >= 6 && index <= 9)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>Loading Posted Purchase Returns...</td></tr>
                )}
                {listQuery.error && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>{friendlyErrorMessage(listQuery.error, 'Unable to load Posted Purchase Returns.')}</td></tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>No posted purchase returns found for the selected filters.</td></tr>
                )}
                {rows.map(row => {
                  const active = selectedId === row.id;
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                      <td style={tableCellStyle()}><strong>{row.purchase_return_number}</strong></td>
                      <td style={tableCellStyle()}>{formatDate(row.purchase_return_date, generalSettings)}</td>
                      <td style={tableCellStyle()}>{row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name}</td>
                      <td style={tableCellStyle()}>{row.supplier_return_number || '-'}</td>
                      <td style={tableCellStyle()}>{row.payment_type}</td>
                      <td style={tableCellStyle()}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || '-'}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.gross_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.discount_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.tax_amount))}</td>
                      <td style={tableCellStyle(true)}><strong>{money(Number(row.net_amount))}</strong></td>
                      <td style={tableCellStyle()}>
                        <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Return" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                          <IconEye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedId && (
            <aside style={purchaseDetailPanelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Purchase Return Detail</strong>
                <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                  <IconCircleX size={15} />
                </button>
              </div>
              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading purchase return detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Purchase Return Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Return No.', detailQuery.data.purchase_return_number],
                      ['Date', formatDate(detailQuery.data.purchase_return_date, generalSettings)],
                      ['Supplier', `${detailQuery.data.supplier_code} - ${detailQuery.data.supplier_name}`],
                      ['Payment Type', detailQuery.data.payment_type],
                      ['Supplier Return No.', detailQuery.data.supplier_return_number || '-'],
                      ['Reference', detailQuery.data.reference_number || '-'],
                      ['Voucher No.', detailQuery.data.accounting_voucher_number || '-'],
                      ['Posted At', detailQuery.data.posted_at ? formatDate(detailQuery.data.posted_at, generalSettings) : '-'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ border: '1px solid var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 7px', minWidth: 0 }}>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.62rem', fontWeight: 800 }}>{label}</div>
                        <div style={{ color: 'var(--color-text)', fontSize: '0.73rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ minHeight: 0, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem', tableLayout: 'fixed' }}>
                      <colgroup><col style={{ width: 32 }} /><col /><col style={{ width: 66 }} /><col style={{ width: 88 }} /></colgroup>
                      <thead>
                        <tr>{['No.', 'Item', 'Qty', 'Amount'].map((label, index) => <th key={label} style={tableHeadStyle(index >= 2)}>{label}</th>)}</tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data.lines ?? []).map((line: any) => (
                          <tr key={line.id}>
                            <td style={tableCellStyle()}>{line.line_number}</td>
                            <td style={tableCellStyle()}>{line.item_code} - {line.item_name}</td>
                            <td style={tableCellStyle(true)}>{formatNumber(Number(line.quantity), generalSettings)}</td>
                            <td style={tableCellStyle(true)}>{money(Number(line.line_total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gap: 5 }}>
                    {[
                      ['Gross Amount', Number(detailQuery.data.gross_amount)],
                      ['Discount', Number(detailQuery.data.discount_amount)],
                      ['Tax', Number(detailQuery.data.tax_amount)],
                      ['Freight', Number(detailQuery.data.freight_amount)],
                      ['Net Amount', Number(detailQuery.data.net_amount)],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.74rem' }}>
                        <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>{label}</span>
                        <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-amount)' }}>{money(Number(value))}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
        </div>

        <div style={purchaseListFooterStyle}>
          <span>Showing {formatNumber(fromRecord, generalSettings)}-{formatNumber(toRecord, generalSettings)} Of {formatNumber(total, generalSettings)}</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>Page {formatNumber(page, generalSettings)} Of {formatNumber(pages, generalSettings)}</span>
            <select className="form-input" value={pageSize} onChange={event => { setPageSize(Number(event.currentTarget.value)); setPage(1); setSelectedId(null); }} style={{ ...fieldStyle('compact'), width: 76 }} title="Page Size">
              {[25, 50, 100, 200].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(1)} style={compactButtonStyle}>First</button>
            <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(value => Math.max(1, value - 1))} style={compactButtonStyle}>Previous</button>
            <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage(value => Math.min(pages, value + 1))} style={compactButtonStyle}>Next</button>
            <button type="button" className="btn-secondary" disabled={page >= pages} onClick={() => setPage(pages)} style={compactButtonStyle}>Last</button>
          </div>
        </div>
      </section>
    </main>
  );
}
