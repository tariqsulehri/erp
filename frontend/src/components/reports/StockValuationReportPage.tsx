'use client';

import { useState, type ReactNode } from 'react';
import { IconBook2, IconPackage, IconRefresh, IconScale, IconSearch } from '@tabler/icons-react';
import { StatGrid, StatTile, type StatTone } from '@/components/ui/StatTile';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { reportHelp } from './report-help';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { useStockValuationReport, type StockValuationResponse } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { todayInputDate } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';
import { placeFilterLabel, StockPlaceFields, useStockPlaceFilter, useStockReportOptions } from './StockReportFilters';

interface StockValuationReportPageProps {
  embedded?: boolean;
}

type LedgerCheck = NonNullable<StockValuationResponse['ledger_check']>;

const COLUMN_COUNT = 7;

/** Plain-words explanation of a mismatch between stock value and the Inventory account. */
function ledgerCheckWarning(check: LedgerCheck, settings?: AppFormatSettingsSource | null) {
  const parts = [
    `Stock value and the Inventory account balance differ by ${formatMoney(check.difference, settings)}.`,
  ];
  if (Number(check.opening_stock_value) > 0) {
    parts.push(
      `Opening stock worth ${formatMoney(check.opening_stock_value, settings)} was entered without an accounting entry. `
      + 'Post a Journal Voucher (Debit Inventory, Credit Opening Balance Equity) dated the day you started using this system. The ledger will then match.',
    );
  }
  return parts.join(' ');
}

function StockValueCheck({ check, settings }: { check: LedgerCheck; settings?: AppFormatSettingsSource | null }) {
  const figures: Array<{ label: string; value: string; tone: StatTone; icon: ReactNode }> = [
    { label: 'Stock Value', value: check.stock_value, tone: 'blue', icon: <IconPackage /> },
    { label: 'Inventory Account Balance', value: check.inventory_account_balance, tone: 'violet', icon: <IconBook2 /> },
    { label: 'Difference', value: check.difference, tone: check.is_matched ? 'teal' : 'amber', icon: <IconScale /> },
  ];

  return (
    <section className="panel">
      <div className="panel-header"><h2 className="panel-title">Stock Value Check</h2></div>
      <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
        <StatGrid label="Stock Value Check">
          {figures.map(figure => (
            <StatTile key={figure.label} label={figure.label} tone={figure.tone} icon={figure.icon} value={formatMoney(figure.value, settings)} />
          ))}
        </StatGrid>
        {check.is_matched
          ? <InlineAlert tone="success">Stock value matches the Inventory account.</InlineAlert>
          : <InlineAlert tone="warning">{ledgerCheckWarning(check, settings)}</InlineAlert>}
      </div>
    </section>
  );
}

