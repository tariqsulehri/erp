import { cleanNumber, numericValue } from '@/lib/erp-utils';
import { validMoneyPattern } from './PurchaseVoucherHelpers';
import type { PaymentType, PurchaseLine, SupplierOption, WarehouseOption } from './PurchaseVoucherTypes';

interface PurchaseValidationInput {
  purchaseDate: string;
  isPurchaseDateValid: boolean;
  postingDateError?: string;
  supplierId: string;
  selectedSupplier?: SupplierOption;
  warehouseId: string;
  locationId: string;
  selectedWarehouse?: WarehouseOption;
  paymentType: PaymentType;
  dueDate: string;
  supplierInvoiceDate: string;
  lines: PurchaseLine[];
  freightAmount: string;
  netAmount: number;
}

interface PurchasePayloadInput {
  purchaseDate: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  paymentType: PaymentType;
  dueDate: string;
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: PurchaseLine[];
}

export function buildPurchaseDetails(selectedSupplier: SupplierOption | undefined, supplierInvoiceNumber: string, lineCount: number) {
  if (!selectedSupplier) return 'Purchase details will be generated after selecting Supplier.';

  return [
    `Purchase from ${selectedSupplier.label.split(' - ').slice(1).join(' - ') || selectedSupplier.label}`,
    supplierInvoiceNumber ? `Bill ${supplierInvoiceNumber}` : '',
    lineCount > 0 ? `${lineCount} item${lineCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' | ');
}

export function validatePurchaseVoucher(input: PurchaseValidationInput) {
  if (!input.purchaseDate) return 'Purchase Date is required.';
  if (!input.isPurchaseDateValid) return 'Purchase Date is not a valid date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.supplierId) return 'Supplier is required.';
  if (!input.selectedSupplier) return 'Selected Supplier was not found. Please select it again.';
  if (!input.selectedSupplier.accountCode) return 'Selected Supplier does not have a Linked Account.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.paymentType === 'Credit' && !input.dueDate) return 'Due Date is required for Credit purchase.';
  if (input.paymentType === 'Credit' && input.dueDate < input.purchaseDate) return 'Due Date cannot be before Purchase Date.';
  if (input.supplierInvoiceDate && input.supplierInvoiceDate > input.purchaseDate) return 'Supplier Invoice Date cannot be after Purchase Date.';
  if (input.lines.length === 0) return 'Add at least one purchase item.';
  if (input.freightAmount && !validMoneyPattern.test(cleanNumber(input.freightAmount))) return 'Freight must be a valid amount.';
  if (input.netAmount <= 0) return 'Net Amount must be greater than zero.';
  return null;
}

export function buildPurchasePayload(input: PurchasePayloadInput) {
  return {
    purchase_date: input.purchaseDate,
    supplier_id: input.supplierId,
    supplier_invoice_number: input.supplierInvoiceNumber || undefined,
    supplier_invoice_date: input.supplierInvoiceDate || undefined,
    payment_type: input.paymentType,
    due_date: input.paymentType === 'Credit' ? input.dueDate : undefined,
    warehouse_id: input.warehouseId,
    location_id: input.locationId || undefined,
    reference_number: input.referenceNumber || undefined,
    description: input.generatedVoucherDetails,
    freight_amount: input.freight,
    lines: input.lines.map(line => ({
      item_id: line.itemId,
      warehouse_id: input.warehouseId,
      quantity: numericValue(line.quantity),
      purchase_price: numericValue(line.purchasePrice),
      discount_amount: numericValue(line.discountAmount),
      tax_amount: numericValue(line.taxAmount),
      description: line.description || undefined,
    })),
  };
}
