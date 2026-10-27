'use client';

import { useMemo, useState } from 'react';
import { useAccountDetail, useAccountsList } from '@/lib/api/accounts';
import { useBookAccounts, useLedgerReport, type BookAccountKind } from '@/lib/api/reports';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate } from '@/lib/app-settings';
import { friendlyErrorMessage, isValidDateInput } from '@/lib/erp-utils';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { LedgerReportFilters } from './LedgerReportFilters';
import { useReportDateRange } from './LedgerReportHelpers';
import { LedgerReportSummary } from './LedgerReportSummary';
import { LedgerReportTable } from './LedgerReportTable';
import { embeddedReportStyle } from './LedgerReportStyles';
import type { ReportDocument } from './report-output';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { reportHelp } from './report-help';

const BOOK_TITLES: Record<BookAccountKind, { title: string; accountLabel: string; empty: string }> = {
  cash: { title: 'Cash Book', accountLabel: 'Cash Account', empty: 'Search Cash Account' },
  bank: { title: 'Bank Book', accountLabel: 'Bank Account', empty: 'Search Bank Account' },
  customer: { title: 'Customer Ledger', accountLabel: 'Customer', empty: 'Search Customer' },
  supplier: { title: 'Supplier Ledger', accountLabel: 'Supplier', empty: 'Search Supplier' },
};

interface LedgerReportPageProps {
  embedded?: boolean;
  /** Limits the account picker to cash, bank, customer or supplier accounts (Cash Book, Bank Book, party ledgers). */
  bookKind?: BookAccountKind;
  /** Opens the report for this account and these dates, e.g. when coming from the Trial Balance. */
  initialAccountId?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
}

