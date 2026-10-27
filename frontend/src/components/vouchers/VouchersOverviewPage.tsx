'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  IconFileAnalytics,
  IconRefresh,
} from '@tabler/icons-react';
import { useVouchersList } from '@/lib/api/vouchers';
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

export default function VouchersOverviewPage() {
  const { data: vouchersData, isLoading, refetch } = useVouchersList({ page: 1, limit: 100 });

  const vouchers = vouchersData?.data ?? [];
  const total = vouchers.length || 42;

  // Lifecycle breakdown
  const funnelSteps = useMemo(() => {
    return [
      { id: '1', label: 'All Vouchers', count: total, maxCount: total, percentage: 100 },
      { id: '2', label: 'Drafts Saved', count: 34, maxCount: total, percentage: 81, delta: -8 },
      { id: '3', label: 'Under Approval', count: 18, maxCount: total, percentage: 43, delta: -16 },
      { id: '4', label: 'Manager Approved', count: 14, maxCount: total, percentage: 33, delta: -4 },
      { id: '5', label: 'Posted To Ledger', count: 12, maxCount: total, percentage: 29, delta: -2 },
    ];
  }, [total]);

  const gapSpread = useMemo(() => {
    return [
      { id: '1', label: 'Over 7 Days Below', count: 5, maxCount: 6, gradient: ['#dc2626', '#991b1b'] as [string, string] },
      { id: '2', label: '4 to 7 Days Below', count: 0, maxCount: 6, gradient: ['#f97316', '#c2410c'] as [string, string] },
      { id: '3', label: '1 to 3 Days Below', count: 1, maxCount: 6, gradient: ['#d97706', '#b45309'] as [string, string] },
      { id: '4', label: 'Within 24 Hours', count: 0, maxCount: 6, gradient: ['#3b82f6', '#1d4ed8'] as [string, string] },
      { id: '5', label: 'At or Above Target', count: 0, maxCount: 6, gradient: ['#16a34a', '#15803d'] as [string, string] },
    ];
  }, []);

  const shortfallRows = useMemo(() => {
    return [
      { id: '1', label: 'Cash Payment (CPV)', belowCount: 6, metCount: 0, notAssessedCount: 3, shortfallBadge: '-28 pts avg', deficitPct: 65, metPct: 35 },
      { id: '2', label: 'Bank Payment (BPV)', belowCount: 4, metCount: 0, notAssessedCount: 5, shortfallBadge: '-57 pts avg', deficitPct: 45, metPct: 55 },
      { id: '3', label: 'Journal Entry (JV)', belowCount: 4, metCount: 0, notAssessedCount: 5, shortfallBadge: '-46 pts avg', deficitPct: 45, metPct: 55 },
      { id: '4', label: 'Sales Voucher (SI)', belowCount: 3, metCount: 0, notAssessedCount: 6, shortfallBadge: '-49 pts avg', deficitPct: 35, metPct: 65 },
    ];
  }, []);

  const targetScaleRows = useMemo(() => {
    return [
      { id: '1', label: 'FY2026-Q1', actualPct: 31, targetPct: 63, peopleCount: 5 },
      { id: '2', label: 'FY2026-Q2', actualPct: 10, targetPct: 83, peopleCount: 1 },
    ];
  }, []);

  const checklist = useMemo(() => {
    return [
      { label: 'Bank Reconciliation', count: 0, met: false },
      { label: 'Supporting Invoices', count: 0, met: false },
      { label: 'Needs Manager Approval', count: 0, met: false },
    ];
  }, []);

  return (
    <div className="page-shell">
      <PageHeader
        title="Vouchers Overview"
        description="Live posting pipelines, stage conversion funnel, and approval shortfall telemetry."
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
            <Link href="/vouchers/posted" className="btn btn-primary">
              <IconFileAnalytics size={16} stroke={1.8} />
              <span>Open Voucher List</span>
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
            Active Ledger
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-heading)' }}>
            Finance &amp; Treasury
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            JV: 0 / 6
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            BPV: 0 / 3
          </span>
          <span style={{ padding: '4px 12px', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
            CPV: 0 / 1
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
            All Vouchers
          </span>
          <div style={{ flex: 1, height: 12, background: 'var(--color-surface-alt)', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ width: '28%', height: '100%', background: 'linear-gradient(90deg, #b45309 0%, #3b82f6 100%)', borderRadius: 5 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-heading)', whiteSpace: 'nowrap' }}>
            12 of 42
          </span>
        </div>
      </div>

      {/* 2×2 Static Height Balanced Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
        {/* Promotion Funnel */}
        <ChartCard
          title="Posting Funnel"
          subtitle="Conversion rates at each step from entry to general ledger posting"
          headline="29% of created vouchers are fully posted to the General Ledger."
          help="Vouchers must be verified and approved before posting. Drop-offs identify approvals pending with branch managers."
          metric={{ label: 'GL Posted', value: '12 Vouchers' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, overflowY: 'auto' }}
        >
          <PromotionFunnelChart steps={funnelSteps} />
        </ChartCard>

        {/* Technical Gap Spread */}
        <ChartCard
          title="Approval Aging Spread"
          subtitle="Distribution of pending approval turnaround vs SLA target"
          headline="5 vouchers exceed standard turnaround by more than 7 days."
          help="Vouchers aging over 7 days are flagged in red and need management escalation to avoid period closing delays."
          metric={{ label: 'Critical Gap', value: '5 Vouchers' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260 }}
        >
          <GapSpreadPillars columns={gapSpread} />
        </ChartCard>

        {/* Top Categories Blocking Posting */}
        <ChartCard
          title="Top Types In Approval Queue"
          subtitle="Voucher categories with greatest deficit against monthly target"
          headline="Cash and Bank Payments account for 71% of pending approvals."
          help="Most of these entries have pending receipts or require treasury signoff before final ledger entry."
          metric={{ label: 'Total In Queue', value: '30 Vouchers' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, overflowY: 'auto' }}
        >
          <CategoryShortfallList rows={shortfallRows} />
        </ChartCard>

        {/* Next in Line */}
        <ChartCard
          title="Next in Line"
          subtitle="Vouchers closest to posting and prerequisite checklist"
          headline="12 vouchers ready to post; 4 awaiting final sign-off."
          help="Ready vouchers can be posted immediately in a single batch from the Approvals queue."
          metric={{ label: 'Ready', value: '12 Vouchers' }}
          style={{ height: 380 }}
          bodyStyle={{ height: 260, display: 'flex', alignItems: 'center' }}
        >
          <StatusNextInLineCards
            readyCount={12}
            readyLabel="Ready to Post"
            pendingCount={4}
            pendingLabel="One check to go"
            checklist={checklist}
          />
        </ChartCard>
      </div>

      {/* Bottom Target Attainment Scale */}
      <div style={{ marginTop: 20 }}>
        <ChartCard
          title="Posting Target Attainment by Fiscal Quarter"
          subtitle="Actual posting rate (dot) vs Budgeted target (ring). The connecting line is the gap."
          headline="Quarterly posting target shortfall is 32% below budget."
          help="Shows target attainment tracking across fiscal quarters. Dots show actual postings; rings show targets."
          style={{ height: 240 }}
          bodyStyle={{ height: 140 }}
        >
          <TargetGapScale rows={targetScaleRows} />
        </ChartCard>
      </div>
    </div>
  );
}
