'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fiscalYearsQueryKey,
  useCloseFiscalPeriod,
  useCreateFiscalYear,
  useFiscalPeriods,
  useFiscalYearsList,
  useLockFiscalPeriod,
  useLockFiscalYear,
  type CreateFiscalYearInput,
  type FiscalPeriodItem,
  type FiscalYearItem,
} from '@/lib/api/fiscal-years';
import { useGeneralSettings } from '@/lib/api/settings';
import { formatDate, type AppFormatSettingsSource } from '@/lib/app-settings';

type FiscalYear   = FiscalYearItem;
type FiscalPeriod = FiscalPeriodItem;

/* ── helpers ─────────────────────────────────────────────────────────── */
function fmt(d: string | Date, settings?: AppFormatSettingsSource | null) {
  return formatDate(d, settings);
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:     { bg: '#dcfce7', color: '#15803d' },
  closing:  { bg: '#fef3c7', color: '#92400e' },
  closed:   { bg: '#fee2e2', color: '#b91c1c' },
  archived: { bg: '#f1f5f9', color: '#64748b' },
};

const PERIOD_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:   { bg: '#dcfce7', color: '#15803d' },
  locked: { bg: '#fef3c7', color: '#92400e' },
  closed: { bg: '#fee2e2', color: '#b91c1c' },
};

/* ── Create Fiscal Year form ─────────────────────────────────────────── */
function CreateFYForm({ onCreated }: { onCreated: () => void }) {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    fiscal_year:         '',
    year_basis:          'calendar' as 'calendar' | 'july' | 'april',
    start_date:          '',
    end_date:            '',
    number_of_periods:   12,
    posting_cutoff_days: 5,
  });
  const [error, setError] = useState('');

  const createMutation = useCreateFiscalYear();

  function createFiscalYear(payload: CreateFiscalYearInput) {
    createMutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
        onCreated();
      },
      onError: (error) => setError(error.message),
    });
  }

  // The backend owns fiscal-year overlap and period validation.

  /* Auto-fill dates when year_basis or fiscal_year changes */
  function applyBasis(basis: typeof form.year_basis, fy: string) {
    const year = parseInt(fy, 10);
    if (!year || year < 2000 || year > 2100) return;
    if (basis === 'calendar') {
      setForm(f => ({ ...f, start_date: `${year}-01-01`, end_date: `${year}-12-31` }));
    } else if (basis === 'july') {
      setForm(f => ({ ...f, start_date: `${year}-07-01`, end_date: `${year + 1}-06-30` }));
    } else if (basis === 'april') {
      setForm(f => ({ ...f, start_date: `${year}-04-01`, end_date: `${year + 1}-03-31` }));
    }
  }

  function handleBasis(basis: typeof form.year_basis) {
    setForm(f => ({ ...f, year_basis: basis }));
    applyBasis(basis, form.fiscal_year);
  }

  function handleFY(fy: string) {
    setForm(f => ({ ...f, fiscal_year: fy }));
    applyBasis(form.year_basis, fy);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.fiscal_year) return setError('Fiscal year identifier is required');
    if (!form.start_date || !form.end_date) return setError('Start and end dates are required');
    createFiscalYear({
      fiscal_year:         form.fiscal_year,
      year_basis:          form.year_basis,
      start_date:          form.start_date,
      end_date:            form.end_date,
      number_of_periods:   form.number_of_periods,
      posting_cutoff_days: form.posting_cutoff_days,
    });
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Fiscal Year Name */}
        <div>
          <label style={labelStyle}>Fiscal Year Identifier *</label>
          <input
            className="form-input"
            placeholder="e.g. 2026 or 2026-2027"
            value={form.fiscal_year}
            onChange={e => handleFY(e.target.value)}
            required
          />
          <p style={hintStyle}>Human-readable label used in reports</p>
        </div>

        {/* Year Basis */}
        <div>
          <label style={labelStyle}>Year Basis *</label>
          <select
            className="form-input"
            value={form.year_basis}
            onChange={e => handleBasis(e.target.value as any)}
          >
            <option value="calendar">Calendar Year  (Jan 1 – Dec 31)</option>
            <option value="july">July Basis  (Jul 1 – Jun 30)</option>
            <option value="april">April Basis  (Apr 1 – Mar 31)</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label style={labelStyle}>Start Date *</label>
          <input
            type="date" className="form-input"
            value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            required
          />
        </div>

        {/* End Date */}
        <div>
          <label style={labelStyle}>End Date *</label>
          <input
            type="date" className="form-input"
            value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            required
          />
        </div>

        {/* Number of Periods */}
        <div>
          <label style={labelStyle}>Number of Periods</label>
          <select
            className="form-input"
            value={form.number_of_periods}
            onChange={e => setForm(f => ({ ...f, number_of_periods: parseInt(e.target.value) }))}
          >
            <option value={12}>12 — Monthly</option>
            <option value={4}>4 — Quarterly</option>
            <option value={13}>13 — 4-week periods</option>
          </select>
        </div>

        {/* Posting Cutoff Days */}
        <div>
          <label style={labelStyle}>Posting Cutoff Days</label>
          <input
            type="number" className="form-input" min={0} max={60}
            value={form.posting_cutoff_days}
            onChange={e => setForm(f => ({ ...f, posting_cutoff_days: parseInt(e.target.value) || 0 }))}
          />
          <p style={hintStyle}>Days after period end to allow late entries</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 6,
          color: '#b91c1c', fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
          {createMutation.isPending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Creating…</>
            : 'Create Fiscal Year'}
        </button>
      </div>
    </form>
  );
}

