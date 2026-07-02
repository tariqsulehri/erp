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
  PurchaseMessageBanner,
  PurchaseSummaryFooter,
  PurchaseToolbar,
} from '@/components/purchases/components';
import { usePurchaseLineEditor } from '@/components/purchases/hooks/usePurchaseLineEditor';
import { usePurchaseTotals } from '@/components/purchases/hooks/usePurchaseTotals';
import { today } from '@/components/purchases/PurchaseVoucherHelpers';
import { useSaleSupportOptions } from './hooks/useSaleSupportOptions';
import type { SaleMessageKind, SalePaymentType } from './SaleVoucherTypes';

export default function SaleVoucherPage() {
  const { data: generalSettings } = useGeneralSettings();
  const supportQuery = useSaleSupportData();
  const createDraft = useCreateSaleDraft();
  const createAndPost = useCreateAndPostSale();
  const invalidateSaleQueries = useInvalidateSaleQueries();

  const [viewMode, setViewMode] = useState<'posted' | 'entry' | 'analytics'>('posted');
  const [saleDate, setSaleDate] = useState(today());
  const [customerId, setCustomerId] = useState('');
  const [paymentType, setPaymentType] = useState<SalePaymentType>('Cash');
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [customerReferenceNumber, setCustomerReferenceNumber] = useState('');
  const [deliveryNoteNumber, setDeliveryNoteNumber] = useState('');
  const [freightAmount, setFreightAmount] = useState('');
  const [message, setMessage] = useState<{ kind: SaleMessageKind; text: string } | null>(null);
  const [processConfirmOpen, setProcessConfirmOpen] = useState(false);

  const saving = createDraft.isPending || createAndPost.isPending;
  const postingDateGuard = usePostingDateGuard(saleDate, 'Sale Date');
  const dateValidation = postingDateGuard.dateValidation;
  const isSaleDateValid = postingDateGuard.dateIsValid;
  const money = useMemo(() => (value: number) => formatMoney(value, generalSettings), [generalSettings]);
  const { customers, items, warehouses, locations } = useSaleSupportOptions(supportQuery.data);
  const selectedCustomer = customers.find(customer => customer.value === customerId);
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

  const totals = usePurchaseTotals(lines, freightAmount, paymentType);
  const generatedVoucherDetails = buildSaleDetails(selectedCustomer, customerReferenceNumber, lines.length);
  const dateStatusMessage = postingDateGuard.isChecking ? 'Checking Sale Date...' : postingDateGuard.statusMessage;
  const newDisabled = postingDateGuard.disabled;
  const newDisabledReason = dateStatusMessage || 'Sale Date is being checked.';

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
    setWarehouseId(warehouses.find(warehouse => warehouse.isDefault)?.value ?? warehouses[0]?.value ?? '');
    setLocationId('');
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
      warehouseId,
      locationId,
      selectedWarehouse,
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
      warehouseId,
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

  if (viewMode === 'posted') {
    return (
      <PostedSalesView
        customers={customers}
        warehouses={warehouses}
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
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
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

      {message && <PurchaseMessageBanner message={message} />}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto 1fr auto', gap: 7, overflow: 'hidden' }}>
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
          warehouseId={warehouseId}
          locationId={locationId}
          showLocation={Boolean(selectedWarehouse?.useLocations)}
          referenceNumber={customerReferenceNumber}
          dueDate={dueDate}
          generatedVoucherDetails={generatedVoucherDetails}
          dateStatusMessage={dateStatusMessage}
          suppliers={customers}
          warehouses={warehouses}
          locations={warehouseLocations}
          loadingSupportData={supportQuery.isLoading}
          supportDataHasError={supportQuery.isError}
          money={money}
          onPurchaseDateChange={setSaleDate}
          onPaymentTypeChange={value => setPaymentType(value as SalePaymentType)}
          onSupplierInvoiceDateChange={setDeliveryDate}
          onSupplierInvoiceNumberChange={setDeliveryNoteNumber}
          onSupplierChange={setCustomerId}
          onWarehouseChange={value => {
            setWarehouseId(value);
            setLocationId('');
          }}
          onLocationChange={setLocationId}
          onReferenceNumberChange={setCustomerReferenceNumber}
          onDueDateChange={setDueDate}
        />

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

        <PurchaseLineTable
          priceColumnLabel="Sale Price"
          lines={lines}
          generalSettings={generalSettings}
          money={money}
          onMoveLine={moveLine}
          onEditLine={editLine}
          onRemoveLine={removeLine}
        />

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
      </section>
    </main>
  );
}
