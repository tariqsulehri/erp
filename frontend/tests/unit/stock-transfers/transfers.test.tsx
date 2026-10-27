import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { TransferDirectionPicker } from '@/components/stock-transfers/TransferDirectionPicker';
import { TransferList } from '@/components/stock-transfers/TransferList';
import { TRANSFER_DIRECTIONS, directionOf, directionOption, directionsFor } from '@/components/stock-transfers/transfer-directions';

const listCalls: any[] = [];
const lastCall = () => listCalls[listCalls.length - 1];
let listResult: any = { isLoading: false, error: null, data: { data: [] } };
jest.mock('@/lib/api/stock-transfers', () => ({
  useStockTransfersList: (query: any) => { listCalls.push(query); return listResult; },
  useStockTransferDetail: (id: string | null) => ({ isFetching: false, data: id ? { transfer_number: 'ST-2026-0001', transfer_date: '2026-10-01', status: 'Posted', from_kind: 'WAREHOUSE', from_code: 'MAIN', from_name: 'Main', to_kind: 'BRANCH', to_code: 'BR-1', to_name: 'Lahore', lines: [{ id: 'l1', item_code: 'P-1', item_name: 'Paper', quantity: '5' }] } : undefined }),
}));

const row = (id: string, number: string, fromKind: string, toKind: string) => ({
  id, transfer_number: number, transfer_date: '2026-10-01', status: 'Posted', total_quantity: '5',
  from_kind: fromKind, from_code: 'F', from_name: 'From Place', to_kind: toKind, to_code: 'T', to_name: 'To Place',
});

beforeEach(() => { listCalls.length = 0; listResult = { isLoading: false, error: null, data: { data: [] } }; });

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
    fireEvent.click(screen.getByRole('button', { name: 'Warehouse → Warehouse' }));
    expect(lastCall()).toMatchObject({ direction: 'WAREHOUSE_TO_WAREHOUSE' });
    expect(screen.getByText('No Transfers Match')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(lastCall().direction).toBeUndefined();
  });

  it('lists transfers with both places and opens the details', () => {
    listResult = { isLoading: false, error: null, data: { data: [row('t1', 'ST-2026-0001', 'WAREHOUSE', 'BRANCH')] } };
    render(<TransferList empty={empty} />);
    expect(screen.getByText('ST-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/From Place/).closest('td')).toHaveTextContent('Warehouse');
    expect(screen.getByText(/To Place/).closest('td')).toHaveTextContent('Branch');
    fireEvent.click(screen.getByRole('button', { name: 'View Transfer ST-2026-0001' }));
    expect(screen.getByRole('complementary', { name: 'Transfer Details' })).toHaveTextContent('P-1 - Paper');
    fireEvent.click(screen.getByRole('button', { name: 'Close Details' }));
    expect(screen.queryByRole('complementary', { name: 'Transfer Details' })).not.toBeInTheDocument();
  });

  it('sends the search text', () => {
    render(<TransferList empty={empty} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search Transfers' }), { target: { value: 'ST-2026' } });
    expect(lastCall()).toMatchObject({ search: 'ST-2026' });
  });
});
