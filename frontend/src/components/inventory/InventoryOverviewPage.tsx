'use client';

import Link from 'next/link';
import {
  IconArrowsExchange,
  IconBuildingWarehouse,
  IconCoin,
  IconPackage,
  IconRefresh,
  IconScale,
} from '@tabler/icons-react';
import { useStockValuationReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { useStockTransfersList } from '@/lib/api/stock-transfers';
import { formatCount, formatMoney, formatNumber } from '@/lib/app-settings';
import { ChartCard, RankedBars } from '@/components/analytics/ProCharts';
import { todayInputDate } from '@/components/reports/LedgerReportHelpers';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatGrid, StatTile } from '@/components/ui/StatTile';

const OVERVIEW_HELP = (
  <>
    <p>A summary of stock on hand today, read from the stock history.</p>
    <ul>
      <li>Stock value is quantity times average cost, at each Branch and Warehouse you can see.</li>
      <li>Stock Transfers in Draft have not moved any stock yet.</li>
      <li>Use Refresh to load the latest figures.</li>
    </ul>
  </>
);

function EmptyNote({ children }: { children: string }) {
  return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <div className="empty-desc">{children}</div>
    </div>
  );
}

export default function InventoryOverviewPage() {
  const asOfDate = todayInputDate();
  const valuationQuery = useStockValuationReport({ as_of_date: asOfDate }, true);
  const draftTransfersQuery = useStockTransfersList({ page: 1, limit: 1, status: 'Draft' });
  const postedTransfersQuery = useStockTransfersList({ page: 1, limit: 1, status: 'Posted' });
  const { data: settings } = useGeneralSettings();
  const { data: valuation, isLoading, error, isFetching } = valuationQuery;

  const refreshAll = () => {
    void valuationQuery.refetch();
    void draftTransfersQuery.refetch();
    void postedTransfersQuery.refetch();
  };

  const header = (
    <PageHeader
      title="Inventory Overview"
      description="Stock on hand today, where it is held, and stock transfers."
      help={OVERVIEW_HELP}
      actions={(
        <>
          <Button variant="secondary" icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshAll} loading={isFetching}>
            Refresh
          </Button>
          <Link href="/inventory/stock-transfers" className="btn btn-primary">
            <IconArrowsExchange size={16} stroke={1.8} />
            <span>Open Stock Transfers</span>
          </Link>
        </>
      )}
    />
  );

  if (isLoading || error || !valuation) {
    return (
      <div className="page-shell">
        {header}
        {error && <InlineAlert tone="danger">Stock figures could not be loaded. Please press Refresh to try again.</InlineAlert>}
        {isLoading && <LoadingState message="Loading Inventory Overview…" minHeight={280} />}
      </div>
    );
  }

  const stockLines = valuation.lines.filter(line => Number(line.quantity) > 0);
  const itemCount = new Set(stockLines.map(line => line.item_id)).size;

  const valueByPlace = new Map<string, { name: string; value: number; count: number }>();
  for (const line of stockLines) {
    const name = `${line.place_name} (${line.place_kind})`;
    const row = valueByPlace.get(name) ?? { name, value: 0, count: 0 };
    row.value += Number(line.value);
    row.count += 1;
    valueByPlace.set(name, row);
  }
  const places = [...valueByPlace.values()].sort((left, right) => right.value - left.value);

  const valueByItem = new Map<string, { name: string; value: number; quantity: number }>();
  for (const line of stockLines) {
    const row = valueByItem.get(line.item_id) ?? { name: `${line.item_code} · ${line.item_name}`, value: 0, quantity: 0 };
    row.value += Number(line.value);
    row.quantity += Number(line.quantity);
    valueByItem.set(line.item_id, row);
  }
  const topItems = [...valueByItem.values()].sort((left, right) => right.value - left.value);

  const totalValue = Number(valuation.totals.value);
  const placeHeadline = places[0] && totalValue > 0
    ? `${places[0].name} holds ${(places[0].value / totalValue * 100).toFixed(1)}% of the stock value.`
    : undefined;
  const itemHeadline = topItems[0] && totalValue > 0
    ? `${topItems[0].name} is the most valuable item in stock, ${(topItems[0].value / totalValue * 100).toFixed(1)}% of the total.`
    : undefined;

  const draftTransfers: number | null = draftTransfersQuery.data?.total ?? null;
  const postedTransfers: number | null = postedTransfersQuery.data?.total ?? null;
  const ledgerCheck = valuation.ledger_check;

  return (
    <div className="page-shell">
      {header}

      {ledgerCheck && !ledgerCheck.is_matched && (
        <div style={{ marginBottom: 16 }}>
          <InlineAlert tone="warning">
            Stock value does not match the Inventory account in the ledger. The difference is {formatMoney(ledgerCheck.difference, settings)}. Open the Stock Valuation report to check it.
          </InlineAlert>
        </div>
      )}

      <section aria-label="Stock Totals" style={{ marginBottom: 20 }}>
        <StatGrid>
          <StatTile
            label="Stock Value" tone="blue" icon={<IconCoin />}
            value={formatMoney(valuation.totals.value, settings)}
            help="Quantity times average cost for all stock on hand today, at the places you can see."
            href="/reports?report=stock-valuation"
          />
          <StatTile
            label="Items In Stock" tone="teal" icon={<IconPackage />}
            value={formatCount(itemCount, settings)}
            help="Number of different items with stock on hand above zero."
          />
          <StatTile
            label="Places Holding Stock" tone="violet" icon={<IconBuildingWarehouse />}
            value={formatCount(places.length, settings)}
            help="Branches and Warehouses that hold at least one item."
          />
          <StatTile
            label="Draft Stock Transfers" tone="amber" icon={<IconArrowsExchange />}
            value={draftTransfers === null ? '—' : formatCount(draftTransfers, settings)}
            help="Stock Transfers saved but not posted. They have not moved any stock yet."
            detail={postedTransfers === null ? undefined : `${formatCount(postedTransfers, settings)} posted`}
            href="/inventory/stock-transfers"
          />
          {ledgerCheck && (
            <StatTile
              label="Ledger Check" tone={ledgerCheck.is_matched ? 'teal' : 'rose'} icon={<IconScale />}
              value={ledgerCheck.is_matched ? 'Matched' : formatMoney(ledgerCheck.difference, settings)}
              help="Compares stock value with the balance of the Inventory account in the ledger. They should be equal."
            />
          )}
        </StatGrid>
      </section>

      <div className="layout-cols-2">
        <ChartCard
          title="Stock Value By Place"
          subtitle="Each Branch and Warehouse, largest first"
          headline={placeHeadline}
          help="Value of stock on hand at each Branch and Warehouse today."
          table={{
            columns: [{ key: 'place', label: 'Place' }, { key: 'lines', label: 'Items', numeric: true }, { key: 'value', label: 'Stock Value', numeric: true }],
            rows: places.map(row => ({ place: row.name, lines: formatCount(row.count, settings), value: formatMoney(row.value, settings) })),
          }}
        >
          {places.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <RankedBars
              items={places}
              total={totalValue}
              format={value => formatMoney(value, settings)}
              limit={8}
              countLabel={value => `${formatCount(value, settings)} Items`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Most Valuable Items"
          subtitle="Items with the highest stock value, all places together"
          headline={itemHeadline}
          help="Items ranked by stock value today. Quantity is the total at every place you can see."
          table={{
            columns: [{ key: 'item', label: 'Item' }, { key: 'quantity', label: 'Quantity', numeric: true }, { key: 'value', label: 'Stock Value', numeric: true }],
            rows: topItems.slice(0, 50).map(row => ({ item: row.name, quantity: formatNumber(row.quantity, settings), value: formatMoney(row.value, settings) })),
          }}
        >
          {topItems.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <RankedBars
              items={topItems}
              total={totalValue}
              format={value => formatMoney(value, settings)}
              limit={8}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
