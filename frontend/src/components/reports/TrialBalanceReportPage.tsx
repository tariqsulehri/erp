'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { CheckboxField, DateField } from '@/components/ui/FormFields';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { TrialBalanceLine, useTrialBalanceReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useReportDateRange } from './LedgerReportHelpers';
import { amountStyle, embeddedReportStyle, reportFilterGridStyle, reportGroupRowStyle, reportIndentStyle } from './LedgerReportStyles';
import { ReportActions } from './ReportActions';
import type { ReportDocument } from './report-output';

interface TrialBalanceReportPageProps {
  embedded?: boolean;
}

/** Zero amounts are left blank so the figures that matter stand out. */
function moneyOrBlank(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '' : formatMoney(value, settings);
}

type AmountKey = 'opening_debit' | 'opening_credit' | 'period_debit' | 'period_credit' | 'closing_debit' | 'closing_credit';

type TrialBalanceDisplayRow =
  | {
      kind: 'group';
      key: string;
      level: 1 | 2 | 3;
      code: string;
      name: string;
      totals: Record<AmountKey, string>;
    }
  | {
      kind: 'account';
      key: string;
      line: TrialBalanceLine;
    };

const linkStyle = { color: 'var(--color-primary-text)' };

const amountKeys: AmountKey[] = ['opening_debit', 'opening_credit', 'period_debit', 'period_credit', 'closing_debit', 'closing_credit'];

function amountCents(value: string | number) {
  return Math.round(Number(value || 0) * 100);
}

function centsText(cents: number) {
  return (cents / 100).toFixed(2);
}

function isZeroLine(line: TrialBalanceLine) {
  return amountKeys.every(key => amountCents(line[key]) === 0);
}

function totalLines(lines: TrialBalanceLine[]) {
  return amountKeys.reduce<Record<AmountKey, string>>((totals, key) => {
    totals[key] = centsText(lines.reduce((sum, line) => sum + amountCents(line[key]), 0));
    return totals;
  }, {} as Record<AmountKey, string>);
}

function buildGroupedRows(lines: TrialBalanceLine[], includeZeroBalances: boolean): TrialBalanceDisplayRow[] {
  const visibleLines = includeZeroBalances ? lines : lines.filter(line => !isZeroLine(line));
  const mainCodes = [...new Set(visibleLines.map(line => line.main_code))].sort();

  return mainCodes.flatMap(mainCode => {
    const mainLines = visibleLines.filter(line => line.main_code === mainCode);
    const firstMain = mainLines[0];
    const rows: TrialBalanceDisplayRow[] = [{
      kind: 'group',
      key: `main-${mainCode}`,
      level: 1,
      code: mainCode,
      name: firstMain?.main_name ?? 'Main Category',
      totals: totalLines(mainLines),
    }];

    [...new Set(mainLines.map(line => line.group_code))].sort().forEach(groupCode => {
      const groupLines = mainLines.filter(line => line.group_code === groupCode);
      const firstGroup = groupLines[0];
      rows.push({
        kind: 'group',
        key: `group-${groupCode}`,
        level: 2,
        code: groupCode,
        name: firstGroup?.group_name ?? 'Group',
        totals: totalLines(groupLines),
      });

      [...new Set(groupLines.map(line => line.sub_group_code))].sort().forEach(subGroupCode => {
        const subGroupLines = groupLines.filter(line => line.sub_group_code === subGroupCode);
        const firstSubGroup = subGroupLines[0];
        rows.push({
          kind: 'group',
          key: `sub-group-${subGroupCode}`,
          level: 3,
          code: subGroupCode,
          name: firstSubGroup?.sub_group_name ?? 'Sub-Group',
          totals: totalLines(subGroupLines),
        });
        subGroupLines.forEach(line => rows.push({ kind: 'account', key: line.account_id, line }));
      });
    });

    return rows;
  });
}

