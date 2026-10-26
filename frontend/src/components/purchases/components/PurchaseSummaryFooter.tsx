'use client';

import { cleanNumber, formatAmountInput } from '@/lib/erp-utils';
import { DocumentSummary, SummaryAmount, SummaryAmountInput } from '@/components/documents';

interface PurchaseSummaryFooterProps {
  freightLabel?: string;
  balanceLabel?: string;
  totalItems: number;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  freightAmount: string;
  netAmount: number;
  balanceDue: number;
  generalSettings: any;
  money: (value: number) => string;
  onFreightAmountChange: (value: string) => void;
}

export function PurchaseSummaryFooter({
  freightLabel = 'Freight',
  balanceLabel = 'Balance Due',
  totalItems,
  grossAmount,
  discountAmount,
  taxAmount,
  freightAmount,
  netAmount,
  balanceDue,
  generalSettings,
  money,
  onFreightAmountChange,
}: PurchaseSummaryFooterProps) {
  return (
    <DocumentSummary countLabel="Total Items" count={totalItems}>
      <SummaryAmount label="Gross Amount" value={money(grossAmount)} />
      <SummaryAmount label="Discount" value={money(discountAmount)} />
      <SummaryAmount label="Tax" value={money(taxAmount)} />
      <SummaryAmountInput
        label={freightLabel}
        value={freightAmount}
        onChange={onFreightAmountChange}
        onFocus={() => onFreightAmountChange(cleanNumber(freightAmount))}
        onBlur={() => onFreightAmountChange(formatAmountInput(freightAmount, generalSettings))}
      />
      <SummaryAmount label="Net Amount" value={money(netAmount)} strong />
      <SummaryAmount label={balanceLabel} value={money(balanceDue)} />
    </DocumentSummary>
  );
}
