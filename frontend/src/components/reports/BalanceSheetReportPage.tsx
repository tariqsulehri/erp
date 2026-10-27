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
import { BalanceSheetLine, useBalanceSheetReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { todayInputDate } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle, reportGroupRowStyle, reportIndentStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';

interface BalanceSheetReportPageProps {
  embedded?: boolean;
}

type BalanceSheetDisplayRow =
  | {
      kind: 'section' | 'group' | 'sub-group';
      key: string;
      code: string;
      name: string;
      section: BalanceSheetLine['section'];
      amount: string;
    }
  | {
      kind: 'account';
      key: string;
      line: BalanceSheetLine;
    };

const linkStyle = { color: 'var(--color-primary-text)' };

const sections: BalanceSheetLine['section'][] = ['Assets', 'Liabilities', 'Equity'];

function amountCents(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}

function centsText(cents: number) {
  return (cents / 100).toFixed(2);
}

function totalAmount(lines: BalanceSheetLine[]) {
  return centsText(lines.reduce((sum, line) => sum + amountCents(line.amount), 0));
}

/** Zero amounts are left blank so the figures that matter stand out. */
function moneyOrBlank(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '' : formatMoney(value, settings);
}

function buildGroupedRows(lines: BalanceSheetLine[], includeZeroBalances: boolean): BalanceSheetDisplayRow[] {
  const visibleLines = includeZeroBalances ? lines : lines.filter(line => amountCents(line.amount) !== 0);
  return sections.flatMap(section => {
    const sectionLines = visibleLines.filter(line => line.section === section);
    if (sectionLines.length === 0) return [];

    const rows: BalanceSheetDisplayRow[] = [{
      kind: 'section',
      key: section,
      code: section === 'Assets' ? '01' : section === 'Liabilities' ? '02' : '03',
      name: section,
      section,
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
        section,
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
          section,
          amount: totalAmount(subGroupLines),
        });
        subGroupLines.forEach(line => rows.push({ kind: 'account', key: line.account_id, line }));
      });
    });

    return rows;
  });
}

