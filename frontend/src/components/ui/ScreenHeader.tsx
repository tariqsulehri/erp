import type { ReactNode } from 'react';

/**
 * Header card for a setup or list screen: icon tile, title with an optional badge, one-line description,
 * and a slot on the right for search or actions.
 */
export function ScreenHeader({ icon, title, badge, description, aside }: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <span className="screen-header-icon" aria-hidden>{icon}</span>
      <div className="screen-header-text">
        <div className="screen-header-title-row">
          <h1 className="screen-header-title">{title}</h1>
          {badge}
        </div>
        <p className="screen-header-desc">{description}</p>
      </div>
      {aside && <div className="screen-header-aside">{aside}</div>}
    </header>
  );
}
