import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChartCard, RankedBars } from '@/components/analytics/ProCharts';
import { StatTile } from '@/components/ui/StatTile';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

describe('StatTile', () => {
  it('shows the label, value, suffix, and tone', () => {
    const { container } = render(<StatTile label="People Assessed" value="33" suffix="/ 41" tone="violet" icon={<svg data-testid="icon" />} />);
    expect(screen.getByText('People Assessed')).toBeInTheDocument();
    expect(screen.getByText('33')).toBeInTheDocument();
    expect(screen.getByText('/ 41')).toBeInTheDocument();
    expect(container.querySelector('.stat-tile')).toHaveClass('tone-violet');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('defaults to the blue tone', () => {
    const { container } = render(<StatTile label="Documents" value="9" />);
    expect(container.querySelector('.stat-tile')).toHaveClass('tone-blue');
  });

  it('explains the figure from the help mark', () => {
    render(<StatTile label="Net Profit" value="1" help="Revenue less all expenses." />);
    expect(screen.getByRole('note', { name: 'About Net Profit: Revenue less all expenses.' })).toBeInTheDocument();
  });

  it('shows the change with its comparison, and hides it when there is nothing to compare', () => {
    const { rerender } = render(<StatTile label="Net" value="1" change={{ percent: -12.34, text: 'Oct vs Sep' }} />);
    expect(screen.getByText('12.3%')).toBeInTheDocument();
    expect(screen.getByText('Oct vs Sep')).toBeInTheDocument();
    rerender(<StatTile label="Net" value="1" change={{ percent: null, text: 'Oct vs Sep' }} />);
    expect(screen.queryByText('Oct vs Sep')).not.toBeInTheDocument();
  });

  it('draws a progress bar clamped to 0–100', () => {
    const { container } = render(<StatTile label="Done" value="1" progress={140} />);
    expect(screen.getByRole('img', { name: '140%' })).toBeInTheDocument();
    expect((container.querySelector('.stat-tile-bar > span') as HTMLElement).style.width).toBe('100%');
  });

  it('labels a part-to-whole bar for screen readers', () => {
    render(<StatTile label="Credit" value="1" parts={[{ name: 'Credit', value: 75, color: '#000' }, { name: 'Cash', value: 25, color: '#fff' }]} />);
    expect(screen.getByRole('img', { name: 'Credit 75%, Cash 25%' })).toBeInTheDocument();
  });

  it('becomes a link that still reads its figure', () => {
    render(<StatTile label="Receivables" value="$ 10" href="/reports?report=receivables-aging" linkLabel="View Receivables Aging" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/reports?report=receivables-aging');
    expect(link).toHaveTextContent('$ 10');
    expect(link).toHaveTextContent('View Receivables Aging');
  });
});

describe('ChartCard', () => {
  const table = { columns: [{ key: 'month', label: 'Month' }, { key: 'net', label: 'Net', numeric: true }], rows: [{ month: 'July 2026', net: '$ 10' }] };

  it('shows the headline and switches between chart and table', () => {
    render(
      <ChartCard title="Net By Month" subtitle="Each month" headline="Peak month July." table={table}>
        <div>chart body</div>
      </ChartCard>,
    );
    expect(screen.getByText('Peak month July.')).toBeInTheDocument();
    expect(screen.getByText('chart body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Net By Month Table' }));
    expect(screen.getByRole('table')).toHaveTextContent('July 2026');
    expect(screen.queryByText('chart body')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Net By Month Chart' }));
    expect(screen.getByText('chart body')).toBeInTheDocument();
  });

  it('disables the download when there are no rows', () => {
    render(<ChartCard title="Empty" subtitle="None" table={{ columns: table.columns, rows: [] }}><div /></ChartCard>);
    expect(screen.getByRole('button', { name: 'Download Empty As CSV' })).toBeDisabled();
  });
});

describe('RankedBars', () => {
  const format = (value: number) => `$${value}`;

  it('lists items with amount and share, and folds the rest into one line', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ name: `Supplier ${index + 1}`, value: 100 - index * 10 }));
    render(<RankedBars items={items} total={640} format={format} color="#1f56c7" limit={6} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('15.6%')).toBeInTheDocument();
    expect(screen.getByText('2 more: $70 (10.9%)')).toBeInTheDocument();
  });

  it('shows an empty message with no data', () => {
    render(<RankedBars items={[]} total={0} format={format} color="#1f56c7" />);
    expect(screen.getByText('No data for the selected filters.')).toBeInTheDocument();
  });
});
