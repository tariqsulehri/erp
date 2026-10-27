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

/** The entry form values for a saved Draft purchase, so it can be opened, changed and posted. */
export interface PurchaseDraftForm {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  supplierId: string;
  paymentType: PaymentType;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  dueDate: string;
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  freightAmount: string;
  lines: PurchaseLine[];
}

/** Date columns arrive as 'YYYY-MM-DD' or as an ISO time at midnight UTC; the form needs 'YYYY-MM-DD'. */
function dateOnly(value: unknown) {
  return typeof value === 'string' && value.length >= 10 ? value.slice(0, 10) : '';
}

function textOrEmpty(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

/** Maps the purchase detail from GET /purchases/:id to the entry form. */
export function purchaseFormFromDetail(detail: Record<string, any>): PurchaseDraftForm {
  const freight = Number(detail.freight_amount ?? 0);
  return {
    id: String(detail.id),
    purchaseNumber: String(detail.purchase_number),
    purchaseDate: dateOnly(detail.purchase_date),
    supplierId: textOrEmpty(detail.supplier_id),
    paymentType: detail.payment_type === 'Credit' ? 'Credit' : 'Cash',
    supplierInvoiceNumber: textOrEmpty(detail.supplier_invoice_number),
    supplierInvoiceDate: dateOnly(detail.supplier_invoice_date),
    dueDate: dateOnly(detail.due_date),
    warehouseId: textOrEmpty(detail.warehouse_id),
    locationId: textOrEmpty(detail.location_id),
    referenceNumber: textOrEmpty(detail.reference_number),
    freightAmount: freight > 0 ? freight.toFixed(2) : '',
    lines: [...(detail.lines ?? [])]
      .sort((left, right) => Number(left.line_number) - Number(right.line_number))
      .map((line, index): PurchaseLine => ({
        id: index + 1,
        itemId: String(line.item_id),
        itemCode: textOrEmpty(line.item_code),
        itemName: textOrEmpty(line.item_name),
        uomName: textOrEmpty(line.uom_name),
        quantity: Number(line.quantity).toFixed(4),
        purchasePrice: Number(line.purchase_price).toFixed(2),
        discountAmount: Number(line.discount_amount ?? 0).toFixed(2),
        taxAmount: Number(line.tax_amount ?? 0).toFixed(2),
        lineTotal: Number(line.line_total),
        description: textOrEmpty(line.description),
      })),
  };
}

export function buildPurchaseDetails(selectedSupplier: SupplierOption | undefined, supplierInvoiceNumber: string, lineCount: number) {
  if (!selectedSupplier) return 'Details appear after you select a Supplier.';

  return [
    `Purchase from ${selectedSupplier.label.split(' - ').slice(1).join(' - ') || selectedSupplier.label}`,
    supplierInvoiceNumber ? `Bill ${supplierInvoiceNumber}` : '',
    lineCount > 0 ? `${lineCount} item${lineCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' | ');
}

export function validatePurchaseVoucher(input: PurchaseValidationInput) {
  if (!input.purchaseDate) return 'Purchase Date is required.';
  if (!input.isPurchaseDateValid) return 'Purchase Date is not a correct date. Check the date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.supplierId) return 'Supplier is required.';
  if (!input.selectedSupplier) return 'The selected Supplier is no longer available. Select it again.';
  if (!input.selectedSupplier.accountCode) return 'The selected Supplier has no Linked Account. Set one up for this Supplier first.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.paymentType === 'Credit' && !input.dueDate) return 'Due Date is required for a Credit purchase.';
  if (input.paymentType === 'Credit' && input.dueDate < input.purchaseDate) return 'Due Date cannot be before Purchase Date.';
  if (input.supplierInvoiceDate && input.supplierInvoiceDate > input.purchaseDate) return 'Bill Date cannot be after Purchase Date.';
  if (input.lines.length === 0) return 'Add at least one purchase item.';
  if (input.freightAmount && !validMoneyPattern.test(cleanNumber(input.freightAmount))) return 'Freight is not a correct amount. Enter a number.';
  if (input.netAmount <= 0) return 'Net Amount must be more than zero.';
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
