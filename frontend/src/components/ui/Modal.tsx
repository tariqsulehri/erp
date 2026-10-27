'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside the dialog, closes on Escape, and returns focus to the opener. Shared by Modal and Drawer. */
export function useDialogFocus(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void, closable = true) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    items()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && closable) { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [open, ref, onClose, closable]);
}

/** General dialog: title, close button, content, optional footer. For forms use FormDialog; for yes/no use ConfirmDialog. */
export function Modal({ open, title, children, footer, size = 'md', onClose }: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useDialogFocus(open, ref, onClose);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={ref} className={`dialog modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">{title}</h2>
          <button type="button" className="help-dialog-close" title="Close" aria-label={`Close ${title}`} onClick={onClose}>
            <IconX size={16} stroke={1.9} aria-hidden />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
