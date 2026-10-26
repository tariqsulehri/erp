'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  IconBook,
  IconCalendarTime,
  IconChartInfographic,
  IconCash,
  IconBuildingBank,
  IconFileAnalytics,
  IconHourglass,
  IconReceiptTax,
  IconUsers,
  IconPackage,
  IconRefresh,
  IconReportMoney,
  IconScale,
  IconShoppingCart,
  IconTruckDelivery,
} from '@tabler/icons-react';
import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { usePurchaseInvoicesList, usePurchaseSupportData } from '@/lib/api/purchases';
import { usePurchaseReturnsList, usePurchaseReturnSupportData } from '@/lib/api/purchase-returns';
import { useSaleInvoicesList, useSaleSupportData } from '@/lib/api/sales';
import { useSaleReturnsList, useSaleReturnSupportData } from '@/lib/api/sale-returns';
import { useWarehouseStockSummary, useWarehousesList } from '@/lib/api/warehouses';
import { useGeneralSettings } from '@/lib/api/settings';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { PaginationBar as SharedPaginationBar } from '@/components/ui/PaginationBar';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { Tabs } from '@/components/ui/Tabs';
import { LedgerReportPage } from './LedgerReportPage';
import { BalanceSheetReportPage } from './BalanceSheetReportPage';
import { ProfitAndLossReportPage } from './ProfitAndLossReportPage';
import { TrialBalanceReportPage } from './TrialBalanceReportPage';
import { AgingReportPage } from './AgingReportPage';
import { DayBookReportPage } from './DayBookReportPage';
import { SalesTaxReportPage } from './SalesTaxReportPage';
import { StockLedgerReportPage } from './StockLedgerReportPage';
import { StockValuationReportPage } from './StockValuationReportPage';
import { hasPermission } from '@/lib/auth/session-user';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle } from './LedgerReportStyles';
import { useReportDateRange } from './LedgerReportHelpers';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';
import type { DocumentListTotals } from '@/lib/api/document-totals';

type ReportGroupKey = 'purchase' | 'sales' | 'inventory' | 'accounts' | 'parties' | 'tax';
export type ReportKey =
  | 'purchase-summary'
  | 'purchase-return-summary'
  | 'sales-summary'
  | 'sale-return-summary'
  | 'stock-summary'
  | 'stock-ledger'
  | 'stock-valuation'
  | 'ledger'
  | 'cash-book'
  | 'bank-book'
  | 'day-book'
  | 'trial-balance'
  | 'balance-sheet'
  | 'profit-and-loss'
  | 'customer-ledger'
  | 'supplier-ledger'
  | 'receivables-aging'
  | 'payables-aging'
  | 'sales-tax';

interface ReportDefinition {
  key: ReportKey;
  title: string;
  Icon: typeof IconFileAnalytics;
}

interface ReportGroup {
  key: ReportGroupKey;
  title: string;
  Icon: typeof IconFileAnalytics;
  reports: ReportDefinition[];
  /** Ledger-based groups need the financial reports permission (the backend checks it too). */
  financial?: boolean;
}

interface FilterState {
  search: string;
  partyId: string;
  warehouseId: string;
  dateFrom: string;
  dateTo: string;
  amountFrom: string;
  amountTo: string;
  page: number;
  limit: number;
}

interface TransactionRow {
  id: string;
  documentNumber: string;
  documentDate: string;
  partyName: string;
  paymentType: string;
  warehouseName?: string | null;
  locationName?: string | null;
  grossAmount: string;
  discountAmount: string;
  taxAmount: string;
  freightAmount: string;
  netAmount: string;
}

