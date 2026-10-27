'use client';

import { useState } from 'react';
import { IconFileSpreadsheet, IconPrinter } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { useCompanyProfile, useGeneralSettings } from '@/lib/api/settings';
import { downloadReportCsv, printReport, type ReportDocument } from './report-output';

interface ReportActionsProps {
  /** Built only when a button is clicked; return null when there is nothing to print yet. */
  buildReport: () => ReportDocument | null;
  disabled?: boolean;
  onError?: (message: string) => void;
}

/** Print (or Save as PDF) and Export to Excel (CSV) buttons shared by every report. */
export function ReportActions({ buildReport, disabled = false, onError }: ReportActionsProps) {
  const { data: company } = useCompanyProfile();
  const { data: settings } = useGeneralSettings();
  const [busy, setBusy] = useState(false);

  function run(action: (report: ReportDocument) => void) {
    const report = buildReport();
    if (!report) {
      onError?.('View the report first, then print or export it.');
      return;
    }
    setBusy(true);
    try {
      action(report);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Could not prepare the report. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        icon={<IconPrinter size={16} stroke={1.8} />}
        onClick={() => run(report => printReport(report, company, settings))}
        disabled={disabled || busy}
        title="Print or save as PDF"
      >
        Print
      </Button>
      <Button
        icon={<IconFileSpreadsheet size={16} stroke={1.8} />}
        onClick={() => run(report => downloadReportCsv(report))}
        disabled={disabled || busy}
        title="Download a file that opens in Excel"
      >
        Export
      </Button>
    </>
  );
}
