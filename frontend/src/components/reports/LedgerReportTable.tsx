'use client';

import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatDate, formatMoney } from '@/lib/app-settings';
import type { LedgerReportResponse } from '@/lib/api/reports';
import { formatLedgerBalance } from './LedgerReportHelpers';
import { reportTableCellStyle, reportTableHeadStyle, reportTableTotalCellStyle } from './LedgerReportStyles';

interface LedgerReportTableProps {
  report: LedgerReportResponse | undefined;
  loading: boolean;
  errorMessage: string;
  settings?: AppFormatSettingsSource | null;
}

export function LedgerReportTable({ report, loading, errorMessage, settings }: LedgerReportTableProps) {
  const lines = report?.lines ?? [];

  return (
    <div style={{ minHeight: 0, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
      <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
        <colgroup>
          <col style={{ width: 92 }} />
          <col style={{ width: 128 }} />
          <col style={{ width: 74 }} />
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 120 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 150 }} />
        </colgroup>
        <thead>
          <tr>
            <th style={reportTableHeadStyle()}>Date</th>
            <th style={reportTableHeadStyle()}>Voucher Number</th>
            <th style={reportTableHeadStyle()}>Type</th>
            <th style={reportTableHeadStyle()}>Reference</th>
            <th style={reportTableHeadStyle()}>Description</th>
            <th style={reportTableHeadStyle(true)}>Debit</th>
            <th style={reportTableHeadStyle(true)}>Credit</th>
            <th style={reportTableHeadStyle(true)}>Running Balance</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={8} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>
                Loading Ledger Report...
              </td>
            </tr>
          )}
          {!loading && errorMessage && (
            <tr>
              <td colSpan={8} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-danger-text)', fontWeight: 800 }}>
                {errorMessage}
              </td>
            </tr>
          )}
          {!loading && !errorMessage && !report && (
            <tr>
              <td colSpan={8} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>
                Select Account and Dates, then click View Report.
              </td>
            </tr>
          )}
          {!loading && !errorMessage && report && lines.length === 0 && (
            <tr>
              <td colSpan={8} style={{ ...reportTableCellStyle(), height: 90, textAlign: 'center', color: 'var(--color-text-muted)', fontWeight: 800 }}>
                No posted transactions found for the selected period.
              </td>
            </tr>
          )}
          {lines.map(line => (
            <tr key={line.id}>
              <td style={reportTableCellStyle()}>{formatDate(line.voucher_date, settings)}</td>
              <td style={reportTableCellStyle()}><strong>{line.voucher_number}</strong></td>
              <td style={reportTableCellStyle()}>{line.voucher_type}</td>
              <td style={reportTableCellStyle()}>{line.reference || '-'}</td>
              <td style={reportTableCellStyle()}>{line.description || '-'}</td>
              <td style={reportTableCellStyle(true)}>{Number(line.debit_amount) > 0 ? formatMoney(line.debit_amount, settings) : '-'}</td>
              <td style={reportTableCellStyle(true)}>{Number(line.credit_amount) > 0 ? formatMoney(line.credit_amount, settings) : '-'}</td>
              <td style={reportTableCellStyle(true)}>{formatLedgerBalance(line.running_balance, line.running_balance_side, settings)}</td>
            </tr>
          ))}
        </tbody>
        {report && (
          <tfoot>
            <tr>
              <td colSpan={5} style={reportTableTotalCellStyle(true)}>Totals</td>
              <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.total_debit, settings)}</td>
              <td style={reportTableTotalCellStyle(true)}>{formatMoney(report.total_credit, settings)}</td>
              <td style={reportTableTotalCellStyle(true)}>{formatLedgerBalance(report.closing_balance, report.closing_balance_side, settings)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
