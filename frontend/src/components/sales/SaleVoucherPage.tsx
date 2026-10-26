'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useCreateAndPostSale, useCreateSaleDraft, useInvalidateSaleQueries, useSaleSupportData } from '@/lib/api/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { addDays, friendlyErrorMessage } from '@/lib/erp-utils';
import { buildSaleDetails, buildSalePayload, validateSaleVoucher } from './SaleVoucherBusiness';
import { PostedSalesView } from './PostedSalesView';
import { SaleAnalyticsView } from './SaleAnalyticsView';
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
import { useSaleBranch, useSaleBranchOptions } from './hooks/useSaleBranch';
import { useSaleSupportOptions } from './hooks/useSaleSupportOptions';
import type { SaleMessageKind, SalePaymentType } from './SaleVoucherTypes';

export default function SaleVoucherPage() {
  const { data: generalSettings } = useGeneralSettings();
  const branch = useSaleBranch();
  const supportQuery = useSaleSupportData(branch.branchId || undefined);
  const createDraft = useCreateSaleDraft();
  const createAndPost = useCreateAndPostSale();
  const invalidateSaleQueries = useInvalidateSaleQueries();

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('analytics');
  const [saleDate, setSaleDate] = useState(today());
  const [customerId, setCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState<SalePaymentType>('Cash');
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [customerReferenceNumber, setCustomerReferenceNumber] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [message, setMessage] = useState<{ kind: SaleMessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);

  const saving = createDraft.isPending || createAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(saleDate, 'Sale Date');
  const isSaleDateValid = postingDateGuard.dateIsValid;
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
  const generatedVoucherDetails = buildSaleDetails(selectedCustomer, customerReferenceNumber, lines.length);
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Sale Date...' : postingDateGuard.statusMessage;
  const newDisabled = postingDateGuard.disabled;
  const newDisabledReason = dateStatusMessage || 'Sale Date is being checked.';

  useEffect(() => {
    if (!customerId || !selectedCustomer || paymentType !== 'Credit' || !isSaleDateValid) return;
    setDueDate(addDays(saleDate, selectedCustomer.paymentTermsDays));
  }, [customerId, selectedCustomer, paymentType, saleDate, isSaleDateValid]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Unable to load sale setup. Please refresh and try again.'),
      });
    }
  }, [supportQuery.error]);

  function resetForm(clearMessage = true) {
    setSaleDate(today());
    setCustomerId('');
    setPaymentType('Cash');
    setDeliveryDate(today());
    setDueDate(today());
    resetBranch();
    setCustomerReferenceNumber('');
    setDeliveryNoteNumber('');
    setFreightAmount('');
    resetLineEditor();
    if (clearMessage) setMessage(null);
  }

  function validateForm() {
    return validateSaleVoucher({
      saleDate,
      isSaleDateValid,
      postingDateError: postingDateGuard.isBlocked ? dateStatusMessage : undefined,
      customerId,
      selectedCustomer,
      branchId,
      selectedBranch,
      paymentType,
      dueDate,
      deliveryDate,
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
      setMessage({ kind: 'success', text: 'Sale data refreshed successfully.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to refresh sale data.') });
    }
  }

  async function saveSale(postNow: boolean) {
    setProcessConfirmOpen(false);
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Sale Voucher is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }

    const payload = buildSalePayload({
      saleDate,
      customerId,
      paymentType,
      dueDate,
      deliveryDate,
      branchId,
      locationId,
      customerReferenceNumber,
      deliveryNoteNumber,
      generatedVoucherDetails,
      freight: totals.freight,
      lines,
    });

    try {
      const sale = postNow
        ? await createAndPost.mutateAsync(payload)
        : await createDraft.mutateAsync(payload);
      await invalidateSaleQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${sale.sale_number} saved and posted successfully.`
          : `${sale.sale_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to save Sale Voucher.') });
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

  function openNewSale() {
    if (newDisabled) return;
    resetForm();
    setViewMode('entry');
  }

  const actionDisabled = saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;
  const lineKeyboard = useLineEntryKeyboard({
    enabled: viewMode === 'entry',
    onSave: () => saveSale(false),
    saveDisabled: actionDisabled,
    onCommitLine: addItemLine,
    commitDisabled: supportQuery.isLoading || supportQuery.isError,
    onNewLine: cancelLineEdit,
  });

  if (viewMode === 'posted') {
    return (
      <PostedSalesView
        customers={customers}
        branches={branches}
        showBranchFilter={!isBranchUser}
        money={money}
        generalSettings={generalSettings}
        onNewSale={openNewSale}
        onAnalytics={() => setViewMode('analytics')}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  if (viewMode === 'analytics') {
    return (
      <SaleAnalyticsView
        settings={generalSettings}
        onNewSale={openNewSale}
        onPostedSales={() => setViewMode('posted')}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  return (
    <DocumentPage>
      <PurchaseToolbar
        title="Sale Voucher"
        documentCode="SI"
        postedListLabel="Posted Sales"
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
        onSaveDraft={() => saveSale(false)}
        onProcess={requestProcessConfirmation}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Sale Voucher?"
        message="This will save and post the Sale Voucher. Posted documents cannot be edited directly."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => saveSale(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <PurchaseHeaderForm
        documentNumberLabel="Sale Number"
        documentDateLabel="Sale Date"
        supplierDocumentDateLabel="Delivery Date"
        supplierDocumentNumberLabel="Delivery Note No."
        supplierDocumentPlaceholder="Delivery Note"
        partyLabel="Customer"
        partyPlaceholder="Search Customer"
        balanceLabel="Received Amount"
        balanceValue={money(totals.netAmount)}
        purchaseDate={saleDate}
        paymentType={paymentType}
        supplierInvoiceDate={deliveryDate}
        supplierInvoiceNumber={deliveryNoteNumber}
        supplierId={customerId}
        warehouseId={branchId}
        holderLabel="Branch"
        holderReadOnly={isBranchUser}
        locationId={locationId}
        showLocation={branchLocations.length > 0}
        referenceNumber={customerReferenceNumber}
        dueDate={dueDate}
        generatedVoucherDetails={generatedVoucherDetails}
        dateStatusMessage={dateStatusMessage}
        suppliers={customers}
        warehouses={branches}
        locations={branchLocations}
        loadingSupportData={supportQuery.isLoading}
        supportDataHasError={supportQuery.isError}
        money={money}
        onPurchaseDateChange={setSaleDate}
        onPaymentTypeChange={value => setPaymentType(value as SalePaymentType)}
        onSupplierInvoiceDateChange={setDeliveryDate}
        onSupplierInvoiceNumberChange={setDeliveryNoteNumber}
        onSupplierChange={setCustomerId}
        onWarehouseChange={changeBranch}
        onLocationChange={setLocationId}
        onReferenceNumberChange={setCustomerReferenceNumber}
        onDueDateChange={setDueDate}
      />

      <LinesPanel
        title="Lines"
        hint={<LineShortcutHint mode="entry" />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        entry={(
          <PurchaseLineEntry
            priceLabel="Sale Price"
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
            freightLabel="Freight"
            balanceLabel={paymentType === 'Credit' ? 'Balance Due' : 'Received Amount'}
            totalItems={lines.length}
            grossAmount={totals.grossAmount}
            discountAmount={totals.discountAmount}
            taxAmount={totals.taxAmount}
            freightAmount={freightAmount}
            netAmount={totals.netAmount}
            balanceDue={paymentType === 'Credit' ? totals.netAmount : 0}
            generalSettings={generalSettings}
            money={money}
            onFreightAmountChange={setFreightAmount}
          />
        )}
      >
        <PurchaseLineTable
          priceColumnLabel="Sale Price"
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
