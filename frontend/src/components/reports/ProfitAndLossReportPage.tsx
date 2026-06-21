'use client';

import { useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { formatDate, formatMoney, formatNumber } from '@/lib/app-settings';
import { ProfitAndLossLine, useProfitAndLossReport } from '@/lib/api/reports';
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

function moneyOrDash(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '-' : formatMoney(value, settings);
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
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentYear());
  const [dateTo, setDateTo] = useState(todayInputDate());
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');

  const reportQuery = useProfitAndLossReport({
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
  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const displayRows = buildGroupedRows(report?.lines ?? [], includeZeroBalances);
  const netAmount = Number(report?.totals.net_profit ?? 0) - Number(report?.totals.net_loss ?? 0);
  const netLabel = report?.totals.result ?? 'Break Even';

  const summaryBoxes = [
    { label: 'Total Revenue', value: report?.totals.revenue ?? '0.00' },
    { label: 'Total Expenses', value: report?.totals.expenses ?? '0.00' },
    { label: netLabel, value: Math.abs(netAmount).toFixed(2), accent: true },
    { label: 'Period', value: `${formatDate(dateFrom, generalSettings)} To ${formatDate(dateTo, generalSettings)}`, text: true },
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

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 8 }}>
        {summaryBoxes.map(box => (
          <div key={box.label} style={summaryBoxStyle(box.accent)}>
            <span style={{ color: 'var(--color-heading)', fontSize: '0.72rem', fontWeight: 900 }}>{box.label}</span>
            <strong style={{ textAlign: 'right', fontFamily: box.text ? undefined : 'var(--font-mono)', color: 'var(--color-heading)', fontSize: box.text ? '0.74rem' : '0.92rem', fontWeight: 900 }}>
              {box.text ? box.value : formatMoney(box.value, generalSettings)}
            </strong>
          </div>
        ))}
      </section>

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr', overflow: 'hidden' }}>
        <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 130 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 150 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={reportTableHeadStyle()}>Account Code</th>
                <th style={reportTableHeadStyle()}>Account Name</th>
                <th style={reportTableHeadStyle(true)}>Debit</th>
                <th style={reportTableHeadStyle(true)}>Credit</th>
                <th style={reportTableHeadStyle(true)}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Loading Profit And Loss...
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Select Dates, then click View Report.
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    No revenue or expense transactions found for the selected period.
                  </td>
                </tr>
              )}
              {displayRows.map(row => {
                if (row.kind !== 'account') {
                  const level = row.kind === 'section' ? 1 : row.kind === 'group' ? 2 : 3;
                  const background = level === 1
                    ? 'var(--color-primary-light)'
                    : level === 2
                      ? 'var(--color-surface-alt)'
                      : 'var(--color-table-row-odd)';
                  return (
                    <tr key={row.key}>
                      <td colSpan={4} style={{ ...reportTableCellStyle(), background, fontWeight: 900, paddingLeft: level * 10 }}>
                        {row.code} - {row.name}
                      </td>
                      <td style={{ ...reportTableCellStyle(true), background, fontWeight: 900 }}>{moneyOrDash(row.amount, generalSettings)}</td>
                    </tr>
                  );
                }

                const { line } = row;
                return (
                  <tr key={line.account_id}>
                    <td style={{ ...reportTableCellStyle(), paddingLeft: 34 }}><strong>{line.account_code}</strong></td>
                    <td style={reportTableCellStyle()}>{line.account_name}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.debit_amount, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.credit_amount, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(line.amount, generalSettings)}</td>
                  </tr>
                );
              })}
            </tbody>
            {report && (
              <tfoot>
                <tr>
                  <td colSpan={2} style={reportTableTotalCellStyle(true)}>
                    Net {netLabel} ({formatNumber(displayRows.filter(row => row.kind === 'account').length, generalSettings)} Accounts)
                  </td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.expenses, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.totals.revenue, generalSettings)}</td>
                  <td style={reportTableTotalCellStyle(true)}>{formatMoney(Math.abs(netAmount), generalSettings)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </main>
  );
}
