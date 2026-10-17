'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';
import { usePostingDateGuard } from '@/lib/api/fiscal-years';
import { useCreateAndPostPurchase, useCreatePurchaseDraft, useInvalidatePurchaseQueries, usePurchaseSupportData } from '@/lib/api/purchases';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  addDays,
  friendlyErrorMessage,
} from '@/lib/erp-utils';
import { PostedPurchasesView } from './PostedPurchasesView';
import { PurchaseAnalyticsView } from './PurchaseAnalyticsView';
import { buildPurchaseDetails, buildPurchasePayload, validatePurchaseVoucher } from './PurchaseVoucherBusiness';
import {
  PurchaseHeaderForm,
  PurchaseLineEntry,
  PurchaseLineTable,
  PurchaseMessageBanner,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from './components';
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
  const invalidatePurchaseQueries = useInvalidatePurchaseQueries();

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('posted');
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

  const saving = createDraft.isPending || createAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(purchaseDate, 'Purchase Date');
  const dateValidation = postingDateGuard.dateValidation;
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
  const newDisabled = postingDateGuard.disabled;
  const newDisabledReason = dateStatusMessage || 'Purchase Date is being checked.';

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
    setDueDate(addDays(purchaseDate, selectedSupplier.paymentTermsDays));
  }, [supplierId, selectedSupplier, paymentType, purchaseDate, isPurchaseDateValid]);

  useEffect(() => {
    if (supportQuery.error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(supportQuery.error, 'Unable to load purchase setup. Please refresh and try again.'),
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
    if (clearMessage) setMessage(null);
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
      setMessage({ kind: 'success', text: 'Purchase data refreshed successfully.' });
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to refresh purchase data.') });
    }
  }

  function printVoucher() {
    try {
      window.print();
    } catch (error) {
      setMessage({ kind: 'error', text: friendlyErrorMessage(error, 'Unable to print Purchase Voucher.') });
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
      const purchase = postNow
        ? await createAndPost.mutateAsync(payload)
        : await createDraft.mutateAsync(payload);
      await invalidatePurchaseQueries();
      resetForm(false);
      setMessage({
        kind: 'success',
        text: postNow
          ? `${purchase.purchase_number} saved and posted successfully.`
          : `${purchase.purchase_number} saved as Draft.`,
      });
    } catch (error) {
      setMessage({
        kind: 'error',
        text: friendlyErrorMessage(error, 'Unable to save Purchase Voucher.'),
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

  const actionDisabled = saving || supportQuery.isLoading || supportQuery.isError || postingDateGuard.disabled;

  if (viewMode === 'posted') {
    return (
      <PostedPurchasesView
        suppliers={suppliers}
        warehouses={warehouses}
        money={money}
        generalSettings={generalSettings}
        onNewPurchase={openNewPurchase}
        onAnalytics={() => setViewMode('analytics')}
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
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <PurchaseToolbar
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
      />

      <ConfirmDialog
        open={processConfirmOpen}
        title="Process Purchase Voucher?"
        message="This will save and post the Purchase Voucher. Posted documents cannot be edited directly."
        confirmLabel="Yes, Process"
        cancelLabel="No"
        variant="warning"
        loading={saving}
        onConfirm={() => savePurchase(true)}
        onCancel={() => setProcessConfirmOpen(false)}
      />

      {message && <PurchaseMessageBanner message={message} />}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto auto 1fr auto', gap: 7, overflow: 'hidden' }}>
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

        <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'visible' }}>
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
      </section>
    </main>
  );
}