export function LedgerReportPage({ embedded = false, bookKind, initialAccountId, initialDateFrom, initialDateTo }: LedgerReportPageProps) {
  const range = useReportDateRange();
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [customDateFrom, setCustomDateFrom] = useState(initialDateFrom ?? '');
  const [customDateTo, setCustomDateTo] = useState(initialDateTo ?? '');
  const dateFrom = customDateFrom || range.dateFrom;
  const dateTo = customDateTo || range.dateTo;
  const [shouldLoad, setShouldLoad] = useState(Boolean(initialAccountId));
  const [message, setMessage] = useState('');
  const [selectedAccountLabel, setSelectedAccountLabel] = useState('');
  const [searchText, setSearchText] = useState('');
  const search = useDebouncedValue(searchText.trim(), 300);
  const { data: generalSettings } = useGeneralSettings();
  const book = bookKind ? BOOK_TITLES[bookKind] : null;

  // Accounts are searched on the server, so every account can be found however many there are.
  const accountsQuery = useAccountsList({ page: 1, limit: 30, is_active: true, is_posting: true, search: search || undefined }, !bookKind);
  const bookAccountsQuery = useBookAccounts(bookKind ?? 'cash', search);
  const initialAccountQuery = useAccountDetail(initialAccountId, Boolean(initialAccountId));
  const reportQuery = useLedgerReport({ account_id: accountId, date_from: dateFrom, date_to: dateTo }, shouldLoad && Boolean(accountId));

  const accountOptions = useMemo(() => {
    if (bookKind) {
      return (bookAccountsQuery.data ?? []).map(account => ({
        value: account.account_id,
        label: bookKind === 'customer' || bookKind === 'supplier'
          ? `${account.label} (${account.account_code})`
          : `${account.account_code} - ${account.label}`,
        searchText: `${account.account_code} ${account.account_name} ${account.label}`,
      }));
    }
    return (accountsQuery.data?.data ?? []).map(account => ({
      value: account.id,
      label: `${account.code} - ${account.name}`,
      searchText: `${account.code} ${account.name} ${account.account_type}`,
    }));
  }, [bookKind, bookAccountsQuery.data, accountsQuery.data?.data]);

  const initialAccountLabel = initialAccountQuery.data ? `${initialAccountQuery.data.code} - ${initialAccountQuery.data.name}` : '';
  const selectedAccount = reportQuery.data?.account
    ? `${reportQuery.data.account.code} - ${reportQuery.data.account.name}`
    : accountOptions.find(option => option.value === accountId)?.label ?? (selectedAccountLabel || initialAccountLabel);
  const loadingAccounts = bookKind ? bookAccountsQuery.isLoading : accountsQuery.isLoading;
  const accountsError = bookKind ? bookAccountsQuery.error : accountsQuery.error;

  function validateFilters() {
    if (!accountId) return `Select the ${book?.accountLabel ?? 'Account'}.`;
    if (!isValidDateInput(dateFrom)) return 'Enter the Date From.';
    if (!isValidDateInput(dateTo)) return 'Enter the Date To.';
    if (dateTo < dateFrom) return 'Date To must be on or after Date From.';
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

  function buildReport(): ReportDocument | null {
    const report = reportQuery.data;
    if (!report) return null;
    const side = (value: string, balanceSide: string) => (balanceSide === 'Credit' ? `-${value}` : value);
    return {
      title: book?.title ?? 'Ledger Report',
      subtitle: `${report.account.code} - ${report.account.name} · ${formatDate(report.date_from, generalSettings)} to ${formatDate(report.date_to, generalSettings)}`,
      summary: [
        { label: 'Opening Balance', value: `${report.opening_balance} ${report.opening_balance_side === 'Balanced' ? '' : report.opening_balance_side}` },
        { label: 'Total Debit', value: report.total_debit },
        { label: 'Total Credit', value: report.total_credit },
        { label: 'Closing Balance', value: `${report.closing_balance} ${report.closing_balance_side === 'Balanced' ? '' : report.closing_balance_side}` },
      ],
      columns: [
        { label: 'Date', kind: 'date' },
        { label: 'Voucher Number' },
        { label: 'Type' },
        { label: 'Reference' },
        { label: 'Description' },
        { label: 'Debit', kind: 'money' },
        { label: 'Credit', kind: 'money' },
        { label: 'Balance (Credit Negative)', kind: 'money' },
      ],
      rows: [
        { cells: [report.date_from, 'Opening Balance', '', '', '', '', '', side(report.opening_balance, report.opening_balance_side)], style: 'group' },
        ...report.lines.map(line => ({
          cells: [
            line.voucher_date.slice(0, 10), line.voucher_number, line.voucher_type, line.reference ?? '', line.description,
            Number(line.debit_amount) ? line.debit_amount : '', Number(line.credit_amount) ? line.credit_amount : '',
            side(line.running_balance, line.running_balance_side),
          ],
        })),
        { cells: ['', 'Totals', '', '', '', report.total_debit, report.total_credit, side(report.closing_balance, report.closing_balance_side)], style: 'total' },
      ],
      fileName: `${(book?.title ?? 'ledger').toLowerCase()}-${report.account.code}-${report.date_from}-to-${report.date_to}`,
    };
  }

  const errorMessage = message || friendlyErrorMessage(reportQuery.error, '');
  const Root = embedded ? 'div' : 'main';

  return (
    <Root className={embedded ? undefined : 'page-shell'} style={embedded ? embeddedReportStyle : undefined}>
      {!embedded && (
        <PageHeader
          title={book?.title ?? 'Ledger Report'}
          help={reportHelp[bookKind ? `${bookKind}-${bookKind === 'cash' || bookKind === 'bank' ? 'book' : 'ledger'}` : 'ledger']}
          description={selectedAccount
            ? `${selectedAccount} · ${formatDate(dateFrom, generalSettings)} to ${formatDate(dateTo, generalSettings)} · Posted transactions only`
            : 'Check an Account balance with its opening and running balance. Posted transactions only.'}
        />
      )}

      {accountsError && <InlineAlert tone="danger">{friendlyErrorMessage(accountsError, 'Could not load Accounts. Please try again.')}</InlineAlert>}

      <section className="panel panel-fill">
        <LedgerReportFilters
          accountLabel={book?.accountLabel ?? 'Account'}
          accountPlaceholder={book?.empty ?? 'Search Account Code Or Name'}
          accountId={accountId}
          selectedAccountLabel={selectedAccount ?? ''}
          dateFrom={dateFrom}
          dateTo={dateTo}
          accountOptions={accountOptions}
          loadingAccounts={loadingAccounts}
          loadingReport={reportQuery.isFetching}
          onAccountSearch={setSearchText}
          onAccountChange={value => {
            const option = accountOptions.find(item => item.value === value);
            setAccountId(value);
            setSelectedAccountLabel(option?.label ?? '');
            setShouldLoad(false);
            setMessage('');
          }}
          onDateFromChange={value => {
            setCustomDateFrom(value);
            setShouldLoad(false);
            setMessage('');
          }}
          onDateToChange={value => {
            setCustomDateTo(value);
            setShouldLoad(false);
            setMessage('');
          }}
          onViewReport={viewReport}
          onRefresh={refreshReport}
          buildReport={buildReport}
          hasReport={Boolean(reportQuery.data)}
          onReportError={setMessage}
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
