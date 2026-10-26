'use client';

import { useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { type SalesTaxResponse, useSalesTaxReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useReportDateRange } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';

interface SalesTaxReportPageProps {
  embedded?: boolean;
}

function amountCents(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}

function centsText(cents: number) {
  return (cents / 100).toFixed(2);
}

/** Net line: payable when output tax is higher, refundable when input tax is higher. */
function netTaxFigure(summary: SalesTaxResponse['summary'] | undefined) {
  if (summary && amountCents(summary.net_tax_refundable) !== 0) {
    return { label: 'Net Tax Refundable', value: summary.net_tax_refundable };
  }
  return { label: 'Net Tax Payable', value: summary?.net_tax_payable ?? '0' };
}

export function SalesTaxReportPage({ embedded = false }: SalesTaxReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useReportDateRange();
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useSalesTaxReport({ date_from: dateFrom, date_to: dateTo }, shouldLoad);

  function validateFilters() {
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

  const report = reportQuery.data;
  const summary = report?.summary;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const documents = report?.documents ?? [];
  const periodText = `${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}`;
  const netTax = netTaxFigure(summary);

  const sideTotals = (['Output', 'Input'] as const).map(side => {
    const sideDocuments = documents.filter(document => document.tax_side === side);
    return {
      side,
      taxable: centsText(sideDocuments.reduce((sum, document) => sum + amountCents(document.taxable_amount), 0)),
      tax: centsText(sideDocuments.reduce((sum, document) => sum + amountCents(document.tax_amount), 0)),
    };
  });

  const figures = [
    { label: 'Output Taxable Amount', value: summary?.output_taxable_amount ?? '0' },
    { label: 'Output Tax', value: summary?.output_tax ?? '0' },
    { label: 'Input Taxable Amount', value: summary?.input_taxable_amount ?? '0' },
    { label: 'Input Tax', value: summary?.input_tax ?? '0' },
    netTax,
  ];

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    return {
      title: 'Sales Tax Report',
      subtitle: periodText,
      summary: figures.map(figure => ({ label: figure.label, value: formatMoney(figure.value, generalSettings) })),
      columns: [
        { label: 'Date', kind: 'date' },
        { label: 'Document Type' },
        { label: 'Document No.' },
        { label: 'Party' },
        { label: 'Tax Registration No.' },
        { label: 'Tax Side' },
        { label: 'Taxable Amount', kind: 'money' },
        { label: 'Tax Amount', kind: 'money' },
      ],
      rows: [
        ...documents.map(document => ({
          cells: [
            document.document_date,
            document.document_type,
            document.document_number,
            document.party_name,
            document.tax_registration_no ?? '',
            document.tax_side,
            document.taxable_amount,
            document.tax_amount,
          ],
        })),
        ...sideTotals.map(total => ({
          style: 'total' as const,
          cells: ['', `Total ${total.side} Tax`, '', '', '', total.side, total.taxable, total.tax],
        })),
      ],
      note: 'Returns are shown as negative amounts.',
      fileName: `sales-tax-${dateFrom}-to-${dateTo}`,
    };
  }

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader title="Sales Tax Report" description={`Tax charged on sales and paid on purchases from ${periodText}.`} />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} required />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} required />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <div className="filter-bar" aria-label="Sales Tax Totals">
          <div className="filter-bar-end" style={{ gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {figures.map(figure => (
              <span key={figure.label}>
                {figure.label}{' '}
                <strong style={{ fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(figure.value, generalSettings)}
                </strong>
              </span>
            ))}
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Document Type</th>
                <th>Document No.</th>
                <th>Party</th>
                <th>Tax Registration No.</th>
                <th>Tax Side</th>
                <th className="num">Taxable Amount</th>
                <th className="num">Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={8} title="Loading Sales Tax Report…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={8} title="Choose The Dates" description="Select Date From and Date To, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && documents.length === 0 && (
                <TableMessageRow colSpan={8} title="No Taxed Documents Found" description="No posted sales or purchases with tax in the selected period. Widen the dates to see more." />
              )}
              {!reportQuery.isFetching && documents.map(document => (
                <tr key={`${document.document_type}-${document.document_id}`}>
                  <td>{formatDate(document.document_date, generalSettings)}</td>
                  <td>{document.document_type}</td>
                  <td className="cell-strong">{document.document_number}</td>
                  <td>{document.party_name}</td>
                  <td className="cell-muted">{document.tax_registration_no ?? ''}</td>
                  <td>{document.tax_side}</td>
                  <td className="num" style={amountStyle(document.taxable_amount)}>{formatMoney(document.taxable_amount, generalSettings)}</td>
                  <td className="num" style={amountStyle(document.tax_amount)}>{formatMoney(document.tax_amount, generalSettings)}</td>
                </tr>
              ))}
            </tbody>
            {report && (
              <tfoot>
                {sideTotals.map(total => (
                  <tr key={total.side}>
                    <td colSpan={6}>Total {total.side} Tax</td>
                    <td className="num" style={amountStyle(total.taxable)}>{formatMoney(total.taxable, generalSettings)}</td>
                    <td className="num" style={amountStyle(total.tax)}>{formatMoney(total.tax, generalSettings)}</td>
                  </tr>
                ))}
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
