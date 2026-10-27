import type { ReactNode } from 'react';
import { HelpButton } from './HelpButton';

/**
 * The one page header. Title (Title Case) with its help button, a short plain-words description on the left,
 * page actions on the right: secondary actions first, the single primary action last.
 */
export function PageHeader({ title, description, actions, help }: {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Plain-words help for the whole screen, shown from the ⓘ button beside the title. */
  help?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        <div className="page-head-title-row">
          <h1 className="page-head-title">{title}</h1>
          {help && <HelpButton title={title}>{help}</HelpButton>}
        </div>
        {description && <p className="page-head-desc">{description}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </header>
  );
}
