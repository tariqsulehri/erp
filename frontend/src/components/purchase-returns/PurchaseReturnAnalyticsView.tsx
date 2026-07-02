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
      documentLabel="Purchase Returns"
      postedListLabel="Posted Returns"
      rows={rows}
      totalRecords={query.data?.total ?? 0}
      loading={query.isLoading}
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
