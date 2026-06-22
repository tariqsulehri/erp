'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  IconChartInfographic,
  IconFileAnalytics,
  IconPackage,
  IconRefresh,
  IconReportMoney,
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
import { DateField, NumericField, TextField } from '@/components/ui/FormFields';
import { PaginationBar as SharedPaginationBar } from '@/components/ui/PaginationBar';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { LedgerReportPage } from './LedgerReportPage';
import { ProfitAndLossReportPage } from './ProfitAndLossReportPage';
import { TrialBalanceReportPage } from './TrialBalanceReportPage';
import { compactButtonStyle, reportToolbarStyle, reportTitleIconStyle } from './LedgerReportStyles';
import { firstDayOfCurrentYear, todayInputDate } from './LedgerReportHelpers';

type ReportGroupKey = 'purchase' | 'sales' | 'inventory' | 'accounts';
type ReportKey =
  | 'purchase-summary'
  | 'purchase-return-summary'
  | 'sales-summary'
  | 'sale-return-summary'
  | 'stock-summary'
  | 'ledger'
  | 'trial-balance'
  | 'profit-and-loss';

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
    ],
  },
  {
    key: 'accounts',
    title: 'Accounts',
    Icon: IconReportMoney,
    reports: [
      { key: 'ledger', title: 'Ledger Report', Icon: IconReportMoney },
      { key: 'trial-balance', title: 'Trial Balance', Icon: IconFileAnalytics },
      { key: 'profit-and-loss', title: 'Profit And Loss', Icon: IconChartInfographic },
    ],
  },
];

const defaultReportByGroup: Record<ReportGroupKey, ReportKey> = {
  purchase: 'purchase-summary',
  sales: 'sales-summary',
  inventory: 'stock-summary',
  accounts: 'ledger',
};

const defaultFilters = (): FilterState => ({
  search: '',
  partyId: '',
  warehouseId: '',
  dateFrom: firstDayOfCurrentYear(),
  dateTo: todayInputDate(),
  amountFrom: '',
  amountTo: '',
  page: 1,
  limit: 50,
});

