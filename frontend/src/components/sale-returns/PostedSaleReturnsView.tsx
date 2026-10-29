'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconChartBar,
  IconEye,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { hasPermission } from '@/lib/auth/session-user';
import { useCancelSaleReturnDraft, useInvalidateSaleReturnQueries, usePostSaleReturnDraft, useSaleReturnDetail, useSaleReturnsList } from '@/lib/api/sale-returns';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { StatusChip } from '@/components/ui/StatusChip';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import {
  DetailFields,
  DetailLinesTable,
  DetailNote,
  DetailTotals,
  DocumentDetailPanel,
  DocumentHeader,
  DocumentPage,
  DOCUMENT_STATUS_OPTIONS,
  documentStatusLabel,
  DraftDocumentActions,
  PostedListFilters,
  PostedListPanel,
  postedListRowClass,
  type DraftActionMessage,
} from '@/components/documents';
import type { CustomerOption, SalePaymentType, BranchOption } from '@/components/sales/SaleVoucherTypes';

interface PostedSaleReturnsViewProps {
  customers: CustomerOption[];
  branches: BranchOption[];
  /** Branch users only see their own Branch, so the filter is hidden for them. */
  showBranchFilter?: boolean;
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewReturn: () => void;
  onAnalytics: () => void;
  /** Opens a saved Draft in the entry form. */
  onOpenDraft: (detail: Record<string, any>) => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

/** Sale Return List: posted returns by default, and saved Drafts and Cancelled drafts through the Status filter. */
export function PostedSaleReturnsView({
  customers,
  branches,
  showBranchFilter = true,
  money,
  generalSettings,
  onNewReturn,
  onAnalytics,
  onOpenDraft,
  newDisabled = false,
  newDisabledReason,
}: PostedSaleReturnsViewProps) {
  const { data: session } = useSession();
  const canChangeDrafts = hasPermission(session?.user.role, 'sales.edit');
  const postDraft = usePostSaleReturnDraft();
  const cancelDraft = useCancelSaleReturnDraft();
  const invalidateQueries = useInvalidateSaleReturnQueries();
  const [status, setStatus] = useState('Posted');
  const [actionMessage, setActionMessage] = useState<DraftActionMessage | null>(null);
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

  const listQuery = useSaleReturnsList({
    page,
    limit: pageSize,
    status: (status || undefined) as 'Draft' | 'Posted' | 'Voided' | undefined,
    search: search || undefined,
    customer_id: customerId || undefined,
    payment_type: paymentType as SalePaymentType || undefined,
    branch_id: branchId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    amount_from: amountFrom ? numericValue(amountFrom) : undefined,
    amount_to: amountTo ? numericValue(amountTo) : undefined,
  });
  const detailQuery = useSaleReturnDetail(selectedId);
  const rows = listQuery.data?.data ?? [];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

  function updateFilter(action: () => void) {
    action();
    setPage(1);
    setSelectedId(null);
  }

  function resetFilters() {
    setStatus('Posted');
    setActionMessage(null);
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
  const statusFilterLabel = status ? documentStatusLabel(status) : 'All Statuses';

  return (
    <DocumentPage>
      <DocumentHeader
        title="Sale Return List"
        help={(
          <>
            <p>This list shows posted sale returns. Change the Status filter to see saved Drafts or Cancelled drafts.</p>
            <p>Use the filters to find a return. Select a row to see its lines and totals, or to print it.</p>
            <p>A Draft can be opened and changed, posted, or cancelled. A cancelled Draft stays in the list with its reason.</p>
            <p>Posted returns cannot be changed.</p>
          </>
        )}
        badges={(
          <>
            <Badge variant={status === 'Posted' ? 'success' : 'neutral'}>{statusFilterLabel}</Badge>
            <Badge variant="neutral">{total} Record{total === 1 ? '' : 's'}</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={() => listQuery.refetch()}>Refresh</Button>
            <Button variant="secondary" icon={<IconChartBar {...iconProps} />} onClick={onAnalytics}>Analytics</Button>
            <Button variant="primary" icon={<IconFilePlus {...iconProps} />} disabled={newDisabled} title={newDisabledReason} onClick={onNewReturn}>New Return</Button>
          </>
        )}
      />

      {actionMessage && <InlineAlert tone={actionMessage.tone} onDismiss={() => setActionMessage(null)}>{actionMessage.text}</InlineAlert>}

      <PostedListPanel
        filters={(
          <PostedListFilters label="Sale Return List Filters">
            <SelectField label="Status" value={status} onChange={value => updateFilter(() => setStatus(value))} options={DOCUMENT_STATUS_OPTIONS} placeholder="All Statuses" />
            <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Return No., Customer, Reference" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
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
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1096 }}>
            <colgroup>
              <col style={{ width: 128 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 96 }} />
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
                <th>Return No.</th>
                <th>Date</th>
                <th>Status</th>
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
              {listQuery.isLoading && <TableMessageRow colSpan={12} title="Loading Sale Returns…" loading />}
              {listQuery.error && (
                <TableMessageRow colSpan={12} title="Could Not Load Sale Returns" description={friendlyErrorMessage(listQuery.error, 'Could not load the Sale Return List. Please try again.')} />
              )}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                <TableMessageRow colSpan={12} title={`No ${statusFilterLabel === 'All Statuses' ? '' : `${statusFilterLabel} `}Sale Returns Found`} description="Change or clear the filters to see more records." />
              )}
              {rows.map(row => (
                <tr key={row.id} className={`${postedListRowClass}${selectedId === row.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                  <td className="cell-strong">{row.sale_return_number}</td>
                  <td>{formatDate(row.sale_return_date, generalSettings)}</td>
                  <td><StatusChip status={row.status} label={documentStatusLabel(row.status)} /></td>
                  <td>{row.customer_code ? `${row.customer_code} - ${row.customer_name}` : row.customer_name}</td>
                  <td className={(row.reference_number || row.customer_return_number) ? undefined : 'cell-muted'}>{(row.reference_number || row.customer_return_number) || 'Not Set'}</td>
                  <td>{row.payment_type}</td>
                  <td>{placeLabel(row)}</td>
                  <td className="num">{money(Number(row.gross_amount))}</td>
                  <td className="num">{money(Number(row.discount_amount))}</td>
                  <td className="num">{money(Number(row.tax_amount))}</td>
                  <td className="num cell-strong">{money(Number(row.net_amount))}</td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconEye {...iconProps} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Sale Return ${row.sale_return_number}`} title="View Sale Return" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        detail={selectedId && (
          <DocumentDetailPanel
            title="Sale Return Details"
            loading={detailQuery.isLoading}
            loadingText="Loading Sale Return Details…"
            error={detailQuery.error ? friendlyErrorMessage(detailQuery.error, 'Could not load Sale Return Details. Please try again.') : undefined}
            onClose={() => setSelectedId(null)}
            actions={detail && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {detail.status === 'Draft' && canChangeDrafts && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconPencil {...iconProps} />}
                    onClick={() => onOpenDraft(detail)}
                    aria-label="Edit Draft Sale Return"
                    title="Edit Draft Sale Return"
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<IconPrinter {...iconProps} />}
                  onClick={() => window.print()}
                  aria-label="Print Sale Return"
                  title="Print Sale Return"
                />
              </div>
            )}
          >
            {detail && (
              <>
                <DetailFields
                  items={[
                    ['Return No.', detail.sale_return_number],
                    ['Date', formatDate(detail.sale_return_date, generalSettings)],
                    ['Type', 'Sale Return'],
                    ['Status', documentStatusLabel(detail.status)],
                    ['Customer', `${detail.customer_code} - ${detail.customer_name}`],
                    ['Payment Type', detail.payment_type],
                    ['Customer Return No.', detail.customer_return_number],
                    ['Reference', detail.reference_number],
                    ['Voucher No.', detail.accounting_voucher_number],
                    ['Posted At', detail.posted_at ? formatDate(detail.posted_at, generalSettings) : ''],
                    ...(detail.status === 'Voided'
                      ? [
                        ['Cancelled Reason', detail.void_reason] as [string, string],
                        ['Cancelled At', detail.voided_at ? formatDate(detail.voided_at, generalSettings) : ''] as [string, string],
                      ]
                      : []),
                  ]}
                />
                <DetailLinesTable>
                  <colgroup>
                    <col style={{ width: 44 }} />
                    <col style={{ width: 140 }} />
                    <col />
                    <col style={{ width: 75 }} />
                    <col style={{ width: 85 }} />
                    <col style={{ width: 105 }} />
                    <col style={{ width: 110 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="num">No.</th>
                      <th>Item Code</th>
                      <th>Item Description</th>
                      <th>UOM</th>
                      <th className="num">Qty</th>
                      <th className="num">Unit Price</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.lines ?? []).map((line: any) => (
                      <tr key={line.id}>
                        <td className="num cell-muted">{line.line_number}</td>
                        <td><span className="code-chip">{line.item_code}</span></td>
                        <td className="cell-strong" title={line.item_name}>{line.item_name}</td>
                        <td>{line.uom_name || '—'}</td>
                        <td className="num">{formatNumber(Number(line.quantity), generalSettings)}</td>
                        <td className="num">{money(Number(line.unit_price ?? line.sales_price ?? 0))}</td>
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
                <DetailNote>
                  {detail.status === 'Draft' && 'This sale return is a Draft. Edit it and post it to return stock from the customer.'}
                  {detail.status === 'Posted' && 'This sale return is already posted.'}
                  {detail.status === 'Voided' && 'This sale return was cancelled.'}
                </DetailNote>
                {detail.status === 'Draft' && canChangeDrafts && (
                  <DraftDocumentActions
                    documentName="Sale Return"
                    documentNumber={detail.sale_return_number}
                    postEffect="Stock goes up and the Customer balance is updated."
                    onOpen={() => onOpenDraft(detail)}
                    onPost={async () => {
                      const result = await postDraft.mutateAsync(detail.id);
                      await invalidateQueries();
                      return result.sale_return_number;
                    }}
                    onCancel={async reason => {
                      const result = await cancelDraft.mutateAsync({ id: detail.id, reason });
                      await invalidateQueries();
                      return result.sale_return_number;
                    }}
                    onMessage={setActionMessage}
                  />
                )}
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
            recordLabel={total === 1 ? 'Sale Return' : 'Sale Returns'}
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