export function BalanceSheetReportPage({ embedded = false }: BalanceSheetReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const [asOfDate, setAsOfDate] = useState(todayInputDate());
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useBalanceSheetReport({
    as_of_date: asOfDate,
    include_zero_balances: includeZeroBalances,
  }, shouldLoad);

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

  function updateZeroBalanceFilter(checked: boolean) {
    setIncludeZeroBalances(checked);
    setMessage('');
  }

  const report = reportQuery.data;
  const totals = report?.totals;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const displayRows = buildGroupedRows(report?.lines ?? [], includeZeroBalances);
  const difference = Math.abs(Number(totals?.difference ?? 0));
  const resultLabel = totals?.result === 'Loss' ? 'Current Year Loss' : totals?.result === 'Profit' ? 'Current Year Profit' : 'Current Year Result';
  const resultAmount = totals?.result === 'Loss' ? totals.current_year_loss : totals?.current_year_profit ?? '0.00';

  const totalRows = totals ? [
    { label: 'Total Assets', value: totals.assets },
    { label: 'Total Liabilities', value: totals.liabilities },
    { label: 'Total Equity', value: totals.equity },
    { label: resultLabel, value: resultAmount },
    { label: 'Total Liabilities And Equity', value: totals.liabilities_and_equity },
  ] : [];

  function buildReport(): ReportDocument | null {
    if (!report || !totals) return null;
    return {
      title: 'Balance Sheet',
      subtitle: `As of ${formatDate(report.as_of_date, generalSettings)}`,
      columns: [
        { label: 'Account Code' },
        { label: 'Account Name' },
        { label: 'Debit Balance', kind: 'money' },
        { label: 'Credit Balance', kind: 'money' },
        { label: 'Report Amount', kind: 'money' },
      ],
      rows: [
        ...displayRows.map(row => (row.kind !== 'account'
          ? { style: 'group' as const, cells: [row.code, row.name, '', '', row.amount] }
          : { cells: [row.line.account_code, row.line.account_name, row.line.debit_balance, row.line.credit_balance, row.line.amount] })),
        ...totalRows.map(total => ({ style: 'total' as const, cells: ['', total.label, '', '', total.value] })),
        { style: 'total' as const, cells: ['', 'Difference', '', '', totals.difference] },
      ],
      note: report.fiscal_year
        ? `Fiscal Year ${report.fiscal_year.fiscal_year}: ${formatDate(report.fiscal_year.start_date, generalSettings)} to ${formatDate(report.fiscal_year.end_date, generalSettings)}`
        : undefined,
      fileName: `balance-sheet-${report.as_of_date}`,
    };
  }

  const ledgerFrom = report?.fiscal_year?.start_date ?? `${(report?.as_of_date ?? asOfDate).slice(0, 4)}-01-01`;
  const ledgerHref = (accountId: string) => `/reports?report=ledger&account=${accountId}&from=${ledgerFrom}&to=${report?.as_of_date ?? asOfDate}`;

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader title="Balance Sheet" description={`Assets, liabilities, and equity as of ${formatDate(asOfDate, generalSettings)}.`} help={reportHelp['balance-sheet']} />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}
      {report && difference !== 0 && (
        <InlineAlert tone="warning">
          Total Assets and Total Liabilities And Equity differ by {formatMoney(totals?.difference ?? 0, generalSettings)}. Check the account balances before sharing this report.
        </InlineAlert>
      )}

      <section className="panel panel-fill">
        <div className="filter-bar">
          <div className="filter-grid" style={reportFilterGridStyle}>
            <DateField label="As Of Date" value={asOfDate} onChange={value => updateFilter(() => setAsOfDate(value))} required />
            <CheckboxField label="Show Zero Balances" checked={includeZeroBalances} onChange={updateZeroBalanceFilter} />
            <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={viewReport} loading={reportQuery.isFetching}>View Report</Button>
            <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={refreshReport} disabled={reportQuery.isFetching}>Refresh</Button>
            <ReportActions buildReport={buildReport} disabled={!report} onError={setMessage} />
          </div>
          {report?.fiscal_year && (
            <div className="filter-bar-end">
              Fiscal Year {report.fiscal_year.fiscal_year}: {formatDate(report.fiscal_year.start_date, generalSettings)} to {formatDate(report.fiscal_year.end_date, generalSettings)}
            </div>
          )}
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 980 }}>
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
                <th className="num">Debit Balance</th>
                <th className="num">Credit Balance</th>
                <th className="num">Report Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={5} title="Loading Balance Sheet…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={5} title="Choose The Date" description="Select the As Of Date, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <TableMessageRow colSpan={5} title="No Balances Found" description="No Balance Sheet accounts have a balance on this date. Pick a later date or tick Show Zero Balances." />
              )}
              {!reportQuery.isFetching && displayRows.map(row => {
                if (row.kind !== 'account') {
                  const level = row.kind === 'section' ? 1 : row.kind === 'group' ? 2 : 3;
                  const groupStyle = reportGroupRowStyle(level);
                  return (
                    <tr key={row.key}>
                      <td style={{ ...groupStyle, ...reportIndentStyle(level - 1) }}>{row.code}</td>
                      <td style={groupStyle}>{row.name}</td>
                      <td style={groupStyle} />
                      <td style={groupStyle} />
                      <td className="num" style={{ ...groupStyle, ...amountStyle(row.amount) }}>{formatMoney(row.amount, generalSettings)}</td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.key}>
                    <td className="cell-muted" style={reportIndentStyle(3)}>
                      {row.line.is_system_line
                        ? row.line.account_code
                        : <Link href={ledgerHref(row.line.account_id)} style={linkStyle}>{row.line.account_code}</Link>}
                    </td>
                    <td style={row.line.is_system_line ? { fontWeight: 600, color: 'var(--color-heading)' } : undefined}>
                      {row.line.is_system_line
                        ? row.line.account_name
                        : <Link href={ledgerHref(row.line.account_id)} style={linkStyle}>{row.line.account_name}</Link>}
                    </td>
                    <td className="num" style={amountStyle(row.line.debit_balance)}>{moneyOrBlank(row.line.debit_balance, generalSettings)}</td>
                    <td className="num" style={amountStyle(row.line.credit_balance)}>{moneyOrBlank(row.line.credit_balance, generalSettings)}</td>
                    <td className="num" style={amountStyle(row.line.amount)}>{moneyOrBlank(row.line.amount, generalSettings)}</td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot>
                {totalRows.map(total => (
                  <tr key={total.label}>
                    <td colSpan={4}>{total.label}</td>
                    <td className="num" style={amountStyle(total.value)}>{formatMoney(total.value, generalSettings)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4}>Difference</td>
                  <td className="num" style={difference !== 0 ? { color: 'var(--color-negative)' } : undefined}>{formatMoney(totals.difference, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
