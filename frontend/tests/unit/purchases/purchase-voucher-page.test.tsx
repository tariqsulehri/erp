import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import PurchaseVoucherPage from '@/components/purchases/PurchaseVoucherPage';
import { BackendApiError } from '@/lib/api/backend-client';

let role = 'warehouse_staff';
const createDraft = jest.fn();
const createAndPost = jest.fn();

jest.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { role } } }) }));
jest.mock('@/lib/api/settings', () => ({ useGeneralSettings: () => ({ data: undefined }), useCompanyProfile: () => ({ data: undefined }) }));
jest.mock('@/lib/api/fiscal-years', () => ({
  usePostingDateGuard: () => ({ dateIsValid: true, isChecking: false, isBlocked: false, statusMessage: '', disabled: false }),
}));
jest.mock('@/lib/api/purchases', () => ({
  usePurchaseSupportData: () => ({
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    data: {
      suppliers: [{ id: 's-1', code: 'SUP-1', name: 'Paper House', account_code: '0201010001', payment_terms_days: 30 }],
      items: [{ id: 'i-1', item_code: 'P-1', item_name: 'Paper', purchase_price: '12.50', tax_rate: '0', uom_name: 'PCS' }],
      warehouses: [{ id: 'w-1', code: 'WH-1', name: 'Main', is_default: true }],
      locations: [],
    },
  }),
  useCreatePurchaseDraft: () => ({ mutateAsync: createDraft, isPending: false }),
  useCreateAndPostPurchase: () => ({ mutateAsync: createAndPost, isPending: false }),
  useUpdatePurchaseDraft: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateAndPostPurchase: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useInvalidatePurchaseQueries: () => () => Promise.resolve(),
}));
// The page opens on its analytics view; a plain stand-in keeps this test on the entry form.
jest.mock('@/components/purchases/PurchaseAnalyticsView', () => ({
  PurchaseAnalyticsView: ({ onNewPurchase, newDisabled, newDisabledReason }: { onNewPurchase: () => void; newDisabled: boolean; newDisabledReason: string }) => (
    <button type="button" disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase}>New Purchase</button>
  ),
}));

// jsdom has no layout, so the dropdown's scroll-to-option call is a no-op here.
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  role = 'warehouse_staff';
  createDraft.mockReset();
  createAndPost.mockReset();
});

function openEntry() {
  render(<PurchaseVoucherPage />);
  fireEvent.click(screen.getByRole('button', { name: 'New Purchase' }));
}

function choose(combobox: HTMLElement, optionName: RegExp) {
  fireEvent.focus(combobox);
  fireEvent.click(screen.getByRole('option', { name: optionName }));
}

/** Supplier and one line of 4 x Paper at 12.50. */
function fillValidPurchase() {
  choose(screen.getByPlaceholderText('Search Supplier'), /SUP-1 - Paper House/);
  choose(screen.getByPlaceholderText('Search Item'), /P-1 - Paper/);
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
}

describe('Purchase Voucher entry', () => {
  it('lets a role that may not save purchases open nothing, and says why', () => {
    role = 'viewer';
    render(<PurchaseVoucherPage />);
    const newButton = screen.getByRole('button', { name: 'New Purchase' });
    expect(newButton).toBeDisabled();
    expect(newButton).toHaveAttribute('title', 'Your role can view Purchase Vouchers but cannot save or post them.');
  });

  it('asks for the Supplier before saving and sends nothing', () => {
    openEntry();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(screen.getByText('Supplier is required.')).toBeInTheDocument();
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('asks for at least one line', () => {
    openEntry();
    choose(screen.getByPlaceholderText('Search Supplier'), /SUP-1 - Paper House/);
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(screen.getByText('Add at least one purchase item.')).toBeInTheDocument();
  });

  it('adds a line with the item price and saves the draft with the expected payload', async () => {
    createDraft.mockResolvedValue({ id: 'p-1', purchase_number: 'PI-2026-0001' });
    openEntry();
    fillValidPurchase();
    expect(screen.getByText('P-1 - Paper')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(await screen.findByText('PI-2026-0001 saved as Draft.')).toBeInTheDocument();
    expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({
      supplier_id: 's-1',
      warehouse_id: 'w-1',
      payment_type: 'Cash',
      lines: [expect.objectContaining({ item_id: 'i-1', warehouse_id: 'w-1', quantity: 4, purchase_price: 12.5, discount_amount: 0, tax_amount: 0 })],
    }));
  });

  it('shows the server message when saving is refused, and keeps the entered lines', async () => {
    createDraft.mockRejectedValue(new BackendApiError('Supplier Bill No. is already used on PI-2026-0001.', 400));
    openEntry();
    fillValidPurchase();
    fireEvent.click(screen.getByRole('button', { name: /Save Draft/ }));
    expect(await screen.findByText(/Supplier Bill No\. is already used on PI-2026-0001/)).toBeInTheDocument();
    expect(screen.getByText('P-1 - Paper')).toBeInTheDocument();
  });

  it('asks before Process, then saves and posts in one step', async () => {
    createAndPost.mockResolvedValue({ id: 'p-2', purchase_number: 'PI-2026-0002', status: 'Posted' });
    openEntry();
    fillValidPurchase();
    fireEvent.click(screen.getByRole('button', { name: /^Process/ }));
    const dialog = screen.getByRole('alertdialog', { name: 'Process Purchase Voucher?' });
    expect(within(dialog).getByText(/You cannot change it after it is posted/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Process' }));
    expect(await screen.findByText('PI-2026-0002 saved and posted.')).toBeInTheDocument();
    expect(createAndPost).toHaveBeenCalledTimes(1);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('adds a line with Enter in its last field and saves the draft with Ctrl+S', async () => {
    createDraft.mockResolvedValue({ id: 'p-3', purchase_number: 'PI-2026-0003' });
    openEntry();
    choose(screen.getByPlaceholderText('Search Supplier'), /SUP-1 - Paper House/);
    choose(screen.getByPlaceholderText('Search Item'), /P-1 - Paper/);
    const quantity = screen.getByLabelText(/^Quantity/);
    fireEvent.change(quantity, { target: { value: '2' } });
    // Enter in the last field of the line (Line Description) adds the line.
    fireEvent.keyDown(screen.getByLabelText(/^Line Description/), { key: 'Enter' });
    expect(screen.getByText('P-1 - Paper')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(document, { key: 's', ctrlKey: true });
    });
    await waitFor(() => expect(createDraft).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ quantity: 2 })] })));
  });
});
