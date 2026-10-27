'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { roleCannotSave, usePermission } from '@/lib/auth/use-permission';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import {
  useCreateAndPostSale,
  useCreateSaleDraft,
  useInvalidateSaleQueries,
  useSaleSupportData,
  useUpdateAndPostSale,
  useUpdateSaleDraft,
} from '@/lib/api/sales';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { addDays, friendlyErrorMessage } from '@/lib/erp-utils';
import { buildSaleDetails, buildSalePayload, saleFormFromDetail, validateSaleVoucher } from './SaleVoucherBusiness';
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
  const updateDraft = useUpdateSaleDraft();
  const updateAndPost = useUpdateAndPostSale();
  const invalidateSaleQueries = useInvalidateSaleQueries();
  /** The saved Draft open in the form, or null for a new sale. */
  const [openDraft, setOpenDraft] = useState<{ id: string; saleNumber: string } | null>(null);
  /** Customer, Payment Type and Date of a just-opened Draft, so its saved Due Date is not replaced by the customer's terms. */
  const loadedDueDateKey = useRef<string | null>(null);
  /** An opened Draft's shelf Location, applied once that Branch's Locations have loaded. */
  const pendingLocationId = useRef<string | null>(null);

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

  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
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
    loadLines,
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
  const canSave = usePermission('sales.edit');
  const newDisabled = postingDateGuard.disabled || !canSave;
  const newDisabledReason = !canSave ? roleCannotSave('Sale Vouchers') : dateStatusMessage || 'Sale Date is being checked.';

  useEffect(() => {
    if (!customerId || !selectedCustomer || paymentType !== 'Credit' || !isSaleDateValid) return;
    // Keep an opened Draft's own Due Date until the user changes its Customer, Payment Type or Date.
    if (loadedDueDateKey.current === `${customerId}|${paymentType}|${saleDate}`) return;
    loadedDueDateKey.current = null;
    setDueDate(addDays(saleDate, selectedCustomer.paymentTermsDays));
  }, [customerId, selectedCustomer, paymentType, saleDate, isSaleDateValid]);

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
        text: friendlyErrorMessage(supportQuery.error, 'Could not load the sale setup. Select Refresh and try again.'),
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
    setOpenDraft(null);
    loadedDueDateKey.current = null;
    pendingLocationId.current = null;
    if (clearMessage) setMessage(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = saleFormFromDetail(detail);
    setSaleDate(form.saleDate);
    setCustomerId(form.customerId);
    setPaymentType(form.paymentType);
    setDueDate(form.dueDate || form.saleDate);
    setDeliveryDate(form.deliveryDate);
    changeBranch(form.branchId);
    setLocationId(form.locationId);
    pendingLocationId.current = form.locationId || null;
    setCustomerReferenceNumber(form.customerReferenceNumber);
    setDeliveryNoteNumber(form.deliveryNoteNumber);
    setFreightAmount(form.freightAmount);
    loadLines(form.lines);
    loadedDueDateKey.current = `${form.customerId}|${form.paymentType}|${form.saleDate}`;
    setOpenDraft({ id: form.id, saleNumber: form.saleNumber });
    setMessage(null);
    setViewMode('entry');
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
      setMessage({ kind: 'success', text: 'Sale data refreshed.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not refresh sale data. Please try again.') });
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
      const sale = openDraft
        ? postNow
          ? await updateAndPost.mutateAsync({ id: openDraft.id, input: payload })
          : await updateDraft.mutateAsync({ id: openDraft.id, input: payload })
        : postNow
          ? await createAndPost.mutateAsync(payload)
          : await createDraft.mutateAsync(payload);
      await invalidateSaleQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${sale.sale_number} saved and posted.`
          : `${sale.sale_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not save Sale Voucher. Please try again.') });
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

  const actionDisabled = !canSave || saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;
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
        onOpenDraft={openSavedDraft}
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
        title={openDraft ? `Sale Voucher ${openDraft.saleNumber}` : 'Sale Voucher'}
        mode={openDraft ? 'Edit' : 'Add'}
        documentCode="SI"
        postedListLabel="Sale List"
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
        help={(
          <>
            <p>Use this screen to record goods you sell to a Customer from a Branch.</p>
            <ul>
              <li>Fill in the Customer, dates and Branch, then add one line for each item.</li>
              <li>Save Draft keeps the sale so you can finish it later. Find it in the Sale List with Status Draft and select Open Draft.</li>
              <li>Process saves and posts it. Stock and the Customer balance are updated. If posting is refused, nothing is saved.</li>
            </ul>
            <p>A posted sale cannot be changed. Use a Sale Return to correct it.</p>
          </>
        )}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Sale Voucher?"
        message="This saves and posts the Sale Voucher. You cannot change it after it is posted."
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
