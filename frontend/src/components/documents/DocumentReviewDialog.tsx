'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './documents.module.css';

/**
 * Large review dialog shown before a document is processed or posted.
 * Escape and the backdrop go back to editing (unless saving); focus moves in, is trapped, and returns.
 */
export function DocumentReviewDialog({
  open,
  title,
  description,
  confirmLabel,
  backLabel = 'Back To Edit',
  saving = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  backLabel?: string;
  saving?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? []);
    // Start on the confirm action, the last button.
    const items = focusable();
    items[items.length - 1]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab') return;
      const list = focusable();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, saving]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <div
        ref={dialogRef}
        className="dialog dialog-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className={styles.reviewBody}>
          <h2 id={titleId} className="dialog-title">{title}</h2>
          {description && <p id={descriptionId} className="dialog-message">{description}</p>}
          <div className={styles.reviewContent}>{children}</div>
        </div>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={onClose} disabled={saving}>{backLabel}</Button>
          <Button variant="primary" onClick={onConfirm} loading={saving}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
