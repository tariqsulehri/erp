import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SaleVoucherPage from '@/components/sales/SaleVoucherPage';
import { BackendApiError } from '@/lib/api/backend-client';

let role = 'sales_staff';
const createDraft = jest.fn();
const createAndPost = jest.fn();

jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { role, accessLevel: 'ALL_BRANCHES' } } }) }));
jest.mock('@/lib/api/settings', () => ({ useGeneralSettings: () => ({ data: undefined }), useCompanyProfile: () => ({ data: undefined }) }));
jest.mock('@/lib/api/fiscal-years', () => ({
  usePostingDateGuard: () => ({ dateIsValid: true, isChecking: false, isBlocked: false, statusMessage: '', disabled: false }),
}));
jest.mock('@/lib/api/sales', () => ({
  useSaleSupportData: () => ({
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    data: {
      customers: [{ id: 'c-1', code: 'CUS-1', name: 'City Books', account_code: '0103010001', payment_terms_days: 15, credit_limit: 0, current_balance: 0 }],
      items: [{ id: 'i-1', item_code: 'P-1', item_name: 'Paper', sale_price: '20', tax_rate: '0', uom_name: 'PCS', stock_on_hand: '50' }],
      branches: [{ id: 'b-1', code: 'BR-1', name: 'Lahore', is_default: true }],
      locations: [],
    },
  }),
  useCreateSaleDraft: () => ({ mutateAsync: createDraft, isPending: false }),
  useCreateAndPostSale: () => ({ mutateAsync: createAndPost, isPending: false }),
  useUpdateSaleDraft: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateAndPostSale: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useInvalidateSaleQueries: () => () => Promise.resolve(),
}));
// The page opens on its analytics view; a plain stand-in keeps this test on the entry form.
jest.mock('@/components/sales/SaleAnalyticsView', () => ({
  SaleAnalyticsView: ({ onNewSale, newDisabled, newDisabledReason }: { onNewSale: () => void; newDisabled: boolean; newDisabledReason: string }) => (
    <button type="button" disabled={newDisabled} title={newDisabledReason} onClick={onNewSale}>New Sale</button>
  ),
}));

// jsdom has no layout, so the dropdown's scroll-to-option call is a no-op here.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  role = 'sales_staff';
  createDraft.mockReset();
  createAndPost.mockReset();
});

function openEntry() {
  render(<SaleVoucherPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New Sale' }));
}

function choose(combobox: HTMLElement, optionName: RegExp) {
  fireEvent.focus(combobox);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Customer and one line of 3 x Paper at 20. */
function fillValidSale() {
  choose(screen.getByPlaceholderText('Search Customer'), /CUS-1 - City Books/);
  choose(screen.getByPlaceholderText('Search Item'), /P-1 - Paper/);
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('Sale Voucher entry', () => {
  it('lets a role that may not save sales open nothing, and says why', () => {
    role = 'warehouse_staff';
    render(<SaleVoucherPage />);
    const newButton = screen.getByRole('button', { name: 'New Sale' });
    expect(newButton).toBeDisabled();
    expect(newButton).toHaveAttribute('title', 'Your role can view Sale Vouchers but cannot save or post them.');
  });

  it('asks for the Customer and at least one line, and sends nothing', () => {
    openEntry();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(screen.getByText('Customer is required.')).toBeInTheDocument();
    choose(screen.getByPlaceholderText('Search Customer'), /CUS-1 - City Books/);
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(screen.getByText('Add at least one sale item.')).toBeInTheDocument();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('saves the draft at the default Branch with the sale price', async () => {
    createDraft.mockResolvedValue({ id: 's-1', sale_number: 'SI-2026-0001' });
    openEntry();
    fillValidSale();
    expect(screen.getByText('P-1 - Paper')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(await screen.findByText('SI-2026-0001 saved as Draft.')).toBeInTheDocument();
    expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({
      customer_id: 'c-1',
      branch_id: 'b-1',
      lines: [expect.objectContaining({ item_id: 'i-1', quantity: 3, sale_price: 20 })],
    }));
  });

  it('shows the server message when posting is refused, and keeps the lines', async () => {
    createAndPost.mockRejectedValue(new BackendApiError('Not enough stock for P-1.', 400));
    openEntry();
    fillValidSale();
    fireEvent.click(screen.getByRole('button', { name: /^Process/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Process Sale Voucher?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Process' }));
    expect(await screen.findByText(/Not enough stock for P-1/)).toBeInTheDocument();
    expect(screen.getByText('P-1 - Paper')).toBeInTheDocument();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('saves and posts after confirming Process', async () => {
    createAndPost.mockResolvedValue({ id: 's-2', sale_number: 'SI-2026-0002', status: 'Posted' });
    openEntry();
    fillValidSale();
    fireEvent.click(screen.getByRole('button', { name: /^Process/ }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, Process' }));
    expect(await screen.findByText('SI-2026-0002 saved and posted.')).toBeInTheDocument();
  });

  it('saves the draft with Ctrl+S', async () => {
    createDraft.mockResolvedValue({ id: 's-3', sale_number: 'SI-2026-0003' });
    openEntry();
    fillValidSale();
    await act(async () => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    });
    await waitFor(() => expect(createDraft).toHaveBeenCalledTimes(1));
  });
});
