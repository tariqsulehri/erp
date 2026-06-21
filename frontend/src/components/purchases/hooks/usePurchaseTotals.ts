import { useMemo } from 'react';
import { numericValue } from '@/lib/erp-utils';
import type { PaymentType, PurchaseLine } from '../PurchaseVoucherTypes';

export interface PurchaseTotals {
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  freight: number;
  netAmount: number;
  balanceDue: number;
}

export function usePurchaseTotals(lines: PurchaseLine[], freightAmount: string, paymentType: PaymentType): PurchaseTotals {
  return useMemo(() => {
    const grossAmount = lines.reduce((sum, line) => sum + numericValue(line.quantity) * numericValue(line.purchasePrice), 0);
    const discountAmount = lines.reduce((sum, line) => sum + numericValue(line.discountAmount), 0);
    const taxAmount = lines.reduce((sum, line) => sum + numericValue(line.taxAmount), 0);
    const freight = numericValue(freightAmount);
    const netAmount = grossAmount - discountAmount + taxAmount + freight;

    return {
      grossAmount,
      discountAmount,
      taxAmount,
      freight,
      netAmount,
      balanceDue: paymentType === 'Cash' ? 0 : netAmount,
    };
  }, [freightAmount, lines, paymentType]);
}
