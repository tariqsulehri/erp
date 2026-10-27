import type { PaymentType, PurchaseLine, SupplierOption, WarehouseOption } from '@/components/purchases/PurchaseVoucherTypes';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';
import { dateOnly, documentLinesFromDetail, textOrEmpty } from '@/components/purchases/PurchaseVoucherBusiness';

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
  if (!selectedSupplier) return 'Details appear after you select a Supplier.';
  const parts = [
    `Purchase return to ${selectedSupplier.label.split(' - ').slice(1).join(' - ') || selectedSupplier.label}`,
    supplierReturnNumber ? `Supplier Return ${supplierReturnNumber}` : '',
    `${lineCount} item${lineCount === 1 ? '' : 's'}`,
  ].filter(Boolean);
  return parts.join(' | ');
}

export function validatePurchaseReturnVoucher(input: PurchaseReturnValidationInput) {
  if (!input.purchaseReturnDate) return 'Purchase Return Date is required.';
  if (!input.isPurchaseReturnDateValid) return 'Purchase Return Date is not a correct date. Check the date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.supplierId || !input.selectedSupplier) return 'Supplier is required.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.supplierReturnDate && input.supplierReturnDate > input.purchaseReturnDate) {
    return 'Supplier Return Date cannot be after Purchase Return Date.';
  }
  if (input.lines.length === 0) return 'Add at least one purchase return item.';
  if (!validMoneyPattern.test(input.freightAmount || '0')) return 'Freight is not a correct amount. Enter a number.';
  if (input.netAmount <= 0) return 'Net Amount must be more than zero.';
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

/** The entry form values for a saved Draft purchase return, so it can be opened, changed and posted. */
export interface PurchaseReturnDraftForm {
  id: string;
  purchaseReturnNumber: string;
  purchaseReturnDate: string;
  supplierId: string;
  paymentType: PaymentType;
  supplierReturnNumber: string;
  supplierReturnDate: string;
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  freightAmount: string;
  lines: PurchaseLine[];
}

/** Maps the purchase return detail from GET /purchase-returns/:id to the entry form. */
export function purchaseReturnFormFromDetail(detail: Record<string, any>): PurchaseReturnDraftForm {
  const freight = Number(detail.freight_amount ?? 0);
  return {
    id: String(detail.id),
    purchaseReturnNumber: String(detail.purchase_return_number),
    purchaseReturnDate: dateOnly(detail.purchase_return_date),
    supplierId: textOrEmpty(detail.supplier_id),
    paymentType: detail.payment_type === 'Cash' ? 'Cash' : 'Credit',
    supplierReturnNumber: textOrEmpty(detail.supplier_return_number),
    supplierReturnDate: dateOnly(detail.supplier_return_date),
    warehouseId: textOrEmpty(detail.warehouse_id),
    locationId: textOrEmpty(detail.location_id),
    referenceNumber: textOrEmpty(detail.reference_number),
    freightAmount: freight > 0 ? freight.toFixed(2) : '',
    lines: documentLinesFromDetail(detail.lines, 'purchase_price'),
  };
}
