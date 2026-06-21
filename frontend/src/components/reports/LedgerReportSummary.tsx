'use client';

import type { AppFormatSettingsSource } from '@/lib/app-settings';
import type { LedgerReportResponse } from '@/lib/api/reports';
import { formatLedgerBalance } from './LedgerReportHelpers';
import { summaryBoxStyle } from './LedgerReportStyles';

interface LedgerReportSummaryProps {
  report: LedgerReportResponse | undefined;
  settings?: AppFormatSettingsSource | null;
}

export function LedgerReportSummary({ report, settings }: LedgerReportSummaryProps) {
  const boxes = [
    {
      label: 'Opening Balance',
      value: report ? formatLedgerBalance(report.opening_balance, report.opening_balance_side, settings) : formatLedgerBalance(0, 'Balanced', settings),
    },
    {
      label: 'Total Debit',
      value: report ? formatLedgerBalance(report.total_debit, 'Debit', settings) : formatLedgerBalance(0, 'Balanced', settings),
    },
    {
      label: 'Total Credit',
      value: report ? formatLedgerBalance(report.total_credit, 'Credit', settings) : formatLedgerBalance(0, 'Balanced', settings),
    },
    {
      label: 'Closing Balance',
      value: report ? formatLedgerBalance(report.closing_balance, report.closing_balance_side, settings) : formatLedgerBalance(0, 'Balanced', settings),
      accent: true,
    },
  ];

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 8 }}>
      {boxes.map(box => (
        <div key={box.label} style={summaryBoxStyle(box.accent)}>
          <span style={{ color: 'var(--color-heading)', fontSize: '0.72rem', fontWeight: 900 }}>{box.label}</span>
          <strong style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-heading)', fontSize: '0.92rem', fontWeight: 900, lineHeight: 1.2 }}>
            {box.value}
          </strong>
        </div>
      ))}
    </section>
  );
}
