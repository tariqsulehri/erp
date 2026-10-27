'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { CheckboxField, DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { reportHelp } from './report-help';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { ProfitAndLossLine, useProfitAndLossReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useReportDateRange } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle, reportGroupRowStyle, reportIndentStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';

interface ProfitAndLossReportPageProps {
  embedded?: boolean;
}

type ProfitAndLossDisplayRow =
  | {
      kind: 'section' | 'group' | 'sub-group';
      key: string;
      code: string;
      name: string;
      amount: string;
    }
  | {
      kind: 'account';
      key: string;
      line: ProfitAndLossLine;
    };

const linkStyle = { color: 'var(--color-primary-text)' };

function amountCents(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}

function centsText(cents: number) {
  return (cents / 100).toFixed(2);
}

function isZeroLine(line: ProfitAndLossLine) {
  return amountCents(line.amount) === 0;
}

function totalAmount(lines: ProfitAndLossLine[]) {
  return centsText(lines.reduce((sum, line) => sum + amountCents(line.amount), 0));
}

/** Zero amounts are left blank so the figures that matter stand out. */
function moneyOrBlank(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '' : formatMoney(value, settings);
}

function buildGroupedRows(lines: ProfitAndLossLine[], includeZeroBalances: boolean): ProfitAndLossDisplayRow[] {
  const visibleLines = includeZeroBalances ? lines : lines.filter(line => !isZeroLine(line));
  return (['Revenue', 'Expenses'] as const).flatMap(section => {
    const sectionLines = visibleLines.filter(line => line.section === section);
    if (sectionLines.length === 0) return [];

    const rows: ProfitAndLossDisplayRow[] = [{
      kind: 'section',
      key: section,
      code: section === 'Revenue' ? '04' : '05',
      name: section,
      amount: totalAmount(sectionLines),
    }];

    [...new Set(sectionLines.map(line => line.group_code))].sort().forEach(groupCode => {
      const groupLines = sectionLines.filter(line => line.group_code === groupCode);
      const firstGroup = groupLines[0];
      rows.push({
        kind: 'group',
        key: `group-${groupCode}`,
        code: groupCode,
        name: firstGroup?.group_name ?? 'Group',
        amount: totalAmount(groupLines),
      });

      [...new Set(groupLines.map(line => line.sub_group_code))].sort().forEach(subGroupCode => {
        const subGroupLines = groupLines.filter(line => line.sub_group_code === subGroupCode);
        const firstSubGroup = subGroupLines[0];
        rows.push({
          kind: 'sub-group',
          key: `sub-group-${subGroupCode}`,
          code: subGroupCode,
          name: firstSubGroup?.sub_group_name ?? 'Sub-Group',
          amount: totalAmount(subGroupLines),
        });
        subGroupLines.forEach(line => rows.push({ kind: 'account', key: line.account_id, line }));
      });
    });

    return rows;
  });
}

