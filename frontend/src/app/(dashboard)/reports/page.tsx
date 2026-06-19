'use client';

const REPORTS = [
  {
    category: 'Financial Statements',
    items: [
      { title: 'Trial Balance',         desc: 'Debit/credit totals for all accounts at a given date', icon: 'M3 3h18M3 9h18M3 15h18M3 21h18', status: 'soon' },
      { title: 'Balance Sheet',         desc: 'Assets, Liabilities and Equity at period end',         icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', status: 'soon' },
      { title: 'Income Statement',      desc: 'Revenue, COGS and Expenses for the period',            icon: 'M18 20V10M12 20V4M6 20v-6', status: 'soon' },
      { title: 'Cash Flow Statement',   desc: 'Operating, investing and financing activities',         icon: 'M12 2v20M2 12h20', status: 'soon' },
    ],
  },
  {
    category: 'Ledger Reports',
    items: [
      { title: 'General Ledger',        desc: 'All transactions by account for a date range',          icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', status: 'soon' },
      { title: 'Account Statement',     desc: 'Transaction history for a single account',              icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', status: 'soon' },
      { title: 'Chart of Accounts',     desc: 'Printable full COA with balances',                     icon: 'M4 6h16M4 12h16M4 18h7', status: 'soon' },
    ],
  },
  {
    category: 'Bank Reports',
    items: [
      { title: 'Bank Reconciliation',   desc: 'Cleared and uncleared transactions vs bank statement',  icon: 'M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z', status: 'soon' },
      { title: 'PDC Schedule',          desc: 'Upcoming post-dated cheques by maturity date',          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', status: 'soon' },
    ],
  },
];

export default function ReportsPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Financial statements, ledger reports and bank reports</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, marginTop: 8 }}>
        {REPORTS.map((section) => (
          <div key={section.category}>
            <h2 style={{
              fontSize: 'var(--font-size-sm)', fontWeight: 700, letterSpacing: 0, color: 'var(--color-text-muted)', marginBottom: 12,
            }}>
              {section.category}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {section.items.map((r) => (
                <div key={r.title} style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: '18px 20px',
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  opacity: 0.75,
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <div style={{
                    flexShrink: 0, width: 36, height: 36, borderRadius: 8,
                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8">
                      <path d={r.icon}/>
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                        {r.title}
                      </span>
                      <span style={{
                        fontSize: '0.625rem', fontWeight: 700, letterSpacing: 0, padding: '1px 6px', borderRadius: 4,
                        background: '#fef3c7', color: '#92400e',
                      }}>Soon</span>
                    </div>
                    <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                      {r.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
