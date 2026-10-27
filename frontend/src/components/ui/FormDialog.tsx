'use client';

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { Button } from './Button';

/**
 * Modal form: header with an accent bar and a close button, scrolling body, and full-width
 * Save and Cancel buttons at the bottom. Escape and the backdrop cancel (unless saving);
 * focus moves to the first field and returns to the opener on close.
 */
export function FormDialog({ open, title, children, saveLabel = 'Save', cancelLabel = 'Cancel', saving = false, saveDisabled = false, onSave, onCancel }: {
  open: boolean;
  title: string;
  children: ReactNode;
  saveLabel?: string;
  cancelLabel?: string;
  saving?: boolean;
  saveDisabled?: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLFormElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
    ) ?? []);
    (dialogRef.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled)') ?? focusable()[0])?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) { event.preventDefault(); onCancel(); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, saving, onCancel]);

  if (!open) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!saving && !saveDisabled) onSave();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel(); }}>
      <form ref={dialogRef} className="dialog form-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={submit} noValidate>
        <div className="form-dialog-head">
          <h2 id={titleId} className="form-dialog-title">{title}</h2>
          <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onCancel} disabled={saving} aria-label={`Close ${title}`} title="Close" />
        </div>
        <div className="form-dialog-body">{children}</div>
        <div className="form-dialog-foot">
          <Button type="submit" variant="primary" loading={saving} disabled={saveDisabled}>{saveLabel}</Button>
          <Button onClick={onCancel} disabled={saving}>{cancelLabel}</Button>
        </div>
      </form>
    </div>
  );
}
