'use client';

/**
 * Bank Module
 *
 * Tabs:
 *  Accounts        — Bank accounts registered in the system
 *  Post-Dated Cheques (PDC) — Received and issued PDCs with status tracking
 *  Reconciliation  — Bank reconciliation statement (match GL vs bank statement)
 */

import { useState } from 'react';
import { formatDate, formatMoney, normalizeFormatSettings, type AppFormatSettingsSource } from '@/lib/app-settings';
import { useGeneralSettings } from '@/lib/api/settings';

type Tab = 'accounts' | 'pdc' | 'reconciliation';
type PDCType = 'received' | 'issued';
type PDCStatus = 'Pending' | 'Deposited' | 'Matured' | 'Returned' | 'Cancelled';

/* ── Sample data (replace with tRPC queries once bank module is built) ── */
const SAMPLE_BANK_ACCOUNTS = [
  { id: '1', name: 'Main Operating Account', bank: 'HBL', branch: 'Main Branch', accountNo: '****-1234', balance: 2_450_000, is_active: true },
  { id: '2', name: 'Savings Account',        bank: 'MCB', branch: 'Gulberg',     accountNo: '****-5678', balance:   850_000, is_active: true },
  { id: '3', name: 'Payroll Account',        bank: 'UBL', branch: 'Defence',     accountNo: '****-9012', balance:   120_000, is_active: true },
];

