'use client';

import type { ReactNode } from 'react';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { Drawer, type DrawerSize } from '@/components/ui/Drawer';
import styles from './documents.module.css';

/** Overlapping slide-over drawer beside a posted-document list: header with actions and Close, then the detail. */
export function DocumentDetailPanel({
  title,
  actions,
  loading = false,
  loadingText = 'Loading Details…',
  error,
  size = 'lg',
  onClose,
  children,
}: {
  title: string;
  actions?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  error?: string;
  size?: DrawerSize;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Drawer
      open={true}
      title={title}
      size={size}
      onClose={onClose}
      headerActions={actions}
    >
      {loading && <LoadingState message={loadingText} minHeight={140} />}
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      {!loading && children}
    </Drawer>
  );
}

/** Label / value pairs in the detail panel. Renders in 2 parallel columns by default with narrative rows spanning full width. */
export function DetailFields({
  items,
  columns = 2,
}: {
  items: Array<[string, ReactNode]>;
  columns?: 1 | 2;
}) {
  return (
    <dl className={`detail-list ${columns === 2 ? 'detail-list-2col' : ''}`}>
      {items.map(([label, value]) => {
        const isFullWidth =
          label.toLowerCase().includes('description') ||
          label.toLowerCase().includes('reason') ||
          label.toLowerCase().includes('narration') ||
          label.toLowerCase().includes('notes');
        return (
          <div key={label} className={`detail-row ${isFullWidth ? 'detail-row-full' : ''}`}>
            <dt>{label}</dt>
            <dd>{value === null || value === undefined || value === '' ? <span className="cell-muted">Not Set</span> : value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Read-only totals in the detail panel, right-aligned. The last row can be emphasised. */
export function DetailTotals({ items, strongLast = false }: { items: Array<[string, string]>; strongLast?: boolean }) {
  if (!items || items.length === 0) return null;
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
