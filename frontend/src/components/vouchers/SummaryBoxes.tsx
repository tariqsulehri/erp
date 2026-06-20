import type { CSSProperties } from 'react';
import { sanitizeMoneyInput } from '@/lib/erp-utils';

export function SummaryBox({
  label,
  value,
  strong = false,
  money,
}: {
  label: string;
  value: number;
  strong?: boolean;
  money: (value: number) => string;
}) {
  return (
    <div style={{ width: 122, minWidth: 0 }}>
      <span style={summaryLabelStyle}>{label}</span>
      <span style={summaryValueStyle(strong)}>{money(value)}</span>
    </div>
  );
}

export function SummaryInputBox({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <div style={{ width: 122, minWidth: 0 }}>
      <span style={summaryLabelStyle}>{label}</span>
      <input
        className="form-input"
        inputMode="decimal"
        value={value}
        onChange={event => onChange(sanitizeMoneyInput(event.currentTarget.value))}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="0.00"
        style={summaryInputStyle}
      />
    </div>
  );
}

const summaryLabelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--color-text-muted)',
  fontSize: '0.66rem',
  fontWeight: 800,
  lineHeight: 1.1,
};

function summaryValueStyle(strong: boolean): CSSProperties {
  return {
    display: 'block',
    marginTop: 4,
    minHeight: 32,
    padding: '6px 8px',
    border: `1px solid ${strong ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius)',
    background: strong ? 'var(--color-primary-light)' : 'var(--color-surface)',
    fontFamily: 'var(--font-mono)',
    fontSize: strong ? '0.82rem' : '0.78rem',
    fontWeight: strong ? 900 : 800,
    color: 'var(--color-amount)',
    textAlign: 'right',
    lineHeight: 1.2,
  };
}

const summaryInputStyle: CSSProperties = {
  height: 32,
  minHeight: 32,
  marginTop: 4,
  width: '100%',
  padding: '6px 8px',
  fontSize: '0.78rem',
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
};
