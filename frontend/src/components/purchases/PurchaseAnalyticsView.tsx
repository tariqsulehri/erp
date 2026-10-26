'use client';

import { useState } from 'react';
import { formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { usePurchaseAnalytics } from '@/lib/api/purchases';
import type { SelectOption } from '@/components/ui/SearchableSelect';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PurchaseAnalyticsCharts, PurchaseAnalyticsFilters, PurchaseAnalyticsSummary, PurchaseAnalyticsToolbar } from './components';
import { usePurchaseAnalyticsModel } from './hooks/usePurchaseAnalyticsModel';
import { DocumentPage } from '@/components/documents';

type PaymentType = 'Cash' | 'Credit';
type GeneralSettings = Parameters<typeof formatNumber>[1];

interface SupplierOption extends SelectOption {
  paymentTermsDays: number;
  accountCode?: string | null;
}

interface WarehouseOption extends SelectOption {
  isDefault?: boolean;
}

interface PurchaseAnalyticsViewProps {
  suppliers: SupplierOption[];
  warehouses: WarehouseOption[];
  money: (value: number) => string;
  generalSettings: GeneralSettings;
  onNewPurchase: () => void;
  onPostedPurchases: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PurchaseAnalyticsView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onPostedPurchases,
  newDisabled = false,
  newDisabledReason,
}: PurchaseAnalyticsViewProps) {
  const currentYear = new Date().getFullYear();
  const [supplierId, setSupplierId] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState(`${currentYear}-01-01`);
  const [dateTo, setDateTo] = useState(`${currentYear}-12-31`);

  const analyticsQuery = usePurchaseAnalytics({
    supplier_id: supplierId || undefined,
    payment_type: paymentType as PaymentType || undefined,
    warehouse_id: warehouseId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  const model = usePurchaseAnalyticsModel(analyticsQuery.data, generalSettings, { dateFrom, dateTo });
  const firstLoad = analyticsQuery.isLoading && !analyticsQuery.data;
  const empty = !analyticsQuery.isLoading && model.totals.purchases === 0;

  function resetFilters() {
    setSupplierId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom(`${currentYear}-01-01`);
    setDateTo(`${currentYear}-12-31`);
  }

  return (
    <DocumentPage>
      <PurchaseAnalyticsToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        generalSettings={generalSettings}
        onRefresh={() => analyticsQuery.refetch()}
        onPostedPurchases={onPostedPurchases}
        onNewPurchase={onNewPurchase}
        newDisabled={newDisabled}
        newDisabledReason={newDisabledReason}
      />

      <section className="workspace-card" style={{ padding: 12, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 12, overflow: 'hidden' }}>
        <PurchaseAnalyticsFilters
          supplierId={supplierId}
          paymentType={paymentType}
          warehouseId={warehouseId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          suppliers={suppliers}
          warehouses={warehouses}
          onSupplierChange={setSupplierId}
          onPaymentTypeChange={setPaymentType}
          onWarehouseChange={setWarehouseId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onResetFilters={resetFilters}
        />

        {analyticsQuery.error
          ? <InlineAlert tone="danger">{friendlyErrorMessage(analyticsQuery.error, 'Unable to load Purchase Analytics.')}</InlineAlert>
          : <div />}

        {/* On a refetch the previous charts stay in place, dimmed, instead of flashing a loader. */}
        <div className={`analytics-stack${analyticsQuery.isFetching && !firstLoad ? ' analytics-loading' : ''}`} aria-busy={analyticsQuery.isFetching}>
          {firstLoad && <div className="chart-card chart-empty">Loading Purchase Analytics…</div>}
          {empty && (
            <div className="chart-card chart-empty">
              No posted purchases for the selected filters. Change the dates or clear the filters.
            </div>
          )}
          {!firstLoad && !empty && (
            <>
              <PurchaseAnalyticsSummary model={model} settings={generalSettings} money={money} />
              <PurchaseAnalyticsCharts model={model} settings={generalSettings} money={money} />
            </>
          )}
        </div>
      </section>
    </DocumentPage>
  );
}
