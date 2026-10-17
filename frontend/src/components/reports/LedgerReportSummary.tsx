'use client';

import type { AppFormatSettingsSource } from '@/lib/app-settings';
import type { LedgerReportResponse } from '@/lib/api/reports';
import { formatLedgerBalance } from './LedgerReportHelpers';

interface LedgerReportSummaryProps {
  report: LedgerReportResponse | undefined;
  settings?: AppFormatSettingsSource | null;
}

/** One quiet line of ledger figures inside the report panel, right-aligned. */
export function LedgerReportSummary({ report, settings }: LedgerReportSummaryProps) {
  const figures = [
    { label: 'Opening Balance', value: report ? formatLedgerBalance(report.opening_balance, report.opening_balance_side, settings) : formatLedgerBalance(0, 'Balanced', settings) },
    { label: 'Total Debit', value: report ? formatLedgerBalance(report.total_debit, 'Debit', settings) : formatLedgerBalance(0, 'Balanced', settings) },
    { label: 'Total Credit', value: report ? formatLedgerBalance(report.total_credit, 'Credit', settings) : formatLedgerBalance(0, 'Balanced', settings) },
    { label: 'Closing Balance', value: report ? formatLedgerBalance(report.closing_balance, report.closing_balance_side, settings) : formatLedgerBalance(0, 'Balanced', settings) },
  ];

  return (
    <div className="filter-bar" aria-label="Ledger Totals">
      <div className="filter-bar-end" style={{ gap: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {figures.map(figure => (
          <span key={figure.label}>
            {figure.label}{' '}
            <strong style={{ fontWeight: 600, color: 'var(--color-heading)', fontVariantNumeric: 'tabular-nums' }}>{figure.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
