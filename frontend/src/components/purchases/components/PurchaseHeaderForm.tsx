'use client';

import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, SelectField, TextField } from '@/components/ui/FormFields';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { DocumentFormPanel } from '@/components/documents';
import type { SelectOption } from '@/components/ui/SearchableSelect';
import type { PaymentType, SupplierOption, WarehouseOption } from '../PurchaseVoucherTypes';

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
  /** Label of the stock place field: Warehouse for purchases, Branch for sales. */
  holderLabel?: string;
  /** Shows the stock place as a fixed value, e.g. a Branch user's own Branch. */
  holderReadOnly?: boolean;
  locationId?: string;
  showLocation?: boolean;
  referenceNumber: string;
  dueDate: string;
  generatedVoucherDetails: string;
  dateStatusMessage: string;
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  locations?: SelectOption[];
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
  holderLabel = 'Warehouse',
  holderReadOnly = false,
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
    <DocumentFormPanel columns={6} statusMessage={dateStatusMessage}>
      <TextField label={documentNumberLabel} value="Auto" disabled />
      <DateField label={documentDateLabel} required value={purchaseDate} onChange={onPurchaseDateChange} />
      <SelectField
        label="Payment Type"
        required
        value={paymentType}
        onChange={value => onPaymentTypeChange(value as PaymentType)}
        options={[{ value: 'Cash', label: 'Cash' }, { value: 'Credit', label: 'Credit' }]}
      />
      <div className="span-3">
        <FieldLabel label={partyLabel} required>
          <SearchableSelect value={supplierId} options={suppliers} onChange={onSupplierChange} placeholder={loadingSupportData ? `Loading ${partyLabel}s` : partyPlaceholder} disabled={loadingSupportData || supportDataHasError} />
        </FieldLabel>
      </div>

      <div className="span-2">
        {holderReadOnly ? (
          <TextField label={holderLabel} required value={warehouses.find(option => option.value === warehouseId)?.label ?? (loadingSupportData ? 'Loading…' : '')} disabled />
        ) : (
          <FieldLabel label={holderLabel} required>
            <SearchableSelect value={warehouseId} options={warehouses} onChange={onWarehouseChange} placeholder={loadingSupportData ? 'Loading…' : `Search ${holderLabel}`} disabled={loadingSupportData || supportDataHasError} />
          </FieldLabel>
        )}
      </div>
      {showLocation && (
        <FieldLabel label="Location">
          <SearchableSelect value={locationId} options={locations} onChange={value => onLocationChange?.(value)} placeholder="Optional Location" disabled={!warehouseId || loadingSupportData || supportDataHasError || locations.length === 0} />
        </FieldLabel>
      )}
      <DateField label={supplierDocumentDateLabel} value={supplierInvoiceDate} onChange={onSupplierInvoiceDateChange} />
      <TextField label={supplierDocumentNumberLabel} value={supplierInvoiceNumber} onChange={onSupplierInvoiceNumberChange} placeholder={supplierDocumentPlaceholder} />
      <TextField label="Reference Number" value={referenceNumber} onChange={onReferenceNumberChange} placeholder="Optional Reference" />
      {paymentType === 'Credit' && showDueDate ? (
        <DateField label="Due Date" value={dueDate} onChange={onDueDateChange} />
      ) : (
        <NumericField label={balanceLabel} value={balanceValue ?? money(0)} disabled />
      )}
      <div className={showLocation ? 'span-3' : 'span-all'}>
        <TextField label="Voucher Details" value={generatedVoucherDetails} disabled />
      </div>
    </DocumentFormPanel>
  );
}
