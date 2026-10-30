import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutiveAiWorkspace } from '@/components/executive-ai/ExecutiveAiWorkspace';
import { ExecutiveAiDrawer } from '@/components/executive-ai/ExecutiveAiDrawer';
import { AppHeader } from '@/components/shell/AppHeader';
import type { ExecutiveBriefingResponse, ExecutiveAiQueryResponse } from '@/lib/api/executive-ai';

// Mock executive-ai api hooks
const mockBriefing: ExecutiveBriefingResponse = {
  generatedAt: '2026-10-30T10:00:00.000Z',
  healthScore: 84,
  healthStatus: 'optimal',
  executiveSummary:
    'Enterprise Financial Health is OPTIMAL (Index: 84/100). Generating positive Net Profit of PKR 450,000.00 with healthy liquidity cover.',
  kpis: {
    cashAndBank: {
      label: 'Cash & Bank Reserves',
      value: '1,250,000.00',
      status: 'optimal',
      hint: 'Immediate liquid assets',
    },
    revenueYtd: {
      label: 'Revenue (YTD)',
      value: '5,800,000.00',
      status: 'optimal',
    },
    netProfitYtd: {
      label: 'Net Profit (YTD)',
      value: '450,000.00',
      status: 'optimal',
    },
    grossMargin: {
      label: 'Gross Margin',
      value: '32.5%',
      status: 'optimal',
    },
    receivables: {
      label: 'Total Receivables (AR)',
      value: '620,000.00',
      overdueAmount: '75,000.00',
      overdueRatio: '12.1%',
      status: 'optimal',
    },
    payables: {
      label: 'Supplier Payables (AP)',
      value: '380,000.00',
      status: 'neutral',
    },
    stockValuation: {
      label: 'Inventory Valuation',
      value: '2,100,000.00',
      lowStockCount: 2,
      zeroStockCount: 0,
      status: 'optimal',
    },
    internalControl: {
      unpostedVouchersCount: 2,
      unpostedVouchersTotal: '45,000.00',
      dualControlRate: 92,
      pendingApprovalsCount: 1,
    },
  },
  criticalAlerts: [],
  strategicSuggestions: [
    {
      id: 'sug-1',
      priority: 'medium',
      title: 'Targeted Stock Reordering',
      detail: 'Reorder 2 items approaching safety stock.',
      impact: 'Avoid missed sales opportunities.',
      category: 'inventory',
    },
  ],
};

const mockQueryResponse: ExecutiveAiQueryResponse = {
  question: 'What is our current cash and bank balance breakdown?',
  intent: 'LIQUIDITY_AND_TREASURY',
  answer: 'Total enterprise liquid reserves stand at **1,250,000.00** across operating bank accounts.',
  status: 'optimal',
  keyMetrics: [
    { label: 'Total Liquid Funds', value: '1,250,000.00', status: 'optimal' },
    { label: 'Trade Payables Due', value: '380,000.00', status: 'neutral' },
  ],
  tableData: {
    title: 'Live Bank Accounts & Ledger Balances',
    columns: [
      { key: 'bank_name', label: 'Bank Name', align: 'left' },
      { key: 'balance', label: 'Balance', align: 'right' },
    ],
    rows: [{ bank_name: 'Habib Bank Ltd', balance: '1,250,000.00' }],
  },
  actionableSuggestions: ['Maintain liquidity cushion above PKR 500,000.'],
  followUpQuestions: ['Which customers owe us overdue payments?'],
};

const mockMutate = jest.fn();

jest.mock('@/lib/api/executive-ai', () => ({
  useExecutiveBriefing: () => ({
    data: mockBriefing,
    isLoading: false,
    refetch: jest.fn(),
    isFetching: false,
  }),
  useExecutiveAiQueryMutation: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Executive AI Workspace & Copilot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it('renders executive KPI pulse bar and summary narrative from real data', () => {
    renderWithQuery(<ExecutiveAiWorkspace />);

    expect(screen.getByText('Executive AI Intelligence')).toBeInTheDocument();
    expect(screen.getByText(/Health Index 84\/100/i)).toBeInTheDocument();
    expect(screen.getByText('1,250,000.00')).toBeInTheDocument();
    expect(screen.getByText('450,000.00')).toBeInTheDocument();
    expect(screen.getByText(/Enterprise Financial Health is OPTIMAL/i)).toBeInTheDocument();
  });

  it('renders suggested executive inquiry prompt pills', () => {
    renderWithQuery(<ExecutiveAiWorkspace />);

    expect(screen.getByText('Treasury & Liquidity')).toBeInTheDocument();
    expect(screen.getByText('Debtors & AR')).toBeInTheDocument();
    expect(screen.getByText('Stock & Inventory')).toBeInTheDocument();
    expect(screen.getByText('Governance & Risk')).toBeInTheDocument();
  });

  it('triggers mutation when typing and submitting a query', () => {
    renderWithQuery(<ExecutiveAiWorkspace />);

    const input = screen.getByPlaceholderText(/Ask anything about financial health/i);
    fireEvent.change(input, { target: { value: 'How is our business performing?' } });

    const askButton = screen.getByRole('button', { name: /ask/i });
    fireEvent.click(askButton);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      { question: 'How is our business performing?' },
      expect.any(Object)
    );
  });

  it('triggers mutation on clicking a prompt pill', () => {
    renderWithQuery(<ExecutiveAiWorkspace />);

    const pill = screen.getByText('Treasury & Liquidity');
    fireEvent.click(pill);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      { question: 'What is our current cash and bank balance breakdown?' },
      expect.any(Object)
    );
  });

  it('renders ExecutiveAiDrawer when open is true', () => {
    const handleClose = jest.fn();
    renderWithQuery(<ExecutiveAiDrawer open={true} onClose={handleClose} />);

    expect(screen.getByText('Executive AI Assistant')).toBeInTheDocument();
  });

  it('displays Executive AI launcher in AppHeader for admin role and opens drawer', () => {
    const adminUser = {
      id: 'usr-admin',
      role: 'admin' as const,
      accessLevel: 'ALL_BRANCHES' as const,
      name: 'Executive Admin',
      email: 'admin@company.com',
      branch: null,
      warehouse: null,
      companies: ['comp-1'],
      currentCompanyId: 'comp-1',
    };

    renderWithQuery(
      <AppHeader
        pageLabel="Dashboard"
        user={adminUser}
        onOpenMenu={jest.fn()}
      />
    );

    const execBtn = screen.getByRole('button', { name: /executive ai/i });
    expect(execBtn).toBeInTheDocument();

    fireEvent.click(execBtn);
    expect(screen.getByText('Executive AI Assistant')).toBeInTheDocument();
  });

  it('hides Executive AI launcher in AppHeader for non-manager roles', () => {
    const staffUser = {
      id: 'usr-staff',
      role: 'sales_staff' as const,
      accessLevel: 'BRANCH' as const,
      name: 'Sales Person',
      email: 'sales@company.com',
      branch: { id: 'br-1', code: 'BR-1', name: 'Karachi Branch' },
      warehouse: null,
      companies: ['comp-1'],
      currentCompanyId: 'comp-1',
    };

    renderWithQuery(
      <AppHeader
        pageLabel="Sales"
        user={staffUser}
        onOpenMenu={jest.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /executive ai/i })).not.toBeInTheDocument();
  });
});
