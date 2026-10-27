'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { DateField, SelectField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { reportHelp } from './report-help';
import { PaginationBar } from '@/components/ui/PaginationBar';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { useDayBookReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useReportDateRange } from './LedgerReportHelpers';
import { embeddedReportStyle, reportFilterGridStyle, reportGroupRowStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument, ReportRow } from './report-output';

interface DayBookReportPageProps {
  embedded?: boolean;
}

const PAGE_SIZE = 50;

const voucherTypes = [
  { value: 'JV', label: 'Journal Voucher' },
  { value: 'BRV', label: 'Bank Receipt' },
  { value: 'BPV', label: 'Bank Payment' },
  { value: 'CRV', label: 'Cash Receipt' },
  { value: 'CPV', label: 'Cash Payment' },
  { value: 'CV', label: 'Contra Voucher' },
  { value: 'DN', label: 'Debit Note' },
  { value: 'CN', label: 'Credit Note' },
  { value: 'PI', label: 'Purchase Voucher' },
  { value: 'PR', label: 'Purchase Return' },
  { value: 'SI', label: 'Sale Voucher' },
  { value: 'SR', label: 'Sale Return' },
  { value: 'SA', label: 'Stock Adjustment' },
  { value: 'RV', label: 'Reversal Voucher' },
  { value: 'CL', label: 'Year-End Closing' },
];

const voucherTypeOptions = [
  { value: '', label: 'All' },
  ...voucherTypes.map(type => ({ value: type.value, label: `${type.label} (${type.value})` })),
];

function voucherTypeLabel(code: string) {
  return voucherTypes.find(type => type.value === code)?.label ?? code;
}

/** Zero amounts are left blank so the figures that matter stand out. */
function moneyOrBlank(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '' : formatMoney(value, settings);
}

const linkStyle = { color: 'var(--color-primary-text)', fontWeight: 600 };

export function DayBookReportPage({ embedded = false }: DayBookReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useReportDateRange();
  const [voucherType, setVoucherType] = useState('');
  const [page, setPage] = useState(1);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useDayBookReport({
    date_from: dateFrom,
    date_to: dateTo,
    voucher_type: voucherType || undefined,
    page,
    limit: PAGE_SIZE,
  }, shouldLoad);

  function validateFilters() {
    if (!isValidDateInput(dateFrom)) return 'Enter the Date From.';
    if (!isValidDateInput(dateTo)) return 'Enter the Date To.';
    if (dateTo < dateFrom) return 'Date To must be on or after Date From.';
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
    setPage(1);
    setShouldLoad(false);
    setMessage('');
  }

  const report = reportQuery.data;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const vouchers = report?.vouchers ?? [];
  const pagination = report?.pagination;
  const totalPages = Math.max(1, pagination?.pages ?? 1);
  const periodText = `${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}`;

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    const rows: ReportRow[] = [];
    vouchers.forEach(voucher => {
      rows.push({
        style: 'group',
        cells: [
          voucher.voucher_date,
          voucher.voucher_number,
          voucherTypeLabel(voucher.voucher_type),
          '',
          '',
          [voucher.reference, voucher.narration].filter(Boolean).join(' - '),
          '',
          '',
        ],
      });
      voucher.lines.forEach(line => rows.push({
        cells: ['', '', '', line.account_code, line.account_name, line.narration ?? '', line.debit_amount, line.credit_amount],
      }));
    });
    rows.push({
      style: 'total',
      cells: ['', `Totals (${report.totals.voucher_count} Vouchers)`, '', '', '', '', report.totals.total_debit, report.totals.total_credit],
    });

    const typeText = voucherType ? ` · ${voucherTypeLabel(voucherType)}` : '';
    return {
      title: 'Day Book',
      subtitle: `${periodText}${typeText}`,
      columns: [
        { label: 'Date', kind: 'date' },
        { label: 'Voucher No.' },
        { label: 'Type' },
        { label: 'Account Code' },
        { label: 'Account Name' },
        { label: 'Reference / Narration' },
        { label: 'Debit', kind: 'money' },
        { label: 'Credit', kind: 'money' },
      ],
      rows,
      note: `Page ${pagination?.page ?? page} of ${totalPages}. Totals cover the whole period. Choose a shorter date range to export fewer vouchers.`,
      fileName: `day-book-${dateFrom}-to-${dateTo}${totalPages > 1 ? `-page-${pagination?.page ?? page}` : ''}`,
    };
  }

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader title="Day Book" description={`Posted vouchers from ${periodText}.`} help={reportHelp['day-book']} />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} required />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} required />
            <SelectField label="Voucher Type" value={voucherType} options={voucherTypeOptions} onChange={value => updateFilter(() => setVoucherType(value))} />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1000 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No.</th>
                <th>Type</th>
                <th>Account Code</th>
                <th>Account Name / Narration</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={7} title="Loading Day Book…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={7} title="Choose The Dates" description="Select Date From and Date To, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && vouchers.length === 0 && (
                <TableMessageRow colSpan={7} title="No Vouchers Found" description="No posted vouchers in the selected period. Choose a wider date range or set Voucher Type to All." />
              )}
              {!reportQuery.isFetching && vouchers.map(voucher => {
                const groupStyle = reportGroupRowStyle(2);
                const description = [voucher.reference, voucher.narration].filter(Boolean).join(' - ');
                return [
                  <tr key={voucher.id}>
                    <td style={groupStyle}>{formatDate(voucher.voucher_date, generalSettings)}</td>
                    <td style={groupStyle}>
                      <Link href={`/vouchers/posted?status=Posted&voucher=${voucher.id}`} style={linkStyle}>{voucher.voucher_number}</Link>
                    </td>
                    <td style={groupStyle}>{voucherTypeLabel(voucher.voucher_type)}</td>
                    <td colSpan={4} style={{ ...groupStyle, fontWeight: 400 }} className="cell-muted">{description}</td>
                  </tr>,
                  ...voucher.lines.map((line, index) => (
                    <tr key={`${voucher.id}-${index}`}>
                      <td colSpan={3} />
                      <td>{line.account_code}</td>
                      <td>
                        {line.account_name}
                        {line.narration && <span className="cell-muted"> · {line.narration}</span>}
                      </td>
                      <td className="num">{moneyOrBlank(line.debit_amount, generalSettings)}</td>
                      <td className="num">{moneyOrBlank(line.credit_amount, generalSettings)}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Totals For The Period ({report.totals.voucher_count} Vouchers)</td>
                  <td className="num">{formatMoney(report.totals.total_debit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.total_credit, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {report && (
          <PaginationBar
            page={pagination?.page ?? page}
            totalPages={totalPages}
            totalRecords={pagination?.total ?? 0}
            recordLabel="Vouchers"
            disabled={reportQuery.isFetching}
            onPageChange={setPage}
          />
        )}
      </section>
    </Root>
  );
}
