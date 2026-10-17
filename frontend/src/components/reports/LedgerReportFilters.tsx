'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { reportFilterGridStyle } from './LedgerReportStyles';

interface LedgerReportFiltersProps {
  accountId: string;
  selectedAccountLabel: string;
  dateFrom: string;
  dateTo: string;
  accountOptions: SelectOption[];
  loadingAccounts: boolean;
  loadingReport: boolean;
  onAccountChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onViewReport: () => void;
  onRefresh: () => void;
}

export function LedgerReportFilters({
  accountId,
  selectedAccountLabel,
  dateFrom,
  dateTo,
  accountOptions,
  loadingAccounts,
  loadingReport,
  onAccountChange,
  onDateFromChange,
  onDateToChange,
  onViewReport,
  onRefresh,
}: LedgerReportFiltersProps) {
  return (
    <div className="filter-bar">
      <div className="filter-grid" style={reportFilterGridStyle}>
        <FieldLabel label="Account" required>
          <SearchableSelect
            value={accountId}
            selectedLabel={selectedAccountLabel}
            options={accountOptions}
            onChange={onAccountChange}
            placeholder={loadingAccounts ? 'Loading Accounts…' : 'Search Account'}
            disabled={loadingAccounts}
          />
        </FieldLabel>
        <DateField label="Date From" value={dateFrom} onChange={onDateFromChange} required />
        <DateField label="Date To" value={dateTo} onChange={onDateToChange} required />
        <Button variant="primary" icon={<IconSearch size={16} stroke={1.8} />} onClick={onViewReport} loading={loadingReport}>View Report</Button>
        <Button icon={<IconRefresh size={16} stroke={1.8} />} onClick={onRefresh} disabled={loadingReport}>Refresh</Button>
      </div>
    </div>
  );
}
