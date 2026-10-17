import type { CSSProperties } from 'react';

/**
 * Layout shared by the report screens. Everything else comes from the shared
 * classes (page-shell, panel, filter-bar, filter-grid, table-scroll, data-table).
 */

/** Report rendered inside the Reports workspace: panels stacked with the standard 12px gap. */
export const embeddedReportStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

/** The filter-grid inside a filter-bar takes the full row. */
export const reportFilterGridStyle: CSSProperties = { flex: 1, minWidth: 0 };

/** Negative amounts use the accounting negative token. */
export function amountStyle(value: string | number): CSSProperties | undefined {
  return Number(value) < 0 ? { color: 'var(--color-negative)' } : undefined;
}

/** Group or heading row inside a report table (Main, Group, Sub-Group). */
export function reportGroupRowStyle(level: 1 | 2 | 3): CSSProperties {
  return {
    background: level === 1 ? 'var(--color-surface-alt)' : undefined,
    fontWeight: level === 3 ? 500 : 600,
    color: 'var(--color-heading)',
  };
}

/** Indent for a nested cell, 12px per level. */
export function reportIndentStyle(level: number): CSSProperties {
  return { paddingLeft: 12 + level * 12 };
}
