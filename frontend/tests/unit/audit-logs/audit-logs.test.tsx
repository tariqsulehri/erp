import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  actionBadgeVariant,
  formatAuditDate,
} from '@/components/audit-logs/audit-helpers';
import { AuditLogDetailDrawer } from '@/components/audit-logs/AuditLogDetailDrawer';
import { AuditAnalyticsView } from '@/components/audit-logs/AuditAnalyticsView';
import type { AuditLogRow, AuditLogStats } from '@/lib/api/audit';

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const mockLog: AuditLogRow = {
  id: 'a0000000-0000-0000-0000-000000000001',
  company_id: 'c0000000-0000-0000-0000-000000000001',
  user_id: 'u0000000-0000-0000-0000-000000000001',
  user_name: 'Tariq Sulehri',
  user_email: 'tariq@example.com',
  action: 'DELETE',
  entity_name: 'Product',
  entity_id: 'PROD-1029',
  description: 'Deleted obsolete test SKU from inventory',
  details: { sku: 'SKU-OLD-99', reason: 'Discontinued' },
  ip_address: '192.168.1.10',
  created_at: '2026-10-29T14:00:00.000Z',
};

const mockStats: AuditLogStats = {
  metrics: {
    totalEvents: 42,
    activeUsers: 5,
    criticalActions: 3,
    todayEvents: 12,
    topEntity: 'Product',
  },
  dailyActivity: [
    { day: '2026-10-28', label: 'Oct 28', count: 4 },
    { day: '2026-10-29', label: 'Oct 29', count: 8 },
  ],
  byAction: [
    { action: 'UPDATE', count: 20, percentage: 48 },
    { action: 'CREATE', count: 15, percentage: 36 },
    { action: 'DELETE', count: 7, percentage: 16 },
  ],
  byEntity: [
    { entity: 'Product', count: 25, percentage: 60 },
    { entity: 'Voucher', count: 17, percentage: 40 },
  ],
  topUsers: [
    { userName: 'Tariq Sulehri', userEmail: 'tariq@example.com', count: 30, percentage: 71 },
    { userName: 'Sara Admin', userEmail: 'sara@example.com', count: 12, percentage: 29 },
  ],
  recentCritical: [
    {
      id: 'crit-1',
      company_id: 'c1',
      user_id: 'u1',
      action: 'DELETE',
      entity_name: 'Product',
      entity_id: 'PROD-1029',
      user_name: 'Tariq Sulehri',
      user_email: 'tariq@example.com',
      description: 'Deleted obsolete test SKU',
      details: null,
      created_at: '2026-10-29T14:00:00.000Z',
      ip_address: '192.168.1.10',
    },
  ],
};

describe('Audit helpers', () => {
  it('maps actions to expected semantic badge variants', () => {
    expect(actionBadgeVariant('CREATE')).toBe('success');
    expect(actionBadgeVariant('POST')).toBe('success');
    expect(actionBadgeVariant('UPDATE')).toBe('info');
    expect(actionBadgeVariant('DELETE')).toBe('danger');
    expect(actionBadgeVariant('VOID')).toBe('danger');
    expect(actionBadgeVariant('CANCEL')).toBe('danger');
    expect(actionBadgeVariant('REVERSE')).toBe('danger');
    expect(actionBadgeVariant('PASSWORD_RESET')).toBe('warning');
    expect(actionBadgeVariant('UNKNOWN')).toBe('neutral');
  });

  it('formats dates into readable strings', () => {
    const formatted = formatAuditDate('2026-10-29T14:00:00.000Z');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Oct');
  });
});

describe('AuditLogDetailDrawer', () => {
  it('renders structured log properties and details', () => {
    render(
      <AuditLogDetailDrawer
        log={mockLog}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Audit Log Details')).toBeInTheDocument();
    expect(screen.getByText('DELETE')).toBeInTheDocument();
    expect(screen.getByText('Tariq Sulehri')).toBeInTheDocument();
    expect(screen.getByText('tariq@example.com')).toBeInTheDocument();
    expect(screen.getByText('PROD-1029')).toBeInTheDocument();
    expect(screen.getByText('Deleted obsolete test SKU from inventory')).toBeInTheDocument();
    expect(screen.getByText('SKU-OLD-99')).toBeInTheDocument();
  });

  it('triggers onFilterUser callback when clicking user filter button', () => {
    const filterUser = jest.fn();
    const close = jest.fn();
    render(
      <AuditLogDetailDrawer
        log={mockLog}
        onClose={close}
        onFilterUser={filterUser}
      />
    );

    const userBtn = screen.getByText('Filter By This User');
    fireEvent.click(userBtn);
    expect(filterUser).toHaveBeenCalledWith('Tariq Sulehri');
    expect(close).toHaveBeenCalled();
  });
});

describe('AuditAnalyticsView', () => {
  it('renders all executive KPI metrics and active operators', () => {
    renderWithQuery(
      <AuditAnalyticsView
        stats={mockStats}
        onInspect={jest.fn()}
        onSwitchToExplorer={jest.fn()}
      />
    );

    expect(screen.getByText('Telemetry & Governance KPIs')).toBeInTheDocument();
    expect(screen.getByText('Total Events Logged')).toBeInTheDocument();
    expect(screen.getAllByText('42').length).toBeGreaterThan(0);
    expect(screen.getByText('Active Operators')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Sensitive Actions')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    expect(screen.getByText('24-Hour Velocity')).toBeInTheDocument();
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getByText('Primary Target Entity')).toBeInTheDocument();

    // Check operator leaderboard
    expect(screen.getByText('Most Active Operators')).toBeInTheDocument();
    expect(screen.getByText('Sara Admin')).toBeInTheDocument();

    // Check Four-Eyes Principle section
    expect(screen.getByText('Four-Eyes Principle Governance Intelligence')).toBeInTheDocument();
  });

  it('renders critical security event and allows inspection', () => {
    const onInspect = jest.fn();
    renderWithQuery(
      <AuditAnalyticsView
        stats={mockStats}
        onInspect={onInspect}
        onSwitchToExplorer={jest.fn()}
      />
    );

    expect(screen.getByText('Recent Security & Sensitive Operations')).toBeInTheDocument();
    expect(screen.getByText('Deleted obsolete test SKU')).toBeInTheDocument();

    const inspectBtns = screen.getAllByLabelText('Inspect Log');
    fireEvent.click(inspectBtns[0]);
    expect(onInspect).toHaveBeenCalled();
  });

  it('triggers onTileClick callback when clicking an interactive KPI tile', () => {
    const onTileClick = jest.fn();
    renderWithQuery(
      <AuditAnalyticsView
        stats={mockStats}
        onInspect={jest.fn()}
        onSwitchToExplorer={jest.fn()}
        onTileClick={onTileClick}
      />
    );

    const tile = screen.getByText('Sensitive Actions');
    fireEvent.click(tile);
    expect(onTileClick).toHaveBeenCalledWith(expect.objectContaining({
      tileId: 'sensitive-actions',
      category: 'deletions',
    }));
  });
});
