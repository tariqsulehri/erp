'use client';

import { useId, useRef, type ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { useDialogFocus } from './Modal';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl';

/** Panel that slides in from the right over the page, for details or a short form. */
export function Drawer({
  open,
  title,
  children,
  footer,
  headerActions,
  size = 'md',
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  size?: DrawerSize;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  useDialogFocus(open, ref, onClose);
  if (!open) return null;
  return (
    <div
      className="dialog-backdrop drawer-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`drawer drawer-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-head">
          <h2 id={titleId} className="modal-title">{title}</h2>
          {headerActions && <div className="row-actions">{headerActions}</div>}
          <button
            type="button"
            className="help-dialog-close"
            title="Close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <IconX size={16} stroke={1.9} aria-hidden />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
