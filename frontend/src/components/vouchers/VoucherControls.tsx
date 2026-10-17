'use client';

import { formatMoney } from '@/lib/app-settings';

// The voucher screens use the shared form controls; these re-exports keep existing imports working.
export { SearchableSelect } from '@/components/ui/SearchableSelect';
export type { SelectOption as VoucherSelectOption } from '@/components/ui/SearchableSelect';
export { FieldLabel } from '@/components/ui/FieldLabel';

/** Read-only total in the voucher summary area. `danger` marks an out-of-balance value. */
export function SummaryRow({
  label,
  value,
  strong = false,
  danger = false,
  width = 140,
  formatMoneyValue = formatMoney,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
  width?: number;
  formatMoneyValue?: (value: number) => string;
}) {
  return (
    <div style={{ width, minWidth: 0 }}>
      <span className="field-label">{label}</span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: 'var(--control-h)',
          padding: '0 10px',
          border: `1px solid ${danger ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius)',
          background: danger ? 'var(--color-danger-bg)' : 'var(--color-surface)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 'var(--font-size-sm)',
          fontWeight: strong ? 600 : 500,
          color: danger ? 'var(--color-danger-text)' : 'var(--color-heading)',
          whiteSpace: 'nowrap',
        }}
      >
        {formatMoneyValue(value)}
      </span>
    </div>
  );
}
