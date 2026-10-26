import type { FormEvent, ReactNode } from 'react';
import { IconX } from '@tabler/icons-react';
import { Button } from './Button';

/**
 * Right-hand panel for creating or editing a small master record next to its list.
 * Not a modal: the list stays visible and usable. Footer holds Cancel then the primary action.
 */
export function SidePanel({ title, onClose, onSubmit, footer, children }: {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <form className="panel side-panel" onSubmit={onSubmit} noValidate>
      <div className="panel-header">
        <h2 className="panel-title">{title}</h2>
        <Button variant="ghost" size="sm" icon={<IconX size={16} stroke={1.8} />} onClick={onClose} aria-label="Close Panel" title="Close Panel" />
      </div>
      <div className="panel-body">{children}</div>
      <div className="panel-footer">{footer}</div>
    </form>
  );
}
