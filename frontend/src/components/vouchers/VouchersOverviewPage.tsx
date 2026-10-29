'use client';

import Link from 'next/link';
import {
  IconCircleCheck,
  IconClipboardCheck,
  IconFileAnalytics,
  IconPencil,
  IconReceipt,
  IconRefresh,
} from '@tabler/icons-react';
import { useDashboardSummary } from '@/lib/api/dashboard';
import { useGeneralSettings } from '@/lib/api/settings';
import { useVouchersList } from '@/lib/api/vouchers';
import { formatCount, formatMoney } from '@/lib/app-settings';
import { ChartCard, DonutChart, MonthlyColumnChart, RankedBars } from '@/components/analytics/ProCharts';
import { compactAxis } from '@/components/analytics/chart-data';
import { useChartTheme, type ChartTheme } from '@/components/analytics/chart-palette';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { LoadingState } from '@/components/ui/LoadingSpinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatGrid, StatTile } from '@/components/ui/StatTile';

const OVERVIEW_HELP = (
  <>
    <p>A summary of every voucher in this company, read from the ledger.</p>
    <ul>
      <li>Posted vouchers are in the ledger and change account balances.</li>
      <li>Drafts and vouchers waiting for approval do not change balances until they are posted.</li>
      <li>Use Refresh to load the latest figures.</li>
    </ul>
  </>
);

function statusColor(theme: ChartTheme, status: string) {
  if (status === 'Posted') return theme.series.teal;
  if (status === 'Draft') return theme.series.amber;
  return theme.series.slate;
}

function EmptyNote({ children }: { children: string }) {
  return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <div className="empty-desc">{children}</div>
    </div>
  );
}