const reportGroups: ReportGroup[] = [
  {
    key: 'purchase',
    title: 'Purchase',
    Icon: IconTruckDelivery,
    reports: [
      { key: 'purchase-summary', title: 'Purchase Summary', Icon: IconFileAnalytics },
      { key: 'purchase-return-summary', title: 'Purchase Return Summary', Icon: IconTruckDelivery },
    ],
  },
  {
    key: 'sales',
    title: 'Sales',
    Icon: IconShoppingCart,
    reports: [
      { key: 'sales-summary', title: 'Sales Summary', Icon: IconFileAnalytics },
      { key: 'sale-return-summary', title: 'Sale Return Summary', Icon: IconShoppingCart },
    ],
  },
  {
    key: 'inventory',
    title: 'Inventory',
    Icon: IconPackage,
    reports: [
      { key: 'stock-summary', title: 'Stock Summary', Icon: IconPackage },
      { key: 'stock-ledger', title: 'Stock Ledger', Icon: IconBook },
      { key: 'stock-valuation', title: 'Stock Valuation', Icon: IconScale },
    ],
  },
  {
    key: 'accounts',
    title: 'Accounts',
    Icon: IconReportMoney,
    financial: true,
    reports: [
      { key: 'ledger', title: 'Ledger Report', Icon: IconReportMoney },
      { key: 'cash-book', title: 'Cash Book', Icon: IconCash },
      { key: 'bank-book', title: 'Bank Book', Icon: IconBuildingBank },
      { key: 'day-book', title: 'Day Book', Icon: IconCalendarTime },
      { key: 'trial-balance', title: 'Trial Balance', Icon: IconFileAnalytics },
      { key: 'balance-sheet', title: 'Balance Sheet', Icon: IconScale },
      { key: 'profit-and-loss', title: 'Profit And Loss', Icon: IconChartInfographic },
    ],
  },
  {
    key: 'parties',
    title: 'Customers And Suppliers',
    Icon: IconUsers,
    financial: true,
    reports: [
      { key: 'customer-ledger', title: 'Customer Ledger', Icon: IconUsers },
      { key: 'supplier-ledger', title: 'Supplier Ledger', Icon: IconTruckDelivery },
      { key: 'receivables-aging', title: 'Receivables Aging', Icon: IconHourglass },
      { key: 'payables-aging', title: 'Payables Aging', Icon: IconHourglass },
    ],
  },
  {
    key: 'tax',
    title: 'Tax',
    Icon: IconReceiptTax,
    financial: true,
    reports: [
      { key: 'sales-tax', title: 'Sales Tax Report', Icon: IconReceiptTax },
    ],
  },
];

const defaultReportByGroup: Record<ReportGroupKey, ReportKey> = {
  purchase: 'purchase-summary',
  sales: 'sales-summary',
  inventory: 'stock-summary',
  accounts: 'ledger',
  parties: 'customer-ledger',
  tax: 'sales-tax',
};

/** Opens a report directly, e.g. /reports?report=ledger&account=<id>&from=2026-07-01&to=2026-10-26. */
export interface ReportLink {
  report?: string | null;
  account?: string | null;
  from?: string | null;
  to?: string | null;
}

function groupOfReport(reportKey: string | null | undefined, groups: ReportGroup[]) {
  return groups.find(group => group.reports.some(report => report.key === reportKey));
}

const defaultFilters = (): FilterState => ({
  search: '',
  partyId: '',
  warehouseId: '',
  dateFrom: '',
  dateTo: '',
  amountFrom: '',
  amountTo: '',
  page: 1,
  limit: 50,
});

