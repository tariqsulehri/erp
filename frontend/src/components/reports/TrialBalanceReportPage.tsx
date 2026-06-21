'use client';

import { useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { DateField } from '@/components/ui/FormFields';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { TrialBalanceLine, useTrialBalanceReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { firstDayOfCurrentYear, todayInputDate } from './LedgerReportHelpers';
import {
  compactButtonStyle,
  reportTableCellStyle,
  reportTableHeadStyle,
  reportTableTotalCellStyle,
  summaryBoxStyle,
} from './LedgerReportStyles';

interface TrialBalanceReportPageProps {
  embedded?: boolean;
}

function moneyOrDash(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '-' : formatMoney(value, settings);
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
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentYear());
  const [dateTo, setDateTo] = useState(todayInputDate());
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

  const report = reportQuery.data;
  const totals = report?.totals;
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const rows = report?.lines ?? [];
  const displayRows = buildGroupedRows(rows, includeZeroBalances);
  const difference = Number(totals?.difference ?? 0);

  const summaryBoxes = [
    { label: 'Opening Debit', value: totals?.opening_debit ?? '0.00' },
    { label: 'Opening Credit', value: totals?.opening_credit ?? '0.00' },
    { label: 'Period Debit', value: totals?.period_debit ?? '0.00' },
    { label: 'Period Credit', value: totals?.period_credit ?? '0.00' },
    { label: 'Closing Debit', value: totals?.closing_debit ?? '0.00', accent: difference === 0 },
    { label: 'Closing Credit', value: totals?.closing_credit ?? '0.00', accent: difference === 0 },
    { label: 'Difference', value: totals?.difference ?? '0.00', accent: difference !== 0 },
  ];

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: embedded ? 0 : 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section className="workspace-card" style={{ padding: 10, overflow: 'visible' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '132px 132px minmax(190px, auto) auto', gap: 8, alignItems: 'end' }}>
          <DateField label="Date From" value={dateFrom} onChange={value => updateFilter(() => setDateFrom(value))} required />
          <DateField label="Date To" value={dateTo} onChange={value => updateFilter(() => setDateTo(value))} required />
          <FieldLabel label="Options">
            <label style={{ minHeight: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={includeZeroBalances}
                onChange={event => updateFilter(() => setIncludeZeroBalances(event.currentTarget.checked))}
              />
              Show Zero Balances
            </label>
          </FieldLabel>
          <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
            <button type="button" className="btn-primary" onClick={viewReport} disabled={reportQuery.isFetching} style={compactButtonStyle}>
              <IconSearch size={15} /> View Report
            </button>
            <button type="button" className="btn-secondary" onClick={refreshReport} disabled={reportQuery.isFetching} style={compactButtonStyle}>
              <IconRefresh size={15} /> Refresh
            </button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div style={{ color: 'var(--color-danger-text)', fontSize: '0.72rem', fontWeight: 800 }}>
          {errorMessage}
        </div>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))', gap: 8 }}>
        {summaryBoxes.map(box => (
          <div key={box.label} style={summaryBoxStyle(box.accent)}>
            <span style={{ color: 'var(--color-heading)', fontSize: '0.68rem', fontWeight: 900 }}>{box.label}</span>
            <strong style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-heading)', fontSize: '0.84rem', fontWeight: 900 }}>
              {formatMoney(box.value, generalSettings)}
            </strong>
          </div>
        ))}
      </section>

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr', overflow: 'hidden' }}>
        <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', minWidth: 1080, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
            <colgroup>
              <col style={{ width: 112 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
              <col style={{ width: 118 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={reportTableHeadStyle()}>Account Code</th>
                <th style={reportTableHeadStyle()}>Account Name</th>
                <th style={reportTableHeadStyle()}>Account Type</th>
                <th style={reportTableHeadStyle(true)}>Opening Dr</th>
                <th style={reportTableHeadStyle(true)}>Opening Cr</th>
                <th style={reportTableHeadStyle(true)}>Period Dr</th>
                <th style={reportTableHeadStyle(true)}>Period Cr</th>
                <th style={reportTableHeadStyle(true)}>Closing Dr</th>
                <th style={reportTableHeadStyle(true)}>Closing Cr</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && (
                <tr>
                  <td colSpan={9} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Loading Trial Balance...
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <tr>
                  <td colSpan={9} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Select Dates, then click View Report.
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    No balances found for the selected period.
                  </td>
                </tr>
              )}
              {displayRows.map(row => {
                if (row.kind === 'group') {
                  const background = row.level === 1
                    ? 'var(--color-primary-light)'
                    : row.level === 2
                      ? 'var(--color-surface-alt)'
                      : 'var(--color-table-row-odd)';
                  const fontSize = row.level === 1 ? '0.78rem' : row.level === 2 ? '0.74rem' : '0.71rem';
                  return (
                    <tr key={row.key}>
                      <td colSpan={3} style={{ ...reportTableCellStyle(), background, fontSize, fontWeight: 900, paddingLeft: row.level * 10 }}>
                        {row.code} - {row.name}
                      </td>
                      {amountKeys.map(key => (
                        <td key={key} style={{ ...reportTableCellStyle(true), background, fontSize, fontWeight: 900 }}>
                          {moneyOrDash(row.totals[key], generalSettings)}
                        </td>
                      ))}
                    </tr>
                  );
                }

                const { line } = row;
                return (
                  <tr key={line.account_id}>
                    <td style={{ ...reportTableCellStyle(), paddingLeft: 34 }}><strong>{line.account_code}</strong></td>
                    <td style={reportTableCellStyle()}>{line.account_name}</td>
                    <td style={reportTableCellStyle()}>{line.account_type}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.opening_debit, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.opening_credit, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.period_debit, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.period_credit, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.closing_debit, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.closing_credit, generalSettings)}</td>
                  </tr>
                );
              })}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={3} style={reportTableTotalCellStyle(true)}>
                    Totals ({formatNumber(displayRows.filter(row => row.kind === 'account').length, generalSettings)} Accounts)
                  </td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.opening_debit, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.opening_credit, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.period_debit, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.period_credit, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.closing_debit, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.closing_credit, generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  );
}
