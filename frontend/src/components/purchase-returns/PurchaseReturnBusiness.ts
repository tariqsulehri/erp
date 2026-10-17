import type { PaymentType, PurchaseLine, SupplierOption, WarehouseOption } from '@/components/purchases/PurchaseVoucherTypes';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';

interface PurchaseReturnValidationInput {
  purchaseReturnDate: string;
  isPurchaseReturnDateValid: boolean;
  postingDateError?: string;
  supplierId: string;
  selectedSupplier?: SupplierOption;
  warehouseId: string;
  locationId: string;
  selectedWarehouse?: WarehouseOption;
  paymentType: PaymentType;
  supplierReturnDate: string;
  lines: PurchaseLine[];
  freightAmount: string;
  netAmount: number;
}

interface PurchaseReturnPayloadInput {
  purchaseReturnDate: string;
  supplierId: string;
  supplierReturnNumber: string;
  supplierReturnDate: string;
  paymentType: PaymentType;
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: PurchaseLine[];
}

export function buildPurchaseReturnDetails(selectedSupplier: SupplierOption | undefined, supplierReturnNumber: string, lineCount: number) {
  if (!selectedSupplier) return 'Purchase return details will be generated after selecting Supplier.';
  const parts = [
    `Purchase return to ${selectedSupplier.label.split(' - ').slice(1).join(' - ') || selectedSupplier.label}`,
    supplierReturnNumber ? `Supplier Return ${supplierReturnNumber}` : '',
    `${lineCount} item${lineCount === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

export function validatePurchaseReturnVoucher(input: PurchaseReturnValidationInput) {
  if (!input.purchaseReturnDate) return 'Purchase Return Date is required.';
  if (!input.isPurchaseReturnDateValid) return 'Purchase Return Date is not a valid date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.supplierId || !input.selectedSupplier) return 'Supplier is required.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.supplierReturnDate && input.supplierReturnDate > input.purchaseReturnDate) {
    return 'Supplier Return Date cannot be after Purchase Return Date.';
  }
  if (input.lines.length === 0) return 'Add at least one purchase return item.';
  if (!validMoneyPattern.test(input.freightAmount || '0')) return 'Freight must be a valid amount.';
  if (input.netAmount <= 0) return 'Net Amount must be greater than zero.';
  return '';
}

export function buildPurchaseReturnPayload(input: PurchaseReturnPayloadInput) {
  return {
    purchase_return_date: input.purchaseReturnDate,
    supplier_id: input.supplierId,
    supplier_return_number: input.supplierReturnNumber || undefined,
    supplier_return_date: input.supplierReturnDate || undefined,
    payment_type: input.paymentType,
    warehouse_id: input.warehouseId,
    location_id: input.locationId || undefined,
    reference_number: input.referenceNumber || undefined,
    description: input.generatedVoucherDetails,
    freight_amount: input.freight,
    lines: input.lines.map(line => ({
      item_id: line.itemId,
      warehouse_id: input.warehouseId,
      quantity: Number(line.quantity.replace(/,/g, '')),
      purchase_price: Number(line.purchasePrice.replace(/,/g, '')),
      discount_amount: Number(line.discountAmount.replace(/,/g, '') || 0),
      tax_amount: Number(line.taxAmount.replace(/,/g, '') || 0),
      description: line.description || undefined,
    })),
  };
}
