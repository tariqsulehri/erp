'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { reportHelp } from './report-help';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { type AgingBucketKey, type AgingKind, useAgingReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { todayInputDate } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';

interface AgingReportPageProps {
  embedded?: boolean;
  kind: AgingKind;
}

/** Used until the report arrives; the labels on screen come from the response. */
const defaultBuckets: Array<{ key: AgingBucketKey; label: string }> = [
  { key: 'days_0_30', label: '0 - 30 Days' },
  { key: 'days_31_60', label: '31 - 60 Days' },
  { key: 'days_61_90', label: '61 - 90 Days' },
  { key: 'over_90', label: 'Over 90 Days' },
];

/** Zero amounts are left blank so the figures that matter stand out. */
function moneyOrBlank(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '' : formatMoney(value, settings);
}

const linkStyle = { color: 'var(--color-primary-text)' };
const hintStyle = { padding: '8px 12px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', borderBottom: '1px solid var(--color-border-subtle)' };

export function AgingReportPage({ embedded = false, kind }: AgingReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const [asOfDate, setAsOfDate] = useState(todayInputDate());
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useAgingReport({ kind, as_of_date: asOfDate }, shouldLoad);

  const isReceivables = kind === 'receivables';
  const title = isReceivables ? 'Receivables Aging' : 'Payables Aging';
  const partyLabel = isReceivables ? 'Customer' : 'Supplier';
  const ledgerReport = isReceivables ? 'customer-ledger' : 'supplier-ledger';

  function validateFilters() {
    if (!isValidDateInput(asOfDate)) return 'Enter the As Of Date.';
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
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const rows = report?.rows ?? [];
  const buckets = report?.buckets?.length ? report.buckets : defaultBuckets;
  const columnCount = buckets.length + 4;

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    return {
      title,
      subtitle: `As of ${formatDate(report.as_of_date, generalSettings)}`,
      columns: [
        { label: 'Code' },
        { label: partyLabel },
        ...buckets.map(bucket => ({ label: bucket.label, kind: 'money' as const })),
        { label: 'Advance', kind: 'money' },
        { label: 'Balance', kind: 'money' },
      ],
      rows: [
        ...rows.map(row => ({
          cells: [row.party_code, row.party_name, ...buckets.map(bucket => row[bucket.key]), row.advance, row.balance],
        })),
        {
          style: 'total' as const,
          cells: ['', `Totals (${rows.length} ${partyLabel}s)`, ...buckets.map(bucket => report.totals[bucket.key]), report.totals.advance, report.totals.balance],
        },
      ],
      note: 'Payments are matched to the oldest open amounts first. Advance is money received (or paid) before it was due.',
      fileName: `${kind}-aging-${report.as_of_date}`,
    };
  }

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader
          title={title}
          description={`Open ${isReceivables ? 'customer' : 'supplier'} balances by age as of ${formatDate(asOfDate, generalSettings)}.`}
          help={reportHelp[isReceivables ? 'receivables-aging' : 'payables-aging']}
        />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="As Of Date" value={asOfDate} onChange={value => updateFilter(() => setAsOfDate(value))} required />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <div style={hintStyle}>
          Payments are matched to the oldest open amounts first. Advance is money received (or paid) before it was due.
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col />
              {buckets.map(bucket => <col key={bucket.key} style={{ width: 124 }} />)}
              <col style={{ width: 124 }} />
              <col style={{ width: 136 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>{partyLabel}</th>
                {buckets.map(bucket => <th key={bucket.key} className="num">{bucket.label}</th>)}
                <th className="num">Advance</th>
                <th className="num">Balance</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={columnCount} title={`Loading ${title}…`} loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={columnCount} title="Choose The Date" description="Select the As Of Date, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && rows.length === 0 && (
                <TableMessageRow
                  colSpan={columnCount}
                  title="No Open Balances Found"
                  description={`No ${isReceivables ? 'customer' : 'supplier'} has an open balance on this date. Pick a later date to see more.`}
                />
              )}
              {!reportQuery.isFetching && report && rows.map(row => (
                <tr key={row.party_id}>
                  <td className="cell-muted">{row.party_code}</td>
                  <td>
                    <Link href={`/reports?report=${ledgerReport}&account=${row.account_id}&to=${report.as_of_date}`} style={linkStyle}>
                      {row.party_name}
                    </Link>
                  </td>
                  {buckets.map(bucket => (
                    <td key={bucket.key} className="num" style={amountStyle(row[bucket.key])}>{moneyOrBlank(row[bucket.key], generalSettings)}</td>
                  ))}
                  <td className="num" style={amountStyle(row.advance)}>{moneyOrBlank(row.advance, generalSettings)}</td>
                  <td className="num cell-strong" style={amountStyle(row.balance)}>{formatMoney(row.balance, generalSettings)}</td>
                </tr>
              ))}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Totals ({rows.length} {partyLabel}s)</td>
                  {buckets.map(bucket => (
                    <td key={bucket.key} className="num" style={amountStyle(report.totals[bucket.key])}>{formatMoney(report.totals[bucket.key], generalSettings)}</td>
                  ))}
                  <td className="num" style={amountStyle(report.totals.advance)}>{formatMoney(report.totals.advance, generalSettings)}</td>
                  <td className="num" style={amountStyle(report.totals.balance)}>{formatMoney(report.totals.balance, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
