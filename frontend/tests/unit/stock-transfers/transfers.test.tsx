import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransferDirectionPicker } from '@/components/stock-transfers/TransferDirectionPicker';
import { TransferList } from '@/components/stock-transfers/TransferList';
import { TRANSFER_DIRECTIONS, directionOf, directionOption, directionsFor } from '@/components/stock-transfers/transfer-directions';

const listCalls: any[] = [];
const lastCall = () => listCalls[listCalls.length - 1];
let listResult: any = { isLoading: false, error: null, data: { data: [] } };
let detailStatus = 'Posted';
const postDraft = jest.fn();
const cancelDraft = jest.fn();
const reverseTransfer = jest.fn();
jest.mock('@/lib/api/stock-transfers', () => ({
  useReverseStockTransfer: () => ({ mutateAsync: reverseTransfer }),
  useStockTransfersList: (query: any) => { listCalls.push(query); return listResult; },
  usePostStockTransferDraft: () => ({ mutateAsync: postDraft }),
  useCancelStockTransferDraft: () => ({ mutateAsync: cancelDraft }),
  useInvalidateStockTransferQueries: () => () => Promise.resolve(),
  useStockTransferDetail: (id: string | null) => ({ isFetching: false, data: id ? { id, transfer_number: 'ST-2026-0001', transfer_date: '2026-10-01', status: detailStatus, from_kind: 'WAREHOUSE', from_code: 'MAIN', from_name: 'Main', to_kind: 'BRANCH', to_code: 'BR-1', to_name: 'Lahore', lines: [{ id: 'l1', item_code: 'P-1', item_name: 'Paper', quantity: '5' }] } : undefined }),
}));

const row = (id: string, number: string, fromKind: string, toKind: string) => ({
  id, transfer_number: number, transfer_date: '2026-10-01', status: 'Posted', total_quantity: '5',
  from_kind: fromKind, from_code: 'F', from_name: 'From Place', to_kind: toKind, to_code: 'T', to_name: 'To Place',
});

beforeEach(() => { listCalls.length = 0; listResult = { isLoading: false, error: null, data: { data: [] } }; detailStatus = 'Posted'; postDraft.mockReset(); cancelDraft.mockReset(); reverseTransfer.mockReset(); });

describe('transfer directions', () => {
  it('lists the four directions, Warehouse → Branch first', () => {
    expect(TRANSFER_DIRECTIONS.map(option => option.label)).toEqual(['Warehouse → Branch', 'Branch → Branch', 'Warehouse → Warehouse', 'Branch → Warehouse']);
  });

  it('builds and reads a direction from the two kinds of place', () => {
    expect(directionOf('BRANCH', 'WAREHOUSE')).toBe('BRANCH_TO_WAREHOUSE');
    expect(directionOption('WAREHOUSE_TO_WAREHOUSE')).toMatchObject({ from: 'WAREHOUSE', to: 'WAREHOUSE' });
  });

  it('offers a Branch or Warehouse user only directions that start at their own kind of place', () => {
    expect(directionsFor('BRANCH').map(option => option.value)).toEqual(['BRANCH_TO_BRANCH', 'BRANCH_TO_WAREHOUSE']);
    expect(directionsFor('WAREHOUSE').map(option => option.value)).toEqual(['WAREHOUSE_TO_BRANCH', 'WAREHOUSE_TO_WAREHOUSE']);
    expect(directionsFor(null)).toHaveLength(4);
  });
});

describe('TransferDirectionPicker', () => {
  it('shows the directions as radio choices and reports the one chosen', () => {
    const onChange = jest.fn();
    render(<TransferDirectionPicker value="WAREHOUSE_TO_BRANCH" options={TRANSFER_DIRECTIONS} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: /Warehouse → Branch/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Branch → Branch/ }));
    expect(onChange).toHaveBeenCalledWith('BRANCH_TO_BRANCH');
  });
});

