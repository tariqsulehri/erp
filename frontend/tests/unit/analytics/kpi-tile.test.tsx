import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { KpiTile, RankedBars } from '@/components/analytics/ProCharts';

describe('KpiTile', () => {
  it('shows the label, value, tone class and icon badge', () => {
    const { container } = render(
      <KpiTile label="Net Purchases" value="$ 23,186.50" tone="violet" icon={<svg data-testid="icon" />} />,
    );
    expect(screen.getByText('Net Purchases')).toBeInTheDocument();
    expect(screen.getByText('$ 23,186.50')).toBeInTheDocument();
    expect(container.querySelector('.kpi-tile')).toHaveClass('tone-violet');
    expect(container.querySelector('.tile-icon')).toContainElement(screen.getByTestId('icon'));
  });

  it('defaults to the blue tone', () => {
    const { container } = render(<KpiTile label="Documents" value="9" />);
    expect(container.querySelector('.kpi-tile')).toHaveClass('tone-blue');
  });

  it('shows the month-on-month change with its comparison', () => {
    render(<KpiTile label="Net" value="1" change={{ percent: -12.34, text: 'Oct vs Sep' }} />);
    expect(screen.getByText('12.3%')).toBeInTheDocument();
    expect(screen.getByText('Oct vs Sep')).toBeInTheDocument();
  });

  it('hides the change when there is nothing to compare', () => {
    render(<KpiTile label="Net" value="1" change={{ percent: null, text: 'Oct vs Sep' }} />);
    expect(screen.queryByText('Oct vs Sep')).not.toBeInTheDocument();
  });

  it('labels the part-to-whole meter for screen readers', () => {
    render(
      <KpiTile
        label="Credit"
        value="1"
        meter={[{ name: 'Credit', value: 75, color: '#000' }, { name: 'Cash', value: 25, color: '#fff' }]}
      />,
    );
    expect(screen.getByRole('img', { name: 'Credit 75%, Cash 25%' })).toBeInTheDocument();
  });
});

describe('RankedBars', () => {
  const format = (value: number) => `$${value}`;

  it('lists items with amount and share, and folds the rest into one line', () => {
    const items = Array.from({ length: 8 }, (_, index) => ({ name: `Supplier ${index + 1}`, value: 100 - index * 10 }));
    render(<RankedBars items={items} total={640} format={format} color="#1f56c7" limit={6} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Supplier 1')).toBeInTheDocument();
    expect(screen.getByText('15.6%')).toBeInTheDocument();
    expect(screen.getByText('2 more: $70 (10.9%)')).toBeInTheDocument();
  });

  it('shows an empty message with no data', () => {
    render(<RankedBars items={[]} total={0} format={format} color="#1f56c7" />);
    expect(screen.getByText('No data for the selected filters.')).toBeInTheDocument();
  });
});
