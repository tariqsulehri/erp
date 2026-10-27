'use client';

import { useMemo } from 'react';
import { useSaleInvoicesList } from '@/lib/api/sales';
import { TransactionAnalyticsView, type AnalyticsRow } from '@/components/shared/TransactionAnalyticsView';
import type { AppFormatSettingsSource } from '@/lib/app-settings';

interface SaleAnalyticsViewProps {
  settings?: AppFormatSettingsSource | null;
  onNewSale: () => void;
  onPostedSales: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function SaleAnalyticsView({ settings, onNewSale, onPostedSales, newDisabled = false, newDisabledReason }: SaleAnalyticsViewProps) {
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
      help={(
        <>
          <p>This screen shows charts and totals for posted sales. Draft documents are not counted.</p>
          <p>See totals by month, cash and credit, and your top Customers. Select Sale List to see all sales and saved drafts, or New to enter one.</p>
        </>
      )}
      documentLabel="Sales"
      partyLabel="Customer"
      postedListLabel="Sale List"
      rows={rows}
      totalRecords={query.data?.total ?? 0}
      loading={query.isLoading}
      fetching={query.isFetching}
      error={query.error}
      settings={settings}
      onNew={onNewSale}
      onPostedList={onPostedSales}
      onRefresh={() => query.refetch()}
      newDisabled={newDisabled}
      newDisabledReason={newDisabledReason}
    />
  );
}
