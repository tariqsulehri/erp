import type { ReactNode } from 'react';
import { HelpButton } from './HelpButton';

/** Flat surface with an optional header (title, help, actions). Use for any grouped block of content. */
export function Card({ title, help, actions, children, padded = true }: {
  title?: string;
  help?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** false for a table that should touch the card edges. */
  padded?: boolean;
}) {
  return (
    <section className="card" aria-label={title}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2 className="card-title">{title}{help && <HelpButton title={title} size="sm">{help}</HelpButton>}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'card-body' : undefined}>{children}</div>
    </section>
  );
}
