import type { ChartTheme } from '@/components/analytics/chart-palette';
import type { AuditLogRow } from '@/lib/api/audit';

export type ActionBadgeVariant = 'success' | 'info' | 'danger' | 'warning' | 'neutral';

export function actionBadgeVariant(action: string): ActionBadgeVariant {
  const norm = action.toUpperCase();
  switch (norm) {
    case 'CREATE':
    case 'POST':
      return 'success';
    case 'UPDATE':
      return 'info';
    case 'DELETE':
    case 'VOID':
    case 'CANCEL':
    case 'REVERSE':
      return 'danger';
    case 'PASSWORD_RESET':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function actionThemeColor(theme: ChartTheme, action: string): string {
  const norm = action.toUpperCase();
  switch (norm) {
    case 'CREATE':
      return theme.series.teal;
    case 'UPDATE':
      return theme.series.blue;
    case 'DELETE':
    case 'VOID':
    case 'CANCEL':
    case 'REVERSE':
      return theme.series.red;
    case 'PASSWORD_RESET':
      return theme.series.amber;
    case 'POST':
      return theme.series.blueDeep;
    default:
      return theme.series.slate;
  }
}

export const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'POST', label: 'Post' },
  { value: 'PASSWORD_RESET', label: 'Password Reset' },
  { value: 'VOID', label: 'Void / Cancel' },
  { value: 'LOGIN', label: 'Login' },
];

export const ENTITY_OPTIONS = [
  { value: '', label: 'All Entities' },
  { value: 'Voucher', label: 'Voucher' },
  { value: 'Product', label: 'Product' },
  { value: 'Customer', label: 'Customer' },
  { value: 'Supplier', label: 'Supplier' },
  { value: 'User', label: 'User' },
  { value: 'Category', label: 'Category' },
  { value: 'Brand', label: 'Brand' },
  { value: 'StockTransfer', label: 'Stock Transfer' },
  { value: 'StockAdjustment', label: 'Stock Adjustment' },
  { value: 'FiscalYear', label: 'Fiscal Year' },
];

export function formatAuditDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function exportAuditLogsToCsv(logs: AuditLogRow[], filename = 'audit-logs.csv'): void {
  const headers = ['Timestamp', 'User Name', 'User Email', 'Action', 'Entity', 'Entity ID', 'Description', 'IP Address'];
  const rows = logs.map(log => [
    `"${log.created_at}"`,
    `"${(log.user_name || '').replace(/"/g, '""')}"`,
    `"${(log.user_email || '').replace(/"/g, '""')}"`,
    `"${(log.action || '').replace(/"/g, '""')}"`,
    `"${(log.entity_name || '').replace(/"/g, '""')}"`,
    `"${(log.entity_id || '').replace(/"/g, '""')}"`,
    `"${(log.description || '').replace(/"/g, '""')}"`,
    `"${(log.ip_address || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
