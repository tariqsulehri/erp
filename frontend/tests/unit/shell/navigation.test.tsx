import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '@/components/shell/AppSidebar';
import { ModuleTabs } from '@/components/shell/ModuleTabs';
import { NAV_SECTIONS, navSectionsFor, resolveRoute } from '@/components/shell/nav-config';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

const configGroup = () => {
  for (const section of NAV_SECTIONS) {
    for (const entry of section.entries) {
      if (entry.type === 'group' && entry.group.key === 'config') return entry.group;
    }
  }
  throw new Error('Configuration group missing');
};

describe('navigation config', () => {
  it('lists Configuration as numbered setup steps in setup order', () => {
    const group = configGroup();
    expect(group.numbered).toBe(true);
    expect(group.items.map(item => item.label)).toEqual([
      'General Settings', 'Fiscal Year', 'Chart of Accounts', 'States', 'Cities', 'Areas',
      'Branches', 'Warehouses', 'Categories', 'Units of Measure', 'Users',
    ]);
  });

  it('every page has a unique address', () => {
    const hrefs = NAV_SECTIONS.flatMap(section => section.entries.flatMap(entry => (entry.type === 'link' ? [entry.item.href] : entry.group.items.map(item => item.href))));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('hides Users from people who cannot manage users', () => {
    const labels = (canManageUsers: boolean) => navSectionsFor({ canManageUsers, role: 'admin' })
      .flatMap(section => section.entries.flatMap(entry => (entry.type === 'group' ? entry.group.items.map(item => item.label) : [entry.item.label])));
    expect(labels(true)).toContain('Users');
    expect(labels(false)).not.toContain('Users');
  });

  it('selects the most specific page for an address', () => {
    expect(resolveRoute('/settings/areas')?.item.label).toBe('Areas');
    expect(resolveRoute('/settings')?.item.label).toBe('General Settings');
    expect(resolveRoute('/fiscal-year')?.group?.key).toBe('config');
    expect(resolveRoute('/does-not-exist')).toBeUndefined();
  });
});

const groupByKey = (key: string) => {
  for (const section of NAV_SECTIONS) {
    for (const entry of section.entries) {
      if (entry.type === 'group' && entry.group.key === key) return entry.group;
    }
  }
  throw new Error(`Group ${key} missing`);
};

describe('AppSidebar', () => {
  const props = { collapsed: false, onToggleCollapsed: jest.fn(), postingDisabled: false, postingReason: '' };

  it('shows each group as one link to its first page, with its page count', () => {
    render(<AppSidebar {...props} />);
    const inventory = screen.getByRole('link', { name: /Inventory/ });
    expect(inventory).toHaveAttribute('href', '/inventory/products');
    expect(inventory).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: /Configuration/ })).toHaveAttribute('href', '/settings');
    // Pages inside groups are not listed in the sidebar any more; they are tabs on the page.
    expect(screen.queryByRole('link', { name: /Stock Received/ })).not.toBeInTheDocument();
  });

  it('marks the group of the current page as active', () => {
    render(<AppSidebar {...props} activeGroupKey="inventory" activeHref="/inventory/stock-received" />);
    expect(screen.getByRole('link', { name: /Inventory/ })).toHaveClass('active');
    expect(screen.getByRole('link', { name: /Payables/ })).not.toHaveClass('active');
  });

  it('marks a single page such as Dashboard as the current page', () => {
    render(<AppSidebar {...props} activeHref="/dashboard" />);
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Dashboard');
  });
});

describe('ModuleTabs', () => {
  const props = { postingDisabled: false, postingReason: '' };

  it('shows the Inventory pages as tabs, including Stock Received, and marks the current one', () => {
    render(<ModuleTabs {...props} group={groupByKey('inventory')} activeHref="/inventory/stock-received" />);
    const tabs = screen.getByRole('navigation', { name: 'Inventory Pages' });
    expect(tabs).toHaveTextContent('Products');
    expect(tabs).toHaveTextContent('Stock Transfer');
    expect(tabs).toHaveTextContent('Stock Adjustment');
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Stock Received');
    expect(screen.queryByLabelText('Step 1')).not.toBeInTheDocument();
  });

  it('numbers the Configuration pages as setup steps', () => {
    render(<ModuleTabs {...props} group={groupByKey('config')} activeHref="/fiscal-year" />);
    expect(screen.getByLabelText('Step 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 11')).toBeInTheDocument();
    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveTextContent('Fiscal Year');
    expect(current).toHaveTextContent('2');
  });

  it('disables posting pages when no period is open, with the reason, but keeps the current page', () => {
    render(<ModuleTabs group={groupByKey('vouchers')} activeHref="/vouchers/journal" postingDisabled postingReason="No open period." />);
    const bankReceipt = screen.getByText('Bank Receipt').closest('.module-tab');
    expect(bankReceipt).toHaveAttribute('aria-disabled', 'true');
    expect(bankReceipt).toHaveAttribute('title', 'No open period.');
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Journal Entry');
    expect(screen.getByRole('link', { name: 'Voucher List' })).toBeInTheDocument();
  });
});
