import Decimal from 'decimal.js';
import { decimal } from '@/lib/erp-utils';
import type { AddLineDraft } from './PurchaseVoucherTypes';

export const validMoneyPattern = /^\d+(\.\d{1,2})?$/;
export const validQuantityPattern = /^\d+(\.\d{1,4})?$/;

export const today = () => new Date().toISOString().slice(0, 10);

export const initialPurchaseLineDraft = (): AddLineDraft => ({
  itemId: '',
  quantity: '',
  purchasePrice: '',
  discountAmount: '',
  taxAmount: '',
  description: '',
});

export function calculatePurchaseLineTotal(quantity: string, price: string, discount: string, tax: string) {
  return decimal(quantity).times(decimal(price)).minus(decimal(discount)).plus(decimal(tax));
}

export function calculatePurchaseTaxAmount(quantity: string, price: string, discount: string, taxRate: string) {
  const taxableAmount = decimal(quantity).times(decimal(price)).minus(decimal(discount));
  if (taxableAmount.lte(0)) return '';

  // Taxes are calculated after line discount so the visible line total matches posting.
  const tax = taxableAmount.times(decimal(taxRate)).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return tax.gt(0) ? tax.toFixed(2) : '';
}