const SAMPLE_PDCS = [
  { id: '1', type: 'received' as PDCType, chequeNo: 'MC-001234', party: 'ABC Trading Co.',    bank: 'MCB', amount: 350_000,  dueDate: '2026-04-15', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
  { id: '2', type: 'received' as PDCType, chequeNo: 'HBL-9876',  party: 'XYZ Suppliers Ltd', bank: 'HBL', amount: 120_000,  dueDate: '2026-04-02', status: 'Matured'   as PDCStatus, account: 'Main Operating Account' },
  { id: '3', type: 'received' as PDCType, chequeNo: 'UBL-5544',  party: 'National Services',  bank: 'UBL', amount:  85_000,  dueDate: '2026-03-20', status: 'Deposited' as PDCStatus, account: 'Main Operating Account' },
  { id: '4', type: 'received' as PDCType, chequeNo: 'ABL-3312',  party: 'Fast Logistics',     bank: 'ABL', amount:  45_000,  dueDate: '2026-03-10', status: 'Returned'  as PDCStatus, account: 'Main Operating Account' },
  { id: '5', type: 'issued'   as PDCType, chequeNo: 'HBL-00112', party: 'Office Rentals LLC', bank: 'HBL', amount: 210_000,  dueDate: '2026-04-30', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
  { id: '6', type: 'issued'   as PDCType, chequeNo: 'HBL-00113', party: 'Raw Material Corp',  bank: 'HBL', amount: 680_000,  dueDate: '2026-05-15', status: 'Pending'   as PDCStatus, account: 'Main Operating Account' },
];

const SAMPLE_RECON = [
  { id: '1', date: '2026-03-01', description: 'Customer Payment — ABC Trading',  gl_amount: 350_000,  bank_amount: 350_000,  cleared: true  },
  { id: '2', date: '2026-03-05', description: 'Supplier Payment — Raw Materials', gl_amount: -200_000, bank_amount: -200_000, cleared: true  },
  { id: '3', date: '2026-03-12', description: 'Cheque #HBL-8899 Deposit',         gl_amount: 120_000,  bank_amount: 120_000,  cleared: true  },
  { id: '4', date: '2026-03-18', description: 'Online Transfer — Payroll',         gl_amount: -450_000, bank_amount: -450_000, cleared: true  },
  { id: '5', date: '2026-03-22', description: 'PDC Deposit — XYZ Suppliers',       gl_amount: 85_000,   bank_amount: null,     cleared: false },
  { id: '6', date: '2026-03-25', description: 'Bank Charges — March',              gl_amount: null,     bank_amount: -1_800,   cleared: false },
  { id: '7', date: '2026-03-28', description: 'Interest Income — Savings',         gl_amount: null,     bank_amount: 3_200,    cleared: false },
];

/* ── Helpers ─────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<PDCStatus, { bg: string; color: string }> = {
  Pending:    { bg: '#fef3c7', color: '#92400e' },
  Deposited:  { bg: '#dcfce7', color: '#15803d' },
  Matured:    { bg: '#dbeafe', color: '#1d4ed8' },
  Returned:   { bg: '#fee2e2', color: '#b91c1c' },
  Cancelled:  { bg: '#f1f5f9', color: '#64748b' },
};

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date();
}

/* ── Bank Accounts Tab ───────────────────────────────────────────────── */
function BankAccountsTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const totalBalance = SAMPLE_BANK_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  const formatSettings = normalizeFormatSettings(settings);

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Bank Balance', value: formatMoney(totalBalance, settings), color: '#2563eb' },
          { label: 'Active Accounts',    value: SAMPLE_BANK_ACCOUNTS.filter(a => a.is_active).length, color: '#16a34a' },
          { label: 'Currency',           value: formatSettings.currencyCode, color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Account cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SAMPLE_BANK_ACCOUNTS.map(acct => (
          <div key={acct.id} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 20, boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10, background: '#dbeafe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2">
                <path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                <path d="M8 9V7a4 4 0 018 0v2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 2 }}>{acct.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                {acct.bank} · {acct.branch} · {acct.accountNo}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#2563eb' }}>
                {formatMoney(acct.balance, settings)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: acct.is_active ? '#16a34a' : '#94a3b8' }}>
                {acct.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
            <button style={{
              padding: '6px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-muted)',
            }}>
              Statement
            </button>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 16, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
        background: '#fffbeb', border: '1px solid #fde68a',
        fontSize: 'var(--font-size-xs)', color: '#92400e',
      }}>
        Bank accounts are linked to GL accounts in the Chart of Accounts (1110–1113).
        Live balance shown here is the GL balance. Bank reconciliation is available in the Reconciliation tab.
      </div>
    </div>
  );
}

/* ── PDC Tab ─────────────────────────────────────────────────────────── */
function PDCTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const [pdcType, setPdcType] = useState<'all' | PDCType>('all');
  const [statusFilter, setStatusFilter] = useState<PDCStatus | 'all'>('all');

  const filtered = SAMPLE_PDCS.filter(p => {
    if (pdcType !== 'all' && p.type !== pdcType) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const totalPending  = SAMPLE_PDCS.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const totalMatured  = SAMPLE_PDCS.filter(p => p.status === 'Matured').reduce((s, p) => s + p.amount, 0);
  const totalReturned = SAMPLE_PDCS.filter(p => p.status === 'Returned').reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Pending PDCs',   value: formatMoney(totalPending, settings),  count: SAMPLE_PDCS.filter(p=>p.status==='Pending').length,  color: '#d97706' },
          { label: 'Matured (Due)',  value: formatMoney(totalMatured, settings),  count: SAMPLE_PDCS.filter(p=>p.status==='Matured').length,  color: '#1d4ed8' },
          { label: 'Returned',       value: formatMoney(totalReturned, settings), count: SAMPLE_PDCS.filter(p=>p.status==='Returned').length, color: '#b91c1c' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {k.label}
              <span style={{ marginLeft: 6, fontSize: '0.6875rem', fontWeight: 700,
                background: `${k.color}15`, color: k.color, padding: '1px 6px', borderRadius: 10 }}>
                {k.count}
              </span>
            </div>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {/* Type toggle */}
        <div style={{ display: 'flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
          {(['all', 'received', 'issued'] as const).map(t => (
            <button key={t} onClick={() => setPdcType(t)} style={{
              padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 'var(--font-size-xs)', fontWeight: 600,
              background: pdcType === t ? 'var(--color-primary)' : 'var(--color-surface)',
              color: pdcType === t ? 'white' : 'var(--color-text-muted)',
            }}>
              {t === 'all' ? 'All' : t === 'received' ? 'Received' : 'Issued'}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as PDCStatus | 'all')}
          style={{
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--font-size-xs)', cursor: 'pointer',
          }}
        >
          <option value="all">All Statuses</option>
          {(['Pending', 'Matured', 'Deposited', 'Returned', 'Cancelled'] as PDCStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Type', 'Cheque No.', 'Party', 'Bank', 'Amount', 'Due Date', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '10px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((pdc, i) => {
              const overdue = pdc.status === 'Pending' && isOverdue(pdc.dueDate);
              const ss = STATUS_STYLE[pdc.status];
              return (
                <tr key={pdc.id} style={{
                  borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                  background: overdue ? '#fff7ed' : 'transparent',
                }}>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: pdc.type === 'received' ? '#dcfce7' : '#fee2e2',
                      color: pdc.type === 'received' ? '#15803d' : '#b91c1c',
                    }}>
                      {pdc.type === 'received' ? 'RCV' : 'ISS'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8125rem' }}>
                    {pdc.chequeNo}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    {pdc.party}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    {pdc.bank}
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>
                    {formatMoney(pdc.amount, settings)}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>
                    <span style={{ color: overdue ? '#b91c1c' : 'var(--color-text)' }}>
                      {formatDate(pdc.dueDate, settings)}
                    </span>
                    {overdue && (
                      <span style={{ marginLeft: 6, fontSize: '0.625rem', fontWeight: 700,
                        background: '#fee2e2', color: '#b91c1c', padding: '1px 5px', borderRadius: 3 }}>
                        OVERDUE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                      background: ss.bg, color: ss.color,
                    }}>
                      {pdc.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {pdc.status === 'Pending' && (
                        <>
                          <button style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                            borderRadius: 4, border: '1px solid #16a34a', background: 'transparent',
                            color: '#16a34a', cursor: 'pointer',
                          }}>
                            Deposit
                          </button>
                          <button style={{
                            padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                            borderRadius: 4, border: '1px solid #b91c1c', background: 'transparent',
                            color: '#b91c1c', cursor: 'pointer',
                          }}>
                            Return
                          </button>
                        </>
                      )}
                      {pdc.status === 'Matured' && (
                        <button style={{
                          padding: '3px 10px', fontSize: '0.6875rem', fontWeight: 600,
                          borderRadius: 4, border: '1px solid #1d4ed8', background: 'transparent',
                          color: '#1d4ed8', cursor: 'pointer',
                        }}>
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No PDCs match the selected filters.
          </div>
        )}
      </div>

      <div style={{
        marginTop: 12, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 'var(--font-size-xs)', color: '#1e40af',
      }}>
        PDC workflow: Received cheque is recorded and held until due date (Pending → Matured → Deposited or Returned).
        Issued cheques are tracked as liabilities until cleared by the bank.
        Full journal entries will post automatically once the voucher module is live.
      </div>
    </div>
  );
}

/* ── Reconciliation Tab ──────────────────────────────────────────────── */
function ReconciliationTab({ settings }: { settings?: AppFormatSettingsSource | null }) {
  const [period, setPeriod] = useState('2026-03');

  const cleared   = SAMPLE_RECON.filter(r => r.cleared);
  const uncleared = SAMPLE_RECON.filter(r => !r.cleared);

  const glBalance     = SAMPLE_RECON.reduce((s, r) => s + (r.gl_amount ?? 0), 0);
  const bankBalance   = SAMPLE_RECON.reduce((s, r) => s + (r.bank_amount ?? 0), 0);
  const difference    = glBalance - bankBalance;

  return (
    <div>
      {/* Header controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Bank Account
          </label>
          <select style={{
            padding: '7px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 'var(--font-size-sm)',
          }}>
            {SAMPLE_BANK_ACCOUNTS.map(a => <option key={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Period
          </label>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-sm)',
            }}
          />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)',
            border: 'none', background: 'var(--color-primary)', color: 'white',
            fontWeight: 600, fontSize: 'var(--font-size-sm)', cursor: 'pointer',
          }}>
            Load Statement
          </button>
        </div>
      </div>

      {/* Summary boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'GL Book Balance',   value: glBalance,   color: '#2563eb' },
          { label: 'Bank Statement Bal',value: bankBalance, color: '#16a34a' },
          { label: 'Difference',        value: difference,  color: Math.abs(difference) < 0.01 ? '#16a34a' : '#b91c1c' },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: `1px solid ${Math.abs(difference) < 0.01 || k.label !== 'Difference' ? 'var(--color-border)' : '#fca5a5'}`,
            borderRadius: 'var(--radius)', padding: '16px 20px', boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: k.color }}>
              {formatMoney(Math.abs(k.value), settings)}
              {k.value < 0 && <span style={{ fontSize: '0.75rem', marginLeft: 4 }}>(Cr)</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Uncleared items */}
      <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
        Uncleared Items
        <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 600,
          background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10 }}>
          {uncleared.length}
        </span>
      </h3>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Date', 'Description', 'GL Amount', 'Bank Amount', 'Action'].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uncleared.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: i < uncleared.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {formatDate(row.date, settings)}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>{row.description}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: row.gl_amount ? (row.gl_amount > 0 ? '#16a34a' : '#b91c1c') : '#94a3b8' }}>
                  {row.gl_amount != null ? `${row.gl_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.gl_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: row.bank_amount ? (row.bank_amount > 0 ? '#16a34a' : '#b91c1c') : '#94a3b8' }}>
                  {row.bank_amount != null ? `${row.bank_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.bank_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <button style={{
                    padding: '3px 12px', fontSize: '0.6875rem', fontWeight: 600,
                    borderRadius: 4, border: '1px solid #16a34a', background: 'transparent',
                    color: '#16a34a', cursor: 'pointer',
                  }}>
                    Match
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cleared items */}
      <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 10 }}>
        Cleared Items
        <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 600,
          background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: 10 }}>
          {cleared.length}
        </span>
      </h3>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
              {['Date', 'Description', 'GL Amount', 'Bank Amount', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 'var(--font-size-xs)', fontWeight: 600,
                  color: 'var(--color-text-muted)', letterSpacing: 0,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cleared.map((row, i) => (
              <tr key={row.id} style={{ borderBottom: i < cleared.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  {formatDate(row.date, settings)}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)' }}>{row.description}</td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: (row.gl_amount ?? 0) > 0 ? '#16a34a' : '#b91c1c' }}>
                  {row.gl_amount != null ? `${row.gl_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.gl_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.8125rem',
                  color: (row.bank_amount ?? 0) > 0 ? '#16a34a' : '#b91c1c' }}>
                  {row.bank_amount != null ? `${row.bank_amount > 0 ? '+' : ''}${formatMoney(Math.abs(row.bank_amount), settings)}` : '—'}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: '#dcfce7', color: '#15803d' }}>
                    Cleared
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{
        marginTop: 12, padding: '10px 16px', borderRadius: 'var(--radius-sm)',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        fontSize: 'var(--font-size-xs)', color: '#1e40af',
      }}>
        Bank reconciliation matches GL transactions against the imported bank statement.
        Unmatched GL items = outstanding cheques. Unmatched bank items = timing differences or errors.
        Full statement import (CSV/MT940) will be available once the voucher module is complete.
      </div>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function BankPage() {
  const [activeTab, setActiveTab] = useState<Tab>('accounts');
  const { data: generalSettings } = useGeneralSettings();

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'accounts',       label: 'Bank Accounts',      icon: 'M3 9a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM8 9V7a4 4 0 018 0v2' },
    { id: 'pdc',            label: 'Post-Dated Cheques', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: 'reconciliation', label: 'Reconciliation',     icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bank</h1>
          <p className="page-subtitle">Bank accounts, post-dated cheques, and reconciliation</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'pdc' && (
            <button className="btn btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              New PDC
            </button>
          )}
          {activeTab === 'accounts' && (
            <button className="btn btn-primary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              Add Bank Account
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--color-border)',
        marginBottom: 24,
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 20px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 'var(--font-size-sm)', fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: -2,
              transition: 'var(--transition)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d={tab.icon}/>
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'accounts'       && <BankAccountsTab settings={generalSettings} />}
      {activeTab === 'pdc'            && <PDCTab settings={generalSettings} />}
      {activeTab === 'reconciliation' && <ReconciliationTab settings={generalSettings} />}
    </div>
  );
}
