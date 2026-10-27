'use client';

import { useMemo } from 'react';
import { usePurchaseReturnsList } from '@/lib/api/purchase-returns';
import { TransactionAnalyticsView, type AnalyticsRow } from '@/components/shared/TransactionAnalyticsView';
import type { AppFormatSettingsSource } from '@/lib/app-settings';

interface PurchaseReturnAnalyticsViewProps {
  settings?: AppFormatSettingsSource | null;
  onNewReturn: () => void;
  onPostedReturns: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PurchaseReturnAnalyticsView({ settings, onNewReturn, onPostedReturns, newDisabled = false, newDisabledReason }: PurchaseReturnAnalyticsViewProps) {
  const query = usePurchaseReturnsList({ page: 1, limit: 200, status: 'Posted' });
  const rows = useMemo<AnalyticsRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.purchase_return_number,
    documentDate: row.purchase_return_date,
    partyName: `${row.supplier_code ? `${row.supplier_code} - ` : ''}${row.supplier_name}`,
    paymentType: row.payment_type,
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionAnalyticsView
      title="Purchase Return Analysis"
      help={(
        <>
          <p>This screen shows charts and totals for posted purchase returns. Draft documents are not counted.</p>
          <p>See totals by month, cash and credit, and your top Suppliers. Select Posted Returns to see the full list, or New to enter one.</p>
        </>
      )}
      documentLabel="Purchase Returns"
      partyLabel="Supplier"
      postedListLabel="Posted Returns"
      rows={rows}
      totalRecords={query.data?.total ?? 0}
      loading={query.isLoading}
      fetching={query.isFetching}
      error={query.error}
      settings={settings}
      onNew={onNewReturn}
      onPostedList={onPostedReturns}
      onRefresh={() => query.refetch()}
      newDisabled={newDisabled}
      newDisabledReason={newDisabledReason}
    />
  );
}
