'use client';

/**
 * Chart of Accounts — main list page.
 *
 * Features:
 *  - Table / Tree / Group view modes
 *  - Filter bar: account type select + posting/header segmented filter
 *  - Full-text search (table view)
 *  - Checkbox row selection + bulk activate/deactivate
 *  - Click row → AccountSlideOver side panel beside the list
 *  - Export all Chart of Accounts rows to CSV
 *  - Print / PDF formatted Chart of Accounts report
 *  - Import Template (only when no accounts exist)
 */

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconDownload,
  IconFileImport,
  IconLayoutGrid,
  IconListTree,
  IconPlus,
  IconPrinter,
  IconTable,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { accountsQueryKey, fetchAllAccountsForExport, useAccountsList, useBulkSetAccountActive, useOpeningBalanceSummary, type AccountListItem } from '@/lib/api/accounts';
import { useCompanyProfile, useGeneralSettings } from '@/lib/api/settings';
import { AccountsTable }     from '@/components/tables/AccountsTable';
import { AccountTreeView }   from '@/components/accounts/AccountTreeView';
import { AccountGroupView }  from '@/components/accounts/AccountGroupView';
import { LoadingState }      from '@/components/ui/LoadingSpinner';
import { AccountSlideOver }  from '@/components/accounts/AccountSlideOver';
import { printChartOfAccountsReport } from '@/components/accounts/ChartOfAccountsPrintHtml';
import { ImportTemplateModal } from '@/components/modals/ImportTemplateModal';
import { BulkImportModal }   from '@/components/modals/BulkImportModal';
import { getAccountLevelLabel, getParentAccountCode } from '@/modules/accounts/account-code';
import { formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Tabs } from '@/components/ui/Tabs';

const PAGE_SIZE = 20;
type ViewMode    = 'table' | 'tree' | 'group';
type PostingFilter = 'all' | 'posting' | 'header';

const ACCOUNT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'Asset', label: 'Assets (01)' },
  { value: 'Liability', label: 'Liabilities (02)' },
  { value: 'Equity', label: 'Equity (03)' },
  { value: 'Revenue', label: 'Revenue (04)' },
  { value: 'Expense', label: 'Expenses (05)' },
];

