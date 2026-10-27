import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AppSidebar } from '@/components/shell/AppSidebar';
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

describe('AppSidebar', () => {
  const props = { collapsed: false, onToggleCollapsed: jest.fn(), onExpand: jest.fn(), postingDisabled: false, postingReason: '' };

  it('numbers the setup pages of the open Configuration group and marks the current page', () => {
    render(<AppSidebar {...props} activeGroupKey="config" activeHref="/fiscal-year" />);
    expect(screen.getByLabelText('Step 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Step 11')).toBeInTheDocument();
    const current = screen.getByRole('link', { current: 'page' });
    expect(current).toHaveTextContent('Fiscal Year');
    expect(current).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Configuration/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not number pages of other groups', () => {
    render(<AppSidebar {...props} activeGroupKey="vouchers" activeHref="/vouchers/journal" />);
    expect(screen.queryByLabelText('Step 1')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Journal Entry');
  });

  it('disables posting pages when no period is open, with the reason', () => {
    render(<AppSidebar {...props} activeGroupKey="vouchers" postingDisabled postingReason="No open period." />);
    expect(screen.getByRole('button', { name: /Bank Receipt/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Bank Receipt/ })).toHaveAttribute('title', 'No open period.');
  });
});