export function ReportsWorkspace({ link }: { link?: ReportLink }) {
  const { data: session } = useSession();
  const canSeeFinancial = hasPermission(session?.user.role, 'reports.financial');
  const visibleGroups = useMemo(() => reportGroups.filter(group => !group.financial || canSeeFinancial), [canSeeFinancial]);
  const linkedGroup = groupOfReport(link?.report, visibleGroups);
  const [activeGroupKey, setActiveGroupKey] = useState<ReportGroupKey>(linkedGroup?.key ?? 'purchase');
  const [activeReportKey, setActiveReportKey] = useState<ReportKey>((linkedGroup ? link?.report : 'purchase-summary') as ReportKey);
  const activeGroup = visibleGroups.find(group => group.key === activeGroupKey) ?? visibleGroups[0];
  const activeReport = activeGroup.reports.find(report => report.key === activeReportKey) ?? activeGroup.reports[0];

  // A link to another report (e.g. Trial Balance -> Ledger) changes the URL without leaving this page.
  useEffect(() => {
    const group = groupOfReport(link?.report, visibleGroups);
    if (group && link?.report) {
      setActiveGroupKey(group.key);
      setActiveReportKey(link.report as ReportKey);
    }
  }, [link?.report, link?.account, link?.from, link?.to, visibleGroups]);

  function selectGroup(groupKey: ReportGroupKey) {
    setActiveGroupKey(groupKey);
    setActiveReportKey(defaultReportByGroup[groupKey]);
  }

  const linkForActive = link?.report === activeReport.key ? link : undefined;

  return (
    <main className="page-shell">
      <PageHeader title="Reports" description={`${activeGroup.title} Reports · ${activeReport.title}`} />

      <Tabs
        label="Report Groups"
        value={activeGroup.key}
        onChange={selectGroup}
        items={visibleGroups.map(group => {
          const GroupIcon = group.Icon;
          return { value: group.key, label: group.title, icon: <GroupIcon size={16} stroke={1.8} /> };
        })}
      />

      {activeGroup.reports.length > 1 && (
        <div>
          <SegmentedControl
            label={`${activeGroup.title} Reports`}
            value={activeReport.key}
            options={activeGroup.reports.map(report => ({ value: report.key, label: report.title }))}
            onChange={setActiveReportKey}
          />
        </div>
      )}

      <div role="tabpanel" aria-labelledby={`tab-${activeGroup.key}`} style={embeddedReportStyle}>
        {renderReport(activeReport.key, linkForActive)}
      </div>
    </main>
  );
}

function renderReport(reportKey: ReportKey, link?: ReportLink) {
  // The key makes the ledger open fresh with the linked account and dates.
  const ledgerKey = `${reportKey}-${link?.account ?? ''}-${link?.from ?? ''}-${link?.to ?? ''}`;
  const ledgerProps = {
    embedded: true,
    initialAccountId: link?.account ?? undefined,
    initialDateFrom: link?.from ?? undefined,
    initialDateTo: link?.to ?? undefined,
  };
  switch (reportKey) {
    case 'purchase-summary': return <PurchaseSummaryReport />;
    case 'purchase-return-summary': return <PurchaseReturnSummaryReport />;
    case 'sales-summary': return <SalesSummaryReport />;
    case 'sale-return-summary': return <SaleReturnSummaryReport />;
    case 'stock-summary': return <StockSummaryReport />;
    case 'stock-ledger': return <StockLedgerReportPage embedded />;
    case 'stock-valuation': return <StockValuationReportPage embedded />;
    case 'cash-book': return <LedgerReportPage key={ledgerKey} {...ledgerProps} bookKind="cash" />;
    case 'bank-book': return <LedgerReportPage key={ledgerKey} {...ledgerProps} bookKind="bank" />;
    case 'customer-ledger': return <LedgerReportPage key={ledgerKey} {...ledgerProps} bookKind="customer" />;
    case 'supplier-ledger': return <LedgerReportPage key={ledgerKey} {...ledgerProps} bookKind="supplier" />;
    case 'day-book': return <DayBookReportPage embedded />;
    case 'trial-balance': return <TrialBalanceReportPage embedded />;
    case 'balance-sheet': return <BalanceSheetReportPage embedded />;
    case 'profit-and-loss': return <ProfitAndLossReportPage embedded />;
    case 'receivables-aging': return <AgingReportPage embedded kind="receivables" />;
    case 'payables-aging': return <AgingReportPage embedded kind="payables" />;
    case 'sales-tax': return <SalesTaxReportPage embedded />;
    default: return <LedgerReportPage key={ledgerKey} {...ledgerProps} />;
  }
}

