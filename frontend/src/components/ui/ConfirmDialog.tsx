'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { Button } from './Button';

/**
 * ConfirmDialog — modal confirmation for destructive or irreversible actions.
 * Escape and the backdrop cancel (unless loading); focus moves into the dialog and returns on close.
 *
 *   <ConfirmDialog open={open} title="Deactivate Account" message="…" confirmLabel="Deactivate"
 *     variant="danger" loading={isPending} onConfirm={handleDeactivate} onCancel={() => setOpen(false)} />
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  requiredText?: string;
  requiredTextLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  requiredText,
  requiredTextLabel = 'Confirmation Text',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => { if (open) setTypedText(''); }, [open]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)') ?? []);
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) { event.preventDefault(); onCancel(); return; }
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
  }, [open, loading, onCancel]);

  if (!open) return null;

  const Icon = variant === 'primary' ? IconInfoCircle : IconAlertTriangle;
  const canConfirm = !requiredText || typedText.trim() === requiredText;

  return (
    <div className="dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
      <div ref={dialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
        <div className="dialog-body">
          <span className={`dialog-icon dialog-icon-${variant}`} aria-hidden><Icon size={20} stroke={1.8} /></span>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="dialog-title">{title}</h2>
            <p id={messageId} className="dialog-message">{message}</p>
            {requiredText && (
              <label style={{ display: 'block', marginTop: 14 }}>
                <span className="field-label">{requiredTextLabel}: type <strong>{requiredText}</strong></span>
                <input className="form-input" value={typedText} onChange={event => setTypedText(event.currentTarget.value)} disabled={loading} />
              </label>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={!canConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