export function StockValuationReportPage({ embedded = false }: StockValuationReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const options = useStockReportOptions();
  const place = useStockPlaceFilter();
  const [asOfDate, setAsOfDate] = useState(todayInputDate());
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useStockValuationReport({ as_of_date: asOfDate, ...place.query }, shouldLoad);

  function validateFilters() {
    if (!isValidDateInput(asOfDate)) return 'Enter the As Of Date.';
    return place.validate();
  }

  function viewReport() {
    const validationMessage = validateFilters();
    if (validationMessage) {
      setMessage(validationMessage);
      setShouldLoad(false);
      return;
    }
    setMessage('');
    setShouldLoad(true);
  }

  function refreshReport() {
    const validationMessage = validateFilters();
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }
    setMessage('');
    if (!shouldLoad) {
      setShouldLoad(true);
      return;
    }
    reportQuery.refetch();
  }

  function updateFilter(action: () => void) {
    action();
    setShouldLoad(false);
    setMessage('');
  }

  const report = shouldLoad ? reportQuery.data : undefined;
  const lines = report?.lines ?? [];
  const check = report?.ledger_check ?? null;
  const errorMessage = message || (shouldLoad ? friendlyErrorMessage(reportQuery.error, '') : '');
  const placeLabel = placeFilterLabel(place.placeType, place.placeId, options.branches, options.warehouses);
  const asOfText = formatDate(asOfDate, generalSettings);

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    const summary = [
      { label: 'Items', value: formatNumber(report.totals.line_count, generalSettings) },
      { label: 'Total Quantity', value: formatNumber(report.totals.quantity, generalSettings) },
      { label: 'Total Value', value: formatMoney(report.totals.value, generalSettings) },
    ];
    if (check) {
      summary.push(
        { label: 'Stock Value', value: formatMoney(check.stock_value, generalSettings) },
        { label: 'Inventory Account Balance', value: formatMoney(check.inventory_account_balance, generalSettings) },
        { label: 'Difference', value: formatMoney(check.difference, generalSettings) },
      );
    }
    return {
      title: 'Stock Valuation',
      subtitle: `As Of ${formatDate(report.as_of_date, generalSettings)} · ${placeLabel}`,
      summary,
      columns: [
        { label: 'Item Code' },
        { label: 'Item Name' },
        { label: 'Place Type' },
        { label: 'Place' },
        { label: 'Quantity', kind: 'quantity' },
        { label: 'Average Cost', kind: 'money' },
        { label: 'Value', kind: 'money' },
      ],
      rows: [
        ...lines.map(line => ({
          cells: [line.item_code, line.item_name, line.place_kind, line.place_name, line.quantity, line.average_cost, line.value],
        })),
        { cells: [`Totals (${report.totals.line_count} Lines)`, '', '', '', report.totals.quantity, '', report.totals.value], style: 'total' },
      ],
      note: check
        ? (check.is_matched ? 'Stock value matches the Inventory account.' : ledgerCheckWarning(check, generalSettings))
        : undefined,
      fileName: `Stock-Valuation-${report.as_of_date}`,
    };
  }

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader title="Stock Valuation" description={`Stock quantity and value as of ${asOfText}.`} help={reportHelp['stock-valuation']} />
      )}

      {options.errorMessage && <InlineAlert tone="danger">{options.errorMessage}</InlineAlert>}
      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      {check && !reportQuery.isFetching && <StockValueCheck check={check} settings={generalSettings} />}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="As Of Date" value={asOfDate} onChange={value => updateFilter(() => setAsOfDate(value))} required />
            <StockPlaceFields
              placeType={place.placeType}
              placeId={place.placeId}
              branches={options.branches}
              warehouses={options.warehouses}
              loading={options.isLoading}
              onPlaceTypeChange={value => updateFilter(() => place.setPlaceType(value))}
              onPlaceIdChange={value => updateFilter(() => place.setPlaceId(value))}
            />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 980 }}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Item Name</th>
                <th>Place Type</th>
                <th>Place</th>
                <th className="num">Quantity</th>
                <th className="num">Average Cost</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={COLUMN_COUNT} title="Loading Stock Valuation…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="Choose The Date" description="Select the As Of Date and the place, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && lines.length === 0 && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="No Stock Found" description="No stock was on hand on this date. Choose a later date or All Places." />
              )}
              {!reportQuery.isFetching && lines.map(line => (
                <tr key={`${line.item_id}-${line.place_kind}-${line.place_name}`}>
                  <td className="cell-strong">{line.item_code}</td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.item_name}>{line.item_name}</td>
                  <td className="cell-muted">{line.place_kind}</td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.place_name}>{line.place_name}</td>
                  <td className="num" style={amountStyle(line.quantity)}>{formatNumber(line.quantity, generalSettings)}</td>
                  <td className="num">{formatMoney(line.average_cost, generalSettings)}</td>
                  <td className="num" style={amountStyle(line.value)}>{formatMoney(line.value, generalSettings)}</td>
                </tr>
              ))}
            </tbody>
            {report && !reportQuery.isFetching && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Totals ({report.totals.line_count} Lines)</td>
                  <td className="num">{formatNumber(report.totals.quantity, generalSettings)}</td>
                  <td />
                  <td className="num">{formatMoney(report.totals.value, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
