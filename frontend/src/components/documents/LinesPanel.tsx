'use client';

import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { Button } from '@/components/ui/Button';
import { IconFilePlus } from '@tabler/icons-react';
import styles from './documents.module.css';

/**
 * The one "Lines" panel of a document: title, keyboard hint and actions in the panel header,
 * an optional line-entry row, the scrolling lines table, and the summary in the panel footer.
 * Pass `linesRef` and `onKeyDown` from useLineEntryKeyboard.
 */
export function LinesPanel({
  title,
  actions,
  hint,
  entry,
  summary,
  linesRef,
  onKeyDown,
  children,
}: {
  title: string;
  actions?: ReactNode;
  hint?: ReactNode;
  entry?: ReactNode;
  summary?: ReactNode;
  linesRef?: Ref<HTMLElement>;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- keyboard shortcuts for the lines (Ctrl+S, Enter, Escape) are handled for the whole panel
    <section ref={linesRef} className={`panel ${styles.linesPanel}`} aria-label={title} onKeyDown={onKeyDown}>
      <div className="panel-header">
        <div className={styles.linesHeading}>
          <h2 className="panel-title">{title}</h2>
          {hint}
        </div>
        {actions && <div className={styles.linesActions}>{actions}</div>}
      </div>
      {entry}
      <div className="table-scroll">{children}</div>
      {summary}
    </section>
  );
}

/** Line-entry row above the lines table. Wraps onto a second row instead of clipping. */
export function LineEntryRow({ label = 'Line Entry', children }: { label?: string; children: ReactNode }) {
  return (
    <div className={styles.entryRow} data-line-entry role="group" aria-label={label}>
      {children}
    </div>
  );
}

/** Size classes for fields inside LineEntryRow. */
export const lineEntryFieldClass = {
  item: styles.entryItem,
  number: styles.entryNumber,
  amount: styles.entryAmount,
  text: styles.entryText,
  actions: styles.entryActions,
} as const;

/** Lines table. `editable` gives each cell an input (voucher grids). */
export function LinesTable({ editable = false, minWidth, children }: { editable?: boolean; minWidth?: number; children: ReactNode }) {
  return (
    <table className={`data-table ${styles.linesTable}${editable ? ` ${styles.gridTable}` : ''}`} style={minWidth ? { minWidth } : undefined}>
      {children}
    </table>
  );
}

/** "Add Line" button for the lines panel header, with its keyboard shortcut in the tooltip. */
export function AddLineButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="secondary" size="sm" icon={<IconFilePlus size={16} stroke={1.8} aria-hidden />} onClick={onClick} disabled={disabled} title="Add Line (Alt+N)" aria-keyshortcuts="Alt+N">
      Add Line
    </Button>
  );
}

/** Small keyboard hint shown next to the lines title. */
export function LineShortcutHint({ mode: _mode = 'grid' }: { mode?: 'entry' | 'grid' } = {}) {
  return (
    <span className={styles.hint}>
      <kbd>Alt+N</kbd> Add Line
    </span>
  );
}
