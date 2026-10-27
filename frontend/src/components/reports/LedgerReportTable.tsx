'use client';

import Link from 'next/link';
import type { AppFormatSettingsSource } from '@/lib/app-settings';
import { formatDate, formatMoney } from '@/lib/app-settings';
import type { LedgerReportResponse } from '@/lib/api/reports';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { formatLedgerBalance } from './LedgerReportHelpers';

interface LedgerReportTableProps {
  report: LedgerReportResponse | undefined;
  loading: boolean;
  errorMessage: string;
  settings?: AppFormatSettingsSource | null;
}

export function LedgerReportTable({ report, loading, errorMessage, settings }: LedgerReportTableProps) {
  const lines = report?.lines ?? [];

  return (
    <div className="table-scroll">
      <table className="data-table" style={{ tableLayout: 'fixed', minWidth: 980 }}>
        <colgroup>
          <col style={{ width: 110 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 70 }} />
          <col style={{ width: 150 }} />
          <col />
          <col style={{ width: 130 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 160 }} />
        </colgroup>
        <thead>
          <tr>
            <th>Date</th>
            <th>Voucher Number</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Description</th>
            <th className="num">Debit</th>
            <th className="num">Credit</th>
            <th className="num">Running Balance</th>
          </tr>
        </thead>
        <tbody>
          {loading && <TableMessageRow colSpan={8} title="Loading Ledger Report…" loading />}
          {!loading && errorMessage && <TableMessageRow colSpan={8} title="Report Not Loaded" description={errorMessage} />}
          {!loading && !errorMessage && !report && (
            <TableMessageRow colSpan={8} title="Choose An Account" description="Select an Account and the dates, then click View Report." />
          )}
          {!loading && !errorMessage && report && lines.length === 0 && (
            <TableMessageRow colSpan={8} title="No Posted Transactions" description="This Account has no posted transactions in the selected period. Choose a wider date range to see more." />
          )}
          {!loading && lines.map(line => (
            <tr key={line.id}>
              <td className="cell-muted">{formatDate(line.voucher_date, settings)}</td>
              <td className="cell-strong">
                {line.voucher_id
                  ? <Link href={`/vouchers/posted?status=Posted&voucher=${encodeURIComponent(line.voucher_id)}`} title="Open Voucher">{line.voucher_number}</Link>
                  : line.voucher_number}
              </td>
              <td className="cell-muted">{line.voucher_type}</td>
              <td className={line.reference ? undefined : 'cell-muted'}>{line.reference || 'Not Set'}</td>
              <td className={line.description ? undefined : 'cell-muted'} title={line.description || undefined}>{line.description || 'Not Set'}</td>
              <td className="num">{Number(line.debit_amount) > 0 ? formatMoney(line.debit_amount, settings) : ''}</td>
              <td className="num">{Number(line.credit_amount) > 0 ? formatMoney(line.credit_amount, settings) : ''}</td>
              <td className="num">{formatLedgerBalance(line.running_balance, line.running_balance_side, settings)}</td>
            </tr>
          ))}
        </tbody>
        {report && (
          <tfoot>
            <tr>
              <td colSpan={5}>Totals</td>
              <td className="num">{formatMoney(report.total_debit, settings)}</td>
              <td className="num">{formatMoney(report.total_credit, settings)}</td>
              <td className="num">{formatLedgerBalance(report.closing_balance, report.closing_balance_side, settings)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
