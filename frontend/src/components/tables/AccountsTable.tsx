'use client';

import Link from 'next/link';
import { IconBan, IconCheck, IconEye, IconPlus } from '@tabler/icons-react';
import type { AccountListItem } from '@/lib/api/accounts';
import { getAccountLevel, getAccountLevelLabel } from '@/modules/accounts/account-code';
import { accountTypeBadge } from '@/lib/ui/account-category-colors';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { TableSkeleton } from '@/components/ui/TableSkeleton';

const COLUMN_COUNT = 8;

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
  /** Shows skeleton rows while the first page loads. */
  loading?:        boolean;
  /** True when search or filters are active, so the empty message can say how to widen them. */
  isFiltered?:     boolean;
  /** Account open in the side panel; its row is shown as selected. */
  activeId?:       string | null;
}

/**
 * Renders as a fragment (bulk bar, scrolling table, pagination) so it sits directly inside
 * the parent `.panel` and the table scrolls inside it.
 */
export function AccountsTable({
  accounts, total, page, pageSize, onPageChange,
  onRowClick, selectedIds, onToggleSelect, onSelectAll,
  onBulkActivate, onBulkDeactivate, bulkLoading,
  loading = false, isFiltered = false, activeId = null,
}: AccountsTableProps) {
  const totalPages    = Math.max(1, Math.ceil(total / pageSize));
  const selectedCount = selectedIds?.size ?? 0;
  const allSelected   = accounts.length > 0 && accounts.every(a => selectedIds?.has(a.id));

  return (
    <>
      {/* ── Bulk action bar ───────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="filter-bar" role="region" aria-label="Selected Accounts">
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>
            {selectedCount} {selectedCount === 1 ? 'Account' : 'Accounts'} Selected
          </span>
          <Button size="sm" icon={<IconCheck size={16} stroke={1.8} />} onClick={onBulkActivate} loading={bulkLoading}>
            Activate
          </Button>
          <Button size="sm" icon={<IconBan size={16} stroke={1.8} />} onClick={onBulkDeactivate} loading={bulkLoading}>
            Deactivate
          </Button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label="Select All Accounts On This Page"
                  checked={allSelected}
                  onChange={onSelectAll}
                  disabled={accounts.length === 0}
                />
              </th>
              <th style={{ width: 120 }}>Account Code</th>
              <th>Account Name</th>
              <th style={{ width: 110 }}>Type</th>
              <th style={{ width: 140 }}>Level</th>
              <th style={{ width: 120 }}>Normal Balance</th>
              <th style={{ width: 100 }}>Status</th>
              <th style={{ width: 56 }}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <TableSkeleton columns={COLUMN_COUNT} rowCount={6} ariaLabel="Loading Accounts…" />}
            {!loading && accounts.length === 0 && (
              isFiltered ? (
                <TableMessageRow
                  colSpan={COLUMN_COUNT}
                  title="No Accounts Match"
                  description="Change the search text or clear the filters to see more accounts."
                />
              ) : (
                <TableMessageRow
                  colSpan={COLUMN_COUNT}
                  title="No Accounts Yet"
                  description="Import a template or create your first account."
                  action={(
                    <Link href="/accounts/new" className="btn-primary">
                      <IconPlus size={16} stroke={1.8} aria-hidden />
                      New Account
                    </Link>
                  )}
                />
              )
            )}
            {!loading && accounts.map(account => {
              const level      = getAccountLevel(account.code);
              const isChecked  = selectedIds?.has(account.id) ?? false;
              const isSelected = isChecked || activeId === account.id;

              return (
                <tr
                  key={account.id}
                  className={isSelected ? 'is-selected' : undefined}
                  onClick={() => onRowClick?.(account)}
                  style={{ cursor: onRowClick ? 'pointer' : undefined }}
                >
                  {/* Checkbox */}
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select Account ${account.code}`}
                      checked={isChecked}
                      onChange={() => onToggleSelect?.(account.id)}
                    />
                  </td>

                  {/* Code */}
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, color: 'var(--color-heading)' }}>
                    {account.code}
                  </td>

                  {/* Name */}
                  <td className={account.description ? 'cell-stack' : undefined}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%',
                      fontWeight: level <= 2 ? 600 : 400,
                      color: account.is_active ? 'var(--color-heading)' : 'var(--color-text-muted)',
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{account.name}</span>
                      {account.is_system && <Badge variant="info" title="System Account. It cannot be deactivated.">System</Badge>}
                    </span>
                    {account.description && (
                      <span className="cell-sub" style={{ whiteSpace: 'nowrap' }}>{account.description}</span>
                    )}
                  </td>

                  {/* Type */}
                  <td><Badge variant={accountTypeBadge(account.account_type)}>{account.account_type}</Badge></td>

                  {/* Level */}
                  <td className="cell-muted">{getAccountLevelLabel(account.code)}</td>

                  {/* Normal balance */}
                  <td className="cell-muted">{account.normal_balance}</td>

                  {/* Status */}
                  <td>
                    <Badge variant={account.is_active ? 'success' : 'neutral'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>

                  {/* Actions */}
                  <td className="cell-actions" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<IconEye size={16} stroke={1.8} />}
                      onClick={() => onRowClick?.(account)}
                      aria-label={`View Account ${account.code}`}
                      title="View Account Details"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ─────────────────────────────────────────── */}
      {total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalRecords={total}
          recordLabel={total === 1 ? 'Account' : 'Accounts'}
          onPageChange={onPageChange}
        />
      )}
    </>
  );
}