/** Filters for the document summaries; empty dates fall back to the fiscal year start and today. */
function useSummaryFilters() {
  const range = useReportDateRange();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const effective: FilterState = { ...filters, dateFrom: filters.dateFrom || range.dateFrom, dateTo: filters.dateTo || range.dateTo };
  return [effective, setFilters] as const;
}

function PurchaseSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const supportQuery = usePurchaseSupportData();
  const [filters, setFilters] = useSummaryFilters();
  const query = usePurchaseInvoicesList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    supplier_id: filters.partyId,
    warehouse_id: filters.warehouseId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    amount_from: toOptionalNumber(filters.amountFrom),
    amount_to: toOptionalNumber(filters.amountTo),
  });
  const rows = useMemo<TransactionRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.purchase_number,
    documentDate: row.purchase_date,
    partyName: joinCodeName(row.supplier_code, row.supplier_name),
    paymentType: row.payment_type,
    warehouseName: joinCodeName(row.warehouse_code, row.warehouse_name),
    locationName: joinCodeName(row.location_code, row.location_name),
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionReport
      title="Purchase Summary"
      partyLabel="Supplier"
      partyPlaceholder="All Suppliers"
      partyOptions={mapOptions(supportQuery.data?.suppliers)}
      warehouseOptions={mapOptions(supportQuery.data?.warehouses)}
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
      grandTotals={query.data?.totals}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onChangeFilters={setFilters}
      onRefresh={() => query.refetch()}
    />
  );
}

function PurchaseReturnSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const supportQuery = usePurchaseReturnSupportData();
  const [filters, setFilters] = useSummaryFilters();
  const query = usePurchaseReturnsList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    supplier_id: filters.partyId,
    warehouse_id: filters.warehouseId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    amount_from: toOptionalNumber(filters.amountFrom),
    amount_to: toOptionalNumber(filters.amountTo),
  });
  const rows = useMemo<TransactionRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.purchase_return_number,
    documentDate: row.purchase_return_date,
    partyName: joinCodeName(row.supplier_code, row.supplier_name),
    paymentType: row.payment_type,
    warehouseName: joinCodeName(row.warehouse_code, row.warehouse_name),
    locationName: joinCodeName(row.location_code, row.location_name),
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionReport
      title="Purchase Return Summary"
      partyLabel="Supplier"
      partyPlaceholder="All Suppliers"
      partyOptions={mapOptions(supportQuery.data?.suppliers)}
      warehouseOptions={mapOptions(supportQuery.data?.warehouses)}
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
      grandTotals={query.data?.totals}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onChangeFilters={setFilters}
      onRefresh={() => query.refetch()}
    />
  );
}

function SalesSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const supportQuery = useSaleSupportData();
  const [filters, setFilters] = useSummaryFilters();
  const query = useSaleInvoicesList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    customer_id: filters.partyId,
    branch_id: filters.warehouseId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    amount_from: toOptionalNumber(filters.amountFrom),
    amount_to: toOptionalNumber(filters.amountTo),
  });
  const rows = useMemo<TransactionRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.sale_number,
    documentDate: row.sale_date,
    partyName: joinCodeName(row.customer_code, row.customer_name),
    paymentType: row.payment_type,
    warehouseName: row.branch_name ? joinCodeName(row.branch_code, row.branch_name) : joinCodeName(row.warehouse_code, row.warehouse_name),
    locationName: joinCodeName(row.location_code, row.location_name),
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionReport
      title="Sales Summary"
      partyLabel="Customer"
      partyPlaceholder="All Customers"
      partyOptions={mapOptions(supportQuery.data?.customers)}
      warehouseOptions={mapOptions(supportQuery.data?.branches)}
      placeLabel="Branch"
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
      grandTotals={query.data?.totals}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onChangeFilters={setFilters}
      onRefresh={() => query.refetch()}
    />
  );
}

function SaleReturnSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const supportQuery = useSaleReturnSupportData();
  const [filters, setFilters] = useSummaryFilters();
  const query = useSaleReturnsList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    customer_id: filters.partyId,
    branch_id: filters.warehouseId,
    date_from: filters.dateFrom,
    date_to: filters.dateTo,
    amount_from: toOptionalNumber(filters.amountFrom),
    amount_to: toOptionalNumber(filters.amountTo),
  });
  const rows = useMemo<TransactionRow[]>(() => (query.data?.data ?? []).map(row => ({
    id: row.id,
    documentNumber: row.sale_return_number,
    documentDate: row.sale_return_date,
    partyName: joinCodeName(row.customer_code, row.customer_name),
    paymentType: row.payment_type,
    warehouseName: row.branch_name ? joinCodeName(row.branch_code, row.branch_name) : joinCodeName(row.warehouse_code, row.warehouse_name),
    locationName: joinCodeName(row.location_code, row.location_name),
    grossAmount: row.gross_amount,
    discountAmount: row.discount_amount,
    taxAmount: row.tax_amount,
    freightAmount: row.freight_amount,
    netAmount: row.net_amount,
  })), [query.data]);

  return (
    <TransactionReport
      title="Sale Return Summary"
      partyLabel="Customer"
      partyPlaceholder="All Customers"
      partyOptions={mapOptions(supportQuery.data?.customers)}
      warehouseOptions={mapOptions(supportQuery.data?.branches)}
      placeLabel="Branch"
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
      grandTotals={query.data?.totals}
      loading={query.isLoading}
      error={query.error}
      settings={settings}
      onChangeFilters={setFilters}
      onRefresh={() => query.refetch()}
    />
  );
}

