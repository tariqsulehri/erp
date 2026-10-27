import type { ReactNode } from 'react';

/** Shown when a list or screen has nothing yet: what is missing, and what to do next. */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="empty-state" role="status">
      {icon && <span className="empty-icon" aria-hidden>{icon}</span>}
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action}
    </div>
  );
}
