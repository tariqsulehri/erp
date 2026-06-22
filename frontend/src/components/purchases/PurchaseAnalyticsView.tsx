'use client';

import { useState, type CSSProperties } from 'react';
import { IconFileInvoice } from '@tabler/icons-react';
import { formatNumber } from '@/lib/app-settings';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { usePurchaseAnalytics } from '@/lib/api/purchases';
import type { SelectOption } from '@/components/ui/SearchableSelect';
import { PurchaseAnalyticsCharts, PurchaseAnalyticsFilters, PurchaseAnalyticsSummary, PurchaseAnalyticsToolbar } from './components';
import { usePurchaseAnalyticsModel } from './hooks/usePurchaseAnalyticsModel';

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
}

export function PurchaseAnalyticsView({
  suppliers,
  warehouses,
  money,
  generalSettings,
  onNewPurchase,
  onPostedPurchases,
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

  const {
    monthlyChartData,
    supplierChartData,
    warehouseChartData,
    totalNetAmount,
    totalPurchases,
    averageInvoice,
    taxFreightTotal,
    grossAmount,
    discountAmount,
    cashTotal,
    creditTotal,
    creditShare,
    averageMonthlyPurchase,
    peakMonth,
    topSupplier,
    topWarehouse,
    moneyAxis,
  } = usePurchaseAnalyticsModel(analyticsQuery.data, generalSettings);
  const chartEmpty = !analyticsQuery.isLoading && monthlyChartData.length === 0;

  function resetFilters() {
    setSupplierId('');
    setPaymentType('');
    setWarehouseId('');
    setDateFrom(`${currentYear}-01-01`);
    setDateTo(`${currentYear}-12-31`);
  }

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: 8, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
      <PurchaseAnalyticsToolbar
        dateFrom={dateFrom}
        dateTo={dateTo}
        generalSettings={generalSettings}
        onRefresh={() => analyticsQuery.refetch()}
        onPostedPurchases={onPostedPurchases}
        onNewPurchase={onNewPurchase}
      />

      <section className="workspace-card" style={{ padding: 8, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: 7, overflow: 'hidden' }}>
        <PurchaseAnalyticsFilters
          supplierId={supplierId}
          paymentType={paymentType}
          warehouseId={warehouseId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          suppliers={suppliers}
          warehouses={warehouses}
          gridStyle={analyticsFilterGridStyle}
          buttonStyle={compactButtonStyle}
          onSupplierChange={setSupplierId}
          onPaymentTypeChange={setPaymentType}
          onWarehouseChange={setWarehouseId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onResetFilters={resetFilters}
        />

        {analyticsQuery.error && (
          <div style={messageStyle('error')}>
            <IconFileInvoice size={18} />
            {friendlyErrorMessage(analyticsQuery.error, 'Unable to load Purchase Analytics.')}
          </div>
        )}

        <div style={{ minHeight: 0, overflow: 'auto', display: 'grid', gridTemplateRows: 'auto auto auto', gap: 8, paddingRight: 2 }}>
          <PurchaseAnalyticsSummary
            totalNetAmount={totalNetAmount}
            grossAmount={grossAmount}
            totalPurchases={totalPurchases}
            averageInvoice={averageInvoice}
            creditTotal={creditTotal}
            creditShare={creditShare}
            taxFreightTotal={taxFreightTotal}
            discountAmount={discountAmount}
            peakMonth={peakMonth}
            topSupplier={topSupplier}
            topWarehouse={topWarehouse}
            cashTotal={cashTotal}
            generalSettings={generalSettings}
            money={money}
            kpiGridStyle={analyticsKpiGridStyle}
            insightGridStyle={analyticsInsightGridStyle}
          />

          {analyticsQuery.isLoading && (
            <div style={analyticsEmptyStyle}>Loading Purchase Analytics...</div>
          )}

          {chartEmpty && (
            <div style={analyticsEmptyStyle}>No purchase analytics found for the selected filters.</div>
          )}

          {!analyticsQuery.isLoading && !chartEmpty && (
            <PurchaseAnalyticsCharts
              monthlyChartData={monthlyChartData}
              supplierChartData={supplierChartData}
              warehouseChartData={warehouseChartData}
              totalNetAmount={totalNetAmount}
              averageMonthlyPurchase={averageMonthlyPurchase}
              creditShare={creditShare}
              taxFreightTotal={taxFreightTotal}
              topSupplier={topSupplier}
              generalSettings={generalSettings}
              money={money}
              moneyAxis={moneyAxis}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function messageStyle(kind: 'success' | 'error'): CSSProperties {
  return {
    flexShrink: 0,
    borderRadius: 'var(--radius)',
    padding: '7px 10px',
    border: `1px solid ${kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
    background: kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    color: kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.78rem',
  };
}

const compactButtonStyle: CSSProperties = {
  minHeight: 28,
  padding: '4px 9px',
  fontSize: '0.76rem',
};

const analyticsFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(230px, 1.5fr) 120px minmax(210px, 1.35fr) 118px 118px auto',
  gap: 6,
  alignItems: 'end',
  overflow: 'visible',
  position: 'relative',
  zIndex: 6,
};

const analyticsKpiGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(138px, 1fr))',
  gap: 7,
};

const analyticsInsightGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(145px, 1fr))',
  gap: 7,
};

const analyticsEmptyStyle: CSSProperties = {
  minHeight: 150,
  display: 'grid',
  placeItems: 'center',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius)',
  color: 'var(--color-text-muted)',
  fontSize: '0.8rem',
  fontWeight: 800,
  background: 'var(--color-surface-alt)',
};
