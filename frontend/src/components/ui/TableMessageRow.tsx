import type { ReactNode } from 'react';
import { Spinner } from './LoadingSpinner';

/**
 * Full-width table row for loading, empty, and error states.
 * `loading` shows spinner and skeleton bars (title is kept for screen readers and visible indicator).
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
        <td colSpan={colSpan} style={{ padding: '20px 16px 8px', height: 'auto', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Spinner size="sm" aria-hidden />
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-muted)' }}>
              {title}
            </span>
          </div>
          {[92, 78, 86, 70, 82].map((width, index) => (
            <div key={index} className="skeleton" style={{ height: 14, width: `${width}%`, margin: '0 auto 12px' }} aria-hidden />
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
