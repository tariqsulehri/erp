'use client';

import { useState } from 'react';
import {
  IconChartBar,
  IconCircleX,
  IconEye,
  IconFilePlus,
  IconListSearch,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { useSaleInvoiceDetail, useSaleInvoicesList } from '@/lib/api/sales';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { DateField, SelectField, TextField, fieldStyle } from '@/components/ui/FormFields';
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
import type { CustomerOption, SaleListRow, SalePaymentType, WarehouseOption } from './SaleVoucherTypes';

interface PostedSalesViewProps {
  customers: CustomerOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewSale: () => void;
  onAnalytics: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PostedSalesView({
  customers,
  warehouses,
  money,
  generalSettings,
  onNewSale,
  onAnalytics,
  newDisabled = false,
  newDisabledReason,
}: PostedSalesViewProps) {
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountFrom, setAmountFrom] = useState('');
  const [amountTo, setAmountTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useSaleInvoicesList({
    page,
    limit: pageSize,
    status: 'Posted',
    search: search || undefined,
    customer_id: customerId || undefined,
    payment_type: paymentType as SalePaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = useSaleInvoiceDetail(selectedId);

  const rows = (listQuery.data?.data ?? []) as SaleListRow[];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

  function updateFilter(action: () => void) {
    action();
    setPage(1);
    setSelectedId(null);
  }

  function resetFilters() {
    setSearchText('');
    setSearch('');
    setCustomerId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom('');
    setDateTo('');
    setAmountFrom('');
    setAmountTo('');
    setPage(1);
    setSelectedId(null);
  }

  function applySearch() {
    updateFilter(() => setSearch(searchText.trim()));
  }

  function clearSearch() {
    updateFilter(() => {
      setSearchText('');
      setSearch('');
    });
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section style={toolbarStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={titleIconStyle}><IconListSearch size={20} stroke={1.8} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Posted Sales</h1>
              <span style={badgeStyle('#166534', '#dcfce7')}>Posted Only</span>
              <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => listQuery.refetch()} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" onClick={onAnalytics} style={compactButtonStyle}><IconChartBar size={15} /> Analytics</button>
            <button className="btn-primary" type="button" disabled={newDisabled} title={newDisabledReason} onClick={onNewSale} style={compactButtonStyle}><IconFilePlus size={15} /> New Sale</button>
          </div>
        </div>
      </section>

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.5fr) 84px 76px minmax(210px, 1fr) 120px 150px 115px 115px 110px 110px 110px', gap: 6, alignItems: 'end' }}>
          <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Sale No., Customer, Reference" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
          <button type="button" className="btn-secondary" onClick={applySearch} disabled={listQuery.isFetching} style={{ ...compactButtonStyle, alignSelf: 'end' }}>
            {listQuery.isFetching && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
            {listQuery.isFetching ? 'Searching...' : 'Search'}
          </button>
          <button type="button" className="btn-secondary" onClick={clearSearch} disabled={listQuery.isFetching || (!search && !searchText)} style={{ ...compactButtonStyle, alignSelf: 'end' }}>Clear</button>
          <div>
            <label className="field-label">Customer</label>
            <SearchableSelect value={customerId} options={customers} onChange={value => updateFilter(() => setCustomerId(value))} placeholder="All Customers" />
          </div>
          <SelectField label="Type" value={paymentType} onChange={value => updateFilter(() => setPaymentType(value))} options={[{ value: '', label: 'All' }, { value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]} />
          <div>
            <label className="field-label">Warehouse</label>
            <SearchableSelect value={warehouseId} options={warehouses} onChange={value => updateFilter(() => setWarehouseId(value))} placeholder="All Warehouses" />
          </div>
          <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} />
          <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} />
          <TextField label="Amount From" value={amountFrom} onChange={value => updateFilter(() => setAmountFrom(value))} />
          <TextField label="Amount To" value={amountTo} onChange={value => updateFilter(() => setAmountTo(value))} />
          <button type="button" className="btn-secondary" onClick={resetFilters} style={{ ...compactButtonStyle, alignSelf: 'end' }}>Clear Filters</button>
        </div>

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0, 1fr) 390px' : '1fr', gap: 8, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: '0.74rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 116 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 190 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 88 }} />
                <col style={{ width: 125 }} />
                <col style={{ width: 95 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 92 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 62 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Sale No.', 'Date', 'Customer', 'Reference', 'Type', 'Warehouse', 'Gross', 'Discount', 'Tax', 'Net Amount', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index >= 6 && index <= 9)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>Loading Posted Sales...</td></tr>
                )}
                {listQuery.error && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>{friendlyErrorMessage(listQuery.error, 'Unable to load Posted Sales.')}</td></tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr><td colSpan={11} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>No posted sales found for the selected filters.</td></tr>
                )}
                {rows.map(row => (
                  <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: selectedId === row.id ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                    <td style={tableCellStyle()}><strong>{row.sale_number}</strong></td>
                    <td style={tableCellStyle()}>{formatDate(row.sale_date, generalSettings)}</td>
                    <td style={tableCellStyle()}>{row.customer_code ? `${row.customer_code} - ${row.customer_name}` : row.customer_name}</td>
                    <td style={tableCellStyle()}>{row.customer_reference_number || '—'}</td>
                    <td style={tableCellStyle()}>{row.payment_type}</td>
                    <td style={tableCellStyle()}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || '—'}</td>
                    <td style={tableCellStyle(true)}>{money(Number(row.gross_amount))}</td>
                    <td style={tableCellStyle(true)}>{money(Number(row.discount_amount))}</td>
                    <td style={tableCellStyle(true)}>{money(Number(row.tax_amount))}</td>
                    <td style={tableCellStyle(true)}><strong>{money(Number(row.net_amount))}</strong></td>
                    <td style={tableCellStyle()}>
                      <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Sale" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                        <IconEye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedId && (
            <aside style={purchaseDetailPanelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Sale Detail</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" className="btn-ghost" onClick={() => window.print()} title="Print" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}><IconPrinter size={15} /></button>
                  <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}><IconCircleX size={15} /></button>
                </div>
              </div>
              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading sale detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Sale Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Sale No.', detailQuery.data.sale_number],
                      ['Date', formatDate(detailQuery.data.sale_date, generalSettings)],
                      ['Customer', `${detailQuery.data.customer_code} - ${detailQuery.data.customer_name}`],
                      ['Payment Type', detailQuery.data.payment_type],
                      ['Reference', detailQuery.data.customer_reference_number || '—'],
                      ['Delivery Note', detailQuery.data.delivery_note_number || '—'],
                      ['Voucher No.', detailQuery.data.accounting_voucher_number || '—'],
                      ['Posted At', detailQuery.data.posted_at ? formatDate(detailQuery.data.posted_at, generalSettings) : '—'],
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
                      <thead><tr>{['No.', 'Item', 'Qty', 'Amount'].map((label, index) => <th key={label} style={tableHeadStyle(index >= 2)}>{label}</th>)}</tr></thead>
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

        <PaginationBar
          page={page}
          totalPages={pages}
          totalRecords={total}
          pageSize={pageSize}
          recordLabel={total === 1 ? 'Sale' : 'Sales'}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value); setPage(1); setSelectedId(null); }}
        />
      </section>
    </main>
  );
}
