import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FiscalYearItem } from '@/lib/api/fiscal-years';
import { FiscalYearsTable } from '@/components/fiscal-years/FiscalYearsTable';

const lockMutate = jest.fn();
const unlockMutate = jest.fn();
jest.mock('@/lib/api/fiscal-years', () => ({
  fiscalYearsQueryKey: ['fiscal-years'],
  useLockFiscalYear: () => ({ mutate: lockMutate, isPending: false }),
  useUnlockFiscalYear: () => ({ mutate: unlockMutate, isPending: false }),
  useLockFiscalPeriod: () => ({ mutate: jest.fn(), isPending: false }),
  useCloseFiscalPeriod: () => ({ mutate: jest.fn(), isPending: false }),
  useFiscalPeriods: () => ({
    isLoading: false,
    data: [{ id: 'p1', period_number: 1, period_name: 'Jul 2026', start_date: '2026-07-01', end_date: '2026-07-31', status: 'open', transaction_count: 3 }],
  }),
}));

function year(overrides: Partial<FiscalYearItem>): FiscalYearItem {
  return {
    id: 'id', company_id: 'c', fiscal_year: '2026-2027', year_basis: 'july', start_date: '2026-07-01', end_date: '2027-06-30',
    number_of_periods: 12, period_type: 'monthly', posting_cutoff_days: 5, status: 'open', is_active: false, is_locked: false,
    locked_at: null, transaction_count: 0, total_debits: '0', total_credits: '0', notes: null, created_at: '', updated_at: '',
    ...overrides,
  };
}

const years = [
  year({ id: 'a', fiscal_year: '2025-2026', start_date: '2025-07-01', end_date: '2026-06-30', status: 'closed' }),
  year({ id: 'b', fiscal_year: '2026-2027', is_active: true, transaction_count: 42 }),
  year({ id: 'c', fiscal_year: '2027-2028', start_date: '2027-07-01', end_date: '2028-06-30', is_locked: true }),
];

function renderTable(props: Partial<Parameters<typeof FiscalYearsTable>[0]> = {}) {
  const onNew = jest.fn();
  const onRefresh = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FiscalYearsTable years={years} loading={false} calendarYears={[2025, 2026, 2027, 2028]} onNew={onNew} onRefresh={onRefresh} {...props} />
    </QueryClientProvider>,
  );
  return { onNew, onRefresh };
}

// Year rows of the outer table only (an opened year adds a periods table inside a detail row).
const bodyRows = () => Array.from(screen.getAllByRole('table')[0].querySelectorAll<HTMLElement>(':scope > tbody > tr:not(.row-detail)'));

beforeEach(() => { lockMutate.mockReset(); unlockMutate.mockReset(); });

describe('FiscalYearsTable', () => {
  it('lists each year with its code, timeline, transactions, and status', () => {
    renderTable();
    expect(bodyRows()).toHaveLength(3);
    const active = bodyRows()[1];
    expect(active).toHaveTextContent('2026-2027');
    expect(active).toHaveTextContent('July – June');
    expect(active).toHaveTextContent('12 periods · Late entries 5 days');
    expect(active).toHaveTextContent('42');
    expect(active).toHaveTextContent('Active Year');
    expect(bodyRows()[2]).toHaveTextContent('Locked');
  });

  it('filters by text, calendar year, and status', () => {
    renderTable();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Fiscal Years' }), { target: { value: '2027-2028' } });
    expect(bodyRows()).toHaveLength(1);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Fiscal Years' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar Year' }), { target: { value: '2025' } });
    expect(bodyRows()).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Calendar Year' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Status' }), { target: { value: 'closed' } });
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('2025-2026');
  });

  it('explains an empty list and a list with no matches', () => {
    renderTable({ years: [] });
    expect(screen.getByText('No Fiscal Years Yet')).toBeInTheDocument();
  });

  it('shows no matches when filters exclude everything', () => {
    renderTable();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Fiscal Years' }), { target: { value: 'zzz' } });
    expect(screen.getByText('No Fiscal Years Match')).toBeInTheDocument();
  });

  it('opens New Fiscal Year', () => {
    const { onNew } = renderTable();
    fireEvent.click(screen.getByRole('button', { name: 'New Fiscal Year' }));
    expect(onNew).toHaveBeenCalled();
  });

  it('shows and hides the periods of a year', () => {
    renderTable();
    const toggle = within(bodyRows()[1]).getByRole('button', { name: 'Periods' });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Jul 2026')).toBeInTheDocument();
    fireEvent.click(within(bodyRows()[1]).getByRole('button', { name: 'Hide Periods' }));
    expect(screen.queryByText('Jul 2026')).not.toBeInTheDocument();
  });

  it('offers Lock only for open unlocked years and Unlock only for locked ones', () => {
    renderTable();
    expect(within(bodyRows()[0]).queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    expect(within(bodyRows()[1]).getByRole('button', { name: 'Lock' })).toBeInTheDocument();
    expect(within(bodyRows()[2]).getByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });

  it('locks a year only after the year name is typed, then refreshes', () => {
    const { onRefresh } = renderTable();
    fireEvent.click(within(bodyRows()[1]).getByRole('button', { name: 'Lock' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Lock Fiscal Year?' });
    const confirm = within(dialog).getByRole('button', { name: 'Yes, Lock Year' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '2026-2027' } });
    fireEvent.click(confirm);
    expect(lockMutate).toHaveBeenCalledWith({ id: 'b' }, expect.any(Object));
    act(() => lockMutate.mock.calls[0][1].onSuccess());
    expect(onRefresh).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('unlocks a locked year', () => {
    renderTable();
    fireEvent.click(within(bodyRows()[2]).getByRole('button', { name: 'Unlock' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Unlock Fiscal Year?' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '2027-2028' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Unlock Year' }));
    expect(unlockMutate).toHaveBeenCalledWith({ id: 'c' }, expect.any(Object));
  });
});
