'use client';

import { useState } from 'react';
import {
  IconChartBar,
  IconCircleX,
  IconEye,
  IconFileInvoice,
  IconFilePlus,
  IconListSearch,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { useCompanyProfile } from '@/lib/api/settings';
import { usePurchaseInvoiceDetail, usePurchaseInvoicesList } from '@/lib/api/purchases';
import { fieldStyle } from '@/components/ui/FormFields';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { PurchaseInvoicePrintPreview } from './PurchasePrintPreview';
import { PostedPurchasesFilters } from './components';
import {
  badgeStyle,
  compactButtonStyle,
  detailMessageStyle,
  lineActionButtonStyle,
  messageStyle,
  purchaseDetailPanelStyle,
  purchaseListFooterStyle,
  statusBadgeStyle,
  tableCellStyle,
  tableHeadStyle,
  titleIconStyle,
  toolbarStyle,
} from './PurchaseVoucherStyles';
import type { PaymentType, PurchaseListRow, SupplierOption, WarehouseOption } from './PurchaseVoucherTypes';

interface PostedPurchasesViewProps {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewPurchase: () => void;
  onAnalytics: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PostedPurchasesView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onAnalytics,
  newDisabled = false,
  newDisabledReason,
}: PostedPurchasesViewProps) {
  const [searchText, setSearchText] = useState('');
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
  const [printPreviewInvoice, setPrintPreviewInvoice] = useState<any | null>(null);
  const [printError, setPrintError] = useState('');
  const { data: company } = useCompanyProfile();

  const listQuery = usePurchaseInvoicesList({
    page,
    limit: pageSize,
    status: 'Posted',
    search: search || undefined,
    supplier_id: supplierId || undefined,
    payment_type: paymentType as PaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });

  const detailQuery = usePurchaseInvoiceDetail(selectedId);

  const rows = (listQuery.data?.data ?? []) as PurchaseListRow[];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));
  const fromRecord = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toRecord = Math.min(page * pageSize, total);

  function resetFilters() {
    setPrintError('');
    setSearchText('');
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
    setPrintError('');
    action();
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
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Posted Purchases</h1>
                <span style={badgeStyle('#166534', '#dcfce7')}>Posted Only</span>
                <span style={statusBadgeStyle}>{total} Record{total === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn-secondary" type="button" onClick={() => { setPrintError(''); listQuery.refetch(); }} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
            <button className="btn-secondary" type="button" onClick={onAnalytics} style={compactButtonStyle}><IconChartBar size={15} /> Analytics</button>
            <button className="btn-primary" type="button" disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase} style={compactButtonStyle}><IconFilePlus size={15} /> New Purchase</button>
          </div>
        </div>
      </section>

      {printError && (
        <div style={messageStyle('error')}>
          <IconFileInvoice size={18} />
          {printError}
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 8, overflow: 'hidden' }}>
        <PostedPurchasesFilters
          search={searchText}
          supplierId={supplierId}
          paymentType={paymentType}
          warehouseId={warehouseId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          amountFrom={amountFrom}
          amountTo={amountTo}
          suppliers={suppliers}
          warehouses={warehouses}
          onSearchChange={setSearchText}
          onSearchSubmit={applySearch}
          onSearchClear={clearSearch}
          searchApplied={Boolean(search)}
          loading={listQuery.isFetching}
          onSupplierChange={value => updateFilter(() => setSupplierId(value))}
          onPaymentTypeChange={value => updateFilter(() => setPaymentType(value))}
          onWarehouseChange={value => updateFilter(() => setWarehouseId(value))}
          onDateFromChange={value => updateFilter(() => setDateFrom(value))}
          onDateToChange={value => updateFilter(() => setDateTo(value))}
          onAmountFromChange={value => updateFilter(() => setAmountFrom(value))}
          onAmountToChange={value => updateFilter(() => setAmountTo(value))}
          onResetFilters={resetFilters}
        />

        <div style={{ minHeight: 0, display: 'grid', gridTemplateColumns: selectedId ? 'minmax(0, 1fr) 390px' : '1fr', gap: 8, overflow: 'hidden' }}>
          <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', fontSize: '0.74rem', tableLayout: 'fixed' }}>
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
                <col style={{ width: 92 }} />
                <col style={{ width: 118 }} />
                <col style={{ width: 62 }} />
              </colgroup>
              <thead>
                <tr>
                  {['Purchase No.', 'Date', 'Supplier', 'Supplier Bill No.', 'Type', 'Warehouse', 'Gross', 'Discount', 'Tax', 'Freight', 'Net Amount', 'View'].map((label, index) => (
                    <th key={label} style={tableHeadStyle(index >= 6 && index <= 10)}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      Loading Posted Purchases...
                    </td>
                  </tr>
                )}
                {listQuery.error && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 80, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 700 }}>
                      {friendlyErrorMessage(listQuery.error, 'Unable to load Posted Purchases.')}
                    </td>
                  </tr>
                )}
                {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ ...tableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                      No posted purchases found for the selected filters.
                    </td>
                  </tr>
                )}
                {rows.map(row => {
                  const active = selectedId === row.id;
                  return (
                    <tr key={row.id} onClick={() => setSelectedId(row.id)} style={{ cursor: 'pointer', outline: active ? '2px solid var(--color-primary)' : 'none', outlineOffset: -1 }}>
                      <td style={tableCellStyle()}><strong>{row.purchase_number}</strong></td>
                      <td style={tableCellStyle()}>{formatDate(row.purchase_date, generalSettings)}</td>
                      <td style={tableCellStyle()}>{row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name}</td>
                      <td style={tableCellStyle()}>{row.supplier_invoice_number || '—'}</td>
                      <td style={tableCellStyle()}>{row.payment_type}</td>
                      <td style={tableCellStyle()}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || '—'}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.gross_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.discount_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.tax_amount))}</td>
                      <td style={tableCellStyle(true)}>{money(Number(row.freight_amount))}</td>
                      <td style={tableCellStyle(true)}><strong>{money(Number(row.net_amount))}</strong></td>
                      <td style={tableCellStyle()}>
                        <button type="button" className="btn-ghost" onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} title="View Purchase" style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
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
                <strong style={{ fontSize: '0.86rem', color: 'var(--color-heading)' }}>Purchase Detail</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  {detailQuery.data && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setPrintError('');
                        setPrintPreviewInvoice(detailQuery.data);
                      }}
                      title="Print Preview"
                      style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}
                    >
                      <IconPrinter size={15} />
                    </button>
                  )}
                  <button type="button" className="btn-ghost" onClick={() => setSelectedId(null)} style={{ ...lineActionButtonStyle, width: 28, minWidth: 28 }}>
                    <IconCircleX size={15} />
                  </button>
                </div>
              </div>
              {detailQuery.isLoading && <div style={detailMessageStyle}>Loading purchase detail...</div>}
              {detailQuery.error && <div style={{ ...detailMessageStyle, color: 'var(--color-danger-text)' }}>{friendlyErrorMessage(detailQuery.error, 'Unable to load Purchase Detail.')}</div>}
              {detailQuery.data && (
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[
                      ['Purchase No.', detailQuery.data.purchase_number],
                      ['Date', formatDate(detailQuery.data.purchase_date, generalSettings)],
                      ['Supplier', `${detailQuery.data.supplier_code} - ${detailQuery.data.supplier_name}`],
                      ['Payment Type', detailQuery.data.payment_type],
                      ['Supplier Bill No.', detailQuery.data.supplier_invoice_number || '—'],
                      ['Reference', detailQuery.data.reference_number || '—'],
                      ['Location', detailQuery.data.location_code ? `${detailQuery.data.location_code} - ${detailQuery.data.location_name}` : detailQuery.data.location_name || '—'],
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
                      <colgroup>
                        <col style={{ width: 32 }} />
                        <col />
                        <col style={{ width: 66 }} />
                        <col style={{ width: 88 }} />
                      </colgroup>
                      <thead>
                        <tr>
                          {['No.', 'Item', 'Qty', 'Amount'].map((label, index) => (
                            <th key={label} style={tableHeadStyle(index >= 2)}>{label}</th>
                          ))}
                        </tr>
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

        <PaginationBar
          page={page}
          totalPages={pages}
          totalRecords={total}
          pageSize={pageSize}
          recordLabel={total === 1 ? 'Purchase' : 'Purchases'}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value); setPage(1); setSelectedId(null); }}
        />
      </section>

      {printPreviewInvoice && (
        <PurchaseInvoicePrintPreview
          invoice={printPreviewInvoice}
          company={company}
          generalSettings={generalSettings}
          money={money}
          onClose={() => setPrintPreviewInvoice(null)}
          onError={setPrintError}
        />
      )}
    </main>
  );
}