describe('TransferList', () => {
  const empty = { title: 'No Stock Received Yet', description: 'Nothing delivered yet.' };

  it('asks only for posted transfers delivered to the user when used for Stock Received', () => {
    render(<TransferList incoming empty={empty} />);
    expect(lastCall()).toMatchObject({ status: 'Posted', incoming: true });
    expect(screen.getByText('No Stock Received Yet')).toBeInTheDocument();
  });

  it('filters by direction and explains when nothing matches', () => {
    render(<TransferList empty={empty} />);
    expect(lastCall().incoming).toBeUndefined();
    fireEvent.click(screen.getByRole('combobox', { name: 'Direction' }));
    fireEvent.click(screen.getByRole('option', { name: 'Warehouse → Warehouse' }));
    expect(lastCall()).toMatchObject({ direction: 'WAREHOUSE_TO_WAREHOUSE' });
    expect(screen.getByText('No Transfers Match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Direction' }));
    fireEvent.click(screen.getByRole('option', { name: 'All Directions' }));
    expect(lastCall().direction).toBeUndefined();
  });

  it('lists transfers with both places and opens the details', () => {
    listResult = { isLoading: false, error: null, data: { data: [row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH')] } };
    render(<TransferList empty={empty} />);
    expect(screen.getByText('ST-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/From Place/).closest('td')).toHaveTextContent('Warehouse');
    expect(screen.getByText(/To Place/).closest('td')).toHaveTextContent('Branch');
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    const details = screen.getByRole('dialog', { name: 'Stock Transfer Details' });
    expect(details).toHaveTextContent('P-1');
    expect(details).toHaveTextContent('Paper');
    fireEvent.click(screen.getByRole('button', { name: 'Close Stock Transfer Details' }));
    expect(screen.queryByRole('dialog', { name: 'Stock Transfer Details' })).not.toBeInTheDocument();
  });

  it('sends the search text', () => {
    render(<TransferList empty={empty} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Transfers' }), { target: { value: 'ST-2026' } });
    expect(lastCall()).toMatchObject({ search: 'ST-2026' });
  });

  it('shows no Status filter for Stock Received, which lists posted transfers only', () => {
    render(<TransferList incoming empty={empty} />);
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
  });

  it('filters by Status and offers Open Draft, Post and Cancel Draft for a selected Draft', () => {
    const onOpenDraft = jest.fn();
    detailStatus = 'Draft';
    listResult = { isLoading: false, error: null, data: { data: [{ ...row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH'), status: 'Draft' }] } };
    render(<TransferList empty={empty} onOpenDraft={onOpenDraft} canChangeDrafts />);
    expect(lastCall()).toMatchObject({ status: 'Posted' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Draft' }));
    expect(lastCall()).toMatchObject({ status: 'Draft' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Status' }));
    fireEvent.click(screen.getByRole('option', { name: 'Cancelled Or Reversed' }));
    expect(lastCall()).toMatchObject({ status: 'Voided' });

    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    expect(screen.getByRole('button', { name: 'Post' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel Draft' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Draft' }));
    expect(onOpenDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', status: 'Draft' }));
  });

  it('hides the Draft actions from roles that may not save transfers, and for posted transfers', () => {
    detailStatus = 'Draft';
    listResult = { isLoading: false, error: null, data: { data: [row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH')] } };
    const { unmount } = render(<TransferList empty={empty} onOpenDraft={jest.fn()} canChangeDrafts={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    expect(screen.queryByRole('button', { name: 'Open Draft' })).not.toBeInTheDocument();
    unmount();

    detailStatus = 'Posted';
    render(<TransferList empty={empty} onOpenDraft={jest.fn()} canChangeDrafts />);
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    expect(screen.queryByRole('button', { name: 'Open Draft' })).not.toBeInTheDocument();
  });

  it('offers Reverse on a posted transfer only to roles that may reverse, and sends the date and reason', async () => {
    listResult = { isLoading: false, error: null, data: { data: [row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH')] } };
    const { unmount } = render(<TransferList empty={empty} onOpenDraft={jest.fn()} canChangeDrafts />);
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    expect(screen.queryByRole('button', { name: 'Reverse' })).not.toBeInTheDocument();
    unmount();

    reverseTransfer.mockResolvedValue({ transfer_number: 'ST-2026-0001' });
    render(<TransferList empty={empty} onOpenDraft={jest.fn()} canChangeDrafts canReverse />);
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    fireEvent.change(screen.getByLabelText(/Reversal Date/), { target: { value: '2026-10-05' } });
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Wrong shop' } });
    const reverseButtons = screen.getAllByRole('button', { name: 'Reverse' });
    fireEvent.click(reverseButtons[reverseButtons.length - 1]);
    expect(await screen.findByText(/ST-2026-0001 reversed/)).toBeInTheDocument();
    expect(reverseTransfer).toHaveBeenCalledWith({ id: 't1', reversalDate: '2026-10-05', reason: 'Wrong shop' });
  });

  it('shows a reversed transfer as Reversed and a cancelled draft as Cancelled', () => {
    listResult = { isLoading: false, error: null, data: { data: [
      { ...row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH'), status: 'Voided', posted_at: '2026-10-01T10:00:00Z' },
      { ...row('t2', 'ST-2026-0002', 'WAREHOUSE', 'BRANCH'), status: 'Voided', posted_at: null },
    ] } };
    render(<TransferList empty={empty} onOpenDraft={jest.fn()} />);
    expect(screen.getByText('ST-2026-0001').closest('tr')).toHaveTextContent('Reversed');
    expect(screen.getByText('ST-2026-0002').closest('tr')).toHaveTextContent('Cancelled');
  });
});
