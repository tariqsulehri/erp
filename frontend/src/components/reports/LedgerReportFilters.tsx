'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { ReportActions } from './ReportActions';
import { reportFilterGridStyle } from './LedgerReportStyles';
import type { ReportDocument } from './report-output';

interface LedgerReportFiltersProps {
  accountLabel: string;
  accountPlaceholder: string;
  accountId: string;
  selectedAccountLabel: string;
  dateFrom: string;
  dateTo: string;
  accountOptions: SelectOption[];
  loadingAccounts: boolean;
  loadingReport: boolean;
  onAccountSearch: (value: string) => void;
  onAccountChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onViewReport: () => void;
  onRefresh: () => void;
  buildReport: () => ReportDocument | null;
  hasReport: boolean;
  onReportError: (message: string) => void;
}

export function LedgerReportFilters({
  accountLabel,
  accountPlaceholder,
  accountId,
  selectedAccountLabel,
  dateFrom,
  dateTo,
  accountOptions,
  loadingAccounts,
  loadingReport,
  onAccountSearch,
  onAccountChange,
  onDateFromChange,
  onDateToChange,
  onViewReport,
  onRefresh,
  buildReport,
  hasReport,
  onReportError,
}: LedgerReportFiltersProps) {
  return (
    <div className="filter-bar">
      <div className="filter-grid" style={reportFilterGridStyle}>
        <FieldLabel label={accountLabel} required>
          <SearchableSelect
            value={accountId}
            selectedLabel={selectedAccountLabel}
            options={accountOptions}
            onChange={onAccountChange}
            onSearchChange={onAccountSearch}
            placeholder={loadingAccounts && !accountOptions.length ? 'Loading…' : accountPlaceholder}
            ariaLabel={accountLabel}
          />
        </FieldLabel>
        <DateField label="Date From" value={dateFrom} onChange={onDateFromChange} required />
        <DateField label="Date To" value={dateTo} onChange={onDateToChange} required />
        <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={onViewReport} loading={loadingReport}>View Report</Button>
        <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={onRefresh} disabled={loadingReport}>Refresh</Button>
        <ReportActions buildReport={buildReport} disabled={!hasReport} onError={onReportError} />
      </div>
    </div>
  );
}
