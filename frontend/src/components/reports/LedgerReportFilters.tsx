'use client';

import { IconRefresh, IconSearch } from '@tabler/icons-react';
import { FieldLabel } from '@/components/ui/FieldLabel';
import { DateField } from '@/components/ui/FormFields';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { compactButtonStyle, reportFilterGridStyle } from './LedgerReportStyles';

interface LedgerReportFiltersProps {
  accountId: string;
  selectedAccountLabel: string;
  dateFrom: string;
  dateTo: string;
  accountOptions: SelectOption[];
  loadingAccounts: boolean;
  loadingReport: boolean;
  onAccountChange: (value: string) => void;
  onAccountSearchChange: (value: string) => void;
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
  onAccountSearchChange,
  onDateFromChange,
  onDateToChange,
  onViewReport,
  onRefresh,
}: LedgerReportFiltersProps) {
  return (
    <section className="workspace-card" style={{ padding: 10, overflow: 'visible' }}>
      <div style={reportFilterGridStyle}>
        <FieldLabel label="Account" required>
          <SearchableSelect
            value={accountId}
            selectedLabel={selectedAccountLabel}
            options={accountOptions}
            onChange={onAccountChange}
            onSearchChange={onAccountSearchChange}
            placeholder={loadingAccounts ? 'Loading Accounts...' : 'Search Account'}
            disabled={loadingAccounts}
          />
        </FieldLabel>
        <DateField label="Date From" value={dateFrom} onChange={onDateFromChange} required />
        <DateField label="Date To" value={dateTo} onChange={onDateToChange} required />
        <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={onViewReport}
            disabled={loadingReport}
            style={compactButtonStyle}
          >
            <IconSearch size={15} /> View Report
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={onRefresh}
            disabled={loadingReport}
            style={compactButtonStyle}
          >
            <IconRefresh size={15} /> Refresh
          </button>
        </div>
      </div>
    </section>
  );
}
