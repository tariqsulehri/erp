import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditReportWorkspace } from '@/components/audit-logs/AuditReportWorkspace';
import type { AuditLogRow, AuditLogStats } from '@/lib/api/audit';

// Mock hooks
const mockLog: AuditLogRow = {
  id: 'a0000000-0000-0000-0000-000000000001',
  company_id: 'c1',
  user_id: 'u1',
  user_name: 'Sara Admin',
  user_email: 'sara@example.com',
  action: 'APPROVE',
  entity_name: 'Voucher',
  entity_id: 'CPV-2026-001',
  description: 'Approved cash payment voucher',
  details: { amount: 15000 },
  ip_address: '10.0.0.1',
  created_at: '2026-10-30T10:00:00.000Z',
  four_eyes_verified: true,
  single_operator: false,
};

const mockStats: AuditLogStats = {
  metrics: {
    totalEvents: 434,
    activeUsers: 6,
    criticalActions: 3,
    todayEvents: 25,
    topEntity: 'Voucher',
  },
  dailyActivity: [
    { day: '2026-10-29', label: 'Oct 29', count: 48 },
    { day: '2026-10-30', label: 'Oct 30', count: 25 },
  ],
  byAction: [
    { action: 'APPROVE', count: 38, percentage: 9 },
    { action: 'CREATE', count: 340, percentage: 78 },
  ],
  byEntity: [
    { entity: 'Voucher', count: 180, percentage: 41 },
    { entity: 'Account', count: 151, percentage: 35 },
  ],
  topUsers: [
    { userName: 'Sara Admin', userEmail: 'sara@example.com', count: 210, percentage: 48 },
  ],
  recentCritical: [],
  fourEyesMetrics: {
    fourEyesVerifiedCount: 38,
    singleOperatorCount: 2,
    dualControlRate: 95,
  },
};

jest.mock('@/lib/api/audit', () => ({
  ...jest.requireActual('@/lib/api/audit'),
  useAuditLogs: jest.fn(() => ({
    data: {
      data: [mockLog],
      pagination: { total: 434, page: 1, limit: 50, pages: 9 },
    },
    isLoading: false,
    refetch: jest.fn(),
  })),
  useAuditLogStats: jest.fn(() => ({
    data: mockStats,
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

jest.mock('@/lib/api/settings', () => ({
  ...jest.requireActual('@/lib/api/settings'),
  useGeneralSettings: jest.fn(() => ({
    data: { dateFormat: 'DD/MM/YYYY', currency: 'PKR' },
  })),
  useCompanyProfile: jest.fn(() => ({
    data: { name: 'Calm Ledger Corp' },
  })),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('AuditReportWorkspace', () => {
  it('renders report header, count, and executive overview charts', () => {
    renderWithQuery(<AuditReportWorkspace />);

    expect(screen.getByText('Audit Trail Summary Report')).toBeInTheDocument();
    expect(screen.getByText('434 Records')).toBeInTheDocument();
    expect(screen.getByText('Executive Visual Overview · Audit Trail Summary Report')).toBeInTheDocument();
    expect(screen.getByText('Activity Velocity (14-Day Timeline)')).toBeInTheDocument();
    expect(screen.getByText('Action Type Distribution (Pie)')).toBeInTheDocument();
    expect(screen.getByText('Governance & Risk Radar')).toBeInTheDocument();
  });

  it('renders sub-tabs for multi-angle reporting when hideSubTabs is false', () => {
    renderWithQuery(<AuditReportWorkspace />);

    expect(screen.getByRole('tab', { name: /Audit Trail Summary/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Four-Eyes & Dual-Control/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /User Activity & Auth/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Sensitive Operations/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Module Mutations/i })).toBeInTheDocument();
  });

  it('hides sub-tabs when hideSubTabs prop is true', () => {
    renderWithQuery(<AuditReportWorkspace hideSubTabs />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('toggles overview panel visibility', () => {
    renderWithQuery(<AuditReportWorkspace />);

    const toggleBtn = screen.getByText('Hide Overview Panel');
    fireEvent.click(toggleBtn);

    expect(screen.queryByText('Activity Velocity (14-Day Timeline)')).not.toBeInTheDocument();
    expect(screen.getByText('Show Overview Panel')).toBeInTheDocument();
  });

  it('renders table rows with 4-Eyes badge and calls onInspectLog when clicked', () => {
    const onInspect = jest.fn();
    renderWithQuery(<AuditReportWorkspace onInspectLog={onInspect} />);

    expect(screen.getByText('LOG-a0000000')).toBeInTheDocument();
    expect(screen.getByText('Sara Admin')).toBeInTheDocument();
    expect(screen.getByText('4-Eyes Verified')).toBeInTheDocument();
    expect(screen.getByText('CPV-2026-001')).toBeInTheDocument();

    const row = screen.getByText('Sara Admin').closest('tr');
    if (row) fireEvent.click(row);
    expect(onInspect).toHaveBeenCalledWith(mockLog);
  });

  it('renders totals row summarizing all database records', () => {
    renderWithQuery(<AuditReportWorkspace />);

    expect(screen.getByText('Totals For All 434 Records')).toBeInTheDocument();
    expect(screen.getByText('38 Verified')).toBeInTheDocument();
    expect(screen.getByText('3 Sensitive Actions')).toBeInTheDocument();
  });
});
