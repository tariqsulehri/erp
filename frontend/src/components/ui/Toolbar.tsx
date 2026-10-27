import type { ReactNode } from 'react';

/**
 * The one filter bar under the page header (at most two toolbars per screen: header + this).
 * Filters wrap on narrow screens; `end` holds the right-aligned controls (e.g. Clear Filters).
 */
export function Toolbar({ children, end, label = 'Filters' }: { children: ReactNode; end?: ReactNode; label?: string }) {
  return (
    <div className="toolbar" role="group" aria-label={label}>
      <div className="toolbar-main">{children}</div>
      {end && <div className="toolbar-end">{end}</div>}
    </div>
  );
}
