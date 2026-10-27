'use client';

import type { ReactNode } from 'react';
import { HelpButton } from '@/components/ui/HelpButton';
import { InlineAlert } from '@/components/ui/InlineAlert';
import styles from './documents.module.css';

export type DocumentMessageKind = 'success' | 'error';
export interface DocumentMessageValue {
  kind: DocumentMessageKind;
  text: string;
}

/** Page shell for every document screen (entry form, posted list, analytics). */
export function DocumentPage({ children }: { children: ReactNode }) {
  return <main className={`page-shell ${styles.page}`}>{children}</main>;
}

/**
 * Page header for documents: title with status badges on the left, actions on the right
 * (secondary actions first, the one primary action last). Same classes as the shared PageHeader.
 */
export function DocumentHeader({
  title,
  description,
  badges,
  actions,
  help,
}: {
  title: string;
  description?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  /** Plain-words help for the screen, shown from the ⓘ button beside the title. */
  help?: ReactNode;
}) {
  return (
    <header className={`page-head ${styles.head}`}>
      <div className="page-head-text">
        <div className={styles.titleRow}>
          <h1 className="page-head-title">{title}</h1>
          {help && <HelpButton title={title}>{help}</HelpButton>}
          {badges}
        </div>
        {description && <p className="page-head-desc">{description}</p>}
      </div>
      {actions && <div className={`page-head-actions ${styles.headerActions}`}>{actions}</div>}
    </header>
  );
}

/** Screen-level success or error message, announced to screen readers. */
export function DocumentMessage({ message, onDismiss }: { message: DocumentMessageValue | null | undefined; onDismiss?: () => void }) {
  if (!message) return null;
  return (
    <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'} onDismiss={onDismiss}>
      {message.text}
    </InlineAlert>
  );
}

/**
 * Header fields of a document in one `.form-grid` panel. The grid collapses to two columns
 * below 900px, so it never clips. `statusMessage` shows a date or setup problem under the fields.
 */
export function DocumentFormPanel({
  columns = 6,
  statusMessage,
  label = 'Document Details',
  children,
}: {
  columns?: number;
  statusMessage?: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <section className={`panel ${styles.formPanel}`} aria-label={label}>
      <div className="panel-body">
        <div className="form-grid" style={{ ['--form-cols' as string]: columns }}>
          {children}
        </div>
        {statusMessage && <p className={`form-error ${styles.statusMessage}`} role="status">{statusMessage}</p>}
      </div>
    </section>
  );
}
