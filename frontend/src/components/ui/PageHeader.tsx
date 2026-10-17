import type { ReactNode } from 'react';

/**
 * The one page header. Title (Title Case) and a short plain-words description on the left,
 * page actions on the right: secondary actions first, the single primary action last.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <h1 className="page-head-title">{title}</h1>
        {description && <p className="page-head-desc">{description}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}
