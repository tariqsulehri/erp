'use client';

import { useState } from 'react';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { type BranchRow, useBranchStockSummary } from '@/lib/api/branches';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { SearchField } from '@/components/ui/SearchField';
import { StockSummaryTable } from '@/components/warehouses/StockSummaryTable';

/** Stock physically held at one Branch: what the Branch can sell. */
export function BranchStockView({ branch, onBack }: { branch: BranchRow; onBack: () => void }) {
  const { data: generalSettings } = useGeneralSettings();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const stockQuery = useBranchStockSummary(branch.id, { page, limit: 100, search: search.trim() || undefined });
  const total = stockQuery.data?.pagination.total ?? 0;
  const error = stockQuery.error ? friendlyErrorMessage(stockQuery.error, 'Unable to load Branch Stock.') : '';

  return (
    <main className="page-shell">
      <PageHeader
        title={`Stock At ${branch.name}`}
        description="Items this Branch holds and can sell. Stock arrives by Stock Transfer from a Warehouse or another Branch."
        actions={(
          <>
            <Button variant="secondary" icon={<IconArrowLeft size={16} stroke={1.8} />} onClick={onBack}>Back To List</Button>
            <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={() => stockQuery.refetch()} loading={stockQuery.isFetching && !stockQuery.isLoading}>Refresh</Button>
          </>
        )}
      />

      {error && <InlineAlert tone="danger">{error}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-bar-grow">
            <SearchField
              label="Search Stock"
              value={searchText}
              onChange={setSearchText}
              onSubmit={() => { setSearch(searchText.trim()); setPage(1); }}
              placeholder="Search Item Or Location, then press Enter"
            />
          </div>
          {(search || searchText) && (
            <Button variant="ghost" onClick={() => { setSearchText(''); setSearch(''); setPage(1); }}>Clear</Button>
          )}
        </div>

        <div className="table-scroll">
          <StockSummaryTable placeLabel="Branch" rows={stockQuery.data?.data ?? []} loading={stockQuery.isLoading} isFiltered={Boolean(search)} settings={generalSettings} />
        </div>

        <PaginationBar
          page={page}
          totalPages={stockQuery.data?.pagination.pages || 1}
          totalRecords={total}
          recordLabel={total === 1 ? 'Stock Row' : 'Stock Rows'}
          onPageChange={setPage}
        />
      </section>
    </main>
  );
}
