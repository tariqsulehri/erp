'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { roleCannotSave, usePermission } from '@/lib/auth/use-permission';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateAndPostSaleReturn,
  useCreateSaleReturnDraft,
  useInvalidateSaleReturnQueries,
  useSaleReturnSupportData,
  useUpdateAndPostSaleReturn,
  useUpdateSaleReturnDraft,
} from '@/lib/api/sale-returns';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { buildSaleReturnDetails, buildSaleReturnPayload, saleReturnFormFromDetail, validateSaleReturnVoucher } from './SaleReturnBusiness';
import { PostedSaleReturnsView } from './PostedSaleReturnsView';
import { SaleReturnAnalyticsView } from './SaleReturnAnalyticsView';
import {
  PurchaseHeaderForm,
  PurchaseLineEntry,
  PurchaseLineTable,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from '@/components/purchases/components';
import { DocumentMessage, DocumentPage, LineShortcutHint, LinesPanel, useLineEntryKeyboard } from '@/components/documents';
import { usePurchaseLineEditor } from '@/components/purchases/hooks/usePurchaseLineEditor';
import { usePurchaseTotals } from '@/components/purchases/hooks/usePurchaseTotals';
import { today } from '@/components/purchases/PurchaseVoucherHelpers';
import { useSaleBranch, useSaleBranchOptions } from '@/components/sales/hooks/useSaleBranch';
import { useSaleSupportOptions } from '@/components/sales/hooks/useSaleSupportOptions';
import type { SaleMessageKind, SalePaymentType } from '@/components/sales/SaleVoucherTypes';

export default function SaleReturnPage() {
  const { data: generalSettings } = useGeneralSettings();
  const branch = useSaleBranch();
  const supportQuery = useSaleReturnSupportData(branch.branchId || undefined);
  const createDraft = useCreateSaleReturnDraft();
  const createAndPost = useCreateAndPostSaleReturn();
  const updateDraft = useUpdateSaleReturnDraft();
  const updateAndPost = useUpdateAndPostSaleReturn();
  const invalidateReturnQueries = useInvalidateSaleReturnQueries();
  /** The saved Draft open in the form, or null for a new return. */
  const [openDraft, setOpenDraft] = useState<{ id: string; saleReturnNumber: string } | null>(null);
  /** An opened Draft's shelf Location, applied once that Branch's Locations have loaded. */
  const pendingLocationId = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('analytics');
  const [saleReturnDate, setSaleReturnDate] = useState(today());
  const [customerId, setCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState<SalePaymentType>('Credit');
  const [customerReturnNumber, setCustomerReturnNumber] = useState('');
  const [customerReturnDate, setCustomerReturnDate] = useState(today());
  const [referenceNumber, setReferenceNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [message, setMessage] = useState<{ kind: SaleMessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);

  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(saleReturnDate, 'Sale Return Date');
  const isSaleReturnDateValid = postingDateGuard.dateIsValid;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const { customers, items, branches, locations } = useSaleSupportOptions(supportQuery.data);
  const { selectedBranch, branchLocations, resetBranch } = useSaleBranchOptions(branch, branches, locations);
  const { branchId, isBranchUser, locationId, setLocationId, changeBranch } = branch;
  const selectedCustomer = customers.find(customer => customer.value === customerId);

  const {
    lineDraft,
    lines,
    editingLineId,
    selectedItem,
    lineDraftTotal,
    updateLineDraft,
    addItemLine,
    removeLine,
    editLine,
    cancelLineEdit,
    moveLine,
    resetLineEditor,
    loadLines,
  } = usePurchaseLineEditor({
    items,
    // Sale items are always taken from the selected Branch, so an item's default Warehouse is ignored.
    onDefaultWarehouseChange: () => undefined,
    onError: text => setMessage({ kind: 'error', text }),
    onClearMessage: () => setMessage(null),
  });

  const totals = usePurchaseTotals(lines, freightAmount, paymentType);
  const generatedVoucherDetails = buildSaleReturnDetails(selectedCustomer, customerReturnNumber, lines.length);
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Sale Return Date...' : postingDateGuard.statusMessage;
  const canSave = usePermission('sales.edit');
  const newDisabled = postingDateGuard.disabled || !canSave;
  const newDisabledReason = !canSave ? roleCannotSave('Sale Returns') : dateStatusMessage || 'Sale Return Date is being checked.';

  useEffect(() => {
    const pending = pendingLocationId.current;
    if (pending && branchLocations.some(location => location.value === pending)) {
      pendingLocationId.current = null;
      setLocationId(pending);
    }
  }, [branchLocations, setLocationId]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Could not load the sale return setup. Select Refresh and try again.'),
      });
    }
  }, [supportQuery.error]);

  function resetForm(clearMessage = true) {
    setSaleReturnDate(today());
    setCustomerId('');
    setPaymentType('Credit');
    setCustomerReturnNumber('');
    setCustomerReturnDate(today());
    resetBranch();
    setReferenceNumber('');
    setFreightAmount('');
    resetLineEditor();
    setOpenDraft(null);
    pendingLocationId.current = null;
    if (clearMessage) setMessage(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = saleReturnFormFromDetail(detail);
    setSaleReturnDate(form.saleReturnDate);
    setCustomerId(form.customerId);
    setPaymentType(form.paymentType);
    setCustomerReturnNumber(form.customerReturnNumber);
    setCustomerReturnDate(form.customerReturnDate);
    changeBranch(form.branchId);
    setLocationId(form.locationId);
    pendingLocationId.current = form.locationId || null;
    setReferenceNumber(form.referenceNumber);
    setFreightAmount(form.freightAmount);
    loadLines(form.lines);
    setOpenDraft({ id: form.id, saleReturnNumber: form.saleReturnNumber });
    setMessage(null);
    setViewMode('entry');
  }

  function validateForm() {
    return validateSaleReturnVoucher({
      saleReturnDate,
      isSaleReturnDateValid,
      postingDateError: postingDateGuard.isBlocked ? dateStatusMessage : undefined,
      customerId,
      selectedCustomer,
      branchId,
      selectedBranch,
      customerReturnDate,
      lines,
      freightAmount,
      netAmount: totals.netAmount,
    });
  }

  async function refreshData() {
    setMessage(null);
    try {
      const result = await supportQuery.refetch();
      if (result.error) throw result.error;
      setMessage({ kind: 'success', text: 'Sale return data refreshed.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not refresh sale return data. Please try again.') });
    }
  }

  async function saveSaleReturn(postNow: boolean) {
    setProcessConfirmOpen(false);
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Sale Return is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }

    const payload = buildSaleReturnPayload({
      saleReturnDate,
      customerId,
      customerReturnNumber,
      customerReturnDate,
      paymentType,
      branchId,
      locationId,
      referenceNumber,
      generatedVoucherDetails,
      freight: totals.freight,
      lines,
    });

    try {
      const saleReturn = openDraft
        ? postNow
          ? await updateAndPost.mutateAsync({ id: openDraft.id, input: payload })
          : await updateDraft.mutateAsync({ id: openDraft.id, input: payload })
        : postNow
          ? await createAndPost.mutateAsync(payload)
          : await createDraft.mutateAsync(payload);
      await invalidateReturnQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${saleReturn.sale_return_number} saved and posted.`
          : `${saleReturn.sale_return_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not save Sale Return. Please try again.') });
    }
  }

  function requestProcessConfirmation() {
    setMessage(null);
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }
    setProcessConfirmOpen(true);
  }

  function openNewReturn() {
    if (newDisabled) return;
    resetForm();
    setViewMode('entry');
  }

  const actionDisabled = !canSave || saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;
  const lineKeyboard = useLineEntryKeyboard({
    enabled: viewMode === 'entry',
    onSave: () => saveSaleReturn(false),
    saveDisabled: actionDisabled,
    onCommitLine: addItemLine,
    commitDisabled: supportQuery.isLoading || supportQuery.isError,
    onNewLine: cancelLineEdit,
  });

  if (viewMode === 'posted') {
    return (
      <PostedSaleReturnsView
        customers={customers}
        branches={branches}
        showBranchFilter={!isBranchUser}
        money={money}
        generalSettings={generalSettings}
        onNewReturn={openNewReturn}
        onAnalytics={() => setViewMode('analytics')}
        onOpenDraft={openSavedDraft}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  if (viewMode === 'analytics') {
    return (
      <SaleReturnAnalyticsView
        settings={generalSettings}
        onNewReturn={openNewReturn}
        onPostedReturns={() => setViewMode('posted')}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  return (
    <DocumentPage>
      <PurchaseToolbar
        title={openDraft ? `Sale Return ${openDraft.saleReturnNumber}` : 'Sale Return'}
        mode={openDraft ? 'Edit' : 'Add'}
        documentCode="SR"
        postedListLabel="Sale Return List"
        analyticsLabel="Analysis"
        showAnalytics
        actionDisabled={actionDisabled}
        saving={saving}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
        onNew={() => resetForm()}
        onPostedPurchases={() => setViewMode('posted')}
        onAnalytics={() => setViewMode('analytics')}
        onRefresh={refreshData}
        onPrint={() => window.print()}
        onCancel={() => resetForm()}
        onSaveDraft={() => saveSaleReturn(false)}
        onProcess={requestProcessConfirmation}
        help={(
          <>
            <p>Use this screen to take back goods that a Customer returns to a Branch.</p>
            <ul>
              <li>Fill in the Customer, dates and Branch, then add one line for each item returned.</li>
              <li>Save Draft keeps the return so you can finish it later. Find it in the Sale Return List with Status Draft and select Open Draft.</li>
              <li>Process saves and posts it. Stock goes up and the Customer balance is updated. If posting is refused, nothing is saved.</li>
            </ul>
            <p>A posted return cannot be changed.</p>
          </>
        )}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Sale Return?"
        message="This saves and posts the Sale Return. You cannot change it after it is posted."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => saveSaleReturn(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <PurchaseHeaderForm
        documentNumberLabel="Return Number"
        documentDateLabel="Return Date"
        supplierDocumentDateLabel="Customer Return Date"
        supplierDocumentNumberLabel="Customer Return No."
        supplierDocumentPlaceholder="Return No."
        partyLabel="Customer"
        partyPlaceholder="Search Customer"
        showDueDate={false}
        balanceLabel="Return Amount"
        balanceValue={money(totals.netAmount)}
        purchaseDate={saleReturnDate}
        paymentType={paymentType}
        supplierInvoiceDate={customerReturnDate}
        supplierInvoiceNumber={customerReturnNumber}
        supplierId={customerId}
        warehouseId={branchId}
        holderLabel="Branch"
        holderReadOnly={isBranchUser}
        locationId={locationId}
        showLocation={branchLocations.length > 0}
        referenceNumber={referenceNumber}
        dueDate={saleReturnDate}
        generatedVoucherDetails={generatedVoucherDetails}
        dateStatusMessage={dateStatusMessage}
        suppliers={customers}
        warehouses={branches}
        locations={branchLocations}
        loadingSupportData={supportQuery.isLoading}
        supportDataHasError={supportQuery.isError}
        money={money}
        onPurchaseDateChange={setSaleReturnDate}
        onPaymentTypeChange={value => setPaymentType(value as SalePaymentType)}
        onSupplierInvoiceDateChange={setCustomerReturnDate}
        onSupplierInvoiceNumberChange={setCustomerReturnNumber}
        onSupplierChange={setCustomerId}
        onWarehouseChange={changeBranch}
        onLocationChange={setLocationId}
        onReferenceNumberChange={setReferenceNumber}
        onDueDateChange={() => undefined}
      />

      <LinesPanel
        title="Lines"
        hint={<LineShortcutHint mode="entry" />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        entry={(
          <PurchaseLineEntry
            priceLabel="Return Price"
            lineDraft={lineDraft}
            selectedItem={selectedItem}
            items={items}
            lineTotal={lineDraftTotal.toNumber()}
            editingLineId={editingLineId}
            loadingSupportData={supportQuery.isLoading}
            supportDataHasError={supportQuery.isError}
            money={money}
            onChange={updateLineDraft}
            onAddOrUpdate={addItemLine}
            onCancelEdit={cancelLineEdit}
          />
        )}
        summary={(
          <PurchaseSummaryFooter
            freightLabel="Freight Reversal"
            balanceLabel="Return Amount"
            totalItems={lines.length}
            grossAmount={totals.grossAmount}
            discountAmount={totals.discountAmount}
            taxAmount={totals.taxAmount}
            freightAmount={freightAmount}
            netAmount={totals.netAmount}
            balanceDue={totals.netAmount}
            generalSettings={generalSettings}
            money={money}
            onFreightAmountChange={setFreightAmount}
          />
        )}
      >
        <PurchaseLineTable
          priceColumnLabel="Return Price"
          lines={lines}
          editingLineId={editingLineId}
          generalSettings={generalSettings}
          money={money}
          onMoveLine={moveLine}
          onEditLine={editLine}
          onRemoveLine={removeLine}
        />
      </LinesPanel>
    </DocumentPage>
  );
}