export function TrialBalanceReportPage({ embedded = false }: TrialBalanceReportPageProps) {
  const { data: generalSettings } = useGeneralSettings();
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useReportDateRange();
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useTrialBalanceReport({
    date_from: dateFrom,
    date_to: dateTo,
    include_zero_balances: includeZeroBalances,
  }, shouldLoad);

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

  function updateZeroBalanceFilter(checked: boolean) {
    setIncludeZeroBalances(checked);
    setMessage('');
  }

  const report = reportQuery.data;
  const totals = report?.totals;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const rows = report?.lines ?? [];
  const displayRows = buildGroupedRows(rows, includeZeroBalances);
  const difference = Number(totals?.difference ?? 0);

  const accountCount = displayRows.filter(row => row.kind === 'account').length;

  function buildReport(): ReportDocument | null {
    if (!report) return null;
    return {
      title: 'Trial Balance',
      subtitle: `${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}`,
      columns: [
        { label: 'Account Code' },
        { label: 'Account Name' },
        { label: 'Account Type' },
        { label: 'Opening Debit', kind: 'money' },
        { label: 'Opening Credit', kind: 'money' },
        { label: 'Period Debit', kind: 'money' },
        { label: 'Period Credit', kind: 'money' },
        { label: 'Closing Debit', kind: 'money' },
        { label: 'Closing Credit', kind: 'money' },
      ],
      rows: [
        ...displayRows.map(row => (row.kind === 'group'
          ? { style: 'group' as const, cells: [row.code, row.name, '', ...amountKeys.map(key => row.totals[key])] }
          : { cells: [row.line.account_code, row.line.account_name, row.line.account_type, ...amountKeys.map(key => row.line[key])] })),
        {
          style: 'total' as const,
          cells: ['', `Totals (${accountCount} Accounts)`, '', ...amountKeys.map(key => report.totals[key])],
        },
      ],
      note: difference !== 0 ? `Closing Debit and Closing Credit differ by ${formatMoney(report.totals.difference, generalSettings)}.` : undefined,
      fileName: `trial-balance-${dateFrom}-to-${dateTo}`,
    };
  }

  const ledgerHref = (accountId: string) => `/reports?report=ledger&account=${accountId}&from=${dateFrom}&to=${dateTo}`;

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader
          title="Trial Balance"
          description={`Posted balances from ${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)}.`}
        />
      )}

      {errorMessage && <InlineAlert tone="danger">{errorMessage}</InlineAlert>}
      {report && difference !== 0 && (
        <InlineAlert tone="warning">
          Closing Debit and Closing Credit differ by {formatMoney(totals?.difference ?? 0, generalSettings)}. Check the unbalanced vouchers before closing the period.
        </InlineAlert>
      )}

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
          <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 1080 }}>
            <colgroup>
              <col style={{ width: 120 }} />
              <col />
              <col style={{ width: 120 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 124 }} />
              <col style={{ width: 124 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Account Code</th>
                <th>Account Name</th>
                <th>Account Type</th>
                <th className="num">Opening Debit</th>
                <th className="num">Opening Credit</th>
                <th className="num">Period Debit</th>
                <th className="num">Period Credit</th>
                <th className="num">Closing Debit</th>
                <th className="num">Closing Credit</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && <TableMessageRow colSpan={9} title="Loading Trial Balance…" loading />}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <TableMessageRow colSpan={9} title="Choose The Dates" description="Select Date From and Date To, then click View Report." />
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <TableMessageRow colSpan={9} title="No Balances Found" description="No posted balances in the selected period. Widen the dates or tick Show Zero Balances." />
              )}
              {!reportQuery.isFetching && displayRows.map(row => {
                if (row.kind === 'group') {
                  const groupStyle = reportGroupRowStyle(row.level);
                  return (
                    <tr key={row.key}>
                      <td colSpan={3} style={{ ...groupStyle, ...reportIndentStyle(row.level - 1) }}>
                        {row.code} - {row.name}
                      </td>
                      {amountKeys.map(key => (
                        <td key={key} className="num" style={{ ...groupStyle, ...amountStyle(row.totals[key]) }}>
                          {moneyOrBlank(row.totals[key], generalSettings)}
                        </td>
                      ))}
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
                    <td className="cell-muted">{line.account_type}</td>
                    {amountKeys.map(key => (
                      <td key={key} className="num" style={amountStyle(line[key])}>{moneyOrBlank(line[key], generalSettings)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Totals ({accountCount} Accounts)</td>
                  <td className="num">{formatMoney(report.totals.opening_debit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.opening_credit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.period_debit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.period_credit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.closing_debit, generalSettings)}</td>
                  <td className="num">{formatMoney(report.totals.closing_credit, generalSettings)}</td>
                </tr>
                <tr>
                  <td colSpan={7}>Difference</td>
                  <td colSpan={2} className="num" style={difference !== 0 ? { color: 'var(--color-negative)' } : undefined}>
                    {formatMoney(report.totals.difference, generalSettings)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </Root>
  );
}
