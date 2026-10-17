'use client';

import { useMemo, useState } from 'react';
import { useAccountsList } from '@/lib/api/accounts';
import { useLedgerReport } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { LedgerReportFilters } from './LedgerReportFilters';
import { firstDayOfCurrentYear, todayInputDate } from './LedgerReportHelpers';
import { LedgerReportSummary } from './LedgerReportSummary';
import { LedgerReportTable } from './LedgerReportTable';
import { embeddedReportStyle } from './LedgerReportStyles';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';

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

  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader
          title="Ledger Report"
          description={selectedAccount
            ? `${selectedAccount} · ${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)} · Posted transactions only`
            : 'Check an Account balance with its opening and running balance. Posted transactions only.'}
        />
      )}

      {accountsQuery.error && <InlineAlert tone="danger">{friendlyErrorMessage(accountsQuery.error, 'Unable to load Accounts.')}</InlineAlert>}

      <section className="panel panel-fill">
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

        <LedgerReportSummary report={reportQuery.data} settings={generalSettings} />

        <LedgerReportTable
          report={reportQuery.data}
          loading={reportQuery.isFetching}
          errorMessage={errorMessage}
          settings={generalSettings}
        />
      </section>
    </Root>
  );
}
