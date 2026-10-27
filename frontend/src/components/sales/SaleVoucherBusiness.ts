import { cleanNumber, numericValue } from '@/lib/erp-utils';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';
import { dateOnly, documentLinesFromDetail, textOrEmpty } from '@/components/purchases/PurchaseVoucherBusiness';
import type { BranchOption, CustomerOption, SaleLine, SalePaymentType } from './SaleVoucherTypes';

interface SaleValidationInput {
  saleDate: string;
  isSaleDateValid: boolean;
  postingDateError?: string;
  customerId: string;
  selectedCustomer?: CustomerOption;
  branchId: string;
  selectedBranch?: BranchOption;
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
  branchId: string;
  locationId: string;
  customerReferenceNumber: string;
  deliveryNoteNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: SaleLine[];
}

export function buildSaleDetails(selectedCustomer: CustomerOption | undefined, customerReferenceNumber: string, lineCount: number) {
  if (!selectedCustomer) return 'Details appear after you select a Customer.';

  return [
    `Sale to ${selectedCustomer.label.split(' - ').slice(1).join(' - ') || selectedCustomer.label}`,
    customerReferenceNumber ? `Ref ${customerReferenceNumber}` : '',
    lineCount > 0 ? `${lineCount} item${lineCount === 1 ? '' : 's'}` : '',
  ].filter(Boolean).join(' | ');
}

export function validateSaleVoucher(input: SaleValidationInput) {
  if (!input.saleDate) return 'Sale Date is required.';
  if (!input.isSaleDateValid) return 'Sale Date is not a correct date. Check the date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.customerId) return 'Customer is required.';
  if (!input.selectedCustomer) return 'The selected Customer is no longer available. Select it again.';
  if (!input.selectedCustomer.accountCode) return 'The selected Customer has no Linked Account. Set one up for this Customer first.';
  if (!input.branchId) return 'Branch is required.';
  if (!input.selectedBranch) return 'The selected Branch is no longer available or is Inactive. Select it again.';
  if (input.paymentType === 'Credit' && !input.dueDate) return 'Due Date is required for Credit sale.';
  if (input.paymentType === 'Credit' && input.dueDate < input.saleDate) return 'Due Date cannot be before Sale Date.';
  if (input.deliveryDate && input.deliveryDate < input.saleDate) return 'Delivery Date cannot be before Sale Date.';
  if (input.lines.length === 0) return 'Add at least one sale item.';
  if (input.freightAmount && !validMoneyPattern.test(cleanNumber(input.freightAmount))) return 'Freight is not a correct amount. Enter a number.';
  if (input.netAmount <= 0) return 'Net Amount must be more than zero.';
  return null;
}

export function buildSalePayload(input: SalePayloadInput) {
  return {
    sale_date: input.saleDate,
    customer_id: input.customerId,
    payment_type: input.paymentType,
    due_date: input.paymentType === 'Credit' ? input.dueDate : undefined,
    delivery_date: input.deliveryDate || undefined,
    branch_id: input.branchId,
    location_id: input.locationId || undefined,
    customer_reference_number: input.customerReferenceNumber || undefined,
    delivery_note_number: input.deliveryNoteNumber || undefined,
    description: input.generatedVoucherDetails,
    freight_amount: input.freight,
    lines: input.lines.map(line => ({
      item_id: line.itemId,
      quantity: numericValue(line.quantity),
      sale_price: numericValue(line.purchasePrice),
      discount_amount: numericValue(line.discountAmount),
      tax_amount: numericValue(line.taxAmount),
      description: line.description || undefined,
    })),
  };
}

/** The entry form values for a saved Draft sale, so it can be opened, changed and posted. */
export interface SaleDraftForm {
  id: string;
  saleNumber: string;
  saleDate: string;
  customerId: string;
  paymentType: SalePaymentType;
  dueDate: string;
  deliveryDate: string;
  branchId: string;
  locationId: string;
  customerReferenceNumber: string;
  deliveryNoteNumber: string;
  freightAmount: string;
  lines: SaleLine[];
}

/** Maps the sale detail from GET /sales/:id to the entry form. */
export function saleFormFromDetail(detail: Record<string, any>): SaleDraftForm {
  const freight = Number(detail.freight_amount ?? 0);
  return {
    id: String(detail.id),
    saleNumber: String(detail.sale_number),
    saleDate: dateOnly(detail.sale_date),
    customerId: textOrEmpty(detail.customer_id),
    paymentType: detail.payment_type === 'Credit' ? 'Credit' : 'Cash',
    dueDate: dateOnly(detail.due_date),
    deliveryDate: dateOnly(detail.delivery_date),
    branchId: textOrEmpty(detail.branch_id),
    locationId: textOrEmpty(detail.location_id),
    customerReferenceNumber: textOrEmpty(detail.customer_reference_number),
    deliveryNoteNumber: textOrEmpty(detail.delivery_note_number),
    freightAmount: freight > 0 ? freight.toFixed(2) : '',
    lines: documentLinesFromDetail(detail.lines, 'sale_price'),
  };
}
