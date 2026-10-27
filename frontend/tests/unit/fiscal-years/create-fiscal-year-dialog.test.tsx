import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateFiscalYearDialog } from '@/components/fiscal-years/CreateFiscalYearDialog';

const mutate = jest.fn();
jest.mock('@/lib/api/fiscal-years', () => ({
  fiscalYearsQueryKey: ['fiscal-years'],
  useCreateFiscalYear: () => ({ mutate, isPending: false }),
}));

const settings = { date_format: 'dd/MM/yyyy', locale: 'en-GB' } as never;

function renderDialog(props: Partial<Parameters<typeof CreateFiscalYearDialog>[0]> = {}) {
  const onClose = jest.fn();
  const onCreated = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CreateFiscalYearDialog open settings={settings} onClose={onClose} onCreated={onCreated} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, onCreated };
}

const field = (label: RegExp) => screen.getByLabelText(label) as HTMLInputElement;

beforeEach(() => mutate.mockReset());

describe('CreateFiscalYearDialog', () => {
  it('fills the dates from the name and basis and previews the periods', () => {
    renderDialog();
    fireEvent.change(field(/Fiscal Year Name/), { target: { value: '2026-2027' } });
    expect(field(/Start Date/).value).toBe('2026-07-01');
    expect(field(/End Date/).value).toBe('2027-06-30');
    expect(screen.getByText(/^12 periods, from/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(12);

    fireEvent.change(field(/Year Basis/), { target: { value: 'calendar' } });
    expect(field(/Start Date/).value).toBe('2026-01-01');
    expect(field(/End Date/).value).toBe('2026-12-31');
  });

  it('shows the backend rule when the periods do not divide the year', () => {
    renderDialog();
    // The default July basis gives 2026-07-01; ending on 2027-04-30 leaves a 10-month year.
    fireEvent.change(field(/Fiscal Year Name/), { target: { value: '2026' } });
    fireEvent.change(field(/End Date/), { target: { value: '2027-04-30' } });
    expect(screen.getByText('Number Of Periods must split the 10-month year into equal parts. You can use: 1, 2.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).not.toHaveBeenCalled();
  });

  it('asks for a name and does not save without one', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a Fiscal Year Name.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('saves the fiscal year with the chosen values', () => {
    const { onClose, onCreated } = renderDialog();
    fireEvent.change(field(/Fiscal Year Name/), { target: { value: ' 2026-2027 ' } });
    fireEvent.change(field(/Number Of Periods/), { target: { value: '4' } });
    fireEvent.change(field(/Late Entry Days/), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mutate).toHaveBeenCalledWith(
      { fiscal_year: '2026-2027', year_basis: 'july', start_date: '2026-07-01', end_date: '2027-06-30', number_of_periods: 4, posting_cutoff_days: 7 },
      expect.any(Object),
    );
    act(() => mutate.mock.calls[0][1].onSuccess({ message: 'Fiscal Year created successfully.' }));
    expect(onCreated).toHaveBeenCalledWith('Fiscal Year created successfully.');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the server message when saving fails, and stays open', () => {
    const { onClose } = renderDialog();
    fireEvent.change(field(/Fiscal Year Name/), { target: { value: '2026-2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => mutate.mock.calls[0][1].onError(new Error('Fiscal Year dates overlap 2025-2026.')));
    expect(screen.getByText('Fiscal Year dates overlap 2025-2026.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('accepts only digits for the cutoff days', () => {
    renderDialog();
    fireEvent.change(field(/Late Entry Days/), { target: { value: '9x' } });
    expect(field(/Late Entry Days/).value).toBe('9');
  });
});
