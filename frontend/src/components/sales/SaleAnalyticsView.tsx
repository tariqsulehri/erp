'use client';

import { useMemo } from 'react';
import { useSaleInvoicesList } from '@/lib/api/sales';
import { TransactionAnalyticsView, type AnalyticsRow } from '@/components/shared/TransactionAnalyticsView';
import type { AppFormatSettingsSource } from '@/lib/app-settings';

interface SaleAnalyticsViewProps {
  settings?: AppFormatSettingsSource | null;
  onNewSale: () => void;
  onPostedSales: () => void;
}

export function SaleAnalyticsView({ settings, onNewSale, onPostedSales }: SaleAnalyticsViewProps) {
  const query = useSaleInvoicesList({ page: 1, limit: 200, status: 'Posted' });
  const rows = useMemo<AnalyticsRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.sale_number,
    documentDate: row.sale_date,
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
      title="Sales Analysis"
      documentLabel="Sales"
      postedListLabel="Posted Sales"
      rows={rows}
      totalRecords={query.data?.total ?? 0}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onNew={onNewSale}
      onPostedList={onPostedSales}
      onRefresh={() => query.refetch()}
    />
  );
}
