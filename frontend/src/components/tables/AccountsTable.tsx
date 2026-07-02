'use client';

import Link from 'next/link';
import type { AccountListItem } from '@/lib/api/accounts';
import { getAccountLevel } from '@/modules/accounts/account-code';
import { PaginationBar } from '@/components/ui/PaginationBar';

/* ── Type badge ──────────────────────────────────────────────────────── */
const TYPE_COLOR: Record<string, { text: string; bg: string }> = {
  Asset:     { text: '#1d4ed8', bg: '#dbeafe' },
  Liability: { text: '#b91c1c', bg: '#fee2e2' },
  Equity:    { text: '#6d28d9', bg: '#ede9fe' },
  Revenue:   { text: '#15803d', bg: '#dcfce7' },
  Expense:   { text: '#b45309', bg: '#fef3c7' },
};

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLOR[type] ?? { text: '#6b7280', bg: '#f1f5f9' };
  return (
    <span style={{
      display: 'inline-block', fontSize: '0.6875rem', fontWeight: 600,
      color: c.text, background: c.bg,
      padding: '2px 8px', borderRadius: 10,
    }}>
      {type}
    </span>
  );
}

/* ── Hierarchy level badge (by code) ─────────────────────────────────── */
const LEVEL_META: Record<number, { label: string; bg: string }> = {
  1: { label: 'Main Category', bg: '#dbeafe' },
  2: { label: 'Group',    bg: '#ede9fe' },
  3: { label: 'Sub-Grp',  bg: '#f3e8ff' },
  4: { label: 'Posting',  bg: '#dcfce7' },
};

function levelOf(code: string): number {
  return getAccountLevel(code);
}

/* ── Props ───────────────────────────────────────────────────────────── */
interface AccountsTableProps {
  accounts:        AccountListItem[];
  total:           number;
  page:            number;
  pageSize:        number;
  onPageChange:    (page: number) => void;
  onRowClick?:     (account: AccountListItem) => void;
  selectedIds?:    Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?:    () => void;
  onBulkActivate?:   () => void;
  onBulkDeactivate?: () => void;
  bulkLoading?:    boolean;
}

export function AccountsTable({
  accounts, total, page, pageSize, onPageChange,
  onRowClick, selectedIds, onToggleSelect, onSelectAll,
  onBulkActivate, onBulkDeactivate, bulkLoading,
}: AccountsTableProps) {
  const totalPages   = Math.max(1, Math.ceil(total / pageSize));
  const selectedCount = selectedIds?.size ?? 0;
  const allSelected  = accounts.length > 0 && accounts.every(a => selectedIds?.has(a.id));

  return (
    <div>
      {/* ── Bulk action bar ───────────────────────────────────── */}
      {selectedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 20px', background: 'var(--color-primary-light)',
          borderBottom: '1px solid #bfdbfe',
        }}>
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-primary)' }}>
            {selectedCount} account{selectedCount !== 1 ? 's' : ''} selected
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBulkActivate}
            disabled={bulkLoading}
            style={{ color: '#16a34a', borderColor: '#16a34a' }}
          >
            {bulkLoading ? '…' : '✓ Activate'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onBulkDeactivate}
            disabled={bulkLoading}
            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
          >
            {bulkLoading ? '…' : '✕ Deactivate'}
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {/* Select-all checkbox */}
              <th style={{ width: 40, paddingRight: 0 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  disabled={accounts.length === 0}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ width: 120 }}>Code</th>
              <th>Account Name</th>
              <th>Type</th>
              <th>Level</th>
              <th style={{ textAlign: 'center' }}>Balance</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                  <div className="empty-state">
                    <div className="empty-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                      </svg>
                    </div>
                    <p className="empty-title">No accounts found</p>
                    <p className="empty-desc">Try adjusting your search or filter, or create a new account.</p>
                    <Link href="/accounts/new" className="btn btn-primary btn-sm">+ New Account</Link>
                  </div>
                </td>
              </tr>
            ) : (
              accounts.map((account) => {
                const level     = levelOf(account.code);
                const levelMeta = LEVEL_META[level];
                const isSelected = selectedIds?.has(account.id) ?? false;

                return (
                  <tr
                    key={account.id}
                    onClick={() => onRowClick?.(account)}
                    style={{
                      cursor: onRowClick ? 'pointer' : undefined,
                      background: isSelected ? 'var(--color-primary-light)' : undefined,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = isSelected ? 'var(--color-primary-light)' : '';
                    }}
                  >
                    {/* Checkbox */}
                    <td
                      style={{ paddingRight: 0 }}
                      onClick={e => { e.stopPropagation(); onToggleSelect?.(account.id); }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect?.(account.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>

                    {/* Code */}
                    <td>
                      <span style={{
                        fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem',
                        color: TYPE_COLOR[account.account_type]?.text ?? '#64748b',
                        background: TYPE_COLOR[account.account_type]?.bg ?? '#f1f5f9',
                        padding: '2px 7px', borderRadius: 4,
                      }}>
                        {account.code}
                      </span>
                    </td>

                    {/* Name */}
                    <td>
                      <div style={{
                        fontWeight: level <= 2 ? 600 : 400,
                        fontSize: 'var(--font-size-sm)',
                        color: account.is_active ? 'var(--color-text)' : 'var(--color-text-muted)',
                      }}>
                        {account.name}
                      </div>
                      {account.description && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 1 }}>
                          {account.description.length > 60
                            ? account.description.slice(0, 60) + '…'
                            : account.description}
                        </div>
                      )}
                      {account.is_system && (
                        <span style={{
                          fontSize: '0.6rem', fontWeight: 700,
                          color: '#92400e', background: '#fef3c7',
                          padding: '1px 5px', borderRadius: 3, marginTop: 2, display: 'inline-block',
                        }}>SYS</span>
                      )}
                    </td>

                    {/* Type */}
                    <td><TypeBadge type={account.account_type} /></td>

                    {/* Level */}
                    <td>
                      <span style={{
                        fontSize: '0.6875rem', fontWeight: 600,
                        background: levelMeta.bg, color: '#374151',
                        padding: '2px 7px', borderRadius: 8,
                      }}>
                        {levelMeta.label}
                      </span>
                    </td>

                    {/* Normal balance */}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        color: account.normal_balance === 'Debit' ? '#1d4ed8' : '#b91c1c',
                      }}>
                        {account.normal_balance}
                      </span>
                    </td>

                    {/* Status — click dot to toggle */}
                    <td onClick={e => e.stopPropagation()}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                          background: account.is_active ? '#16a34a' : '#d1d5db',
                        }} />
                        <span style={{
                          fontSize: 'var(--font-size-xs)',
                          color: account.is_active ? '#16a34a' : 'var(--color-text-muted)',
                        }}>
                          {account.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td
                      style={{ textAlign: 'right' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onRowClick?.(account)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      {total > 0 && (
        <>
          {selectedCount > 0 && (
            <div style={{ padding: '6px 10px 0', color: 'var(--color-primary)', fontSize: '0.74rem', fontWeight: 800 }}>
              {selectedCount} account{selectedCount === 1 ? '' : 's'} selected
            </div>
          )}
          <PaginationBar
            page={page}
            totalPages={totalPages}
            totalRecords={total}
            recordLabel={total === 1 ? 'Account' : 'Accounts'}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  );
}
