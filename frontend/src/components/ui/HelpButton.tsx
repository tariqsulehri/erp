'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { IconInfoCircle, IconX } from '@tabler/icons-react';

/**
 * The ⓘ button every screen, chart, and summary tile carries. It opens a short help window
 * that explains, in plain words, what the user is looking at and what to do with it.
 * Escape, the close button, and the backdrop close it; focus returns to the button.
 */
export function HelpButton({ title, children, size = 'md' }: {
  /** What the help is about, e.g. "Fiscal Years" or "Net Purchases By Month". */
  title: string;
  /** One to four short sentences or a short list. */
  children: ReactNode;
  size?: 'sm' | 'md';
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = buttonRef.current;
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' || event.key === 'Tab') {
        // The window holds one control, so Tab stays on it and Escape closes.
        event.preventDefault();
        if (event.key === 'Escape') setOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`help-button help-button-${size}`}
        title={`Help: ${title}`}
        aria-label={`Help: ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <IconInfoCircle size={size === 'sm' ? 15 : 17} stroke={1.9} aria-hidden />
      </button>
      {open && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="dialog help-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="help-dialog-head">
              <span className="help-dialog-icon" aria-hidden><IconInfoCircle size={18} stroke={1.9} /></span>
              <h2 id={titleId} className="help-dialog-title">{title}</h2>
              <button ref={closeRef} type="button" className="help-dialog-close" title="Close Help" aria-label="Close Help" onClick={() => setOpen(false)}>
                <IconX size={16} stroke={1.9} aria-hidden />
              </button>
            </div>
            <div className="help-dialog-body">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