/* ── Periods panel ──────────────────────────────────────────────────── */
function PeriodsPanel({ fyId, fyStatus, settings }: { fyId: string; fyStatus: string; settings?: AppFormatSettingsSource | null }) {
  const queryClient = useQueryClient();
  const { data: periods, isLoading } = useFiscalPeriods(fyId);
  const lockPeriodMut = useLockFiscalPeriod();
  const closePeriodMut = useCloseFiscalPeriod();

  function refreshPeriods() {
    queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });
  }

  if (isLoading) return <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>Loading periods…</div>;
  if (!periods?.length) return <div style={{ padding: 20, color: 'var(--color-text-muted)' }}>No periods found.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
        <thead>
          <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--color-border)' }}>
            {['#', 'Period', 'Start', 'End', 'Status', 'Transactions', 'Actions'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                fontSize: 'var(--font-size-xs)', fontWeight: 700,
                color: 'var(--color-text-muted)', letterSpacing: 0,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p: FiscalPeriod, i: number) => {
            const ss = PERIOD_STATUS_STYLE[p.status] ?? PERIOD_STATUS_STYLE.open;
            const isLast = i === periods.length - 1;
            const busy = lockPeriodMut.isPending || closePeriodMut.isPending;
            return (
              <tr key={p.id} style={{ borderBottom: isLast ? 'none' : '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  {p.period_number}
                </td>
                <td style={{ padding: '8px 12px', fontWeight: 500 }}>{p.period_name}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                  {fmt(p.start_date, settings)}
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                  {fmt(p.end_date, settings)}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: ss.bg, color: ss.color,
                  }}>{p.status}</span>
                </td>
                <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>
                  {p.transaction_count ?? 0}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {p.status === 'open' && fyStatus !== 'closed' && (
                      <button
                        disabled={busy}
                        onClick={() => lockPeriodMut.mutate({ id: p.id }, { onSuccess: refreshPeriods })}
                        style={actionBtnStyle('#92400e', '#fef3c7')}
                      >Lock</button>
                    )}
                    {p.status === 'locked' && fyStatus !== 'closed' && (
                      <button
                        disabled={busy}
                        onClick={() => closePeriodMut.mutate({ id: p.id }, { onSuccess: refreshPeriods })}
                        style={actionBtnStyle('#b91c1c', '#fee2e2')}
                      >Close</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Fiscal Year card ────────────────────────────────────────────────── */
function FYCard({ fy, onRefresh, settings }: { fy: FiscalYear; onRefresh: () => void; settings?: AppFormatSettingsSource | null }) {
  const [expanded, setExpanded] = useState(false);
  const lockMut = useLockFiscalYear();

  const ss = STATUS_STYLE[fy.status] ?? STATUS_STYLE.open;

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${fy.is_active ? 'var(--color-primary)' : 'var(--color-border)'}`,
      borderRadius: 'var(--radius)',
      overflow: 'hidden',
      boxShadow: fy.is_active ? '0 0 0 2px var(--color-primary)20' : 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 20px',
        background: fy.is_active ? 'var(--color-primary)05' : 'transparent',
        borderBottom: expanded ? '1px solid var(--color-border)' : 'none',
      }}>
        {/* Year badge */}
        <div style={{
          fontWeight: 800, fontSize: '1.125rem', fontFamily: 'monospace',
          color: fy.is_active ? 'var(--color-primary)' : 'var(--color-text)',
          minWidth: 80,
        }}>
          {fy.fiscal_year}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
          {fy.is_active && (
            <span style={{
              fontSize: '0.625rem', fontWeight: 800, letterSpacing: '0.06em',
              background: 'var(--color-primary)', color: 'white',
              padding: '2px 8px', borderRadius: 10,  }}>Active</span>
          )}
          <span style={{
            fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
            background: ss.bg, color: ss.color,
          }}>{fy.status}</span>
          {fy.is_locked && (
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: '#f1f5f9', color: '#64748b',
            }}>🔒 Locked</span>
          )}
        </div>

        {/* Meta */}
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>
          <div>{fmt(fy.start_date, settings)} — {fmt(fy.end_date, settings)}</div>
          <div>{fy.number_of_periods} periods · {fy.transaction_count} transactions</div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {fy.status === 'open' && !fy.is_locked && (
            <button
              onClick={() => lockMut.mutate({ id: fy.id }, { onSuccess: onRefresh })}
              disabled={lockMut.isPending}
              style={actionBtnStyle('#b91c1c', '#fee2e2')}
            >
              Lock Year
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
              fontSize: 'var(--font-size-xs)', fontWeight: 600, cursor: 'pointer',
              color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            {expanded ? 'Hide' : 'Periods'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Periods table */}
      {expanded && <PeriodsPanel fyId={fy.id} fyStatus={fy.status} settings={settings} />}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function FiscalYearPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useFiscalYearsList({ page: 1, limit: 50 });
  const { data: generalSettings } = useGeneralSettings();
  const years: FiscalYear[] = data?.data ?? [];
  const refreshFiscalYears = () => queryClient.invalidateQueries({ queryKey: fiscalYearsQueryKey });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fiscal Year</h1>
          <p className="page-subtitle">Manage accounting years and period close procedures</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(f => !f)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
          </svg>
          {showForm ? 'Cancel' : 'New Fiscal Year'}
        </button>
      </div>

      {/* Create form card */}
      {showForm && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-primary)40',
          borderRadius: 'var(--radius)', padding: 24, marginBottom: 24,
          boxShadow: '0 0 0 2px var(--color-primary)10',
        }}>
          <h3 style={{ fontWeight: 700, marginBottom: 20, color: 'var(--color-text)', fontSize: 'var(--font-size-base)' }}>
            Create New Fiscal Year
          </h3>
          <CreateFYForm onCreated={() => setShowForm(false)} />
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Loading fiscal years…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: 8, color: '#b91c1c', marginBottom: 16 }}>
          {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && years.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60,
          background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius)',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"
            style={{ marginBottom: 16 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
          </svg>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>No fiscal years yet</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 20 }}>
            Create your first fiscal year to start tracking accounting periods.
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Create Fiscal Year
          </button>
        </div>
      )}

      {/* Year cards */}
      {years.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {years.map(fy => (
            <FYCard key={fy.id} fy={fy} onRefresh={refreshFiscalYears} settings={generalSettings} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Shared micro-styles ─────────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 'var(--font-size-xs)',
  fontWeight: 700, color: 'var(--color-text-muted)',
  marginBottom: 6, letterSpacing: 0,
};
const hintStyle: React.CSSProperties = {
  fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4,
};
function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    padding: '3px 12px', fontSize: '0.6875rem', fontWeight: 700,
    borderRadius: 4, border: `1px solid ${color}`,
    background: 'transparent', color, cursor: 'pointer',
  };
}
