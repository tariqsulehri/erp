'use client';

import { trpc } from '@/lib/trpc/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Colour palettes ──────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Asset: '#2563eb', Liability: '#dc2626', Equity: '#7c3aed',
  Revenue: '#16a34a', Expense: '#d97706',
};
const VOUCHER_TYPE_COLORS: Record<string, string> = {
  PV: '#6366f1', RV: '#10b981', JV: '#f59e0b',
  CV: '#3b82f6', DN: '#ef4444', CN: '#8b5cf6',
};
const VOUCHER_TYPE_LABELS: Record<string, string> = {
  PV: 'Payment', RV: 'Receipt', JV: 'Journal',
  CV: 'Contra',  DN: 'Debit Note', CN: 'Credit Note',
};
const STATUS_COLORS = { Posted: '#16a34a', Draft: '#d97706', Voided: '#6b7280' };

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

// ── Sub-components ───────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color = '#2563eb',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1.2 }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{sub}</span>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 12px' }}>
      {title}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function MonthlyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#6366f1' }}>Vouchers: {payload[0]?.value}</p>
      <p style={{ color: '#10b981' }}>Total: {fmtMoney(payload[1]?.value ?? 0)}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading, error } = trpc.dashboard.summary.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--color-text-secondary)' }}>
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: '#dc2626' }}>
        Error loading dashboard: {error.message}
      </div>
    );
  }

  if (!data) return null;

  const { accounts, vouchers, fiscalYear } = data;

  // Voucher status data for pie
  const statusData = [
    { name: 'Posted', value: vouchers.posted },
    { name: 'Draft',  value: vouchers.draft  },
    { name: 'Voided', value: vouchers.voided },
  ].filter(d => d.value > 0);

  // Account type data for pie
  const accountTypeData = accounts.byType.map(r => ({
    name: r.type,
    value: r.count,
  }));

  // Posted amount by voucher type
  const voucherTypeData = vouchers.byType.map(r => ({
    name: VOUCHER_TYPE_LABELS[r.type] ?? r.type,
    type: r.type,
    count: r.count,
    total: r.total,
  }));

  const fyPct = fiscalYear
    ? Math.round((fiscalYear.closedPeriods / (fiscalYear.totalPeriods || 1)) * 100)
    : 0;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
          {fiscalYear
            ? `Fiscal Year: ${fiscalYear.name} · ${fiscalYear.currentPeriod ? `Current period: ${fiscalYear.currentPeriod.name}` : 'No active period'}`
            : 'No active fiscal year'}
        </p>
      </div>

      {/* ── Row 1: KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        <KpiCard
          label="Total Accounts"
          value={accounts.total}
          sub={`${accounts.active} active · ${accounts.posting} posting`}
          color="#2563eb"
        />
        <KpiCard
          label="Posted Vouchers"
          value={vouchers.posted}
          sub={`of ${vouchers.total} total`}
          color="#16a34a"
        />
        <KpiCard
          label="Draft Vouchers"
          value={vouchers.draft}
          sub="Awaiting posting"
          color="#d97706"
        />
        <KpiCard
          label={fiscalYear ? fiscalYear.name : 'Fiscal Year'}
          value={fiscalYear ? fiscalYear.status : '—'}
          sub={fiscalYear
            ? `${fiscalYear.openPeriods} open · ${fiscalYear.closedPeriods} closed`
            : 'No active fiscal year'}
          color={fiscalYear?.status === 'open' ? '#16a34a' : '#6b7280'}
        />
      </div>

      {/* ── Row 2: Monthly volume (wide) + Voucher status pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 28 }}>
        {/* Monthly bar chart */}
        <Card>
          <SectionHeader title="Monthly Voucher Volume — Last 6 Months" />
          {vouchers.monthlyVolume.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No posted vouchers in the last 6 months
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={vouchers.monthlyVolume} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                <Tooltip content={<MonthlyTooltip />} />
                <Bar yAxisId="left"  dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Vouchers" />
                <Bar yAxisId="right" dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Amount" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Voucher status donut */}
        <Card style={{ display: 'flex', flexDirection: 'column' }}>
          <SectionHeader title="Voucher Status" />
          {statusData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No vouchers
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {statusData.map(entry => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name as keyof typeof STATUS_COLORS] ?? '#888'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : String(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {statusData.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[d.name as keyof typeof STATUS_COLORS] }} />
                      <span>{d.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 3: Accounts by type + Voucher types ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        {/* Accounts by type */}
        <Card>
          <SectionHeader title="Accounts by Type" />
          {accountTypeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>No accounts</div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={accountTypeData} dataKey="value" outerRadius={70} paddingAngle={2}>
                    {accountTypeData.map(entry => (
                      <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? '#888'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString() : String(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
                {accountTypeData.map(d => (
                  <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: TYPE_COLORS[d.name] ?? '#888' }} />
                      <span>{d.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{d.value}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
                        ({accounts.total > 0 ? Math.round((d.value / accounts.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                  <span>Total</span>
                  <span>{accounts.total}</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Voucher types bar chart */}
        <Card>
          <SectionHeader title="Posted Amount by Voucher Type" />
          {voucherTypeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>No posted vouchers</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={voucherTypeData} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => fmt(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={72} />
                <Tooltip formatter={(v: any) => fmtMoney(typeof v === 'number' ? v : parseFloat(v ?? '0'))} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {voucherTypeData.map(entry => (
                    <Cell key={entry.type} fill={VOUCHER_TYPE_COLORS[entry.type] ?? '#888'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Row 4: Recent vouchers + FY progress ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 28 }}>
        {/* Recent vouchers table */}
        <Card>
          <SectionHeader title="Recent Vouchers" />
          {vouchers.recent.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No vouchers yet
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Number', 'Type', 'Date', 'Narration', 'Amount', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.recent.map((v: any, i: number) => (
                  <tr key={v.id} style={{ borderBottom: i < vouchers.recent.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td style={{ padding: '8px 8px', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{v.voucher_number}</td>
                    <td style={{ padding: '8px 8px' }}>
                      <span style={{
                        background: (VOUCHER_TYPE_COLORS[v.voucher_type] ?? '#888') + '22',
                        color: VOUCHER_TYPE_COLORS[v.voucher_type] ?? '#888',
                        borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                      }}>
                        {v.voucher_type}
                      </span>
                    </td>
                    <td style={{ padding: '8px 8px', color: 'var(--color-text-secondary)' }}>
                      {new Date(v.voucher_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '8px 8px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.narration || <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmtMoney(parseFloat(v.total_debit ?? '0'))}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <span style={{
                        background: v.status === 'Posted' ? '#dcfce7' : v.status === 'Draft' ? '#fef9c3' : '#f3f4f6',
                        color:      v.status === 'Posted' ? '#16a34a' : v.status === 'Draft' ? '#a16207' : '#6b7280',
                        borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                      }}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Fiscal year progress */}
        <Card style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionHeader title="Fiscal Year Progress" />
          {!fiscalYear ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No active fiscal year
            </div>
          ) : (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{fiscalYear.name}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{fyPct}% complete</span>
                </div>
                <div style={{ background: 'var(--color-border)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#2563eb', height: '100%', width: `${fyPct}%`, borderRadius: 999, transition: 'width 0.4s' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Total Periods', value: fiscalYear.totalPeriods, color: '#2563eb' },
                  { label: 'Open Periods',  value: fiscalYear.openPeriods,  color: '#16a34a' },
                  { label: 'Closed',        value: fiscalYear.closedPeriods, color: '#6b7280' },
                  { label: 'Status',        value: fiscalYear.status,        color: fiscalYear.status === 'open' ? '#16a34a' : '#6b7280' },
                ].map(item => (
                  <div key={item.label} style={{ background: 'var(--color-bg)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {fiscalYear.currentPeriod && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Current Period</div>
                  <div style={{ fontWeight: 600, color: '#1e3a8a' }}>{fiscalYear.currentPeriod.name}</div>
                  <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>Status: {fiscalYear.currentPeriod.status}</div>
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 'auto' }}>
                {new Date(fiscalYear.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' — '}
                {new Date(fiscalYear.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 5: Account health summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <Card>
          <SectionHeader title="Account Health" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Accounts',    value: accounts.total,    pct: 100,                                      color: '#2563eb' },
              { label: 'Active',            value: accounts.active,   pct: accounts.total > 0 ? Math.round(accounts.active   / accounts.total * 100) : 0, color: '#16a34a' },
              { label: 'Inactive',          value: accounts.inactive, pct: accounts.total > 0 ? Math.round(accounts.inactive / accounts.total * 100) : 0, color: '#6b7280' },
              { label: 'Posting Accounts',  value: accounts.posting,  pct: accounts.total > 0 ? Math.round(accounts.posting  / accounts.total * 100) : 0, color: '#7c3aed' },
            ].map(row => (
              <div key={row.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 13 }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 600 }}>{row.value} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: 11 }}>({row.pct}%)</span></span>
                </div>
                <div style={{ background: 'var(--color-border)', borderRadius: 999, height: 5 }}>
                  <div style={{ background: row.color, width: `${row.pct}%`, height: '100%', borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Voucher Summary" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Total Vouchers', value: vouchers.total,  color: '#2563eb' },
              { label: 'Posted',         value: vouchers.posted, color: '#16a34a' },
              { label: 'Draft',          value: vouchers.draft,  color: '#d97706' },
              { label: 'Voided',         value: vouchers.voided, color: '#6b7280' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: row.color }} />
                  {row.label}
                </div>
                <span style={{ fontWeight: 700, color: row.color }}>{row.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Voucher Type Counts" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vouchers.byType.length === 0 ? (
              <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No posted vouchers</div>
            ) : vouchers.byType.map(r => (
              <div key={r.type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: (VOUCHER_TYPE_COLORS[r.type] ?? '#888') + '22',
                    color: VOUCHER_TYPE_COLORS[r.type] ?? '#888',
                    borderRadius: 4, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                  }}>{r.type}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{VOUCHER_TYPE_LABELS[r.type] ?? r.type}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600 }}>{r.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{fmt(r.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
