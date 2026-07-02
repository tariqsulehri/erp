'use client';

import { useState } from 'react';
import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { formatDate, formatMoney } from '@/lib/app-settings';
import { BalanceSheetLine, useBalanceSheetReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { todayInputDate } from './LedgerReportHelpers';
import {
  compactButtonStyle,
  reportTableCellStyle,
  reportTableHeadStyle,
  reportTableTotalCellStyle,
  summaryBoxStyle,
} from './LedgerReportStyles';

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

function moneyOrDash(value: string | number, settings: Parameters<typeof formatMoney>[1]) {
  return Number(value) === 0 ? '-' : formatMoney(value, settings);
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
    if (!isValidDateInput(asOfDate)) return 'As Of Date is required.';
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

  const summaryBoxes = [
    { label: 'Total Assets', value: totals?.assets ?? '0.00', accent: difference === 0 },
    { label: 'Total Liabilities', value: totals?.liabilities ?? '0.00' },
    { label: 'Total Equity', value: totals?.equity ?? '0.00' },
    { label: 'Liabilities + Equity', value: totals?.liabilities_and_equity ?? '0.00', accent: difference === 0 },
    { label: 'Difference', value: totals?.difference ?? '0.00', accent: difference !== 0 },
    { label: resultLabel, value: resultAmount },
    { label: 'As Of Date', value: formatDate(asOfDate, generalSettings), text: true },
  ];

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: embedded ? 0 : 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      <section className="workspace-card" style={{ padding: 10, overflow: 'visible' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '132px minmax(190px, auto) auto', gap: 8, alignItems: 'end' }}>
          <DateField label="As Of Date" value={asOfDate} onChange={value => updateFilter(() => setAsOfDate(value))} required />
          <FieldLabel label="Options">
            <label style={{ minHeight: 28, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.74rem', fontWeight: 800, color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={includeZeroBalances}
                onChange={event => updateZeroBalanceFilter(event.currentTarget.checked)}
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
            <strong style={{ textAlign: 'right', fontFamily: box.text ? undefined : 'var(--font-mono)', color: 'var(--color-heading)', fontSize: box.text ? '0.72rem' : '0.84rem', fontWeight: 900 }}>
              {box.text ? box.value : formatMoney(box.value, generalSettings)}
            </strong>
          </div>
        ))}
      </section>

      {report?.fiscal_year && (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', fontWeight: 800 }}>
          Fiscal Year: {report.fiscal_year.fiscal_year} ({formatDate(report.fiscal_year.start_date, generalSettings)} To {formatDate(report.fiscal_year.end_date, generalSettings)})
        </div>
      )}

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr', overflow: 'hidden' }}>
        <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
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
                <th style={reportTableHeadStyle(true)}>Debit Balance</th>
                <th style={reportTableHeadStyle(true)}>Credit Balance</th>
                <th style={reportTableHeadStyle(true)}>Report Amount</th>
              </tr>
            </thead>
            <tbody>
              {reportQuery.isFetching && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Loading Balance Sheet...
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && !report && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    Select As Of Date, then click View Report.
                  </td>
                </tr>
              )}
              {!reportQuery.isFetching && !errorMessage && report && displayRows.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 900 }}>
                    No Balance Sheet accounts found for the selected date.
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
                      <td style={{ ...reportTableTotalCellStyle(true), background, paddingLeft: level === 1 ? 8 : level === 2 ? 18 : 30 }}>{row.code}</td>
                      <td style={{ ...reportTableTotalCellStyle(true), background }}>{row.name}</td>
                      <td style={{ ...reportTableTotalCellStyle(true), background, textAlign: 'right' }}>-</td>
                      <td style={{ ...reportTableTotalCellStyle(true), background, textAlign: 'right' }}>-</td>
                      <td style={{ ...reportTableTotalCellStyle(true), background, textAlign: 'right' }}>{formatMoney(row.amount, generalSettings)}</td>
                    </tr>
                  );
                }

                return (
                  <tr key={row.key}>
                    <td style={reportTableCellStyle()}>{row.line.account_code}</td>
                    <td style={{ ...reportTableCellStyle(), paddingLeft: row.line.is_system_line ? 42 : 38, fontWeight: row.line.is_system_line ? 850 : 700 }}>
                      {row.line.account_name}
                    </td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(row.line.debit_balance, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(row.line.credit_balance, generalSettings)}</td>
                    <td style={reportTableCellStyle(true)}>{moneyOrDash(row.line.amount, generalSettings)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
