'use client';

import { useMemo } from 'react';
import { useSaleReturnsList } from '@/lib/api/sale-returns';
import { TransactionAnalyticsView, type AnalyticsRow } from '@/components/shared/TransactionAnalyticsView';
import type { AppFormatSettingsSource } from '@/lib/app-settings';

interface SaleReturnAnalyticsViewProps {
  settings?: AppFormatSettingsSource | null;
  onNewReturn: () => void;
  onPostedReturns: () => void;
}

export function SaleReturnAnalyticsView({ settings, onNewReturn, onPostedReturns }: SaleReturnAnalyticsViewProps) {
  const query = useSaleReturnsList({ page: 1, limit: 200, status: 'Posted' });
  const rows = useMemo<AnalyticsRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.sale_return_number,
    documentDate: row.sale_return_date,
    partyName: `${row.customer_code ? `${row.customer_code} - ` : ''}${row.customer_name}`,
    paymentType: row.payment_type,
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionAnalyticsView
      title="Sale Return Analysis"
      documentLabel="Sale Returns"
      postedListLabel="Posted Returns"
      rows={rows}
      totalRecords={query.data?.total ?? 0}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onNew={onNewReturn}
      onPostedList={onPostedReturns}
      onRefresh={() => query.refetch()}
    />
  );
}
