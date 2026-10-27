'use client';

import type { ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import styles from './documents.module.css';

/** Side panel beside a posted-document list: header with actions and Close, then the detail. */
export function DocumentDetailPanel({
  title,
  actions,
  loading = false,
  loadingText = 'Loading Details…',
  error,
  onClose,
  children,
}: {
  title: string;
  actions?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  error?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <aside className="panel side-panel" aria-label={title}>
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <span className="row-actions">
          {actions}
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} aria-hidden />} onClick={onClose} aria-label="Close Details" title="Close Details" />
        </span>
      </div>
      <div className="panel-body">
        {loading && <p className="form-hint" role="status">{loadingText}</p>}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {children}
      </div>
    </aside>
  );
}

/** Label / value pairs in the detail panel. Missing values show "Not Set". */
export function DetailFields({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="detail-list">
      {items.map(([label, value]) => (
        <div key={label} className="detail-row">
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? <span className="cell-muted">Not Set</span> : value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Read-only totals in the detail panel, right-aligned. The last row can be emphasised. */
export function DetailTotals({ items, strongLast = false }: { items: Array<[string, string]>; strongLast?: boolean }) {
  return (
    <dl className={styles.detailTotals}>
      {items.map(([label, value], index) => (
        <div key={label} className={strongLast && index === items.length - 1 ? styles.detailTotalsStrong : undefined}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Small lines table inside the detail panel. */
export function DetailLinesTable({ children }: { children: ReactNode }) {
  return <table className={`data-table ${styles.detailTable}`}>{children}</table>;
}

/** A short note (next step) in the detail panel. */
export function DetailNote({ children }: { children: ReactNode }) {
  return <div className={styles.detailNote}>{children}</div>;
}

/** Stacked full-width actions at the bottom of the detail panel. */
export function DetailActions({ children }: { children: ReactNode }) {
  return <div className={styles.detailActions}>{children}</div>;
}