function TransactionReport({
  title,
  partyLabel,
  partyPlaceholder,
  partyOptions,
  warehouseOptions,
  placeLabel = 'Warehouse',
  filters,
  rows,
  total,
  totalPages,
  grandTotals,
  loading,
  error,
  settings,
  onChangeFilters,
  onRefresh,
}: {
  title: string;
  partyLabel: string;
  partyPlaceholder: string;
  partyOptions: SelectOption[];
  warehouseOptions: SelectOption[];
  /** Where stock moved: Warehouse for purchases, Branch for sales. */
  placeLabel?: 'Warehouse' | 'Branch';
  filters: FilterState;
  rows: TransactionRow[];
  total: number;
  totalPages: number;
  /** Totals of every record that matches the filters (all pages). */
  grandTotals?: DocumentListTotals;
  loading: boolean;
  error: unknown;
  settings?: AppFormatSettingsSource | null;
  onChangeFilters: (filters: FilterState) => void;
  onRefresh: () => void;
}) {
  const totals = useMemo(() => rows.reduce((sum, row) => ({
    gross: sum.gross + Number(row.grossAmount || 0),
    discount: sum.discount + Number(row.discountAmount || 0),
    tax: sum.tax + Number(row.taxAmount || 0),
    freight: sum.freight + Number(row.freightAmount || 0),
    net: sum.net + Number(row.netAmount || 0),
  }), { gross: 0, discount: 0, tax: 0, freight: 0, net: 0 }), [rows]);

  function updateFilter(patch: Partial<FilterState>) {
    onChangeFilters({ ...filters, ...patch, page: patch.page ?? 1 });
  }

  function buildReport(): ReportDocument | null {
    if (loading || error) return null;
    const columns: ReportDocument['columns'] = [
      { label: 'Date', kind: 'date' }, { label: 'Document Number' }, { label: partyLabel }, { label: 'Type' }, { label: placeLabel },
      { label: 'Gross', kind: 'money' }, { label: 'Discount', kind: 'money' }, { label: 'Tax', kind: 'money' },
      { label: 'Freight', kind: 'money' }, { label: 'Net Amount', kind: 'money' },
    ];
    return {
      title,
      subtitle: `${formatDate(filters.dateFrom, settings)} to ${formatDate(filters.dateTo, settings)} · Posted documents`,
      columns,
      rows: [
        ...rows.map(row => ({
          cells: [row.documentDate?.slice(0, 10), row.documentNumber, row.partyName, row.paymentType, row.warehouseName ?? '',
            row.grossAmount, row.discountAmount, row.taxAmount, row.freightAmount, row.netAmount],
        })),
        ...(grandTotals ? [{
          cells: ['', `Totals For All ${total} Records`, '', '', '', grandTotals.gross_amount, grandTotals.discount_amount,
            grandTotals.tax_amount, grandTotals.freight_amount, grandTotals.net_amount],
          style: 'total' as const,
        }] : []),
      ],
      note: totalPages > 1 ? `This file lists page ${filters.page} of ${totalPages}. The totals row covers all matching records.` : undefined,
      fileName: `${title.toLowerCase()}-${filters.dateFrom}-to-${filters.dateTo}`,
    };
  }

  return (
    <div style={embeddedReportStyle}>
      {Boolean(error) && <InlineAlert tone="danger">Unable to load {title}. Click Refresh to try again.</InlineAlert>}

      <section className="panel panel-fill">
        <ReportHeader title={title} count={total} onRefresh={onRefresh} />

        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <TextField label="Search" value={filters.search} placeholder="Document Number, Party, Or Reference" onChange={search => updateFilter({ search })} />
            <SearchFilter label={partyLabel} value={filters.partyId} options={partyOptions} placeholder={partyPlaceholder} onChange={partyId => updateFilter({ partyId })} />
            <SearchFilter label={placeLabel} value={filters.warehouseId} options={warehouseOptions} placeholder={placeLabel === 'Branch' ? 'All Branches' : 'All Warehouses'} onChange={warehouseId => updateFilter({ warehouseId })} />
            <DateField label="Date From" value={filters.dateFrom} onChange={dateFrom => updateFilter({ dateFrom })} />
            <DateField label="Date To" value={filters.dateTo} onChange={dateTo => updateFilter({ dateTo })} />
            <NumericField label="Amount From" value={filters.amountFrom} onChange={amountFrom => updateFilter({ amountFrom })} />
            <NumericField label="Amount To" value={filters.amountTo} onChange={amountTo => updateFilter({ amountTo })} />
            <ReportActions buildReport={buildReport} disabled={loading || rows.length === 0} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 1080 }}>
            <thead>
              <tr>
                <th style={{ width: 110 }}>Date</th>
                <th style={{ width: 150 }}>Document Number</th>
                <th>{partyLabel}</th>
                <th style={{ width: 90 }}>Type</th>
                <th>{placeLabel}</th>
                <th className="num">Gross</th>
                <th className="num">Discount</th>
                <th className="num">Tax</th>
                <th className="num">Freight</th>
                <th className="num">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading && <TableMessageRow colSpan={10} title={`Loading ${title}…`} loading />}
              {!loading && rows.length === 0 && (
                <TableMessageRow colSpan={10} title="No Posted Records Found" description="Change the search text, the dates, or the filters to see more records." />
              )}
              {!loading && rows.map(row => (
                <tr key={row.id}>
                  <td className="cell-muted">{formatDate(row.documentDate, settings)}</td>
                  <td className="cell-strong">{row.documentNumber}</td>
                  <td>{row.partyName || 'Not Set'}</td>
                  <td className="cell-muted">{row.paymentType || 'Not Set'}</td>
                  <td className={row.warehouseName ? undefined : 'cell-muted'}>{row.locationName ? `${row.warehouseName} / ${row.locationName}` : row.warehouseName || 'Not Set'}</td>
                  <td className="num">{formatMoney(row.grossAmount, settings)}</td>
                  <td className="num">{formatMoney(row.discountAmount, settings)}</td>
                  <td className="num">{formatMoney(row.taxAmount, settings)}</td>
                  <td className="num">{formatMoney(row.freightAmount, settings)}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{formatMoney(row.netAmount, settings)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {totalPages > 1 && (
                <tr>
                  <td colSpan={5}>Totals For This Page</td>
                  <td className="num">{formatMoney(totals.gross, settings)}</td>
                  <td className="num">{formatMoney(totals.discount, settings)}</td>
                  <td className="num">{formatMoney(totals.tax, settings)}</td>
                  <td className="num">{formatMoney(totals.freight, settings)}</td>
                  <td className="num">{formatMoney(totals.net, settings)}</td>
                </tr>
              )}
              {grandTotals && (
                <tr>
                  <td colSpan={5}>Totals For All {total} {total === 1 ? 'Record' : 'Records'}</td>
                  <td className="num">{formatMoney(grandTotals.gross_amount, settings)}</td>
                  <td className="num">{formatMoney(grandTotals.discount_amount, settings)}</td>
                  <td className="num">{formatMoney(grandTotals.tax_amount, settings)}</td>
                  <td className="num">{formatMoney(grandTotals.freight_amount, settings)}</td>
                  <td className="num">{formatMoney(grandTotals.net_amount, settings)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        <PaginationBar
          page={filters.page}
          limit={filters.limit}
          total={total}
          totalPages={totalPages}
          onChange={patch => onChangeFilters({ ...filters, ...patch })}
        />
      </section>
    </div>
  );
}

function StockSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const [warehouseId, setWarehouseId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const warehousesQuery = useWarehousesList({ status: 'Active', page: 1, limit: 200 });
  const warehouseOptions = mapOptions(warehousesQuery.data?.data);
  const selectedWarehouseId = warehouseId || warehouseOptions[0]?.value || '';
  const stockQuery = useWarehouseStockSummary(selectedWarehouseId, { page, limit, search });
  const rows = stockQuery.data?.data ?? [];
  const total = stockQuery.data?.pagination.total ?? 0;
  const totalPages = stockQuery.data?.pagination.pages ?? 1;
  const selectedWarehouseName = warehouseOptions.find(option => option.value === selectedWarehouseId)?.label ?? '';
  function buildReport(): ReportDocument | null {
    if (!rows.length) return null;
    return {
      title: 'Stock Summary',
      subtitle: `${selectedWarehouseName} · Current stock`,
      columns: [
        { label: 'Item Code' }, { label: 'SKU' }, { label: 'Item Name' }, { label: 'Location' },
        { label: 'Stock On Hand', kind: 'quantity' }, { label: 'Reserved', kind: 'quantity' }, { label: 'Available', kind: 'quantity' },
        { label: 'Average Cost', kind: 'money' }, { label: 'Stock Value', kind: 'money' },
      ],
      rows: rows.map(row => ({
        cells: [row.item_code, row.sku ?? '', row.item_name, joinCodeName(row.location_code, row.location_name),
          row.stock_on_hand, row.reserved_stock, row.available_stock, row.average_cost, row.total_stock_value],
      })),
      note: totalPages > 1 ? `This file lists page ${page} of ${totalPages}. Use Stock Valuation for a full list on any date.` : undefined,
      fileName: `stock-summary-${selectedWarehouseName}`,
    };
  }
  const totals = rows.reduce((sum, row) => ({
    stock: sum.stock + Number(row.stock_on_hand || 0),
    reserved: sum.reserved + Number(row.reserved_stock || 0),
    available: sum.available + Number(row.available_stock || 0),
    value: sum.value + Number(row.total_stock_value || 0),
  }), { stock: 0, reserved: 0, available: 0, value: 0 });

  return (
    <div style={embeddedReportStyle}>
      {stockQuery.error && <InlineAlert tone="danger">Unable to load Stock Summary. Click Refresh to try again.</InlineAlert>}

      <section className="panel panel-fill">
        <ReportHeader title="Stock Summary" count={total} onRefresh={() => stockQuery.refetch()} />

        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <SearchFilter
              label="Warehouse"
              value={selectedWarehouseId}
              options={warehouseOptions}
              placeholder="Select Warehouse"
              onChange={value => {
                setWarehouseId(value);
                setPage(1);
              }}
            />
            <TextField
              label="Search"
              value={search}
              placeholder="Item Code, SKU, Or Item Name"
              onChange={value => {
                setSearch(value);
                setPage(1);
              }}
            />
            <ReportActions buildReport={buildReport} disabled={stockQuery.isLoading || rows.length === 0} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Item Code</th>
                <th style={{ width: 120 }}>SKU</th>
                <th>Item Name</th>
                <th>Location</th>
                <th className="num">Stock On Hand</th>
                <th className="num">Reserved</th>
                <th className="num">Available</th>
                <th className="num">Average Cost</th>
                <th className="num">Stock Value</th>
              </tr>
            </thead>
            <tbody>
              {stockQuery.isLoading && <TableMessageRow colSpan={9} title="Loading Stock Summary…" loading />}
              {!stockQuery.isLoading && rows.length === 0 && (
                <TableMessageRow colSpan={9} title="No Stock Found" description="Choose another Warehouse or change the search text." />
              )}
              {!stockQuery.isLoading && rows.map(row => (
                <tr key={row.id}>
                  <td className="cell-strong">{row.item_code}</td>
                  <td className="cell-muted">{row.sku || 'Not Set'}</td>
                  <td>{row.item_name}</td>
                  <td className={joinCodeName(row.location_code, row.location_name) ? undefined : 'cell-muted'}>{joinCodeName(row.location_code, row.location_name) || 'Not Set'}</td>
                  <td className="num" style={amountStyle(row.stock_on_hand)}>{formatNumber(row.stock_on_hand, settings)}</td>
                  <td className="num">{formatNumber(row.reserved_stock, settings)}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--color-heading)', ...amountStyle(row.available_stock) }}>{formatNumber(row.available_stock, settings)}</td>
                  <td className="num">{formatMoney(row.average_cost, settings)}</td>
                  <td className="num" style={{ fontWeight: 600, color: 'var(--color-heading)' }}>{formatMoney(row.total_stock_value, settings)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Totals For This Page</td>
                <td className="num">{formatNumber(totals.stock, settings)}</td>
                <td className="num">{formatNumber(totals.reserved, settings)}</td>
                <td className="num">{formatNumber(totals.available, settings)}</td>
                <td className="num" />
                <td className="num">{formatMoney(totals.value, settings)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <PaginationBar
          page={page}
          limit={limit}
          total={total}
          totalPages={totalPages}
          onChange={patch => {
            if (patch.page) setPage(patch.page);
            if (patch.limit) {
              setLimit(patch.limit);
              setPage(1);
            }
          }}
        />
      </section>
    </div>
  );
}

function ReportHeader({ title, count, onRefresh }: { title: string; count: number; onRefresh: () => void }) {
  return (
    <div className="panel-header">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
        <h2 className="panel-title">{title}</h2>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{count} {count === 1 ? 'Record' : 'Records'}</span>
      </div>
      <Button size="sm" icon={<IconRefresh size={16} stroke={1.8} />} onClick={onRefresh}>Refresh</Button>
    </div>
  );
}

function SearchFilter({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldLabel label={label}>
      <SearchableSelect value={value} options={options} placeholder={placeholder} onChange={onChange} />
    </FieldLabel>
  );
}

function PaginationBar({
  page,
  limit,
  total,
  totalPages,
  onChange,
}: {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onChange: (patch: Partial<Pick<FilterState, 'page' | 'limit'>>) => void;
}) {
  return (
    <SharedPaginationBar
      page={page}
      totalPages={totalPages}
      totalRecords={total}
      pageSize={limit}
      onPageChange={nextPage => onChange({ page: nextPage })}
      onPageSizeChange={nextLimit => onChange({ limit: nextLimit, page: 1 })}
    />
  );
}

function mapOptions(rows?: any[]): SelectOption[] {
  return (rows ?? []).map(row => ({
    value: row.value ?? row.id,
    label: row.label ?? joinCodeName(row.code, row.name),
    searchText: `${row.code ?? ''} ${row.name ?? ''}`,
  }));
}

function joinCodeName(code?: string | null, name?: string | null) {
  if (code && name) return `${code} - ${name}`;
  return name ?? code ?? '';
}

function toOptionalNumber(value: string) {
  return value === '' ? undefined : Number(value);
}
