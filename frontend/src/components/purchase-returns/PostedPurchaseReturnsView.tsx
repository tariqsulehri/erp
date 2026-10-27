'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconChartBar,
  IconEye,
  IconFilePlus,
  IconRefresh,
} from '@tabler/icons-react';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { hasPermission } from '@/lib/auth/session-user';
import { useCancelPurchaseReturnDraft, useInvalidatePurchaseReturnQueries, usePostPurchaseReturnDraft, usePurchaseReturnDetail, usePurchaseReturnsList } from '@/lib/api/purchase-returns';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { StatusChip } from '@/components/ui/StatusChip';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import {
  DetailFields,
  DetailLinesTable,
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
import type { PaymentType, SupplierOption, WarehouseOption } from '@/components/purchases/PurchaseVoucherTypes';

interface PostedPurchaseReturnsViewProps {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewReturn: () => void;
  onAnalytics: () => void;
  /** Opens a saved Draft in the entry form. */
  onOpenDraft: (detail: Record<string, any>) => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

/** Purchase Return List: posted returns by default, and saved Drafts and Cancelled drafts through the Status filter. */
export function PostedPurchaseReturnsView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewReturn,
  onAnalytics,
  onOpenDraft,
  newDisabled = false,
  newDisabledReason,
}: PostedPurchaseReturnsViewProps) {
  const { data: session } = useSession();
  const canChangeDrafts = hasPermission(session?.user.role, 'purchases.edit');
  const postDraft = usePostPurchaseReturnDraft();
  const cancelDraft = useCancelPurchaseReturnDraft();
  const invalidateQueries = useInvalidatePurchaseReturnQueries();
  const [status, setStatus] = useState('Posted');
  const [actionMessage, setActionMessage] = useState<DraftActionMessage | null>(null);
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

  const listQuery = usePurchaseReturnsList({
    page,
    limit: pageSize,
    status: (status || undefined) as 'Draft' | 'Posted' | 'Voided' | undefined,
    search: search || undefined,
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

  function resetFilters() {
    setStatus('Posted');
    setActionMessage(null);
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

  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;
  const detail = detailQuery.data;
  const statusFilterLabel = status ? documentStatusLabel(status) : 'All Statuses';

  return (
    <DocumentPage>
      <DocumentHeader
        title="Purchase Return List"
        help={(
          <>
            <p>This list shows posted purchase returns. Change the Status filter to see saved Drafts or Cancelled drafts.</p>
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
          <PostedListFilters label="Purchase Return List Filters">
            <SelectField label="Status" value={status} onChange={value => updateFilter(() => setStatus(value))} options={DOCUMENT_STATUS_OPTIONS} placeholder="All Statuses" />
            <TextField label="Search" value={searchText} onChange={setSearchText} placeholder="Return No., Supplier, Reference" inputProps={{ onKeyDown: event => { if (event.key === 'Enter') applySearch(); } }} />
            <Button variant="secondary" onClick={applySearch} loading={listQuery.isFetching}>Search</Button>
            <Button variant="ghost" onClick={clearSearch} disabled={listQuery.isFetching || (!search && !searchText)}>Clear</Button>
            <FieldLabel label="Supplier">
              <SearchableSelect value={supplierId} options={suppliers} onChange={value => updateFilter(() => setSupplierId(value))} placeholder="All Suppliers" ariaLabel="Supplier" />
            </FieldLabel>
            <SelectField label="Payment Type" value={paymentType} onChange={value => updateFilter(() => setPaymentType(value))} options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]} placeholder="All Types" />
            <FieldLabel label="Warehouse">
              <SearchableSelect value={warehouseId} options={warehouses} onChange={value => updateFilter(() => setWarehouseId(value))} placeholder="All Warehouses" ariaLabel="Warehouse" />
            </FieldLabel>
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} />
            <NumericField label="Amount From" value={amountFrom} onChange={value => updateFilter(() => setAmountFrom(value))} />
            <NumericField label="Amount To" value={amountTo} onChange={value => updateFilter(() => setAmountTo(value))} />
            <Button variant="ghost" onClick={resetFilters}>Clear Filters</Button>
          </PostedListFilters>
        )}
        table={(
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1146 }}>
            <colgroup>
              <col style={{ width: 128 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 190 }} />
              <col style={{ width: 128 }} />
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
                <th>Supplier</th>
                <th>Supplier Return No.</th>
                <th>Type</th>
                <th>Warehouse</th>
                <th className="num">Gross</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Net Amount</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={12} title="Loading Purchase Returns…" loading />}
              {listQuery.error && (
                <TableMessageRow colSpan={12} title="Could Not Load Purchase Returns" description={friendlyErrorMessage(listQuery.error, 'Could not load the Purchase Return List. Please try again.')} />
              )}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                <TableMessageRow colSpan={12} title={`No ${statusFilterLabel === 'All Statuses' ? '' : `${statusFilterLabel} `}Purchase Returns Found`} description="Change or clear the filters to see more records." />
              )}
              {rows.map(row => (
                <tr key={row.id} className={`${postedListRowClass}${selectedId === row.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                  <td className="cell-strong">{row.purchase_return_number}</td>
                  <td>{formatDate(row.purchase_return_date, generalSettings)}</td>
                  <td><StatusChip status={row.status} label={documentStatusLabel(row.status)} /></td>
                  <td>{row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name}</td>
                  <td className={row.supplier_return_number ? undefined : 'cell-muted'}>{row.supplier_return_number || 'Not Set'}</td>
                  <td>{row.payment_type}</td>
                  <td className={row.warehouse_name ? undefined : 'cell-muted'}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || 'Not Set'}</td>
                  <td className="num">{money(Number(row.gross_amount))}</td>
                  <td className="num">{money(Number(row.discount_amount))}</td>
                  <td className="num">{money(Number(row.tax_amount))}</td>
                  <td className="num cell-strong">{money(Number(row.net_amount))}</td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconEye {...iconProps} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Purchase Return ${row.purchase_return_number}`} title="View Purchase Return" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        detail={selectedId && (
          <DocumentDetailPanel
            title="Purchase Return Detail"
            loading={detailQuery.isLoading}
            loadingText="Loading Purchase Return Detail…"
            error={detailQuery.error ? friendlyErrorMessage(detailQuery.error, 'Could not load Purchase Return Detail. Please try again.') : undefined}
            onClose={() => setSelectedId(null)}
          >
            {detail && (
              <>
                {detail.status === 'Draft' && canChangeDrafts && (
                  <DraftDocumentActions
                    documentName="Purchase Return"
                    documentNumber={detail.purchase_return_number}
                    postEffect="Stock goes down and the Supplier balance is updated."
                    onOpen={() => onOpenDraft(detail)}
                    onPost={async () => {
                      const result = await postDraft.mutateAsync(detail.id);
                      await invalidateQueries();
                      return result.purchase_return_number;
                    }}
                    onCancel={async reason => {
                      const result = await cancelDraft.mutateAsync({ id: detail.id, reason });
                      await invalidateQueries();
                      return result.purchase_return_number;
                    }}
                    onMessage={setActionMessage}
                  />
                )}
                <DetailFields
                  items={[
                    ['Return No.', detail.purchase_return_number],
                    ['Status', documentStatusLabel(detail.status)],
                    ...(detail.status === 'Voided'
                      ? [
                        ['Cancelled Reason', detail.void_reason] as [string, string],
                        ['Cancelled At', detail.voided_at ? formatDate(detail.voided_at, generalSettings) : ''] as [string, string],
                      ]
                      : []),
                    ['Date', formatDate(detail.purchase_return_date, generalSettings)],
                    ['Supplier', `${detail.supplier_code} - ${detail.supplier_name}`],
                    ['Payment Type', detail.payment_type],
                    ['Supplier Return No.', detail.supplier_return_number],
                    ['Reference', detail.reference_number],
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
            recordLabel={total === 1 ? 'Purchase Return' : 'Purchase Returns'}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); setSelectedId(null); }}
          />
        )}
      />
    </DocumentPage>
  );
}
