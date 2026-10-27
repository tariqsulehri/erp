import { numericValue } from '@/lib/erp-utils';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';
import { dateOnly, documentLinesFromDetail, textOrEmpty } from '@/components/purchases/PurchaseVoucherBusiness';
import type { BranchOption, CustomerOption, SaleLine, SalePaymentType } from '@/components/sales/SaleVoucherTypes';

interface SaleReturnValidationInput {
  saleReturnDate: string;
  isSaleReturnDateValid: boolean;
  postingDateError?: string;
  customerId: string;
  selectedCustomer?: CustomerOption;
  branchId: string;
  selectedBranch?: BranchOption;
  customerReturnDate: string;
  lines: SaleLine[];
  freightAmount: string;
  netAmount: number;
}

interface SaleReturnPayloadInput {
  saleReturnDate: string;
  customerId: string;
  customerReturnNumber: string;
  customerReturnDate: string;
  paymentType: SalePaymentType;
  branchId: string;
  locationId: string;
  referenceNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: SaleLine[];
}

export function buildSaleReturnDetails(selectedCustomer: CustomerOption | undefined, customerReturnNumber: string, lineCount: number) {
  if (!selectedCustomer) return 'Details appear after you select a Customer.';
  return [
    `Sale return from ${selectedCustomer.label.split(' - ').slice(1).join(' - ') || selectedCustomer.label}`,
    customerReturnNumber ? `Customer Return ${customerReturnNumber}` : '',
    `${lineCount} item${lineCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' | ');
}

export function validateSaleReturnVoucher(input: SaleReturnValidationInput) {
  if (!input.saleReturnDate) return 'Sale Return Date is required.';
  if (!input.isSaleReturnDateValid) return 'Sale Return Date is not a correct date. Check the date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.customerId || !input.selectedCustomer) return 'Customer is required.';
  if (!input.selectedCustomer.accountCode) return 'The selected Customer has no Linked Account. Set one up for this Customer first.';
  if (!input.branchId) return 'Branch is required.';
  if (!input.selectedBranch) return 'The selected Branch is no longer available or is Inactive. Select it again.';
  if (input.customerReturnDate && input.customerReturnDate > input.saleReturnDate) {
    return 'Customer Return Date cannot be after Sale Return Date.';
  }
  if (input.lines.length === 0) return 'Add at least one sale return item.';
  if (!validMoneyPattern.test(input.freightAmount || '0')) return 'Freight is not a correct amount. Enter a number.';
  if (input.netAmount <= 0) return 'Net Amount must be more than zero.';
  return '';
}

export function buildSaleReturnPayload(input: SaleReturnPayloadInput) {
  return {
    sale_return_date: input.saleReturnDate,
    customer_id: input.customerId,
    customer_return_number: input.customerReturnNumber || undefined,
    customer_return_date: input.customerReturnDate || undefined,
    payment_type: input.paymentType,
    branch_id: input.branchId,
    location_id: input.locationId || undefined,
    reference_number: input.referenceNumber || undefined,
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

/** The entry form values for a saved Draft sale return, so it can be opened, changed and posted. */
export interface SaleReturnDraftForm {
  id: string;
  saleReturnNumber: string;
  saleReturnDate: string;
  customerId: string;
  paymentType: SalePaymentType;
  customerReturnNumber: string;
  customerReturnDate: string;
  branchId: string;
  locationId: string;
  referenceNumber: string;
  freightAmount: string;
  lines: SaleLine[];
}

/** Maps the sale return detail from GET /sale-returns/:id to the entry form. */
export function saleReturnFormFromDetail(detail: Record<string, any>): SaleReturnDraftForm {
  const freight = Number(detail.freight_amount ?? 0);
  return {
    id: String(detail.id),
    saleReturnNumber: String(detail.sale_return_number),
    saleReturnDate: dateOnly(detail.sale_return_date),
    customerId: textOrEmpty(detail.customer_id),
    paymentType: detail.payment_type === 'Cash' ? 'Cash' : 'Credit',
    customerReturnNumber: textOrEmpty(detail.customer_return_number),
    customerReturnDate: dateOnly(detail.customer_return_date),
    branchId: textOrEmpty(detail.branch_id),
    locationId: textOrEmpty(detail.location_id),
    referenceNumber: textOrEmpty(detail.reference_number),
    freightAmount: freight > 0 ? freight.toFixed(2) : '',
    lines: documentLinesFromDetail(detail.lines, 'sale_price'),
  };
}
