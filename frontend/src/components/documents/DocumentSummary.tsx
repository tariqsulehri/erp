'use client';

import type { ReactNode } from 'react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { sanitizeMoneyInput } from '@/lib/erp-utils';
import styles from './documents.module.css';

/**
 * Summary area in the lines panel footer: a line count on the left and the totals
 * bottom-right, all right-aligned with tabular figures.
 */
export function DocumentSummary({ countLabel, count, children }: { countLabel: string; count: number; children: ReactNode }) {
  return (
    <div className={`panel-footer ${styles.summary}`} aria-label="Summary" role="group">
      <span className={styles.summaryCount}>
        {countLabel} <strong>{count}</strong>
      </span>
      <div className={styles.summaryItems}>{children}</div>
    </div>
  );
}

/** Read-only total. `danger` marks an out-of-balance value. */
export function SummaryAmount({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  /** Already formatted with the settings money format. */
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  const classes = [styles.summaryValue, strong && styles.summaryStrong, danger && styles.summaryDanger].filter(Boolean).join(' ');
  return (
    <div className={styles.summaryItem}>
      <span className="field-label">{label}</span>
      <output className={classes} aria-label={label}>{value}</output>
    </div>
  );
}

/** Editable amount in the summary area (e.g. Freight). */
export function SummaryAmountInput({
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
    <div className={styles.summaryItem}>
      <FieldLabel label={label}>
        <input
          className={`form-input ${styles.numInput}`}
          inputMode="decimal"
          value={value}
          onChange={event => onChange(sanitizeMoneyInput(event.currentTarget.value))}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder="0.00"
        />
      </FieldLabel>
    </div>
  );
}
