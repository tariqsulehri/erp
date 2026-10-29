'use client';

import type { ReactNode } from 'react';
import styles from './documents.module.css';

/**
 * Posted-document list layout: one panel with the filters on top, then the table (scrolls)
 * with an optional detail side panel, then pagination.
 */
export function PostedListPanel({
  filters,
  table,
  detail,
  pagination,
}: {
  filters: ReactNode;
  table: ReactNode;
  detail?: ReactNode;
  pagination: ReactNode;
}) {
  return (
    <div className={`list-layout ${styles.listBody}`}>
      <section className={`panel ${styles.listPanel}`}>
        {filters}
        <div className="table-scroll">{table}</div>
        {pagination}
      </section>
      {detail}
    </div>
  );
}

/** Labelled filter row for document lists (`.filter-grid`), at the top of the list panel. */
export function PostedListFilters({ children, label = 'Filters' }: { children: ReactNode; label?: string }) {
  return (
    <div className={`filter-grid ${styles.listFilters}`} role="search" aria-label={label}>
      {children}
    </div>
  );
}

/** Class for clickable list rows. */
export const postedListRowClass = styles.listRow;