export function ReportsWorkspace() {
  const [activeGroupKey, setActiveGroupKey] = useState<ReportGroupKey>('purchase');
  const [activeReportKey, setActiveReportKey] = useState<ReportKey>('purchase-summary');
  const activeGroup = reportGroups.find(group => group.key === activeGroupKey) ?? reportGroups[0];
  const activeReport = activeGroup.reports.find(report => report.key === activeReportKey) ?? activeGroup.reports[0];
  const ActiveGroupIcon = activeGroup.Icon;

  function selectGroup(group: ReportGroup) {
    setActiveGroupKey(group.key);
    setActiveReportKey(defaultReportByGroup[group.key]);
  }

  return (
    <main style={pageStyle}>
      <section style={reportToolbarStyle}>
        <div style={toolbarInnerStyle}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
            <div style={reportTitleIconStyle}><ActiveGroupIcon size={20} stroke={1.8} /></div>
            <div style={{ minWidth: 0 }}>
              <h1 style={titleStyle}>Reports</h1>
              <p style={subtitleStyle}>{activeGroup.title} Reports</p>
            </div>
          </div>
          <div style={groupButtonWrapStyle}>
            {reportGroups.map(group => {
              const GroupIcon = group.Icon;
              return (
                <button
                  key={group.key}
                  type="button"
                  className={activeGroupKey === group.key ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => selectGroup(group)}
                  style={smallButtonStyle}
                >
                  <GroupIcon size={14} /> {group.title}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section style={workspaceStyle}>
        <div style={reportTabsStyle}>
          {activeGroup.reports.map(report => {
            const ReportIcon = report.Icon;
            return (
              <button
                key={report.key}
                type="button"
                className={activeReport.key === report.key ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setActiveReportKey(report.key)}
                style={smallButtonStyle}
              >
                <ReportIcon size={14} /> {report.title}
              </button>
            );
          })}
        </div>

        <section style={reportPanelStyle}>
          {renderReport(activeReportKey)}
        </section>
      </section>
    </main>
  );
}

function renderReport(reportKey: ReportKey) {
  if (reportKey === 'purchase-summary') return <PurchaseSummaryReport />;
  if (reportKey === 'purchase-return-summary') return <PurchaseReturnSummaryReport />;
  if (reportKey === 'sales-summary') return <SalesSummaryReport />;
  if (reportKey === 'sale-return-summary') return <SaleReturnSummaryReport />;
  if (reportKey === 'stock-summary') return <StockSummaryReport />;
  if (reportKey === 'trial-balance') return <TrialBalanceReportPage embedded />;
  if (reportKey === 'profit-and-loss') return <ProfitAndLossReportPage embedded />;
  return <LedgerReportPage embedded />;
}

function PurchaseSummaryReport() {
  const { data: settings } = useGeneralSettings();
  const supportQuery = usePurchaseSupportData();
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
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
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
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
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const query = useSaleInvoicesList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    customer_id: filters.partyId,
    warehouse_id: filters.warehouseId,
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
      title="Sales Summary"
      partyLabel="Customer"
      partyPlaceholder="All Customers"
      partyOptions={mapOptions(supportQuery.data?.customers)}
      warehouseOptions={mapOptions(supportQuery.data?.warehouses)}
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
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
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const query = useSaleReturnsList({
    page: filters.page,
    limit: filters.limit,
    status: 'Posted',
    search: filters.search,
    customer_id: filters.partyId,
    warehouse_id: filters.warehouseId,
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
      title="Sale Return Summary"
      partyLabel="Customer"
      partyPlaceholder="All Customers"
      partyOptions={mapOptions(supportQuery.data?.customers)}
      warehouseOptions={mapOptions(supportQuery.data?.warehouses)}
      filters={filters}
      rows={rows}
      total={query.data?.total ?? 0}
      totalPages={query.data?.totalPages ?? 1}
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
  filters,
  rows,
  total,
  totalPages,
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
  filters: FilterState;
  rows: TransactionRow[];
  total: number;
  totalPages: number;
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

  return (
    <div style={reportPageStyle}>
      <ReportHeader title={title} count={total} onRefresh={onRefresh} />

      <div style={transactionFilterGridStyle}>
        <TextField label="Search" value={filters.search} placeholder="Document No., Party, Reference" onChange={search => updateFilter({ search })} />
        <SearchFilter label={partyLabel} value={filters.partyId} options={partyOptions} placeholder={partyPlaceholder} onChange={partyId => updateFilter({ partyId })} />
        <SearchFilter label="Warehouse" value={filters.warehouseId} options={warehouseOptions} placeholder="All Warehouses" onChange={warehouseId => updateFilter({ warehouseId })} />
        <DateField label="Date From" value={filters.dateFrom} onChange={dateFrom => updateFilter({ dateFrom })} />
        <DateField label="Date To" value={filters.dateTo} onChange={dateTo => updateFilter({ dateTo })} />
        <NumericField label="Amount From" value={filters.amountFrom} onChange={amountFrom => updateFilter({ amountFrom })} />
        <NumericField label="Amount To" value={filters.amountTo} onChange={amountTo => updateFilter({ amountTo })} />
      </div>

      <SummaryTiles
        settings={settings}
        tiles={[
          { label: 'Gross Amount', value: totals.gross },
          { label: 'Discount', value: totals.discount },
          { label: 'Tax', value: totals.tax },
          { label: 'Freight', value: totals.freight },
          { label: 'Net Amount', value: totals.net, strong: true },
        ]}
      />

      {Boolean(error) && <div style={errorStyle}>Unable to load {title}. Please refresh and try again.</div>}

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Document Number</th>
              <th style={thStyle}>{partyLabel}</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Warehouse</th>
              <th style={moneyThStyle}>Gross</th>
              <th style={moneyThStyle}>Discount</th>
              <th style={moneyThStyle}>Tax</th>
              <th style={moneyThStyle}>Freight</th>
              <th style={moneyThStyle}>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && <EmptyRow text="Loading Report..." columns={10} />}
            {!loading && rows.length === 0 && <EmptyRow text="No posted records found for selected filters." columns={10} />}
            {!loading && rows.map(row => (
              <tr key={row.id}>
                <td style={tdStyle}>{formatDate(row.documentDate, settings)}</td>
                <td style={strongTdStyle}>{row.documentNumber}</td>
                <td style={tdStyle}>{row.partyName}</td>
                <td style={tdStyle}>{row.paymentType}</td>
                <td style={tdStyle}>{row.locationName ? `${row.warehouseName} / ${row.locationName}` : row.warehouseName}</td>
                <td style={moneyTdStyle}>{formatMoney(row.grossAmount, settings)}</td>
                <td style={moneyTdStyle}>{formatMoney(row.discountAmount, settings)}</td>
                <td style={moneyTdStyle}>{formatMoney(row.taxAmount, settings)}</td>
                <td style={moneyTdStyle}>{formatMoney(row.freightAmount, settings)}</td>
                <td style={moneyStrongTdStyle}>{formatMoney(row.netAmount, settings)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={totalLabelStyle}>Totals</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.gross, settings)}</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.discount, settings)}</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.tax, settings)}</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.freight, settings)}</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.net, settings)}</td>
            </tr>
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
  const totals = rows.reduce((sum, row) => ({
    stock: sum.stock + Number(row.stock_on_hand || 0),
    reserved: sum.reserved + Number(row.reserved_stock || 0),
    available: sum.available + Number(row.available_stock || 0),
    value: sum.value + Number(row.total_stock_value || 0),
  }), { stock: 0, reserved: 0, available: 0, value: 0 });

  return (
    <div style={reportPageStyle}>
      <ReportHeader title="Stock Summary" count={total} onRefresh={() => stockQuery.refetch()} />

      <div style={stockFilterGridStyle}>
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
          placeholder="Item Code, SKU, Item Name"
          onChange={value => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>

      <SummaryTiles
        settings={settings}
        tiles={[
          { label: 'Stock On Hand', value: totals.stock, numberOnly: true },
          { label: 'Reserved Stock', value: totals.reserved, numberOnly: true },
          { label: 'Available Stock', value: totals.available, numberOnly: true },
          { label: 'Stock Value', value: totals.value, strong: true },
        ]}
      />

      {stockQuery.error && <div style={errorStyle}>Unable to load Stock Summary. Please refresh and try again.</div>}

      <div style={tableWrapStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Item Code</th>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Item Name</th>
              <th style={thStyle}>Location</th>
              <th style={moneyThStyle}>Stock On Hand</th>
              <th style={moneyThStyle}>Reserved</th>
              <th style={moneyThStyle}>Available</th>
              <th style={moneyThStyle}>Average Cost</th>
              <th style={moneyThStyle}>Stock Value</th>
            </tr>
          </thead>
          <tbody>
            {stockQuery.isLoading && <EmptyRow text="Loading Stock Summary..." columns={9} />}
            {!stockQuery.isLoading && rows.length === 0 && <EmptyRow text="No stock found for selected filters." columns={9} />}
            {!stockQuery.isLoading && rows.map(row => (
              <tr key={row.id}>
                <td style={strongTdStyle}>{row.item_code}</td>
                <td style={tdStyle}>{row.sku}</td>
                <td style={tdStyle}>{row.item_name}</td>
                <td style={tdStyle}>{joinCodeName(row.location_code, row.location_name) || '-'}</td>
                <td style={moneyTdStyle}>{formatNumber(row.stock_on_hand, settings)}</td>
                <td style={moneyTdStyle}>{formatNumber(row.reserved_stock, settings)}</td>
                <td style={moneyStrongTdStyle}>{formatNumber(row.available_stock, settings)}</td>
                <td style={moneyTdStyle}>{formatMoney(row.average_cost, settings)}</td>
                <td style={moneyStrongTdStyle}>{formatMoney(row.total_stock_value, settings)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={totalLabelStyle}>Totals</td>
              <td style={totalMoneyStyle}>{formatNumber(totals.stock, settings)}</td>
              <td style={totalMoneyStyle}>{formatNumber(totals.reserved, settings)}</td>
              <td style={totalMoneyStyle}>{formatNumber(totals.available, settings)}</td>
              <td style={totalMoneyStyle}>-</td>
              <td style={totalMoneyStyle}>{formatMoney(totals.value, settings)}</td>
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
    </div>
  );
}

function ReportHeader({ title, count, onRefresh }: { title: string; count: number; onRefresh: () => void }) {
  return (
    <div style={reportHeaderStyle}>
      <div>
        <h2 style={reportTitleStyle}>{title}</h2>
        <span style={recordBadgeStyle}>{count} Records</span>
      </div>
      <button type="button" className="btn-secondary" style={smallButtonStyle} onClick={onRefresh}>
        <IconRefresh size={14} /> Refresh
      </button>
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
    <label style={filterLabelStyle}>
      <span>{label}</span>
      <SearchableSelect value={value} options={options} placeholder={placeholder} onChange={onChange} />
    </label>
  );
}

function SummaryTiles({
  tiles,
  settings,
}: {
  tiles: Array<{ label: string; value: number; strong?: boolean; numberOnly?: boolean }>;
  settings?: AppFormatSettingsSource | null;
}) {
  return (
    <div style={summaryGridStyle}>
      {tiles.map(tile => (
        <div key={tile.label} style={summaryTileStyle(tile.strong)}>
          <span>{tile.label}</span>
          <strong>{tile.numberOnly ? formatNumber(tile.value, settings) : formatMoney(tile.value, settings)}</strong>
        </div>
      ))}
    </div>
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

function EmptyRow({ text, columns }: { text: string; columns: number }) {
  return (
    <tr>
      <td colSpan={columns} style={emptyTdStyle}>{text}</td>
    </tr>
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

const pageStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  boxSizing: 'border-box',
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflow: 'hidden',
};

const toolbarInnerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  flexWrap: 'wrap',
};

const groupButtonWrapStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '1.05rem',
  lineHeight: 1.1,
  color: 'var(--color-heading)',
};

const subtitleStyle: CSSProperties = {
  margin: '3px 0 0',
  color: 'var(--color-text-muted)',
  fontSize: '0.73rem',
  fontWeight: 800,
};

const workspaceStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 8,
  overflow: 'hidden',
};

const reportTabsStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface)',
  borderRadius: 'var(--radius-md)',
  padding: 8,
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  alignItems: 'center',
};

const reportPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'hidden',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  display: 'grid',
};

const smallButtonStyle: CSSProperties = {
  ...compactButtonStyle,
  minHeight: 28,
  padding: '4px 9px',
  fontSize: '0.74rem',
};

const reportPageStyle: CSSProperties = {
  height: '100%',
  minHeight: 0,
  padding: 10,
  display: 'grid',
  gridTemplateRows: 'auto auto auto auto minmax(0, 1fr) 40px',
  gap: 8,
  overflow: 'hidden',
};

const reportHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  paddingBottom: 7,
  borderBottom: '1px solid var(--color-border-subtle)',
};

const reportTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--color-heading)',
  fontSize: '0.95rem',
  fontWeight: 900,
};

