'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { roleCannotSave, usePermission } from '@/lib/auth/use-permission';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import {
  useCreateAndPostPurchase,
  useCreatePurchaseDraft,
  useInvalidatePurchaseQueries,
  usePurchaseSupportData,
  useUpdateAndPostPurchase,
  useUpdatePurchaseDraft,
} from '@/lib/api/purchases';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  addDays,
  friendlyErrorMessage,
} from '@/lib/erp-utils';
import { PostedPurchasesView } from './PostedPurchasesView';
import { PurchaseAnalyticsView } from './PurchaseAnalyticsView';
import { buildPurchaseDetails, buildPurchasePayload, purchaseFormFromDetail, validatePurchaseVoucher } from './PurchaseVoucherBusiness';
import {
  PurchaseHeaderForm,
  PurchaseLineEntry,
  PurchaseLineTable,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from './components';
import { DocumentMessage, DocumentPage, LineShortcutHint, LinesPanel, useLineEntryKeyboard } from '@/components/documents';
import { usePurchaseLineEditor } from './hooks/usePurchaseLineEditor';
import { usePurchaseSupportOptions } from './hooks/usePurchaseSupportOptions';
import { usePurchaseTotals } from './hooks/usePurchaseTotals';
import { today } from './PurchaseVoucherHelpers';
import type {
  PaymentType,
  PurchaseMessageKind,
} from './PurchaseVoucherTypes';

export default function PurchaseVoucherPage() {
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = usePurchaseSupportData();
  const createDraft = useCreatePurchaseDraft();
  const createAndPost = useCreateAndPostPurchase();
  const updateDraft = useUpdatePurchaseDraft();
  const updateAndPost = useUpdateAndPostPurchase();
  const invalidatePurchaseQueries = useInvalidatePurchaseQueries();
  /** The saved Draft open in the form, or null for a new purchase. */
  const [openDraft, setOpenDraft] = useState<{ id: string; purchaseNumber: string } | null>(null);
  /** Supplier, Payment Type and Date of a just-opened Draft, so its saved Due Date is not replaced by the supplier's terms. */
  const loadedDueDateKey = useRef<string | null>(null);

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('analytics');
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('Cash');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState('');
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [message, setMessage] = useState<{ kind: PurchaseMessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);

  const saving = createDraft.isPending || createAndPost.isPending || updateDraft.isPending || updateAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(purchaseDate, 'Purchase Date');
  const isPurchaseDateValid = postingDateGuard.dateIsValid;
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
  const generatedVoucherDetails = buildPurchaseDetails(selectedSupplier, supplierInvoiceNumber, lines.length);

  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Purchase Date...' : postingDateGuard.statusMessage;
  const canSave = usePermission('purchases.edit');
  const newDisabled = postingDateGuard.disabled || !canSave;
  const newDisabledReason = !canSave ? roleCannotSave('Purchase Vouchers') : dateStatusMessage || 'Purchase Date is being checked.';

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
    if (!supplierId || !selectedSupplier || paymentType !== 'Credit' || !isPurchaseDateValid) return;
    // Keep an opened Draft's own Due Date until the user changes its Supplier, Payment Type or Date.
    if (loadedDueDateKey.current === `${supplierId}|${paymentType}|${purchaseDate}`) return;
    loadedDueDateKey.current = null;
    setDueDate(addDays(purchaseDate, selectedSupplier.paymentTermsDays));
  }, [supplierId, selectedSupplier, paymentType, purchaseDate, isPurchaseDateValid]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Could not load the purchase setup. Select Refresh and try again.'),
      });
    }
  }, [supportQuery.error]);

  function resetForm(clearMessage = true) {
    setPurchaseDate(today());
    setSupplierId('');
    setPaymentType('Cash');
    setSupplierInvoiceNumber('');
    setSupplierInvoiceDate(today());
    setDueDate(today());
    setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setLocationId('');
    setReferenceNumber('');
    setFreightAmount('');
    resetLineEditor();
    setOpenDraft(null);
    loadedDueDateKey.current = null;
    if (clearMessage) setMessage(null);
  }

  /** Opens a saved Draft in the entry form so it can be changed, saved again, or posted. */
  function openSavedDraft(detail: Record<string, any>) {
    const form = purchaseFormFromDetail(detail);
    setPurchaseDate(form.purchaseDate);
    setSupplierId(form.supplierId);
    setPaymentType(form.paymentType);
    setSupplierInvoiceNumber(form.supplierInvoiceNumber);
    setSupplierInvoiceDate(form.supplierInvoiceDate);
    setDueDate(form.dueDate || form.purchaseDate);
    setWarehouseId(form.warehouseId);
    setLocationId(form.locationId);
    setReferenceNumber(form.referenceNumber);
    setFreightAmount(form.freightAmount);
    loadLines(form.lines);
    loadedDueDateKey.current = `${form.supplierId}|${form.paymentType}|${form.purchaseDate}`;
    setOpenDraft({ id: form.id, purchaseNumber: form.purchaseNumber });
    setMessage(null);
    setViewMode('entry');
  }

  function validateForm() {
    return validatePurchaseVoucher({
      purchaseDate,
      isPurchaseDateValid,
      postingDateError: postingDateGuard.isBlocked ? dateStatusMessage : undefined,
      supplierId,
      selectedSupplier,
      warehouseId,
      locationId,
      selectedWarehouse,
      paymentType,
      dueDate,
      supplierInvoiceDate,
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
      setMessage({ kind: 'success', text: 'Purchase data refreshed.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not refresh purchase data. Please try again.') });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Could not print the Purchase Voucher. Please try again.') });
    }
  }

  async function savePurchase(postNow: boolean) {
    setProcessConfirmOpen(false);
    setMessage(null);
    if (saving) {
      setMessage({ kind: 'error', text: 'Purchase Voucher is already being saved. Please wait.' });
      return;
    }
    const error = validateForm();
    if (error) {
      setMessage({ kind: 'error', text: error });
      return;
    }

    const payload = buildPurchasePayload({
      purchaseDate,
      supplierId,
      supplierInvoiceNumber,
      supplierInvoiceDate,
      paymentType,
      dueDate,
      warehouseId,
      locationId,
      referenceNumber,
      generatedVoucherDetails,
      freight: totals.freight,
      lines,
    });

    try {
      const purchase = openDraft
        ? postNow
          ? await updateAndPost.mutateAsync({ id: openDraft.id, input: payload })
          : await updateDraft.mutateAsync({ id: openDraft.id, input: payload })
        : postNow
          ? await createAndPost.mutateAsync(payload)
          : await createDraft.mutateAsync(payload);
      await invalidatePurchaseQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${purchase.purchase_number} saved and posted.`
          : `${purchase.purchase_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Could not save the Purchase Voucher. Please try again.'),
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

  function openNewPurchase() {
    if (newDisabled) return;
    resetForm();
    setViewMode('entry');
  }

  const actionDisabled = !canSave || saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;
  const lineKeyboard = useLineEntryKeyboard({
    enabled: viewMode === 'entry',
    onSave: () => savePurchase(false),
    saveDisabled: actionDisabled,
    onCommitLine: addItemLine,
    commitDisabled: supportQuery.isLoading || supportQuery.isError,
    onNewLine: cancelLineEdit,
  });

  if (viewMode === 'posted') {
    return (
      <PostedPurchasesView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewPurchase={openNewPurchase}
        onAnalytics={() => setViewMode('analytics')}
        onOpenDraft={openSavedDraft}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  if (viewMode === 'analytics') {
    return (
      <PurchaseAnalyticsView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewPurchase={openNewPurchase}
        onPostedPurchases={() => setViewMode('posted')}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />
    );
  }

  return (
    <DocumentPage>
      <PurchaseToolbar
        title={openDraft ? `Purchase Voucher ${openDraft.purchaseNumber}` : undefined}
        mode={openDraft ? 'Edit' : 'Add'}
        postedListLabel="Purchase List"
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
        onSaveDraft={() => savePurchase(false)}
        onProcess={requestProcessConfirmation}
        help={(
          <>
            <p>Use this screen to record goods you buy from a Supplier.</p>
            <ul>
              <li>Fill in the Supplier, dates and Warehouse, then add one line for each item.</li>
              <li>Save Draft keeps the purchase so you can finish it later. Find it in the Purchase List with Status Draft and select Open Draft.</li>
              <li>Process saves and posts it. Stock and the Supplier balance are updated. If posting is refused, nothing is saved.</li>
            </ul>
            <p>A posted purchase cannot be changed. Use a Purchase Return to correct it.</p>
          </>
        )}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Purchase Voucher?"
        message="This saves and posts the Purchase Voucher. You cannot change it after it is posted."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => savePurchase(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      <DocumentMessage message={message} onDismiss={() => setMessage(null)} />

      <PurchaseHeaderForm
        purchaseDate={purchaseDate}
        paymentType={paymentType}
        supplierInvoiceDate={supplierInvoiceDate}
        supplierInvoiceNumber={supplierInvoiceNumber}
        supplierId={supplierId}
        warehouseId={warehouseId}
        locationId={locationId}
        showLocation={Boolean(selectedWarehouse?.useLocations)}
        referenceNumber={referenceNumber}
        dueDate={dueDate}
        generatedVoucherDetails={generatedVoucherDetails}
        dateStatusMessage={dateStatusMessage}
        suppliers={suppliers}
        warehouses={warehouses}
        locations={warehouseLocations}
        loadingSupportData={supportQuery.isLoading}
        supportDataHasError={supportQuery.isError}
        money={money}
        onPurchaseDateChange={setPurchaseDate}
        onPaymentTypeChange={setPaymentType}
        onSupplierInvoiceDateChange={setSupplierInvoiceDate}
        onSupplierInvoiceNumberChange={setSupplierInvoiceNumber}
        onSupplierChange={setSupplierId}
        onWarehouseChange={value => {
          setWarehouseId(value);
          setLocationId('');
        }}
        onLocationChange={setLocationId}
        onReferenceNumberChange={setReferenceNumber}
        onDueDateChange={setDueDate}
      />

      <LinesPanel
        title="Lines"
        hint={<LineShortcutHint mode="entry" />}
        linesRef={lineKeyboard.linesRef}
        onKeyDown={lineKeyboard.onLinesKeyDown}
        entry={(
          <PurchaseLineEntry
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
            totalItems={lines.length}
            grossAmount={totals.grossAmount}
            discountAmount={totals.discountAmount}
            taxAmount={totals.taxAmount}
            freightAmount={freightAmount}
            netAmount={totals.netAmount}
            balanceDue={totals.balanceDue}
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
