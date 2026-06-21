'use client';

import { cleanNumber, formatAmountInput } from '@/lib/erp-utils';
import { SummaryBox, SummaryInputBox } from '@/components/vouchers/SummaryBoxes';
import {
  summaryFooterStyle,
  summaryValuesStyle,
} from '../PurchaseVoucherStyles';

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
    <div style={summaryFooterStyle}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
        Total Items: <strong style={{ color: 'var(--color-text)' }}>{totalItems}</strong>
      </span>
      <div style={summaryValuesStyle}>
        <SummaryBox label="Gross Amount" value={grossAmount} money={money} />
        <SummaryBox label="Discount" value={discountAmount} money={money} />
        <SummaryBox label="Tax" value={taxAmount} money={money} />
        <SummaryInputBox
          label={freightLabel}
          value={freightAmount}
          onChange={onFreightAmountChange}
          onFocus={() => onFreightAmountChange(cleanNumber(freightAmount))}
          onBlur={() => onFreightAmountChange(formatAmountInput(freightAmount, generalSettings))}
        />
        <SummaryBox label="Net Amount" value={netAmount} strong money={money} />
        <SummaryBox label={balanceLabel} value={balanceDue} money={money} />
      </div>
    </div>
  );
}
