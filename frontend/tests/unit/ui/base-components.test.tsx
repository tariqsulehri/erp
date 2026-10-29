import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { Drawer } from '@/components/ui/Drawer';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { StatusChip, statusTone } from '@/components/ui/StatusChip';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Toolbar } from '@/components/ui/Toolbar';

describe('IconButton', () => {
  it('uses its label as the tooltip and the accessible name', () => {
    render(<IconButton icon={<svg />} label="Print Voucher" />);
    const button = screen.getByRole('button', { name: 'Print Voucher' });
    expect(button).toHaveAttribute('title', 'Print Voucher');
  });
});

describe('StatusChip', () => {
  it('maps ERP statuses to the standard tones', () => {
    expect(statusTone('Draft')).toBe('draft');
    expect(statusTone('Pending Approval')).toBe('pending');
    expect(statusTone('Posted')).toBe('done');
    expect(statusTone('Paid')).toBe('done');
    expect(statusTone('Voided')).toBe('problem');
    expect(statusTone('Overdue')).toBe('problem');
    expect(statusTone('Open')).toBe('open');
    expect(statusTone('Flagged')).toBe('flagged');
    expect(statusTone('Something New')).toBe('draft');
  });

  it('always shows a text label', () => {
    const { container } = render(<StatusChip status="Posted" />);
    expect(screen.getByText('Posted')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('status-chip-done');
  });
});

describe('Card, Toolbar, EmptyState', () => {
  it('shows a titled card with help and actions', () => {
    render(<Card title="Totals" help="What totals mean." actions={<button type="button">Refresh</button>}>Body</Card>);
    expect(screen.getByRole('region', { name: 'Totals' })).toHaveTextContent('Body');
    expect(screen.getByRole('button', { name: 'Help: Totals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('groups filters in a labelled toolbar', () => {
    render(<Toolbar end={<button type="button">Clear Filters</button>}><input aria-label="Search" /></Toolbar>);
    const toolbar = screen.getByRole('group', { name: 'Filters' });
    expect(within(toolbar).getByLabelText('Search')).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument();
  });

  it('explains an empty screen and offers the next step', () => {
    render(<EmptyState title="No Vouchers Yet" description="Create the first voucher." action={<button type="button">New Voucher</button>} />);
    expect(screen.getByRole('status')).toHaveTextContent('No Vouchers Yet');
    expect(screen.getByRole('button', { name: 'New Voucher' })).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  type Row = { code: string; name: string; amount: number };
  const rows: Row[] = [
    { code: 'A-2', name: 'Beta', amount: 200 },
    { code: 'A-10', name: 'Alpha', amount: 50 },
    { code: 'A-1', name: 'Gamma', amount: 1000 },
  ];
  const columns = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'amount', header: 'Amount', numeric: true, sortable: true, render: (row: Row) => row.amount.toFixed(2) },
  ];
  const codes = () => screen.getAllByRole('row').slice(1, 4).map(row => within(row).getAllByRole('cell')[0].textContent);

  it('sorts by a column: ascending, then descending, then back to the original order', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.code} caption="Accounts" />);
    const amount = screen.getByRole('button', { name: 'Amount' });
    fireEvent.click(amount);
    expect(codes()).toEqual(['A-10', 'A-2', 'A-1']);
    expect(screen.getByRole('columnheader', { name: 'Amount' })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(amount);
    expect(codes()).toEqual(['A-1', 'A-2', 'A-10']);
    fireEvent.click(amount);
    expect(codes()).toEqual(['A-2', 'A-10', 'A-1']);
  });

  it('sorts codes in natural order', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.code} />);
    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    expect(codes()).toEqual(['A-1', 'A-2', 'A-10']);
  });

  it('right-aligns numbers and shows a bold totals row', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.code} totals={{ name: 'Total', amount: '1250.00' }} />);
    expect(screen.getByText('200.00')).toHaveClass('num');
    expect(screen.getByText('1250.00').closest('tr')).toHaveClass('data-table-totals');
  });

  it('shows loading and empty messages', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]} rowKey={row => row.code} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    rerender(<DataTable columns={columns} rows={[]} rowKey={row => row.code} empty={{ title: 'No Accounts' }} />);
    expect(screen.getByText('No Accounts')).toBeInTheDocument();
  });

  it('opens a row when it is clicked', () => {
    const onRowClick = jest.fn();
    render(<DataTable columns={columns} rows={rows} rowKey={row => row.code} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('Gamma'));
    expect(onRowClick).toHaveBeenCalledWith(rows[2]);
  });
});

describe('Modal and Drawer', () => {
  it('opens a labelled modal, focuses inside, and closes on Escape and the close button', () => {
    const onClose = jest.fn();
    render(<><button type="button">Opener</button><Modal open title="Details" onClose={onClose} footer={<button type="button">OK</button>}>Text</Modal></>);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close Details' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing when closed', () => {
    render(<Modal open={false} title="Hidden" onClose={jest.fn()}>Text</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a drawer as a dialog', () => {
    const onClose = jest.fn();
    render(<Drawer open title="Transfer" onClose={onClose}>Lines</Drawer>);
    expect(screen.getByRole('dialog', { name: 'Transfer' })).toHaveTextContent('Lines');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ProgressBar', () => {
  it('renders progress bar with standardized default 14px height and aria attributes', () => {
    render(<ProgressBar pct={75} tone="blue" ariaLabel="Storage Used" />);
    const bar = screen.getByRole('progressbar', { name: 'Storage Used' });
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(bar).toHaveStyle({ height: '14px' });
  });

  it('calculates percentage from value and total', () => {
    render(<ProgressBar value={40} total={200} ariaLabel="Quota" />);
    const bar = screen.getByRole('progressbar', { name: 'Quota' });
    expect(bar).toHaveAttribute('aria-valuenow', '20');
  });
});

describe('Toast', () => {
  function Trigger({ tone }: { tone: 'success' | 'error' }) {
    const toast = useToast();
    return <button type="button" onClick={() => toast(tone === 'success' ? 'Voucher posted.' : 'Could not post.', tone)}>Go</button>;
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('announces a success message and removes it after a few seconds', () => {
    render(<ToastProvider><Trigger tone="success" /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(screen.getByRole('status')).toHaveTextContent('Voucher posted.');
    act(() => { jest.advanceTimersByTime(5100); });
    expect(screen.queryByText('Voucher posted.')).not.toBeInTheDocument();
  });

  it('keeps an error until the user closes it', () => {
    render(<ToastProvider><Trigger tone="error" /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    act(() => { jest.advanceTimersByTime(20000); });
    expect(screen.getByText('Could not post.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close Message' }));
    expect(screen.queryByText('Could not post.')).not.toBeInTheDocument();
  });
});