export default function VouchersOverviewPage() {
  const { data, isLoading, error, refetch, isFetching } = useDashboardSummary();
  const pendingQuery = useVouchersList({ approval_status: 'Pending', status: 'Draft', page: 1, limit: 1 });
  const { data: settings } = useGeneralSettings();
  const theme = useChartTheme();

  const header = (
    <PageHeader
      title="Vouchers Overview"
      description="Where all vouchers stand, and the amounts posted to the ledger."
      help={OVERVIEW_HELP}
      actions={(
        <>
          <Button
            variant="secondary"
            icon={<IconRefresh size={16} stroke={1.8} />}
            onClick={() => { void refetch(); void pendingQuery.refetch(); }}
            loading={isFetching}
          >
            Refresh
          </Button>
          <Link href="/vouchers/posted" className="btn btn-primary">
            <IconFileAnalytics size={16} stroke={1.8} />
            <span>Open Voucher List</span>
          </Link>
        </>
      )}
    />
  );

  if (isLoading || error || !data) {
    return (
      <div className="page-shell">
        {header}
        {error && <InlineAlert tone="danger">Voucher figures could not be loaded. Please press Refresh to try again.</InlineAlert>}
        {isLoading && <LoadingState message="Loading Vouchers Overview…" minHeight={280} />}
      </div>
    );
  }

  const { vouchers } = data;
  const pendingCount: number | null = pendingQuery.data?.pagination?.total ?? null;
  const axis = compactAxis(settings);

  const statusData = [
    { name: 'Posted', value: vouchers.posted },
    { name: 'Draft', value: vouchers.draft },
    { name: 'Voided', value: vouchers.voided },
  ].filter(row => row.value > 0);
  const statusHeadline = vouchers.total > 0
    ? `${formatCount(vouchers.posted, settings)} of ${formatCount(vouchers.total, settings)} vouchers are posted${vouchers.draft > 0 ? `; ${formatCount(vouchers.draft, settings)} drafts wait to be posted.` : '.'}`
    : undefined;

  const rankedTypes = vouchers.byType
    .map(row => ({ name: row.type, value: Number(row.total), count: row.count }))
    .sort((left, right) => right.value - left.value);
  const typeTotal = rankedTypes.reduce((sum, row) => sum + row.value, 0);
  const typeHeadline = rankedTypes[0] && typeTotal > 0
    ? `${rankedTypes[0].name} carries the most, ${(rankedTypes[0].value / typeTotal * 100).toFixed(1)}% of the posted amount.`
    : undefined;

  const typeVolumeData = vouchers.byType
    .map(row => ({ name: row.type, value: row.count }))
    .sort((left, right) => right.value - left.value);
  const totalVolume = typeVolumeData.reduce((sum, row) => sum + row.value, 0);
  const topVolumeType = typeVolumeData[0];
  const volumeHeadline = topVolumeType && totalVolume > 0
    ? `${topVolumeType.name} accounts for ${totalVolume > 0 ? Math.round(topVolumeType.value / totalVolume * 100) : 0}% of processed voucher activity (${formatCount(topVolumeType.value, settings)} of ${formatCount(totalVolume, settings)} vouchers).`
    : undefined;

  const monthlyPoints = vouchers.monthlyVolume.map(row => ({ monthKey: row.month, label: row.month, total: Number(row.total), count: row.count }));
  const monthlyAverage = monthlyPoints.length > 0 ? monthlyPoints.reduce((sum, row) => sum + row.total, 0) / monthlyPoints.length : 0;
  const peakMonth = monthlyPoints.reduce<(typeof monthlyPoints)[number] | null>((best, row) => (!best || row.total > best.total ? row : best), null);
  const monthlyHeadline = peakMonth && peakMonth.total > 0
    ? `${peakMonth.label} was the busiest month with ${formatMoney(peakMonth.total, settings)} posted in ${formatCount(peakMonth.count, settings)} vouchers.`
    : undefined;

  return (
    <div className="page-shell">
      {header}

      <section aria-label="Voucher Totals">
        <StatGrid>
          <StatTile
            label="All Vouchers" tone="blue" icon={<IconReceipt />}
            value={formatCount(vouchers.total, settings)}
            help="Every voucher in this company: Posted, Draft, and Voided."
            href="/vouchers/posted"
          />
          <StatTile
            label="Posted" tone="teal" icon={<IconCircleCheck />}
            value={formatCount(vouchers.posted, settings)}
            help="Vouchers in the ledger. They change account balances."
          />
          <StatTile
            label="Drafts" tone="amber" icon={<IconPencil />}
            value={formatCount(vouchers.draft, settings)}
            help="Saved but not posted. Drafts do not change balances."
          />
          <StatTile
            label="Waiting For Approval" tone="violet" icon={<IconClipboardCheck />}
            value={pendingCount === null ? '—' : formatCount(pendingCount, settings)}
            help="Draft vouchers sent for approval. A manager must approve them before they can be posted."
            href="/approvals"
          />
        </StatGrid>
      </section>

      <div className="analytics-grid-2x2">
        <ChartCard
          title="Posted Amount By Month"
          subtitle="Last 6 months; the dashed line is the monthly average"
          headline={monthlyHeadline}
          help="Total amount of vouchers posted in each of the last 6 months."
          metric={{ label: 'Monthly Average', value: formatMoney(monthlyAverage, settings) }}
          table={{
            columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'total', label: 'Posted Amount', numeric: true }],
            rows: vouchers.monthlyVolume.map(row => ({ month: row.month, count: formatCount(row.count, settings), total: formatMoney(row.total, settings) })),
          }}
        >
          {monthlyPoints.length === 0 ? (
            <EmptyNote>No posted vouchers in the last 6 months.</EmptyNote>
          ) : (
            <MonthlyColumnChart
              variant="3d"
              data={monthlyPoints}
              dataKey="total"
              seriesName="Posted Amount"
              average={monthlyAverage}
              format={value => formatMoney(value, settings)}
              axis={axis}
              tooltipTitle={point => String(point.label)}
              height={185}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Voucher Status"
          subtitle="All vouchers by where they stand"
          headline={statusHeadline}
          help="Posted vouchers are in the ledger. Drafts do not affect balances until they are posted. Voided vouchers are cancelled."
          metric={{ label: 'Posted Rate', value: `${vouchers.total > 0 ? Math.round(vouchers.posted / vouchers.total * 100) : 0}%` }}
          table={{
            columns: [{ key: 'status', label: 'Status' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: statusData.map(row => ({ status: row.name, count: formatCount(row.value, settings), share: `${vouchers.total > 0 ? Math.round(row.value / vouchers.total * 100) : 0}%` })),
          }}
        >
          {statusData.length === 0 ? (
            <EmptyNote>No vouchers yet.</EmptyNote>
          ) : (
            <DonutChart
              variant="3d"
              items={statusData.map(row => ({ name: row.name, value: row.value, color: statusColor(theme, row.name) }))}
              centerValue={formatCount(vouchers.total, settings)}
              centerLabel="vouchers"
              format={value => formatCount(value, settings)}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Posted Amount By Voucher Type"
          subtitle="Amount and share of all posted vouchers"
          headline={typeHeadline}
          help="Posted voucher amounts grouped by voucher type, largest first."
          metric={{ label: 'Total Posted', value: formatMoney(typeTotal, settings) }}
          table={{
            columns: [{ key: 'type', label: 'Voucher Type' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'total', label: 'Posted Amount', numeric: true }],
            rows: rankedTypes.map(row => ({ type: row.name, count: formatCount(row.count, settings), total: formatMoney(row.value, settings) })),
          }}
        >
          {rankedTypes.length === 0 ? (
            <EmptyNote>No posted vouchers yet.</EmptyNote>
          ) : (
            <RankedBars
              variant="3d"
              items={rankedTypes}
              total={typeTotal}
              format={value => formatMoney(value, settings)}
              limit={5}
              countLabel={value => `${formatCount(value, settings)} Vouchers`}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Voucher Volume By Type"
          subtitle="Transaction volume and operational share by type"
          headline={volumeHeadline}
          help="The count and share of transactions processed for each voucher type, read directly from the ledger."
          metric={{ label: 'Total Vouchers', value: formatCount(totalVolume, settings) }}
          table={{
            columns: [{ key: 'type', label: 'Voucher Type' }, { key: 'count', label: 'Vouchers', numeric: true }, { key: 'share', label: 'Share', numeric: true }],
            rows: typeVolumeData.map(row => ({
              type: row.name,
              count: formatCount(row.value, settings),
              share: `${totalVolume > 0 ? Math.round(row.value / totalVolume * 100) : 0}%`,
            })),
          }}
        >
          {typeVolumeData.length === 0 ? (
            <EmptyNote>No vouchers yet.</EmptyNote>
          ) : (
            <DonutChart
              variant="3d"
              items={typeVolumeData.map((row, index) => ({
                name: row.name,
                value: row.value,
                color: theme.categorical[index % theme.categorical.length],
              }))}
              centerValue={formatCount(totalVolume, settings)}
              centerLabel="vouchers"
              format={value => formatCount(value, settings)}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
