'use client';

/**
 * Chart of Accounts — main list page.
 *
 * Features:
 *  - Table / Tree / Group view modes
 *  - Filter chips: account type + posting/header toggle
 *  - Full-text search (table view)
 *  - Checkbox row selection + bulk activate/deactivate
 *  - Click row → AccountSlideOver edit panel
 *  - Export to CSV (current filter)
 *  - Import Template (only when no accounts exist)
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { accountsQueryKey, useAccountsList, useBulkSetAccountActive, type AccountListItem } from '@/lib/api/accounts';
import { useGeneralSettings } from '@/lib/api/settings';
import { AccountsTable }     from '@/components/tables/AccountsTable';
import { AccountTreeView }   from '@/components/accounts/AccountTreeView';
import { AccountGroupView }  from '@/components/accounts/AccountGroupView';
import { AccountSlideOver }  from '@/components/accounts/AccountSlideOver';
import { ImportTemplateModal } from '@/components/modals/ImportTemplateModal';
import { BulkImportModal }   from '@/components/modals/BulkImportModal';
import { getAccountLevelLabel } from '@/modules/accounts/account-code';
import { formatNumber } from '@/lib/app-settings';

const PAGE_SIZE = 20;
type ViewMode    = 'table' | 'tree' | 'group';
type PostingFilter = 'all' | 'posting' | 'header';

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

/* ── KPI stats ──────────────────────────────────────────────────────── */
function buildStats(accounts: AccountListItem[], total: number) {
  return [
    { label: 'Total Accounts',   value: total },
    { label: 'Posting On Page',  value: accounts.filter(a => a.is_posting).length },
    { label: 'Assets On Page',   value: accounts.filter(a => a.account_type === 'Asset').length },
    { label: 'Active On Page',   value: accounts.filter(a => a.is_active).length },
  ];
}

/* ── View toggle button ──────────────────────────────────────────────── */
function ViewBtn({ active, onClick, title, children }: {
  active: boolean; onClick: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px',
      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
      background: active ? 'var(--color-primary)' : 'var(--color-surface)',
      color: active ? 'white' : 'var(--color-text-muted)',
      borderRadius: 'var(--radius-sm)',
      fontSize: 'var(--font-size-xs)', fontWeight: 600,
      cursor: 'pointer', transition: 'var(--transition)',
    }}>
      {children}
    </button>
  );
}

