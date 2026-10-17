import type { ReactNode } from 'react';

/**
 * Full-width table row for loading, empty, and error states.
 * `loading` shows skeleton bars (the title is kept for screen readers).
 * Empty states say what to do next.
 */
export function TableMessageRow({ colSpan, title, description, action, loading = false }: {
  colSpan: number;
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <tr aria-busy="true">
        <td colSpan={colSpan} style={{ padding: '12px 12px 4px', height: 'auto' }}>
          <span className="sr-only" role="status">{title}</span>
          {[92, 78, 86, 70, 82].map((width, index) => (
            <div key={index} className="skeleton" style={{ height: 14, width: `${width}%`, marginBottom: 14 }} aria-hidden />
          ))}
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={colSpan} className="cell-empty">
        <div className="empty-state" style={{ padding: '24px 16px' }}>
          <div className="empty-title">{title}</div>
          {description && <div className="empty-desc">{description}</div>}
          {action}
        </div>
      </td>
    </tr>
  );
}
