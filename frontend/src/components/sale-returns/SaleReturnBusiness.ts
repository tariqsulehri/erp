import { numericValue } from '@/lib/erp-utils';
import { validMoneyPattern } from '@/components/purchases/PurchaseVoucherHelpers';
import type { CustomerOption, SaleLine, SalePaymentType, WarehouseOption } from '@/components/sales/SaleVoucherTypes';

interface SaleReturnValidationInput {
  saleReturnDate: string;
  isSaleReturnDateValid: boolean;
  postingDateError?: string;
  customerId: string;
  selectedCustomer?: CustomerOption;
  warehouseId: string;
  locationId: string;
  selectedWarehouse?: WarehouseOption;
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
  warehouseId: string;
  locationId: string;
  referenceNumber: string;
  generatedVoucherDetails: string;
  freight: number;
  lines: SaleLine[];
}

export function buildSaleReturnDetails(selectedCustomer: CustomerOption | undefined, customerReturnNumber: string, lineCount: number) {
  if (!selectedCustomer) return 'Sale return details will be generated after selecting Customer.';
  return [
    `Sale return from ${selectedCustomer.label.split(' - ').slice(1).join(' - ') || selectedCustomer.label}`,
    customerReturnNumber ? `Customer Return ${customerReturnNumber}` : '',
    `${lineCount} item${lineCount === 1 ? '' : 's'}`,
  ].filter(Boolean).join(' | ');
}

export function validateSaleReturnVoucher(input: SaleReturnValidationInput) {
  if (!input.saleReturnDate) return 'Sale Return Date is required.';
  if (!input.isSaleReturnDateValid) return 'Sale Return Date is not a valid date.';
  if (input.postingDateError) return input.postingDateError;
  if (!input.customerId || !input.selectedCustomer) return 'Customer is required.';
  if (!input.selectedCustomer.accountCode) return 'Selected Customer does not have a Linked Account.';
  if (!input.warehouseId) return 'Warehouse is required.';
  if (input.selectedWarehouse?.useLocations && !input.locationId) return 'Location is required for this Warehouse.';
  if (input.customerReturnDate && input.customerReturnDate > input.saleReturnDate) {
    return 'Customer Return Date cannot be after Sale Return Date.';
  }
  if (input.lines.length === 0) return 'Add at least one sale return item.';
  if (!validMoneyPattern.test(input.freightAmount || '0')) return 'Freight must be a valid amount.';
  if (input.netAmount <= 0) return 'Net Amount must be greater than zero.';
  return '';
}

export function buildSaleReturnPayload(input: SaleReturnPayloadInput) {
  return {
    sale_return_date: input.saleReturnDate,
    customer_id: input.customerId,
    customer_return_number: input.customerReturnNumber || undefined,
    customer_return_date: input.customerReturnDate || undefined,
    payment_type: input.paymentType,
    warehouse_id: input.warehouseId,
    location_id: input.locationId || undefined,
    reference_number: input.referenceNumber || undefined,
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
