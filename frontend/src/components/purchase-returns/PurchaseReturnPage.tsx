'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { useValidatePostingDate } from '@/lib/api/fiscal-years';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useCreateAndPostPurchaseReturn,
  useCreatePurchaseReturnDraft,
  useInvalidatePurchaseReturnQueries,
  usePurchaseReturnSupportData,
} from '@/lib/api/purchase-returns';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { PostedPurchaseReturnsView } from './PostedPurchaseReturnsView';
import { PurchaseReturnAnalyticsView } from './PurchaseReturnAnalyticsView';
import { buildPurchaseReturnDetails, buildPurchaseReturnPayload, validatePurchaseReturnVoucher } from './PurchaseReturnBusiness';
import {
  PurchaseHeaderForm,
  PurchaseLineEntry,
  PurchaseLineTable,
  PurchaseMessageBanner,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from '@/components/purchases/components';
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
  const invalidateReturnQueries = useInvalidatePurchaseReturnQueries();

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('posted');
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

  const saving = createDraft.isPending || createAndPost.isPending;
  const isPurchaseReturnDateValid = isValidDateInput(purchaseReturnDate);
  const dateValidation = useValidatePostingDate(isPurchaseReturnDateValid ? purchaseReturnDate : today(), isPurchaseReturnDateValid);
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
  } = usePurchaseLineEditor({
    items,
    onDefaultWarehouseChange: setWarehouseId,
    onError: text => setMessage({ kind: 'error', text }),
    onClearMessage: () => setMessage(null),
  });

  const selectedSupplier = suppliers.find(supplier => supplier.value === supplierId);
  const totals = usePurchaseTotals(lines, freightAmount, paymentType);
  const generatedVoucherDetails = buildPurchaseReturnDetails(selectedSupplier, supplierReturnNumber, lines.length);

  const dateStatusMessage = !purchaseReturnDate
    ? ''
    : !isPurchaseReturnDateValid
      ? 'Purchase Return Date is not a valid date.'
      : dateValidation.data && !dateValidation.data.canPost
        ? `Purchase Return Date: ${dateValidation.data.reason}`
        : '';

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
        text: friendlyErrorMessage(supportQuery.error, 'Unable to load purchase return setup. Please refresh and try again.'),
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
    if (clearMessage) setMessage(null);
  }

  function validateForm() {
    return validatePurchaseReturnVoucher({
      purchaseReturnDate,
      isPurchaseReturnDateValid,
      postingDateError: dateValidation.data && !dateValidation.data.canPost ? `Purchase Return Date: ${dateValidation.data.reason}` : undefined,
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
      setMessage({ kind: 'success', text: 'Purchase return data refreshed successfully.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to refresh purchase return data.') });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to print Purchase Return.') });
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
      const purchaseReturn = postNow
        ? await createAndPost.mutateAsync(payload)
        : await createDraft.mutateAsync(payload);
      await invalidateReturnQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${purchaseReturn.purchase_return_number} saved and posted successfully.`
          : `${purchaseReturn.purchase_return_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Unable to save Purchase Return.'),
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

  const actionDisabled = saving || supportQuery.isLoading || supportQuery.isError;

  if (viewMode === 'posted') {
    return (
      <PostedPurchaseReturnsView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewReturn={() => {
          resetForm();
          setViewMode('entry');
        }}
        onAnalytics={() => setViewMode('analytics')}
      />
    );
  }

  if (viewMode === 'analytics') {
    return (
      <PurchaseReturnAnalyticsView
        settings={generalSettings}
        onNewReturn={() => {
          resetForm();
          setViewMode('entry');
        }}
        onPostedReturns={() => setViewMode('posted')}
      />
    );
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <PurchaseToolbar
        title="Purchase Return"
        documentCode="PR"
        postedListLabel="Posted Returns"
        analyticsLabel="Analysis"
        showAnalytics
        actionDisabled={actionDisabled}
        saving={saving}
        onNew={() => resetForm()}
        onPostedPurchases={() => setViewMode('posted')}
        onAnalytics={() => setViewMode('analytics')}
        onRefresh={refreshData}
        onPrint={printVoucher}
        onCancel={() => resetForm()}
        onSaveDraft={() => savePurchaseReturn(false)}
        onProcess={requestProcessConfirmation}
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Purchase Return?"
        message="This will save and post the Purchase Return. Posted documents cannot be edited directly."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => savePurchaseReturn(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      {message && <PurchaseMessageBanner message={message} />}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 7, overflow: 'hidden' }}>
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

        <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'visible' }}>
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

          <PurchaseLineTable
            lines={lines}
            generalSettings={generalSettings}
            money={money}
            onMoveLine={moveLine}
            onEditLine={editLine}
            onRemoveLine={removeLine}
          />
        </div>

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
      </section>
    </main>
  );
}
