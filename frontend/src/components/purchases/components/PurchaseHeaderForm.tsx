'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { dateMessageStyle } from '../PurchaseVoucherStyles';
import type { LocationOption, PaymentType, SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

interface PurchaseHeaderFormProps {
  documentNumberLabel?: string;
  documentDateLabel?: string;
  supplierDocumentDateLabel?: string;
  supplierDocumentNumberLabel?: string;
  supplierDocumentPlaceholder?: string;
  partyLabel?: string;
  partyPlaceholder?: string;
  showDueDate?: boolean;
  balanceLabel?: string;
  balanceValue?: string;
  purchaseDate: string;
  paymentType: PaymentType;
  supplierInvoiceDate: string;
  supplierInvoiceNumber: string;
  supplierId: string;
  warehouseId: string;
  locationId?: string;
  showLocation?: boolean;
  referenceNumber: string;
  dueDate: string;
  generatedVoucherDetails: string;
  dateStatusMessage: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  locations?: LocationOption[];
  loadingSupportData: boolean;
  supportDataHasError: boolean;
  money: (value: number) => string;
  onPurchaseDateChange: (value: string) => void;
  onPaymentTypeChange: (value: PaymentType) => void;
  onSupplierInvoiceDateChange: (value: string) => void;
  onSupplierInvoiceNumberChange: (value: string) => void;
  onSupplierChange: (value: string) => void;
  onWarehouseChange: (value: string) => void;
  onLocationChange?: (value: string) => void;
  onReferenceNumberChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
}

export function PurchaseHeaderForm({
  documentNumberLabel = 'Purchase Number',
  documentDateLabel = 'Purchase Date',
  supplierDocumentDateLabel = 'Bill Date',
  supplierDocumentNumberLabel = 'Supplier Bill No.',
  supplierDocumentPlaceholder = 'Bill No.',
  partyLabel = 'Supplier',
  partyPlaceholder = 'Search Supplier',
  showDueDate = true,
  balanceLabel = 'Balance Due',
  balanceValue,
  purchaseDate,
  paymentType,
  supplierInvoiceDate,
  supplierInvoiceNumber,
  supplierId,
  warehouseId,
  locationId = '',
  showLocation = false,
  referenceNumber,
  dueDate,
  generatedVoucherDetails,
  dateStatusMessage,
  suppliers,
  warehouses,
  locations = [],
  loadingSupportData,
  supportDataHasError,
  money,
  onPurchaseDateChange,
  onPaymentTypeChange,
  onSupplierInvoiceDateChange,
  onSupplierInvoiceNumberChange,
  onSupplierChange,
  onWarehouseChange,
  onLocationChange,
  onReferenceNumberChange,
  onDueDateChange,
}: PurchaseHeaderFormProps) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 130px 120px 145px 150px minmax(260px, 1fr)', gap: 8, alignItems: 'end' }}>
        <TextField label={documentNumberLabel} value="Auto" disabled />
        <DateField label={documentDateLabel} required value={purchaseDate} onChange={onPurchaseDateChange} />
        <SelectField
          label="Payment Type"
          required
          value={paymentType}
          onChange={value => onPaymentTypeChange(value as PaymentType)}
          options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]}
        />
        <DateField label={supplierDocumentDateLabel} value={supplierInvoiceDate} onChange={onSupplierInvoiceDateChange} />
        <TextField label={supplierDocumentNumberLabel} value={supplierInvoiceNumber} onChange={onSupplierInvoiceNumberChange} placeholder={supplierDocumentPlaceholder} />
        <FieldLabel label={partyLabel} required>
          <SearchableSelect value={supplierId} options={suppliers} onChange={onSupplierChange} placeholder={loadingSupportData ? `Loading ${partyLabel}s` : partyPlaceholder} disabled={loadingSupportData || supportDataHasError} />
        </FieldLabel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: showLocation ? 'minmax(230px, 0.85fr) minmax(170px, 0.65fr) minmax(180px, 0.7fr) 145px minmax(320px, 1.5fr)' : 'minmax(230px, 0.9fr) minmax(190px, 0.7fr) 145px minmax(360px, 1.8fr)', gap: 8, alignItems: 'end' }}>
        <FieldLabel label="Warehouse" required>
          <SearchableSelect value={warehouseId} options={warehouses} onChange={onWarehouseChange} placeholder={loadingSupportData ? 'Loading Warehouses' : 'Search Warehouse'} disabled={loadingSupportData || supportDataHasError} />
        </FieldLabel>
        {showLocation && (
          <FieldLabel label="Location">
            <SearchableSelect value={locationId} options={locations} onChange={value => onLocationChange?.(value)} placeholder="Optional Location" disabled={!warehouseId || loadingSupportData || supportDataHasError || locations.length === 0} />
          </FieldLabel>
        )}
        <TextField label="Reference Number" value={referenceNumber} onChange={onReferenceNumberChange} placeholder="Optional Reference" />
        {paymentType === 'Credit' && showDueDate ? (
          <DateField label="Due Date" value={dueDate} onChange={onDueDateChange} />
        ) : (
          <NumericField label={balanceLabel} value={balanceValue ?? money(0)} disabled />
        )}
        <TextField label="Voucher Details" value={generatedVoucherDetails} disabled />
      </div>

      <div style={dateMessageStyle}>{dateStatusMessage}</div>
    </>
  );
}
