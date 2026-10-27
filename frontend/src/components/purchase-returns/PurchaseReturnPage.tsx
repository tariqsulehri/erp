'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { roleCannotSave, usePermission } from '@/lib/auth/use-permission';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateAndPostPurchaseReturn,
  useCreatePurchaseReturnDraft,
  useInvalidatePurchaseReturnQueries,
  usePurchaseReturnSupportData,
  useUpdateAndPostPurchaseReturn,
  useUpdatePurchaseReturnDraft,
} from '@/lib/api/purchase-returns';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { PostedPurchaseReturnsView } from './PostedPurchaseReturnsView';
import { PurchaseReturnAnalyticsView } from './PurchaseReturnAnalyticsView';
import { buildPurchaseReturnDetails, buildPurchaseReturnPayload, purchaseReturnFormFromDetail, validatePurchaseReturnVoucher } from './PurchaseReturnBusiness';
import {
  PurchaseHeaderForm,
  PurchaseLineEntry,
  PurchaseLineTable,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from '@/components/purchases/components';
import { DocumentMessage, DocumentPage, LineShortcutHint, LinesPanel, useLineEntryKeyboard } from '@/components/documents';
import { usePurchaseLineEditor } from '@/components/purchases/hooks/usePurchaseLineEditor';
import { usePurchaseSupportOptions } from '@/components/purchases/hooks/usePurchaseSupportOptions';
import { usePurchaseTotals } from '@/components/purchases/hooks/usePurchaseTotals';
import { today } from '@/components/purchases/PurchaseVoucherHelpers';
import type { PaymentType, PurchaseMessageKind } from '@/components/purchases/PurchaseVoucherTypes';

export default function PurchaseReturnPage() {
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = usePurchaseReturnSupportData();
  const createDraft = useCreatePurchaseReturnDraft();
  const createAndPost = useCreateAndPostPurchaseReturn();
  const updateDraft = useUpdatePurchaseReturnDraft();
  const updateAndPost = useUpdateAndPostPurchaseReturn();
  const invalidateReturnQueries = useInvalidatePurchaseReturnQueries();
  /** The saved Draft open in the form, or null for a new return. */
  const [openDraft, setOpenDraft] = useState<{ id: string; purchaseReturnNumber: string } | null>(null);

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('analytics');
  const [purchaseReturnDate, setPurchaseReturnDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('Credit');
  const [supplierReturnNumber, setSupplierReturnNumber] = useState('');
  const [supplierReturnDate, setSupplierReturnDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [message, setMessage] = useState<{ kind: PurchaseMessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);

  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(purchaseReturnDate, 'Purchase Return Date');
  const isPurchaseReturnDateValid = postingDateGuard.dateIsValid;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const { suppliers, items, warehouses, locations } = usePurchaseSupportOptions(supportQuery.data);
  const selectedWarehouse = warehouses.find(warehouse => warehouse.value === warehouseId);
  const warehouseLocations = useMemo(() => locations.filter(location => location.warehouseId === warehouseId), [locations, warehouseId]);

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
    onDefaultWarehouseChange: setWarehouseId,
    onError: text => setMessage({ kind: 'error', text }),
    onClearMessage: () => setMessage(null),
  });

  const selectedSupplier = suppliers.find(supplier => supplier.value === supplierId);
  const totals = usePurchaseTotals(lines, freightAmount, paymentType);
  const generatedVoucherDetails = buildPurchaseReturnDetails(selectedSupplier, supplierReturnNumber, lines.length);

  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Purchase Return Date...' : postingDateGuard.statusMessage;
  const canSave = usePermission('purchases.edit');
  const newDisabled = postingDateGuard.disabled || !canSave;
  const newDisabledReason = !canSave ? roleCannotSave('Purchase Returns') : dateStatusMessage || 'Purchase Return Date is being checked.';

  useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0].value);
    }
  }, [warehouseId, warehouses]);

  useEffect(() => {
    if (!warehouseId || !selectedWarehouse?.useLocations) {
      setLocationId('');
      return;
    }
    if (locationId && warehouseLocations.some(location => location.value === locationId)) return;
    setLocationId(warehouseLocations.find(location => location.isDefault)?.value ?? '');
  }, [locationId, selectedWarehouse?.useLocations, warehouseId, warehouseLocations]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Could not load the purchase return setup. Select Refresh and try again.'),
      });
    }
  }, [supportQuery.error]);

  function resetForm(clearMessage = true) {
    setPurchaseReturnDate(today());
    setSupplierId('');
    setPaymentType('Credit');
    setSupplierReturnNumber('');
    setSupplierReturnDate(today());
    setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setLocationId('');
    setReferenceNumber('');
    setFreightAmount('');
    resetLineEditor();
    setOpenDraft(null);
    if (clearMessage) setMessage(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = purchaseReturnFormFromDetail(detail);
    setPurchaseReturnDate(form.purchaseReturnDate);
    setSupplierId(form.supplierId);
    setPaymentType(form.paymentType);
    setSupplierReturnNumber(form.supplierReturnNumber);
    setSupplierReturnDate(form.supplierReturnDate);
    setWarehouseId(form.warehouseId);
    setLocationId(form.locationId);
    setReferenceNumber(form.referenceNumber);
    setFreightAmount(form.freightAmount);
    loadLines(form.lines);
    setOpenDraft({ id: form.id, purchaseReturnNumber: form.purchaseReturnNumber });
    setMessage(null);
    setViewMode('entry');
  }

  function validateForm() {
    return validatePurchaseReturnVoucher({
      purchaseReturnDate,
      isPurchaseReturnDateValid,
      postingDateError: postingDateGuard.isBlocked ? dateStatusMessage : undefined,
      supplierId,
      selectedSupplier,
      warehouseId,
      locationId,
      selectedWarehouse,
      paymentType,
      supplierReturnDate,
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
      setMessage({ kind: 'success', text: 'Purchase return data refreshed.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not refresh purchase return data. Please try again.') });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not print Purchase Return. Please try again.') });
    }
  }

  async function savePurchaseReturn(postNow: boolean) {
    setProcessConfirmOpen(false);
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Purchase Return is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }

    const payload = buildPurchaseReturnPayload({
      purchaseReturnDate,
      supplierId,
      supplierReturnNumber,
      supplierReturnDate,
      paymentType,
      warehouseId,
      locationId,
      referenceNumber,
      generatedVoucherDetails,
      freight: totals.freight,
      lines,
    });

    try {
      const purchaseReturn = openDraft
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
          ? `${purchaseReturn.purchase_return_number} saved and posted.`
          : `${purchaseReturn.purchase_return_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Could not save Purchase Return. Please try again.'),
      });
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
    onSave: () => savePurchaseReturn(false),
    saveDisabled: actionDisabled,
    onCommitLine: addItemLine,
    commitDisabled: supportQuery.isLoading || supportQuery.isError,
    onNewLine: cancelLineEdit,
  });

  if (viewMode === 'posted') {
    return (
      <PostedPurchaseReturnsView
        suppliers={suppliers}
        warehouses={warehouses}
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
      <PurchaseReturnAnalyticsView
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
        title={openDraft ? `Purchase Return ${openDraft.purchaseReturnNumber}` : 'Purchase Return'}
        mode={openDraft ? 'Edit' : 'Add'}
        documentCode="PR"
        postedListLabel="Purchase Return List"
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
        onPrint={printVoucher}
        onCancel={() => resetForm()}
        onSaveDraft={() => savePurchaseReturn(false)}
        onProcess={requestProcessConfirmation}
        help={(
          <>
            <p>Use this screen to send goods back to a Supplier.</p>
            <ul>
              <li>Fill in the Supplier, dates and Warehouse, then add one line for each item you return.</li>
              <li>Save Draft keeps the return so you can finish it later. Find it in the Purchase Return List with Status Draft and select Open Draft.</li>
              <li>Process saves and posts it. Stock goes down and the Supplier balance is updated. If posting is refused, nothing is saved.</li>
            </ul>
            <p>A posted return cannot be changed.</p>
          </>
        )}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Purchase Return?"
        message="This saves and posts the Purchase Return. You cannot change it after it is posted."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => savePurchaseReturn(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <PurchaseHeaderForm
        documentNumberLabel="Return Number"
        documentDateLabel="Return Date"
        supplierDocumentDateLabel="Supplier Return Date"
        supplierDocumentNumberLabel="Supplier Return No."
        supplierDocumentPlaceholder="Return No."
        showDueDate={false}
        balanceLabel="Return Amount"
        balanceValue={money(totals.netAmount)}
        purchaseDate={purchaseReturnDate}
        paymentType={paymentType}
        supplierInvoiceDate={supplierReturnDate}
        supplierInvoiceNumber={supplierReturnNumber}
        supplierId={supplierId}
        warehouseId={warehouseId}
        locationId={locationId}
        showLocation={Boolean(selectedWarehouse?.useLocations)}
        referenceNumber={referenceNumber}
        dueDate={purchaseReturnDate}
        generatedVoucherDetails={generatedVoucherDetails}
        dateStatusMessage={dateStatusMessage}
        suppliers={suppliers}
        warehouses={warehouses}
        locations={warehouseLocations}
        loadingSupportData={supportQuery.isLoading}
        supportDataHasError={supportQuery.isError}
        money={money}
        onPurchaseDateChange={setPurchaseReturnDate}
        onPaymentTypeChange={setPaymentType}
        onSupplierInvoiceDateChange={setSupplierReturnDate}
        onSupplierInvoiceNumberChange={setSupplierReturnNumber}
        onSupplierChange={setSupplierId}
        onWarehouseChange={value => {
          setWarehouseId(value);
          setLocationId('');
        }}
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