const POSTING_OPTIONS: Array<{ value: PostingFilter; label: string }> = [
  { value: 'all',     label: 'All Levels' },
  { value: 'posting', label: 'Posting Accounts Only' },
  { value: 'header',  label: 'Header Accounts Only' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active Accounts' },
  { value: 'inactive', label: 'Inactive Accounts' },
];

const DEPTH_OPTIONS = [
  { value: '4', label: 'All Levels (Down to Posting)' },
  { value: '3', label: 'Up to Sub-Groups (L1–L3)' },
  { value: '2', label: 'Up to Groups (L1–L2)' },
  { value: '1', label: 'Main Categories Only (L1)' },
];

const VIEW_TABS: Array<{ value: ViewMode; label: string; icon: React.ReactNode }> = [
  { value: 'table', label: 'Table', icon: <IconTable size={16} stroke={1.8} /> },
  { value: 'tree',  label: 'Tree',  icon: <IconListTree size={16} stroke={1.8} /> },
  { value: 'group', label: 'Group', icon: <IconLayoutGrid size={16} stroke={1.8} /> },
];

/* ── CSV export utility ─────────────────────────────────────────────── */
function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCSV(accounts: AccountListItem[]) {
  const headers = [
    'Code',
    'Name',
    'Parent Code',
    'Account Type',
    'Level',
    'Account Kind',
    'Normal Balance',
    'Opening Balance',
    'Current Balance',
    'Opening Balance Date',
    'Active',
    'System Account',
    'Description',
    'Created At',
    'Updated At',
  ];
  const rows = accounts.map(a => [
    a.code,
    a.name,
    getParentAccountCode(a.code) ?? '',
    a.account_type,
    getAccountLevelLabel(a.code),
    a.is_posting ? 'Posting' : 'Header',
    a.normal_balance,
    a.opening_balance ?? '0',
    a.current_balance ?? '0',
    a.opening_balance_date ? a.opening_balance_date.slice(0, 10) : '',
    a.is_active  ? 'Yes' : 'No',
    a.is_system  ? 'Yes' : 'No',
    a.description ?? '',
    a.created_at ? a.created_at.slice(0, 10) : '',
    a.updated_at ? a.updated_at.slice(0, 10) : '',
  ]);
  const csv = [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
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
  const [typeFilter,   setTypeFilter]   = useState('');
  const [postFilter,   setPostFilter]   = useState<PostingFilter>('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [depthFilter,  setDepthFilter]  = useState('4');
  const [showImport,     setShowImport]     = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [slideOver,   setSlideOver]   = useState<AccountListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  const queryClient = useQueryClient();
  const { data: generalSettings } = useGeneralSettings();
  const { data: company } = useCompanyProfile();
  const { data: openingSummary } = useOpeningBalanceSummary();

  /* ── Table / stats query ──────────────────────────────────────────── */
  const { data, isLoading, isFetching, error } = useAccountsList(
    {
      page,
      limit: PAGE_SIZE,
      search:     search     || undefined,
      type:       typeFilter || undefined,
      is_active:  statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      is_posting: postFilter === 'posting' ? true : postFilter === 'header' ? false : undefined,
    },
  );

  /* ── Larger list only when the grouped view is open ────────────────── */
  const { data: groupData, isLoading: groupLoading } = useAccountsList(
    {
      page: 1, limit: 200,
      search:     search     || undefined,
      type:       typeFilter || undefined,
      is_active:  statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
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

  const accounts    = useMemo(() => data?.data ?? [], [data]);
  const groupAccounts = groupData?.data ?? [];
  const total       = data?.pagination?.total ?? 0;
  const totalText   = formatNumber(total, { ...(generalSettings ?? {}), decimal_places: 0 });

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
    setSearchText(''); setSearch(''); setTypeFilter(''); setPostFilter('all'); setStatusFilter(''); setDepthFilter('4'); setPage(1);
  };
  const hasFilters = search || typeFilter || postFilter !== 'all' || statusFilter || depthFilter !== '4';

  const applySearch = () => {
    setSearch(searchText.trim());
    setPage(1);
  };

  const exportAllAccounts = async () => {
    try {
      setExportError('');
      setExporting(true);
      const allAccounts = await fetchAllAccountsForExport();
      exportCSV(allAccounts);
    } catch (err) {
      setExportError(friendlyErrorMessage(err, 'Could not export the Chart Of Accounts. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const printAllAccounts = async () => {
    try {
      setExportError('');
      setPrintingPdf(true);
      const allAccounts = await fetchAllAccountsForExport();
      printChartOfAccountsReport({ accounts: allAccounts, company, generalSettings });
    } catch (err) {
      setExportError(friendlyErrorMessage(err, 'Could not prepare the Chart Of Accounts PDF. Please try again.'));
    } finally {
      setPrintingPdf(false);
    }
  };

  const busyExporting = total === 0 || exporting || printingPdf;
  const groupTruncated = view === 'group' && !groupLoading && total > groupAccounts.length;

  return (
    <main className="page-shell">
      <PageHeader
        title="Chart Of Accounts"
        description="Your company's accounts, in levels. Each code has 10 digits: Main Category, Group, Sub-Group, then Posting Account."
        help={(
          <>
            <p>This screen lists all accounts of your company. Vouchers use Posting Accounts; the higher levels only group them.</p>
            <ul>
              <li>New Account opens a step-by-step form. The code is given automatically.</li>
              <li>Click an account to see or change its details and Opening Balance.</li>
              <li>Export CSV and Print Or PDF give you the full list.</li>
            </ul>
            <p>System accounts cannot be deactivated.</p>
          </>
        )}
        actions={(
          <>
            <Button
              icon={<IconDownload size={16} stroke={1.8} />}
              onClick={exportAllAccounts}
              disabled={busyExporting}
              loading={exporting}
              title="Download all accounts as a CSV file"
            >
              Export CSV
            </Button>
            <Button
              icon={<IconPrinter size={16} stroke={1.8} />}
              onClick={printAllAccounts}
              disabled={busyExporting}
              loading={printingPdf}
              title="Open a printable Chart Of Accounts that you can save as PDF"
            >
              Print Or PDF
            </Button>
            {!isLoading && total === 0 && (
              <Button icon={<IconFileImport size={16} stroke={1.8} />} onClick={() => setShowImport(true)}>
                Import Template
              </Button>
            )}
            {total > 0 && (
              <Button icon={<IconUpload size={16} stroke={1.8} />} onClick={() => setShowBulkImport(true)}>
                Bulk Import
              </Button>
            )}
            <Link href="/accounts/new" className="btn-primary">
              <IconPlus size={16} stroke={1.8} aria-hidden />
              New Account
            </Link>
          </>
        )}
      />

      {error && <InlineAlert tone="danger">{friendlyErrorMessage(error, 'Could not load accounts. Please try again.')}</InlineAlert>}
      {exportError && <InlineAlert tone="danger">{exportError}</InlineAlert>}
      {openingSummary && !openingSummary.is_balanced && (
        <InlineAlert tone="warning">
          Opening Balances are not balanced. Total Debit {formatNumber(Number(openingSummary.total_debit), generalSettings)} and
          Total Credit {formatNumber(Number(openingSummary.total_credit), generalSettings)} differ
          by {formatNumber(Number(openingSummary.difference), generalSettings)}. The Trial Balance will not balance until they match.
        </InlineAlert>
      )}
      {openingSummary && openingSummary.accounts_without_date > 0 && (
        <InlineAlert tone="warning">
          {openingSummary.accounts_without_date} account(s) have an Opening Balance without an Opening Balance Date. Add the date you started using this system to each one.
        </InlineAlert>
      )}
      {groupTruncated && (
        <InlineAlert tone="warning">
          Group view shows the first {groupAccounts.length} accounts. Use the Table view with search or filters to see the full list.
        </InlineAlert>
      )}

      <Tabs label="Account Views" value={view} onChange={setView} items={VIEW_TABS} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <section className="panel" role="tabpanel" aria-labelledby={`tab-${view}`}>
          {/* ── Filter Bar ─────────────────────────────────────── */}
          <div className="filter-bar">
            {view === 'table' && (
              <>
                <div className="filter-bar-grow">
                  <SearchField
                    label="Search Accounts"
                    value={searchText}
                    onChange={setSearchText}
                    onSubmit={applySearch}
                    placeholder="Search by Account Code Or Name"
                  />
                </div>
                <Button onClick={applySearch} loading={isFetching}>Search</Button>
              </>
            )}

            <SearchableSelect
              placeholder="All Types"
              ariaLabel="Filter By Account Type"
              value={typeFilter}
              options={ACCOUNT_TYPE_OPTIONS}
              onChange={val => { setTypeFilter(val); setPage(1); }}
              style={{ width: 175 }}
            />

            <SearchableSelect
              placeholder="All Levels"
              ariaLabel="Filter By Account Level"
              value={postFilter}
              options={POSTING_OPTIONS}
              onChange={val => { setPostFilter(val as PostingFilter); setPage(1); }}
              style={{ width: 195 }}
            />

            {view === 'tree' && (
              <SearchableSelect
                placeholder="Hierarchy Depth"
                ariaLabel="Filter By Hierarchy Depth"
                value={depthFilter}
                options={DEPTH_OPTIONS}
                onChange={val => setDepthFilter(val)}
                style={{ width: 230 }}
              />
            )}

            {view !== 'tree' && (
              <SearchableSelect
                placeholder="All Statuses"
                ariaLabel="Filter By Account Status"
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={val => { setStatusFilter(val); setPage(1); }}
                style={{ width: 155 }}
              />
            )}

            {(hasFilters || searchText) && (
              <Button
                variant="ghost"
                icon={<IconX size={16} stroke={1.8} />}
                onClick={resetFilters}
                disabled={isFetching}
              >
                Clear
              </Button>
            )}

            {view !== 'tree' && (
              <div className="filter-bar-end" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {isLoading ? 'Loading…' : `${totalText} ${total === 1 ? 'Account' : 'Accounts'}`}
              </div>
            )}
          </div>

          {/* ── Content ─────────────────────────────────────────── */}
          {view === 'table' && (
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
              loading={isLoading}
              isFiltered={Boolean(hasFilters)}
              activeId={slideOver?.id ?? null}
            />
          )}

          {view === 'tree' && (
            <AccountTreeView
              typeFilter={typeFilter}
              postingFilter={postFilter}
              depthFilter={Number(depthFilter) || 4}
            />
          )}

          {view === 'group' && (
            <div className="table-scroll">
              {groupLoading ? (
                <LoadingState message="Loading Groups…" minHeight={200} />
              ) : (
                <AccountGroupView accounts={groupAccounts} />
              )}
            </div>
          )}
        </section>

        {/* ── Account Side Panel ────────────────────────────────── */}
        <AccountSlideOver
          account={slideOver}
          onClose={() => setSlideOver(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: accountsQueryKey });
          }}
        />
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
    </main>
  );
}
