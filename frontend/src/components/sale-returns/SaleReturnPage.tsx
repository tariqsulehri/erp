'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateAndPostSaleReturn,
  useCreateSaleReturnDraft,
  useInvalidateSaleReturnQueries,
  useSaleReturnSupportData,
} from '@/lib/api/sale-returns';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { buildSaleReturnDetails, buildSaleReturnPayload, validateSaleReturnVoucher } from './SaleReturnBusiness';
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
  const invalidateReturnQueries = useInvalidateSaleReturnQueries();

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

  const saving = createDraft.isPending || createAndPost.isPending;
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
  const newDisabled = postingDateGuard.disabled;
  const newDisabledReason = dateStatusMessage || 'Sale Return Date is being checked.';

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Unable to load sale return setup. Please refresh and try again.'),
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
    if (clearMessage) setMessage(null);
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
      setMessage({ kind: 'success', text: 'Sale return data refreshed successfully.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to refresh sale return data.') });
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
      const saleReturn = postNow
        ? await createAndPost.mutateAsync(payload)
        : await createDraft.mutateAsync(payload);
      await invalidateReturnQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${saleReturn.sale_return_number} saved and posted successfully.`
          : `${saleReturn.sale_return_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Sale Return.') });
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

  const actionDisabled = saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;
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
        title="Sale Return"
        documentCode="SR"
        postedListLabel="Posted Returns"
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
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Sale Return?"
        message="This will save and post the Sale Return. Posted documents cannot be edited directly."
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
