'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconBan,
  IconChartBar,
  IconEye,
  IconFileCheck,
  IconFilePlus,
  IconPencil,
  IconPrinter,
  IconRefresh,
} from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage, numericValue } from '@/lib/erp-utils';
import { hasPermission } from '@/lib/auth/session-user';
import { useCompanyProfile } from '@/lib/api/settings';
import {
  useCancelPurchaseDraft,
  useInvalidatePurchaseQueries,
  usePostPurchaseDraft,
  usePurchaseInvoiceDetail,
  usePurchaseInvoicesList,
} from '@/lib/api/purchases';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { PurchaseInvoicePrintPreview } from './PurchasePrintPreview';
import { PostedPurchasesFilters } from './components';
import { purchaseStatusLabel } from './PurchaseVoucherHelpers';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormDialog } from '@/components/ui/FormDialog';
import { TextField } from '@/components/ui/FormFields';
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
  PostedListPanel,
  postedListRowClass,
} from '@/components/documents';
import type { PaymentType, PurchaseListRow, SupplierOption, WarehouseOption } from './PurchaseVoucherTypes';

interface PostedPurchasesViewProps {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: Parameters<typeof formatNumber>[1];
  onNewPurchase: () => void;
  onAnalytics: () => void;
  /** Opens a saved Draft in the entry form. */
  onOpenDraft: (detail: Record<string, any>) => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

/** Purchase List: posted purchases by default, and saved Drafts and Cancelled drafts through the Status filter. */
export function PostedPurchasesView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onAnalytics,
  onOpenDraft,
  newDisabled = false,
  newDisabledReason,
}: PostedPurchasesViewProps) {
  const { data: session } = useSession();
  const canChangeDrafts = hasPermission(session?.user.role, 'purchases.edit');
  const postDraft = usePostPurchaseDraft();
  const cancelDraft = useCancelPurchaseDraft();
  const invalidatePurchaseQueries = useInvalidatePurchaseQueries();
  const [status, setStatus] = useState('Posted');
  const [actionMessage, setActionMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
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

  const detailQuery = usePurchaseInvoiceDetail(selectedId);

  const rows = (listQuery.data?.data ?? []) as PurchaseListRow[];
  const total = listQuery.data?.total ?? 0;
  const pages = listQuery.data?.totalPages ?? Math.max(1, Math.ceil(total / pageSize));

  function resetFilters() {
    setPrintError('');
    setActionMessage(null);
    setStatus('Posted');
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

  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;
  const detail = detailQuery.data;
  const statusFilterLabel = status ? purchaseStatusLabel(status) : 'All Statuses';
  const selectedIsDraft = detail?.status === 'Draft';

  async function postSelectedDraft() {
    if (!detail) return;
    setActionMessage(null);
    try {
      const result = await postDraft.mutateAsync(detail.id);
      await invalidatePurchaseQueries();
      setPostConfirmOpen(false);
      setActionMessage({ tone: 'success', text: `${result.purchase_number} posted. Stock and the Supplier balance are updated.` });
    } catch (error) {
      setPostConfirmOpen(false);
      setActionMessage({ tone: 'danger', text: friendlyErrorMessage(error, 'Could not post the Purchase Voucher. Please try again.') });
    }
  }

  function openCancelDialog() {
    setCancelReason('');
    setCancelReasonError('');
    setCancelOpen(true);
  }

  async function cancelSelectedDraft() {
    if (!detail) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      setCancelReasonError('Enter a reason of at least 3 characters.');
      return;
    }
    setActionMessage(null);
    try {
      const result = await cancelDraft.mutateAsync({ id: detail.id, reason });
      await invalidatePurchaseQueries();
      setCancelOpen(false);
      setActionMessage({ tone: 'success', text: `${result.purchase_number} cancelled. It stays in the list with Status Cancelled.` });
    } catch (error) {
      setCancelReasonError(friendlyErrorMessage(error, 'Could not cancel the Draft. Please try again.'));
    }
  }

  return (
    <DocumentPage>
      <DocumentHeader
        title="Purchase List"
        help={(
          <>
            <p>This list shows posted purchases. Change the Status filter to see saved Drafts or Cancelled drafts.</p>
            <p>Use the filters to find a purchase. Select a row to see its lines and totals, or to print it.</p>
            <p>A Draft can be opened and changed, posted, or cancelled. A cancelled Draft stays in the list with its reason.</p>
            <p>Posted purchases cannot be changed. Use a Purchase Return to correct one.</p>
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
            <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={() => { setPrintError(''); listQuery.refetch(); }}>Refresh</Button>
            <Button variant="secondary" icon={<IconChartBar {...iconProps} />} onClick={onAnalytics}>Analytics</Button>
            <Button variant="primary" icon={<IconFilePlus {...iconProps} />} disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase}>New Purchase</Button>
          </>
        )}
      />

      {printError && <InlineAlert tone="danger" onDismiss={() => setPrintError('')}>{printError}</InlineAlert>}
      {actionMessage && <InlineAlert tone={actionMessage.tone} onDismiss={() => setActionMessage(null)}>{actionMessage.text}</InlineAlert>}

      <PostedListPanel
        filters={(
          <PostedPurchasesFilters
            status={status}
            onStatusChange={value => updateFilter(() => setStatus(value))}
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
        )}
        table={(
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1176 }}>
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
              <col style={{ width: 100 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 52 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Purchase No.</th>
                <th>Date</th>
                <th>Status</th>
                <th>Supplier</th>
                <th>Supplier Bill No.</th>
                <th>Type</th>
                <th>Warehouse</th>
                <th className="num">Gross</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Freight</th>
                <th className="num">Net Amount</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading && <TableMessageRow colSpan={13} title="Loading Purchases…" loading />}
              {listQuery.error && (
                <TableMessageRow colSpan={13} title="Could Not Load Purchases" description={friendlyErrorMessage(listQuery.error, 'Could not load the Purchase List. Please try again.')} />
              )}
              {!listQuery.isLoading && !listQuery.error && rows.length === 0 && (
                <TableMessageRow colSpan={13} title={`No ${statusFilterLabel === 'All Statuses' ? '' : `${statusFilterLabel} `}Purchases Found`} description="Change or clear the filters to see more purchases." />
              )}
              {rows.map(row => (
                <tr key={row.id} className={`${postedListRowClass}${selectedId === row.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(row.id)}>
                  <td className="cell-strong">{row.purchase_number}</td>
                  <td>{formatDate(row.purchase_date, generalSettings)}</td>
                  <td><StatusChip status={row.status} label={purchaseStatusLabel(row.status)} /></td>
                  <td>{row.supplier_code ? `${row.supplier_code} - ${row.supplier_name}` : row.supplier_name}</td>
                  <td className={row.supplier_invoice_number ? undefined : 'cell-muted'}>{row.supplier_invoice_number || 'Not Set'}</td>
                  <td>{row.payment_type}</td>
                  <td className={row.warehouse_name ? undefined : 'cell-muted'}>{row.warehouse_code ? `${row.warehouse_code} - ${row.warehouse_name}` : row.warehouse_name || 'Not Set'}</td>
                  <td className="num">{money(Number(row.gross_amount))}</td>
                  <td className="num">{money(Number(row.discount_amount))}</td>
                  <td className="num">{money(Number(row.tax_amount))}</td>
                  <td className="num">{money(Number(row.freight_amount))}</td>
                  <td className="num cell-strong">{money(Number(row.net_amount))}</td>
                  <td className="cell-actions">
                    <Button variant="ghost" size="sm" icon={<IconEye {...iconProps} />} onClick={event => { event.stopPropagation(); setSelectedId(row.id); }} aria-label={`View Purchase ${row.purchase_number}`} title="View Purchase" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        detail={selectedId && (
          <DocumentDetailPanel
            title="Purchase Detail"
            loading={detailQuery.isLoading}
            loadingText="Loading Purchase Detail…"
            error={detailQuery.error ? friendlyErrorMessage(detailQuery.error, 'Could not load Purchase Detail. Please try again.') : undefined}
            onClose={() => setSelectedId(null)}
            actions={detail && (
              <Button
                variant="ghost"
                size="sm"
                icon={<IconPrinter {...iconProps} />}
                onClick={() => {
                  setPrintError('');
                  setPrintPreviewInvoice(detail);
                }}
                aria-label="Print Preview"
                title="Print Preview"
              />
            )}
          >
            {detail && (
              <>
                {selectedIsDraft && canChangeDrafts && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    <Button variant="primary" size="sm" icon={<IconPencil {...iconProps} />} onClick={() => onOpenDraft(detail)}>Open Draft</Button>
                    <Button variant="secondary" size="sm" icon={<IconFileCheck {...iconProps} />} onClick={() => { setActionMessage(null); setPostConfirmOpen(true); }}>Post</Button>
                    <Button variant="danger" size="sm" icon={<IconBan {...iconProps} />} onClick={openCancelDialog}>Cancel Draft</Button>
                  </div>
                )}
                <DetailFields
                  items={[
                    ['Purchase No.', detail.purchase_number],
                    ['Status', purchaseStatusLabel(detail.status)],
                    ...(detail.status === 'Voided'
                      ? [
                        ['Cancelled Reason', detail.void_reason] as [string, string],
                        ['Cancelled At', detail.voided_at ? formatDate(detail.voided_at, generalSettings) : ''] as [string, string],
                      ]
                      : []),
                    ['Date', formatDate(detail.purchase_date, generalSettings)],
                    ['Supplier', `${detail.supplier_code} - ${detail.supplier_name}`],
                    ['Payment Type', detail.payment_type],
                    ['Supplier Bill No.', detail.supplier_invoice_number],
                    ['Reference', detail.reference_number],
                    ['Location', detail.location_code ? `${detail.location_code} - ${detail.location_name}` : detail.location_name],
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
            recordLabel={total === 1 ? 'Purchase' : 'Purchases'}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value); setPage(1); setSelectedId(null); }}
          />
        )}
      />

      <ConfirmDialog
        open={postConfirmOpen}
        title="Post Purchase Voucher?"
        message={`This posts ${detail?.purchase_number ?? 'the Draft'} as it was saved. Stock and the Supplier balance are updated, and you cannot change it after it is posted.`}
        confirmLabel="Yes, Post"
        cancelLabel="No"
        variant="warning"
        loading={postDraft.isPending}
        onConfirm={postSelectedDraft}
        onCancel={() => setPostConfirmOpen(false)}
      />

      <FormDialog
        open={cancelOpen}
        title={`Cancel Draft ${detail?.purchase_number ?? ''}`.trim()}
        saveLabel="Cancel Draft"
        cancelLabel="Keep Draft"
        saving={cancelDraft.isPending}
        onSave={cancelSelectedDraft}
        onCancel={() => setCancelOpen(false)}
      >
        <p style={{ marginTop: 0 }}>The Draft stays in the Purchase List with Status Cancelled. It cannot be posted or changed after this.</p>
        <TextField
          label="Reason"
          value={cancelReason}
          onChange={value => { setCancelReason(value); setCancelReasonError(''); }}
          required
          placeholder="Why is this Draft cancelled?"
          error={cancelReasonError || undefined}
        />
      </FormDialog>

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
    </DocumentPage>
  );
}
