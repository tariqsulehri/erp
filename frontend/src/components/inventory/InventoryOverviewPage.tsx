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
import { ChartCard, DonutChart, RankedBars } from '@/components/analytics/ProCharts';
import { useChartTheme } from '@/components/analytics/chart-palette';
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
  const theme = useChartTheme();
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
  const placeKindMap = new Map<string, { name: string; value: number; count: number }>();

  for (const line of stockLines) {
    const name = `${line.place_name} (${line.place_kind})`;
    const row = valueByPlace.get(name) ?? { name, value: 0, count: 0 };
    row.value += Number(line.value);
    row.count += 1;
    valueByPlace.set(name, row);

    const kind = line.place_kind;
    const kindRow = placeKindMap.get(kind) ?? { name: kind, value: 0, count: 0 };
    kindRow.value += Number(line.value);
    kindRow.count += 1;
    placeKindMap.set(kind, kindRow);
  }
  const places = [...valueByPlace.values()].sort((left, right) => right.value - left.value);
  const facilityData = [...placeKindMap.values()].map(entry => ({
    name: entry.name,
    value: Math.round(entry.value),
    count: entry.count,
    color: entry.name === 'Warehouse' ? theme.series.blue : theme.series.teal,
  }));

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

  const placeShareData = places.map((place, idx) => ({
    name: place.name.replace(/\s*\([^)]*\)$/, ''),
    value: Math.round(place.value),
    color: theme.categorical[idx % theme.categorical.length],
  }));

  const draftTransfers: number | null = draftTransfersQuery.data?.total ?? null;
  const postedTransfers: number | null = postedTransfersQuery.data?.total ?? null;
  const ledgerCheck = valuation.ledger_check;

  return (
    <div className="page-shell">
      {header}

      {ledgerCheck && !ledgerCheck.is_matched && (
        <InlineAlert tone="warning">
          Stock value does not match the Inventory account in the ledger. The difference is {formatMoney(ledgerCheck.difference, settings)}. Open the Stock Valuation report to check it.
        </InlineAlert>
      )}

      <section aria-label="Stock Totals">
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

      <div className="analytics-grid-2x2">
        <ChartCard
          title="Stock Value By Place"
          subtitle="Each Branch and Warehouse, largest first"
          headline={placeHeadline}
          help="Value of stock on hand at each Branch and Warehouse today."
          metric={{ label: 'Total Value', value: formatMoney(totalValue, settings) }}
          table={{
            columns: [{ key: 'place', label: 'Place' }, { key: 'lines', label: 'Items', numeric: true }, { key: 'value', label: 'Stock Value', numeric: true }],
            rows: places.map(row => ({ place: row.name, lines: formatCount(row.count, settings), value: formatMoney(row.value, settings) })),
          }}
        >
          {places.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <RankedBars
              variant="3d"
              items={places}
              total={totalValue}
              format={value => formatMoney(value, settings)}
              limit={5}
              countLabel={value => `${formatCount(value, settings)} Items`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Stock Value Distribution"
          subtitle="Capital allocation across inventory locations"
          headline={placeHeadline}
          help="Percentage share of total stock value held by each location."
          metric={{ label: 'Locations', value: formatCount(places.length, settings) }}
          table={{
            columns: [{ key: 'place', label: 'Place' }, { key: 'value', label: 'Stock Value', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: places.map(row => ({
              place: row.name,
              value: formatMoney(row.value, settings),
              share: `${totalValue > 0 ? (row.value / totalValue * 100).toFixed(1) : 0}%`,
            })),
          }}
        >
          {places.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <DonutChart
              variant="3d"
              items={placeShareData}
              centerValue={formatCount(places.length, settings)}
              centerLabel="locations"
              format={value => formatMoney(value, settings)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Most Valuable Items"
          subtitle="Items with the highest stock value, all places together"
          headline={itemHeadline}
          help="Items ranked by stock value today. Quantity is the total at every place you can see."
          metric={{ label: 'Unique SKUs', value: formatCount(itemCount, settings) }}
          table={{
            columns: [{ key: 'item', label: 'Item' }, { key: 'quantity', label: 'Quantity', numeric: true }, { key: 'value', label: 'Stock Value', numeric: true }],
            rows: topItems.slice(0, 50).map(row => ({ item: row.name, quantity: formatNumber(row.quantity, settings), value: formatMoney(row.value, settings) })),
          }}
        >
          {topItems.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <RankedBars
              variant="3d"
              items={topItems}
              total={totalValue}
              format={value => formatMoney(value, settings)}
              limit={5}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Stock By Facility Type"
          subtitle="Distribution of stock value between Warehouses and Branches"
          headline={facilityData.length > 0 ? `${facilityData[0].name} holds the largest share: ${totalValue > 0 ? (facilityData[0].value / totalValue * 100).toFixed(1) : 0}% of inventory capital.` : undefined}
          help="Compares stock stored in central Warehouses versus local distribution Branches."
          metric={{ label: 'Total Stock', value: formatMoney(totalValue, settings) }}
          table={{
            columns: [{ key: 'kind', label: 'Facility Type' }, { key: 'value', label: 'Stock Value', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: facilityData.map(row => ({
              kind: row.name,
              value: formatMoney(row.value, settings),
              share: `${totalValue > 0 ? (row.value / totalValue * 100).toFixed(1) : 0}%`,
            })),
          }}
        >
          {facilityData.length === 0 ? (
            <EmptyNote>No stock on hand yet.</EmptyNote>
          ) : (
            <DonutChart
              variant="3d"
              items={facilityData}
              centerValue={formatCount(itemCount, settings)}
              centerLabel="items"
              format={value => formatMoney(value, settings)}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