export function ProfitAndLossReportPage({ embedded = false }: ProfitAndLossReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useReportDateRange();
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useProfitAndLossReport({
    date_from: dateFrom,
    date_to: dateTo,
    include_zero_balances: includeZeroBalances,
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
    setShouldLoad(false);
    setMessage('');
  }

  function updateZeroBalanceFilter(checked: boolean) {
    setIncludeZeroBalances(checked);
    setMessage('');
  }

  const report = reportQuery.data;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const displayRows = buildGroupedRows(report?.lines ?? [], includeZeroBalances);
  const netAmount = Number(report?.totals.net_profit ?? 0) - Number(report?.totals.net_loss ?? 0);
  const netLabel = report?.totals.result ?? 'Break Even';

  const accountCount = displayRows.filter(row => row.kind === 'account').length;
  const netIsLoss = netAmount < 0;

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    return {
      title: 'Profit And Loss',
      subtitle: `${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}`,
      columns: [
        { label: 'Account Code' },
        { label: 'Account Name' },
        { label: 'Debit', kind: 'money' },
        { label: 'Credit', kind: 'money' },
        { label: 'Amount', kind: 'money' },
      ],
      rows: [
        ...displayRows.map(row => (row.kind !== 'account'
          ? { style: 'group' as const, cells: [row.code, row.name, '', '', row.amount] }
          : { cells: [row.line.account_code, row.line.account_name, row.line.debit_amount, row.line.credit_amount, row.line.amount] })),
        { style: 'total' as const, cells: ['', 'Total Revenue', '', '', report.totals.revenue] },
        { style: 'total' as const, cells: ['', 'Total Expenses', '', '', report.totals.expenses] },
        { style: 'total' as const, cells: ['', `Net ${netLabel} (${accountCount} Accounts)`, '', '', centsText(Math.abs(amountCents(netAmount)))] },
      ],
      fileName: `profit-and-loss-${dateFrom}-to-${dateTo}`,
    };
  }

  const ledgerHref = (accountId: string) => `/reports?report=ledger&account=${accountId}&from=${dateFrom}&to=${dateTo}`;

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader
          title="Profit And Loss"
          description={`Revenue and expenses from ${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}.`}
          help={reportHelp['profit-and-loss']}
        />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} required />
            <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} required />
            <CheckboxField label="Show Zero Balances" checked={includeZeroBalances} onChange={updateZeroBalanceFilter} />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 900 }}>
            <colgroup>
              <col style={{ width: 140 }} />
              <col />
              <col style={{ width: 140 }} />
              <col style={{ width: 140 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account Name</th>
                <th className="num">Debit</th>
                <th className="num">Credit</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={5} title="Loading Profit And Loss…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={5} title="Choose The Dates" description="Select Date From and Date To, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <TableMessageRow colSpan={5} title="No Revenue Or Expenses Found" description="No revenue or expense transactions in the selected period. Choose a wider date range to see more." />
              )}
              {!reportQuery.isFetching && displayRows.map(row => {
                if (row.kind !== 'account') {
                  const level = row.kind === 'section' ? 1 : row.kind === 'group' ? 2 : 3;
                  const groupStyle = reportGroupRowStyle(level);
                  return (
                    <tr key={row.key}>
                      <td colSpan={4} style={{ ...groupStyle, ...reportIndentStyle(level - 1) }}>
                        {row.code} - {row.name}
                      </td>
                      <td className="num" style={{ ...groupStyle, ...amountStyle(row.amount) }}>{moneyOrBlank(row.amount, generalSettings)}</td>
                    </tr>
                  );
                }

                const { line } = row;
                return (
                  <tr key={line.account_id}>
                    <td className="cell-strong" style={reportIndentStyle(3)}>
                      <Link href={ledgerHref(line.account_id)} style={linkStyle}>{line.account_code}</Link>
                    </td>
                    <td>
                      <Link href={ledgerHref(line.account_id)} style={linkStyle}>{line.account_name}</Link>
                    </td>
                    <td className="num" style={amountStyle(line.debit_amount)}>{moneyOrBlank(line.debit_amount, generalSettings)}</td>
                    <td className="num" style={amountStyle(line.credit_amount)}>{moneyOrBlank(line.credit_amount, generalSettings)}</td>
                    <td className="num" style={amountStyle(line.amount)}>{moneyOrBlank(line.amount, generalSettings)}</td>
                  </tr>
                );
              })}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total Revenue</td>
                  <td className="num">{formatMoney(report.totals.revenue, generalSettings)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>Total Expenses</td>
                  <td className="num">{formatMoney(report.totals.expenses, generalSettings)}</td>
                </tr>
                <tr>
                  <td colSpan={4}>Net {netLabel} ({accountCount} Accounts)</td>
                  <td className="num" style={netIsLoss ? { color: 'var(--color-negative)' } : undefined}>{formatMoney(Math.abs(netAmount), generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
