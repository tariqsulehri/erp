'use client';

import { useState } from 'react';
import {
  IconChartBar,
  IconEye,
  IconFilePlus,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { useSaleInvoiceDetail, useSaleInvoicesList } from '@/lib/api/sales';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import {
  DetailFields,
  DetailLinesTable,
  DetailTotals,
  DocumentDetailPanel,
  DocumentHeader,
  DocumentPage,
  PostedListFilters,
  PostedListPanel,
  postedListRowClass,
} from '@/components/documents';
import type { CustomerOption, SaleListRow, SalePaymentType, BranchOption } from './SaleVoucherTypes';

interface PostedSalesViewProps {
  customers: CustomerOption[];
  branches: BranchOption[];
  /** Branch users only see their own Branch, so the filter is hidden for them. */
  showBranchFilter?: boolean;
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewSale: () => void;
  onAnalytics: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PostedSalesView({
  customers,
  branches,
  showBranchFilter = true,
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
  const [branchId, setBranchId] = useState('');
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
    branch_id: branchId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = useSaleInvoiceDetail(selectedId);

  const rows = (listQuery.data?.data ?? []) as SaleListRow[];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

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
    setBranchId('');
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

  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;
  const detail = detailQuery.data;

  return (
    <DocumentPage>
      <DocumentHeader
        title="Posted Sales"
        badges={(
          <>
            <Badge variant="success">Posted Only</Badge>
            <Badge variant="neutral">{total} Record{total === 1 ? '' : 's'}</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={() => listQuery.refetch()}>Refresh</Button>
            <Button variant="secondary" icon={<IconChartBar {...iconProps} />} onClick={onAnalytics}>Analytics</Button>
            <Button variant="primary" icon={<IconFilePlus {...iconProps} />} disabled={newDisabled} title={newDisabledReason} onClick={onNewSale}>New Sale</Button>
          </>
        )}
      />

      <PostedListPanel
        filters={(
          <PostedListFilters label="Posted Sales Filters">
            <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Sale No., Customer, Reference" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
            <Button variant="secondary" onClick={applySearch} loading={listQuery.isFetching}>Search</Button>
            <Button variant="ghost" onClick={clearSearch} disabled={listQuery.isFetching || (!search && !searchText)}>Clear</Button>
            <FieldLabel label="Customer">
              <SearchableSelect value={customerId} options={customers} onChange={value => updateFilter(() => setCustomerId(value))} placeholder="All Customers" ariaLabel="Customer" />
            </FieldLabel>
            <SelectField label="Payment Type" value={paymentType} onChange={value => updateFilter(() => setPaymentType(value))} options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]} placeholder="All Types" />
            {showBranchFilter && (
              <FieldLabel label="Branch">
                <SearchableSelect value={branchId} options={branches} onChange={value => updateFilter(() => setBranchId(value))} placeholder="All Branchs" ariaLabel="Branch" />
              </FieldLabel>
            )}
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} />
            <NumericField label="Amount From" value={amountFrom} onChange={value => updateFilter(() => setAmountFrom(value))} />
            <NumericField label="Amount To" value={amountTo} onChange={value => updateFilter(() => setAmountTo(value))} />
            <Button variant="ghost" onClick={resetFilters}>Clear Filters</Button>
          </PostedListFilters>
        )}
        table={(
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1000 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 52 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Sale No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Reference</th>
                <th>Type</th>
                <th>Branch</th>
                <th className="num">Gross</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Net Amount</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={11} title="Loading Posted Sales…" loading />}
              {listQuery.error && (
                <TableMessageRow colSpan={11} title="Unable To Load Posted Sales" description={friendlyErrorMessage(listQuery.error, 'Unable to load Posted Sales.')} />
              )}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                <TableMessageRow colSpan={11} title="No Posted Sales Found" description="Change or clear the filters to see more records." />
              )}
              {rows.map(row => (
                <tr key={row.id} className={`${postedListRowClass}${selectedId === row.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                  <td className="cell-strong">{row.sale_number}</td>
                  <td>{formatDate(row.sale_date, generalSettings)}</td>
                  <td>{row.customer_code ? `${row.customer_code} - ${row.customer_name}` : row.customer_name}</td>
                  <td className={row.customer_reference_number ? undefined : 'cell-muted'}>{row.customer_reference_number || 'Not Set'}</td>
                  <td>{row.payment_type}</td>
                  <td>{placeLabel(row)}</td>
                  <td className="num">{money(Number(row.gross_amount))}</td>
                  <td className="num">{money(Number(row.discount_amount))}</td>
                  <td className="num">{money(Number(row.tax_amount))}</td>
                  <td className="num cell-strong">{money(Number(row.net_amount))}</td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconEye {...iconProps} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Sale ${row.sale_number}`} title="View Sale" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        detail={selectedId && (
          <DocumentDetailPanel
            title="Sale Detail"
            loading={detailQuery.isLoading}
            loadingText="Loading Sale Detail…"
            error={detailQuery.error ? friendlyErrorMessage(detailQuery.error, 'Unable to load Sale Detail.') : undefined}
            onClose={() => setSelectedId(null)}
            actions={detail && <Button variant="ghost" size="sm" icon={<IconPrinter {...iconProps} />} onClick={() => window.print()} aria-label="Print" title="Print" />}
          >
            {detail && (
              <>
                <DetailFields
                  items={[
                    ['Sale No.', detail.sale_number],
                    ['Date', formatDate(detail.sale_date, generalSettings)],
                    ['Customer', `${detail.customer_code} - ${detail.customer_name}`],
                    ['Payment Type', detail.payment_type],
                    ['Reference', detail.customer_reference_number],
                    ['Delivery Note', detail.delivery_note_number],
                    ['Voucher No.', detail.accounting_voucher_number],
                    ['Posted At', detail.posted_at ? formatDate(detail.posted_at, generalSettings) : ''],
                  ]}
                />
                <DetailLinesTable>
                  <colgroup>
                    <col style={{ width: 40 }} />
                    <col />
                    <col style={{ width: 72 }} />
                    <col style={{ width: 104 }} />
                  </colgroup>
                  <thead>
                    <tr><th className="num">No.</th><th>Item</th><th className="num">Qty</th><th className="num">Amount</th></tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line: any) => (
                      <tr key={line.id}>
                        <td className="num cell-muted">{line.line_number}</td>
                        <td title={`${line.item_code} - ${line.item_name}`}>{line.item_code} - {line.item_name}</td>
                        <td className="num">{formatNumber(Number(line.quantity), generalSettings)}</td>
                        <td className="num">{money(Number(line.line_total))}</td>
                      </tr>
                    ))}
                  </tbody>
                </DetailLinesTable>
                <DetailTotals
                  strongLast
                  items={[
                    ['Gross Amount', money(Number(detail.gross_amount))],
                    ['Discount', money(Number(detail.discount_amount))],
                    ['Tax', money(Number(detail.tax_amount))],
                    ['Freight', money(Number(detail.freight_amount))],
                    ['Net Amount', money(Number(detail.net_amount))],
                  ]}
                />
              </>
            )}
          </DocumentDetailPanel>
        )}
        pagination={(
          <PaginationBar
            page={page}
            totalPages={pages}
            totalRecords={total}
            pageSize={pageSize}
            recordLabel={total === 1 ? 'Sale' : 'Sales'}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); setSelectedId(null); }}
          />
        )}
      />
    </DocumentPage>
  );
}

/** The Branch the document belongs to; older documents saved before Branch stock show their Warehouse. */
function placeLabel(row: { branch_code?: string | null; branch_name?: string | null; warehouse_code?: string | null; warehouse_name?: string | null }) {
  if (row.branch_name) return row.branch_code ? `${row.branch_code} - ${row.branch_name}` : row.branch_name;
  if (row.warehouse_name) return row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name;
  return 'Not Set';
}
