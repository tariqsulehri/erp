'use client';

import { useMemo, useState } from 'react';
import { IconReportMoney } from '@tabler/icons-react';
import { useAccountsList } from '@/lib/api/accounts';
import { useLedgerReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { LedgerReportFilters } from './LedgerReportFilters';
import { firstDayOfCurrentYear, todayInputDate } from './LedgerReportHelpers';
import { LedgerReportSummary } from './LedgerReportSummary';
import { LedgerReportTable } from './LedgerReportTable';
import { reportTitleIconStyle, reportToolbarStyle } from './LedgerReportStyles';

interface LedgerReportPageProps {
  embedded?: boolean;
}

export function LedgerReportPage({ embedded = false }: LedgerReportPageProps) {
  const [accountId, setAccountId] = useState('');
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentYear());
  const [dateTo, setDateTo] = useState(todayInputDate());
  const [shouldLoad, setShouldLoad] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedAccountLabel, setSelectedAccountLabel] = useState('');
  const { data: generalSettings } = useGeneralSettings();

  const accountsQuery = useAccountsList({
    page: 1,
    limit: 200,
    is_active: true,
    is_posting: true,
  });
  const reportQuery = useLedgerReport({ account_id: accountId, date_from: dateFrom, date_to: dateTo }, shouldLoad && Boolean(accountId));

  const accountOptions = useMemo(() => {
    return (accountsQuery.data?.data ?? []).map(account => ({
      value: account.id,
      label: `${account.code} - ${account.name}`,
      searchText: `${account.code} ${account.name} ${account.account_type}`,
    }));
  }, [accountsQuery.data?.data]);

  const selectedAccount = reportQuery.data?.account
    ? `${reportQuery.data.account.code} - ${reportQuery.data.account.name}`
    : accountOptions.find(option => option.value === accountId)?.label ?? selectedAccountLabel;

  function validateFilters() {
    if (!accountId) return 'Account is required.';
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

  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');

  return (
    <main style={{ height: '100%', minHeight: 0, boxSizing: 'border-box', padding: embedded ? 0 : 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
      {!embedded && (
        <section style={reportToolbarStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={reportTitleIconStyle}><IconReportMoney size={20} stroke={1.8} /></div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Ledger Report</h1>
                <p style={{ margin: '3px 0 0', color: 'var(--color-text-muted)', fontSize: '0.73rem', fontWeight: 700 }}>
                  {selectedAccount ? `${selectedAccount} | ${formatDate(dateFrom, generalSettings)} To ${formatDate(dateTo, generalSettings)}` : 'Verify Account Balance With Opening And Running Balance'}
                </p>
              </div>
            </div>
            <span style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-alt)',
              borderRadius: 'var(--radius-full)',
              padding: '3px 9px',
              color: 'var(--color-text-secondary)',
              fontSize: '0.7rem',
              fontWeight: 800,
            }}>
              Posted Transactions Only
            </span>
          </div>
        </section>
      )}

      <LedgerReportFilters
        accountId={accountId}
        selectedAccountLabel={selectedAccount ?? ''}
        dateFrom={dateFrom}
        dateTo={dateTo}
        accountOptions={accountOptions}
        loadingAccounts={accountsQuery.isLoading}
        loadingReport={reportQuery.isFetching}
        onAccountChange={value => {
          const option = accountOptions.find(item => item.value === value);
          setAccountId(value);
          setSelectedAccountLabel(option?.label ?? '');
          setShouldLoad(false);
          setMessage('');
        }}
        onDateFromChange={value => {
          setDateFrom(value);
          setShouldLoad(false);
          setMessage('');
        }}
        onDateToChange={value => {
          setDateTo(value);
          setShouldLoad(false);
          setMessage('');
        }}
        onViewReport={viewReport}
        onRefresh={refreshReport}
      />

      {accountsQuery.error && (
        <div style={{ color: 'var(--color-danger-text)', fontSize: '0.72rem', fontWeight: 700 }}>
          {friendlyErrorMessage(accountsQuery.error, 'Unable to load Accounts.')}
        </div>
      )}

      <LedgerReportSummary report={reportQuery.data} settings={generalSettings} />

      <section className="workspace-card" style={{ padding: 10, flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr', overflow: 'hidden' }}>
        <LedgerReportTable
          report={reportQuery.data}
          loading={reportQuery.isFetching}
          errorMessage={errorMessage}
          settings={generalSettings}
        />
      </section>
    </main>
  );
}
