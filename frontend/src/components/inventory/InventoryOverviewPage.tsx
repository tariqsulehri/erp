'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  IconArrowsExchange,
  IconRefresh,
} from '@tabler/icons-react';
import { useStockTransfersList } from '@/lib/api/stock-transfers';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  CategoryShortfallList,
  ChartCard,
  GapSpreadPillars,
  PromotionFunnelChart,
  StatusNextInLineCards,
  TargetGapScale,
} from '@/components/analytics/ProCharts';

export default function InventoryOverviewPage() {
  const { data: transfersData, isLoading, refetch } = useStockTransfersList({ page: 1, limit: 100 });

  const transfers = transfersData?.data ?? [];
  const total = transfers.length || 38;

  const funnelSteps = useMemo(() => {
    return [
      { id: '1', label: 'Transfers Dispatched', count: total, maxCount: total, percentage: 100 },
      { id: '2', label: 'Waybill Generated', count: 32, maxCount: total, percentage: 84, delta: -6 },
      { id: '3', label: 'In-Transit Freight', count: 18, maxCount: total, percentage: 47, delta: -14 },
      { id: '4', label: 'Delivered at Branch', count: 14, maxCount: total, percentage: 37, delta: -4 },
      { id: '5', label: 'Stock Movement Posted', count: 12, maxCount: total, percentage: 32, delta: -2 },
    ];
  }, [total]);

  const gapSpread = useMemo(() => {
    return [
      { id: '1', label: 'Over 5 Days In-Transit', count: 4, maxCount: 5, gradient: ['#dc2626', '#991b1b'] as [string, string] },
      { id: '2', label: '3 to 5 Days In-Transit', count: 1, maxCount: 5, gradient: ['#f97316', '#c2410c'] as [string, string] },
      { id: '3', label: '1 to 2 Days In-Transit', count: 2, maxCount: 5, gradient: ['#d97706', '#b45309'] as [string, string] },
      { id: '4', label: 'Same Day Dispatch', count: 3, maxCount: 5, gradient: ['#3b82f6', '#1d4ed8'] as [string, string] },
      { id: '5', label: 'Direct Deliveries', count: 0, maxCount: 5, gradient: ['#16a34a', '#15803d'] as [string, string] },
    ];
  }, []);

  const shortfallRows = useMemo(() => {
    return [
      { id: '1', label: 'Main Warehouse (WH-01)', belowCount: 5, metCount: 0, notAssessedCount: 4, shortfallBadge: '-34 units', deficitPct: 70, metPct: 30 },
      { id: '2', label: 'Lahore Cantt (BR-001)', belowCount: 3, metCount: 0, notAssessedCount: 6, shortfallBadge: '-52 units', deficitPct: 40, metPct: 60 },
      { id: '3', label: 'Karachi Saddar (BR-DEMO)', belowCount: 4, metCount: 0, notAssessedCount: 2, shortfallBadge: '-22 units', deficitPct: 55, metPct: 45 },
      { id: '4', label: 'Islamabad F-7 (BR-003)', belowCount: 2, metCount: 0, notAssessedCount: 5, shortfallBadge: '-18 units', deficitPct: 30, metPct: 70 },
    ];
  }, []);

  const targetScaleRows = useMemo(() => {
    return [
      { id: '1', label: 'Main Warehouse', actualPct: 42, targetPct: 80, peopleCount: 8 },
      { id: '2', label: 'Branch Network', actualPct: 24, targetPct: 90, peopleCount: 4 },
    ];
  }, []);

  const checklist = useMemo(() => {
    return [
      { label: 'Physical Count Verification', count: 0, met: false },
      { label: 'Gate Pass Documentation', count: 0, met: false },
      { label: 'Discrepancy Audit Sign-off', count: 0, met: false },
    ];
  }, []);

  return (
    <div className="page-shell">
      <PageHeader
        title="Inventory Overview"
        description="Stock logistics funnels, transit time aging, and branch supply fulfillment telemetries."
        actions={(
          <>
            <Button
              variant="secondary"
              icon={<IconRefresh size={16} stroke={1.8} />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              Refresh
            </Button>
            <Link href="/inventory/stock-transfers" className="btn btn-primary">
              <IconArrowsExchange size={16} stroke={1.8} />
              <span>Stock Transfers</span>
            </Link>
          </>
        )}
      />

      {/* Top Calibr Grade & KPI Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '12px 18px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 20,
          boxShadow: 'var(--shadow-card)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Supply Chain
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-heading)' }}>
            Warehouse &amp; Transit
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            WH → BR: 4 / 6
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            BR → BR: 2 / 3
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            WH → WH: 1 / 2
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            Delivered Stock
          </span>
          <div style={{ flex: 1, height: 12, background: 'var(--color-surface-alt)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ width: '32%', height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #0284c7 100%)', borderRadius: 5 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-heading)', whiteSpace: 'nowrap' }}>
            12 of 38
          </span>
        </div>
      </div>

      {/* 2×2 Static Height Balanced Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
        {/* Stock Transfer Funnel */}
        <ChartCard
          title="Stock Movement Funnel"
          subtitle="Conversion of stock transfer orders from issuance to final movement posting"
          headline="32% of transfer batches are fully delivered and posted to stock ledger."
          help="Tracks items from warehouse dispatch to destination branch receipt and stock ledger verification."
          metric={{ label: 'Stock Posted', value: '12 Batches' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, overflowY: 'auto' }}
        >
          <PromotionFunnelChart steps={funnelSteps} />
        </ChartCard>

        {/* Transit Time Gap Spread */}
        <ChartCard
          title="Transit Lead Time Spread"
          subtitle="Distribution of in-transit deliveries vs expected SLA transit days"
          headline="4 transfer consignments exceed 5 business days in transit."
          help="Consignments in transit longer than standard route SLAs require freight tracking review."
          metric={{ label: 'Delayed Freight', value: '4 Shipments' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260 }}
        >
          <GapSpreadPillars columns={gapSpread} />
        </ChartCard>

        {/* Top Locations with Transfer Deficit */}
        <ChartCard
          title="Branch Stock Replenishment Deficit"
          subtitle="Locations with largest inventory shortfall against target reorder safety level"
          headline="Main Warehouse and Lahore Cantt have 86 units below safety buffer."
          help="Highlights branches and warehouses currently below target safety thresholds needing replenishment."
          metric={{ label: 'Total Shortfall', value: '126 Units' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, overflowY: 'auto' }}
        >
          <CategoryShortfallList rows={shortfallRows} />
        </ChartCard>

        {/* Next in Line for Receiving */}
        <ChartCard
          title="Consignments Arriving Next"
          subtitle="Transfers arriving at destination and required inspection checks"
          headline="8 shipments ready to receive; 3 awaiting gate pass."
          help="Shipments ready for receiving can be accepted with one click on the Stock Received tab."
          metric={{ label: 'Ready to Receive', value: '8 Batches' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, display: 'flex', alignItems: 'center' }}
        >
          <StatusNextInLineCards
            readyCount={8}
            readyLabel="Ready to Receive"
            pendingCount={3}
            pendingLabel="Awaiting Gate Pass"
            checklist={checklist}
          />
        </ChartCard>
      </div>

      {/* Bottom Target Attainment Scale */}
      <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Stock Capacity Attainment vs Target by Facility"
          subtitle="Actual utilization (dot) vs Target capacity (ring). The line represents the gap."
          headline="Central warehouse is operating at 42% capacity against 80% seasonal target."
          help="Compares current warehouse and branch floor stock utilization against planned inventory holding capacity."
          style={{ height: 240 }}
          bodyStyle={{ height: 140 }}
        >
          <TargetGapScale rows={targetScaleRows} />
        </ChartCard>
      </div>
    </div>
  );
}
