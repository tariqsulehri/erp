'use client';

import { useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney, formatNumber, type AppFormatSettingsSource } from '@/lib/app-settings';
import { useStockLedgerReport, type StockLedgerResponse } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useReportDateRange } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';
import { placeFilterLabel, StockPlaceFields, useStockPlaceFilter, useStockReportOptions } from './StockReportFilters';

interface StockLedgerReportPageProps {
  embedded?: boolean;
}

const COLUMN_COUNT = 10;

/** PURCHASE_RECEIPT -> Purchase Receipt. */
function movementKindLabel(kind: string) {
  return kind
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function StockLedgerSummary({ report, settings }: { report: StockLedgerResponse | undefined; settings?: AppFormatSettingsSource | null }) {
  const figures = [
    { label: 'Opening Quantity', value: formatNumber(report?.opening_quantity ?? 0, settings) },
    { label: 'Opening Value', value: formatMoney(report?.opening_value ?? 0, settings) },
    { label: 'Quantity In', value: formatNumber(report?.total_quantity_in ?? 0, settings) },
    { label: 'Quantity Out', value: formatNumber(report?.total_quantity_out ?? 0, settings) },
    { label: 'Closing Quantity', value: formatNumber(report?.closing_quantity ?? 0, settings) },
    { label: 'Closing Value', value: formatMoney(report?.closing_value ?? 0, settings) },
  ];

  return (
    <div className="filter-bar" aria-label="Stock Ledger Totals">
      <div className="filter-bar-end" style={{ gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {figures.map(figure => (
          <span key={figure.label}>
            {figure.label}{' '}
            <strong style={{ fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>{figure.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function StockLedgerReportPage({ embedded = false }: StockLedgerReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useReportDateRange();
  const options = useStockReportOptions();
  const place = useStockPlaceFilter();
  const [itemId, setItemId] = useState('');
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useStockLedgerReport({
    item_id: itemId,
    date_from: dateFrom,
    date_to: dateTo,
    ...place.query,
  }, shouldLoad && Boolean(itemId));

  function validateFilters() {
    if (!itemId) return 'Please select an Item.';
    const placeMessage = place.validate();
    if (placeMessage) return placeMessage;
    if (!isValidDateInput(dateFrom)) return 'Date From is required.';
    if (!isValidDateInput(dateTo)) return 'Date To is required.';
    if (dateTo < dateFrom) return 'Date To cannot be earlier than Date From.';
    return '';
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
  const errorMessage = message || (shouldLoad ? friendlyErrorMessage(reportQuery.error, '') : '');
  const placeLabel = placeFilterLabel(place.placeType, place.placeId, options.branches, options.warehouses);
  const periodText = `${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}`;

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    const itemText = `${report.item.item_code} - ${report.item.item_name}`;
    return {
      title: 'Stock Ledger',
      subtitle: `${itemText} · ${placeLabel} · ${periodText}`,
      summary: [
        { label: 'Opening Quantity', value: formatNumber(report.opening_quantity, generalSettings) },
        { label: 'Opening Value', value: formatMoney(report.opening_value, generalSettings) },
        { label: 'Quantity In', value: formatNumber(report.total_quantity_in, generalSettings) },
        { label: 'Quantity Out', value: formatNumber(report.total_quantity_out, generalSettings) },
        { label: 'Closing Quantity', value: formatNumber(report.closing_quantity, generalSettings) },
        { label: 'Closing Value', value: formatMoney(report.closing_value, generalSettings) },
      ],
      columns: [
        { label: 'Date', kind: 'date' },
        { label: 'Movement' },
        { label: 'Document No.' },
        { label: 'Place' },
        { label: 'Quantity In', kind: 'quantity' },
        { label: 'Quantity Out', kind: 'quantity' },
        { label: 'Unit Cost', kind: 'money' },
        { label: 'Value', kind: 'money' },
        { label: 'Balance Quantity', kind: 'quantity' },
        { label: 'Balance Value', kind: 'money' },
      ],
      rows: [
        { cells: [report.date_from, 'Opening Balance', '', '', '', '', '', '', report.opening_quantity, report.opening_value], style: 'group' },
        ...lines.map(line => ({
          cells: [
            line.movement_date,
            movementKindLabel(line.movement_kind),
            line.document_number ?? '',
            line.place,
            line.quantity_in,
            line.quantity_out,
            line.unit_cost,
            line.value,
            line.balance_quantity,
            line.balance_value,
          ],
        })),
        { cells: ['', 'Totals And Closing', '', '', report.total_quantity_in, report.total_quantity_out, '', '', report.closing_quantity, report.closing_value], style: 'total' },
      ],
      fileName: `Stock-Ledger-${report.item.item_code}-${dateFrom}-to-${dateTo}`,
    };
  }

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader title="Stock Ledger" description={`Stock in and out for one Item from ${periodText}.`} />
      )}

      {options.errorMessage && <InlineAlert tone="danger">{options.errorMessage}</InlineAlert>}
      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <FieldLabel label="Item" required>
              <SearchableSelect
                value={itemId}
                options={options.items}
                onChange={value => updateFilter(() => setItemId(value))}
                placeholder={options.isLoading ? 'Loading Items…' : 'Search Item'}
                disabled={options.isLoading}
                ariaLabel="Item"
              />
            </FieldLabel>
            <StockPlaceFields
              placeType={place.placeType}
              placeId={place.placeId}
              branches={options.branches}
              warehouses={options.warehouses}
              loading={options.isLoading}
              onPlaceTypeChange={value => updateFilter(() => place.setPlaceType(value))}
              onPlaceIdChange={value => updateFilter(() => place.setPlaceId(value))}
            />
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} required />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} required />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <StockLedgerSummary report={report} settings={generalSettings} />

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1180 }}>
            <colgroup>
              <col style={{ width: 104 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 104 }} />
              <col style={{ width: 104 }} />
              <col style={{ width: 112 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 132 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Movement</th>
                <th>Document No.</th>
                <th>Place</th>
                <th className="num">Quantity In</th>
                <th className="num">Quantity Out</th>
                <th className="num">Unit Cost</th>
                <th className="num">Value</th>
                <th className="num">Balance Quantity</th>
                <th className="num">Balance Value</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={COLUMN_COUNT} title="Loading Stock Ledger…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="Choose An Item" description="Select an Item, the place and the dates, then click View Report." />
              )}
              {!reportQuery.isFetching && report && (
                <tr>
                  <td className="cell-muted">{formatDate(report.date_from, generalSettings)}</td>
                  <td colSpan={7} className="cell-strong">Opening Balance</td>
                  <td className="num" style={amountStyle(report.opening_quantity)}>{formatNumber(report.opening_quantity, generalSettings)}</td>
                  <td className="num" style={amountStyle(report.opening_value)}>{formatMoney(report.opening_value, generalSettings)}</td>
                </tr>
              )}
              {!reportQuery.isFetching && report && lines.length === 0 && (
                <TableMessageRow colSpan={COLUMN_COUNT} title="No Stock Movements Found" description="This Item has no stock movements in the selected period. Widen the dates or choose All Places." />
              )}
              {!reportQuery.isFetching && lines.map(line => (
                <tr key={line.id}>
                  <td className="cell-muted">{formatDate(line.movement_date, generalSettings)}</td>
                  <td title={line.remarks ?? undefined}>{movementKindLabel(line.movement_kind)}</td>
                  <td className={line.document_number ? 'cell-strong' : 'cell-muted'}>{line.document_number || 'Not Set'}</td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={line.place}>{line.place}</td>
                  <td className="num">{Number(line.quantity_in) === 0 ? '' : formatNumber(line.quantity_in, generalSettings)}</td>
                  <td className="num">{Number(line.quantity_out) === 0 ? '' : formatNumber(line.quantity_out, generalSettings)}</td>
                  <td className="num">{formatMoney(line.unit_cost, generalSettings)}</td>
                  <td className="num" style={amountStyle(line.value)}>{formatMoney(line.value, generalSettings)}</td>
                  <td className="num" style={amountStyle(line.balance_quantity)}>{formatNumber(line.balance_quantity, generalSettings)}</td>
                  <td className="num" style={amountStyle(line.balance_value)}>{formatMoney(line.balance_value, generalSettings)}</td>
                </tr>
              ))}
            </tbody>
            {report && !reportQuery.isFetching && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Totals And Closing ({lines.length} Movements)</td>
                  <td className="num">{formatNumber(report.total_quantity_in, generalSettings)}</td>
                  <td className="num">{formatNumber(report.total_quantity_out, generalSettings)}</td>
                  <td />
                  <td />
                  <td className="num" style={amountStyle(report.closing_quantity)}>{formatNumber(report.closing_quantity, generalSettings)}</td>
                  <td className="num" style={amountStyle(report.closing_value)}>{formatMoney(report.closing_value, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