const recordBadgeStyle: CSSProperties = {
  display: 'inline-block',
  marginTop: 3,
  color: 'var(--color-success-text)',
  background: 'var(--color-success-bg)',
  border: '1px solid var(--color-success-border)',
  borderRadius: 'var(--radius-pill)',
  padding: '2px 8px',
  fontSize: '0.68rem',
  fontWeight: 900,
};

const transactionFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(210px, 1.2fr) minmax(210px, 1fr) minmax(190px, 0.9fr) 118px 118px 112px 112px',
  gap: 8,
  alignItems: 'end',
  overflow: 'visible',
  position: 'relative',
  zIndex: 10,
};

const stockFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(240px, 320px) minmax(260px, 1fr)',
  gap: 8,
  alignItems: 'end',
  position: 'relative',
  zIndex: 10,
};

const filterLabelStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  color: 'var(--color-heading)',
  fontSize: '0.68rem',
  fontWeight: 900,
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(130px, 1fr))',
  gap: 8,
};

function summaryTileStyle(strong?: boolean): CSSProperties {
  return {
    border: `1px solid ${strong ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background: strong ? 'var(--color-primary-light)' : 'var(--color-surface-alt)',
    borderRadius: 'var(--radius)',
    padding: '7px 9px',
    display: 'grid',
    gap: 5,
  };
}

const tableWrapStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.74rem',
};

const thStyle: CSSProperties = {
  background: 'var(--color-table-header-bg)',
  color: 'var(--color-table-header-text)',
  padding: '7px 8px',
  border: '1px solid var(--color-border)',
  textAlign: 'left',
  fontWeight: 900,
  whiteSpace: 'nowrap',
};

const moneyThStyle: CSSProperties = {
  ...thStyle,
  textAlign: 'right',
};

const tdStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--color-border-subtle)',
  color: 'var(--color-text)',
  whiteSpace: 'nowrap',
};

const strongTdStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 900,
  color: 'var(--color-heading)',
};

const moneyTdStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
};

const moneyStrongTdStyle: CSSProperties = {
  ...moneyTdStyle,
  fontWeight: 950,
  color: 'var(--color-heading)',
};

const totalLabelStyle: CSSProperties = {
  ...tdStyle,
  background: 'var(--color-primary-light)',
  textAlign: 'right',
  fontWeight: 950,
  color: 'var(--color-heading)',
};

const totalMoneyStyle: CSSProperties = {
  ...moneyStrongTdStyle,
  background: 'var(--color-primary-light)',
  borderTop: '2px solid var(--color-primary)',
};

const emptyTdStyle: CSSProperties = {
  ...tdStyle,
  height: 130,
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontWeight: 850,
};

const errorStyle: CSSProperties = {
  color: 'var(--color-danger-text)',
  fontSize: '0.74rem',
  fontWeight: 800,
};
