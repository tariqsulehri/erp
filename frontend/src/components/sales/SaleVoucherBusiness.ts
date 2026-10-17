import { cleanNumber, numericValue } from '@/lib/erp-utils';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';
import type { CustomerOption, SaleLine, SalePaymentType, WarehouseOption } from './SaleVoucherTypes';

interface SaleValidationInput {
  saleDate: string;
  isSaleDateValid: boolean;
  postingDateError?: string;
  customerId: string;
  selectedCustomer?: CustomerOption;
  warehouseId: string;
  locationId: string;
  selectedWarehouse?: WarehouseOption;
  paymentType: SalePaymentType;
  dueDate: string;
  deliveryDate: string;
  lines: SaleLine[];
  freightAmount: string;
  netAmount: number;
}

interface SalePayloadInput {
  saleDate: string;
  customerId: string;
  paymentType: SalePaymentType;
  dueDate: string;
  deliveryDate: string;
  warehouseId: string;
  locationId: string;
  customerReferenceNumber: string;
  deliveryNoteNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: SaleLine[];
}

export function buildSaleDetails(selectedCustomer: CustomerOption | undefined, customerReferenceNumber: string, lineCount: number) {
  if (!selectedCustomer) return 'Sale details will be generated after selecting Customer.';

  return [
    `Sale to ${selectedCustomer.label.split(' - ').slice(1).join(' - ') || selectedCustomer.label}`,
    customerReferenceNumber ? `Ref ${customerReferenceNumber}` : '',
    lineCount > 0 ? `${lineCount} item${lineCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' | ');
}

export function validateSaleVoucher(input: SaleValidationInput) {
  if (!input.saleDate) return 'Sale Date is required.';
  if (!input.isSaleDateValid) return 'Sale Date is not a valid date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.customerId) return 'Customer is required.';
  if (!input.selectedCustomer) return 'Selected Customer was not found. Please select it again.';
  if (!input.selectedCustomer.accountCode) return 'Selected Customer does not have a Linked Account.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.paymentType === 'Credit' && !input.dueDate) return 'Due Date is required for Credit sale.';
  if (input.paymentType === 'Credit' && input.dueDate < input.saleDate) return 'Due Date cannot be before Sale Date.';
  if (input.deliveryDate && input.deliveryDate < input.saleDate) return 'Delivery Date cannot be before Sale Date.';
  if (input.lines.length === 0) return 'Add at least one sale item.';
  if (input.freightAmount && !validMoneyPattern.test(cleanNumber(input.freightAmount))) return 'Freight must be a valid amount.';
  if (input.netAmount <= 0) return 'Net Amount must be greater than zero.';
  return null;
}

export function buildSalePayload(input: SalePayloadInput) {
  return {
    sale_date: input.saleDate,
    customer_id: input.customerId,
    payment_type: input.paymentType,
    due_date: input.paymentType === 'Credit' ? input.dueDate : undefined,
    delivery_date: input.deliveryDate || undefined,
    warehouse_id: input.warehouseId,
    location_id: input.locationId || undefined,
    customer_reference_number: input.customerReferenceNumber || undefined,
    delivery_note_number: input.deliveryNoteNumber || undefined,
    description: input.generatedVoucherDetails,
    freight_amount: input.freight,
    lines: input.lines.map(line => ({
      item_id: line.itemId,
      warehouse_id: input.warehouseId,
      quantity: numericValue(line.quantity),
      sale_price: numericValue(line.purchasePrice),
      discount_amount: numericValue(line.discountAmount),
      tax_amount: numericValue(line.taxAmount),
      description: line.description || undefined,
    })),
  };
}