/* ── CSV export utility ─────────────────────────────────────────────── */
function exportCSV(accounts: AccountListItem[]) {
  const headers = ['Code', 'Name', 'Type', 'Level', 'Normal Balance', 'Posting', 'Active', 'System', 'Description'];
  const rows = accounts.map(a => [
    a.code, `"${a.name.replace(/"/g, '""')}"`,
    a.account_type, getAccountLevelLabel(a.code), a.normal_balance,
    a.is_posting ? 'Yes' : 'No',
    a.is_active  ? 'Yes' : 'No',
    a.is_system  ? 'Yes' : 'No',
    a.description ? `"${a.description.replace(/"/g, '""')}"` : '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function AccountsPage() {
  const [view,        setView]        = useState<ViewMode>('tree');
  const [page,        setPage]        = useState(1);
  const [searchText,  setSearchText]  = useState('');
  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [postFilter,  setPostFilter]  = useState<PostingFilter>('all');
  const [showImport,     setShowImport]     = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [slideOver,   setSlideOver]   = useState<AccountListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const { data: generalSettings } = useGeneralSettings();

  /* ── Table / stats query ──────────────────────────────────────────── */
  const { data, isLoading, isFetching, error } = useAccountsList(
    {
      page,
      limit: PAGE_SIZE,
      search:     search     || undefined,
      type:       typeFilter || undefined,
      is_posting: postFilter === 'posting' ? true : postFilter === 'header' ? false : undefined,
    },
  );

  /* ── Larger list only when the grouped view is open ────────────────── */
  const { data: groupData, isLoading: groupLoading } = useAccountsList(
    {
      page: 1, limit: 200,
      search:     search     || undefined,
      type:       typeFilter || undefined,
      is_posting: postFilter === 'posting' ? true : postFilter === 'header' ? false : undefined,
    },
    view === 'group',
  );

  /* ── Bulk mutation ──────────────────────────────────────────────────── */
  const bulkMutation = useBulkSetAccountActive();

  const bulkSetActive = (isActive: boolean) => {
    bulkMutation.mutate(
      { ids: [...selectedIds], is_active: isActive },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: accountsQueryKey });
          setSelectedIds(new Set());
        },
      },
    );
  };

  const accounts    = data?.data    ?? [];
  const groupAccounts = groupData?.data ?? [];
  const total       = data?.pagination?.total ?? 0;
  const stats       = buildStats(accounts, total);

  /* ── Selection helpers ─────────────────────────────────────────────── */
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(prev =>
      prev.size === accounts.length
        ? new Set()
        : new Set(accounts.map(a => a.id)),
    );
  }, [accounts]);

  /* ── Filter reset ──────────────────────────────────────────────────── */
  const resetFilters = () => {
    setSearchText(''); setSearch(''); setTypeFilter(''); setPostFilter('all'); setPage(1);
  };
  const hasFilters = search || typeFilter || postFilter !== 'all';

  const applySearch = () => {
    setSearch(searchText.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchText('');
    setSearch('');
    setPage(1);
  };

  return (
    <>
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Manage your company's account hierarchy and GL structure</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* CSV Export */}
          <button
            className="btn btn-secondary"
            onClick={() => exportCSV(accounts)}
            disabled={accounts.length === 0}
            title="Export the current page to CSV"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export Page CSV
          </button>

          {/* Template import — only when COA is empty */}
          {!isLoading && total === 0 && (
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Import Template
            </button>
          )}

          {/* Bulk CSV import — always available */}
          {total > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowBulkImport(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Bulk Import
            </button>
          )}

          <Link href="/accounts/new" className="btn btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Account
          </Link>
        </div>
      </div>

      {/* ── KPI Stats ─────────────────────────────────────────────── */}
      <div className="stats-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{isLoading ? '—' : formatNumber(s.value, { ...(generalSettings ?? {}), decimal_places: 0 })}</div>
          </div>
        ))}
      </div>

      {/* ── Error ─────────────────────────────────────────────────── */}
      {error && (
        <div className="alert alert-danger">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          {error.message}
        </div>
      )}

      {/* ── Main Card ─────────────────────────────────────────────── */}
      <div className="card">

        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
          <h2 className="card-title" style={{ alignSelf: 'center' }}>Accounts</h2>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>

            {/* Search — table view only */}
            {view === 'table' && (
              <div style={{ position: 'relative' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-text-muted)" strokeWidth="2"
                  style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text" className="form-input"
                  placeholder="Search accounts…"
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') applySearch();
                  }}
                  style={{ paddingLeft: 30, width: 200, height: 34 }}
                />
              </div>
            )}
            {view === 'table' && (
              <>
                <button className="btn btn-secondary btn-sm" type="button" onClick={applySearch} disabled={isFetching} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {isFetching && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
                  {isFetching ? 'Searching...' : 'Search'}
                </button>
                {(search || searchText) && (
                  <button className="btn btn-secondary btn-sm" type="button" onClick={clearSearch} disabled={isFetching}>
                    Clear
                  </button>
                )}
              </>
            )}

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4 }}>
              <ViewBtn active={view === 'table'} onClick={() => setView('table')} title="Table view">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/>
                </svg>
                Table
              </ViewBtn>
              <ViewBtn active={view === 'tree'} onClick={() => setView('tree')} title="Tree view">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h4M3 6h4M3 18h4M7 6v12M11 9h10M11 15h10M11 12h6"/>
                </svg>
                Tree
              </ViewBtn>
              <ViewBtn active={view === 'group'} onClick={() => setView('group')} title="Group view">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
                Group
              </ViewBtn>
            </div>
          </div>
        </div>

        {/* ── Filter Chips (all views) ──────────────────────────── */}
        {(
          <div style={{
            padding: '10px 20px', borderBottom: '1px solid var(--color-border)',
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          }}>
            {/* Account type chips */}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: 4 }}>
              Type:
            </span>
            {['', ...ACCOUNT_TYPES].map(t => (
              <button
                key={t || 'all'}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 'var(--font-size-xs)',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  borderColor: typeFilter === t ? 'var(--color-primary)' : 'var(--color-border)',
                  background:  typeFilter === t ? 'var(--color-primary)' : 'var(--color-surface)',
                  color:       typeFilter === t ? 'white' : 'var(--color-text-muted)',
                  transition: 'all 0.1s',
                }}
              >
                {t || 'All'}
              </button>
            ))}

            {/* Divider */}
            <span style={{ width: 1, height: 20, background: 'var(--color-border)', margin: '0 4px' }} />

            {/* Posting filter */}
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: 4 }}>
              Level:
            </span>
            {(['all', 'posting', 'header'] as PostingFilter[]).map(f => (
              <button
                key={f}
                onClick={() => { setPostFilter(f); setPage(1); }}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 'var(--font-size-xs)',
                  fontWeight: 600, cursor: 'pointer', border: '1px solid',
                  borderColor: postFilter === f ? 'var(--color-primary)' : 'var(--color-border)',
                  background:  postFilter === f ? 'var(--color-primary)' : 'var(--color-surface)',
                  color:       postFilter === f ? 'white' : 'var(--color-text-muted)',
                  transition: 'all 0.1s',
                }}
              >
                {f === 'all' ? 'All' : f === 'posting' ? 'Posting Only' : 'Headers Only'}
              </button>
            ))}

            {/* Reset */}
            {hasFilters && (
              <button
                onClick={resetFilters}
                style={{
                  marginLeft: 'auto', padding: '3px 10px', borderRadius: 12,
                  fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--color-danger)', background: 'none',
                  color: 'var(--color-danger)',
                }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        )}

        {/* ── Content area ─────────────────────────────────────────── */}
        {view === 'table' && (
          isLoading ? (
            <div className="loading-overlay" style={{ minHeight: 320 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Loading accounts…
                </span>
              </div>
            </div>
          ) : (
            <AccountsTable
              accounts={accounts}
              total={total}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              onRowClick={acct => setSlideOver(acct)}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onBulkActivate={() => bulkSetActive(true)}
              onBulkDeactivate={() => bulkSetActive(false)}
              bulkLoading={bulkMutation.isPending}
            />
          )
        )}

        {view === 'tree' && (
          <AccountTreeView
            typeFilter={typeFilter}
            postingFilter={postFilter}
          />
        )}

        {view === 'group' && (
          groupLoading ? (
            <div className="loading-overlay" style={{ minHeight: 320 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
                  Building groups…
                </span>
              </div>
            </div>
          ) : (
            <>
              {total > groupAccounts.length && (
                <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                  Showing the first {groupAccounts.length} accounts in Group view. Use Table search or filters for the full list.
                </div>
              )}
              <AccountGroupView accounts={groupAccounts} />
            </>
          )
        )}
      </div>

      {/* ── Info banner ───────────────────────────────────────────── */}
      <div style={{
        marginTop: 20, padding: '12px 16px', background: 'var(--color-primary-light)',
        borderRadius: 'var(--radius)', border: '1px solid #bfdbfe',
        display: 'flex', gap: 10, alignItems: 'flex-start',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
        </svg>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
          <strong>10-digit hierarchy:</strong>&nbsp;
          01 = Main Category &nbsp;|&nbsp; 0101 = Group &nbsp;|&nbsp; 010110 = Sub-Group &nbsp;|&nbsp; 0101100001 = Posting Account.
          &nbsp; Tree view is the primary analysis view; table view is for maintenance and export.
          &nbsp; System accounts <strong>(SYS)</strong> cannot be deactivated.
          &nbsp; Use Table view to edit account details.
        </div>
      </div>

      {/* ── Bulk CSV Import Modal ─────────────────────────────────── */}
      <BulkImportModal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: accountsQueryKey });
        }}
      />

      {/* ── Template Import Modal ─────────────────────────────────── */}
      <ImportTemplateModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onDone={() => {
          queryClient.invalidateQueries({ queryKey: accountsQueryKey });
        }}
      />

      {/* ── Slide-Over Edit Panel ─────────────────────────────────── */}
      <AccountSlideOver
        account={slideOver}
        onClose={() => setSlideOver(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: accountsQueryKey });
          // Update the slide-over with refreshed data after save
        }}
      />
    </>
  );
}
