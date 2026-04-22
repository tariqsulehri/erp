'use client';

/**
 * VoucherEntryPage — three modes, QuickBooks-style:
 *
 *  LIST   → full-width dense table, max rows on screen
 *  CREATE → full work area form (table hidden), close returns to LIST
 *  DETAIL → right panel slides in alongside the table (read / post / void)
 */

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── types ──────────────────────────────────────────────────────────────── */
type VoucherType   = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN';
type VoucherStatus = 'Draft' | 'Posted' | 'Voided';
type PageMode      = 'list' | 'create' | 'detail';

interface LineRow {
  key:          number;
  account_id:   string;
  account_code: string;
  account_name: string;
  dr_amount:    string;
  cr_amount:    string;
  narration:    string;
}

/* ── voucher metadata ───────────────────────────────────────────────────── */
export const VOUCHER_META: Record<VoucherType, {
  label: string; shortLabel: string; color: string;
  primarySide: 'Dr' | 'Cr'; primaryLabel: string; desc: string;
  isBankCash: boolean;
}> = {
  BRV: { label: 'Bank Receipt Voucher',  shortLabel: 'Bank Receipt',  color: '#16a34a', primarySide: 'Dr', primaryLabel: 'Bank Account (Receiving)',  desc: 'Money received into the bank account',   isBankCash: true  },
  BPV: { label: 'Bank Payment Voucher',  shortLabel: 'Bank Payment',  color: '#dc2626', primarySide: 'Cr', primaryLabel: 'Bank Account (Paying)',      desc: 'Money paid out of the bank account',     isBankCash: true  },
  CRV: { label: 'Cash Receipt Voucher',  shortLabel: 'Cash Receipt',  color: '#0891b2', primarySide: 'Dr', primaryLabel: 'Cash Account (Receiving)',  desc: 'Cash received in hand',                  isBankCash: true  },
  CPV: { label: 'Cash Payment Voucher',  shortLabel: 'Cash Payment',  color: '#d97706', primarySide: 'Cr', primaryLabel: 'Cash Account (Paying)',     desc: 'Cash paid out of hand',                  isBankCash: true  },
  JV:  { label: 'Journal Voucher',       shortLabel: 'Journal',       color: '#1d4ed8', primarySide: 'Dr', primaryLabel: '',                         desc: 'General / adjusting journal entry',      isBankCash: false },
  CV:  { label: 'Contra Voucher',        shortLabel: 'Contra',        color: '#7c3aed', primarySide: 'Dr', primaryLabel: '',                         desc: 'Cash ↔ Bank transfer',                   isBankCash: false },
  DN:  { label: 'Debit Note',            shortLabel: 'Debit Note',    color: '#b45309', primarySide: 'Dr', primaryLabel: '',                         desc: 'Debit memo to party',                    isBankCash: false },
  CN:  { label: 'Credit Note',           shortLabel: 'Credit Note',   color: '#6d28d9', primarySide: 'Cr', primaryLabel: '',                         desc: 'Credit memo to party',                   isBankCash: false },
};

/* ── helpers ────────────────────────────────────────────────────────────── */
const fmt   = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
const fmtN  = (n: string | number) => { const v = Number(n); return v ? v.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; };
const today = () => new Date().toISOString().slice(0, 10);
const blank = (k: number): LineRow => ({ key: k, account_id: '', account_code: '', account_name: '', dr_amount: '', cr_amount: '', narration: '' });

/* ── StatusBadge ────────────────────────────────────────────────────────── */
const S_STYLE: Record<VoucherStatus, { bg: string; color: string }> = {
  Draft:  { bg: '#f1f5f9', color: '#475569' },
  Posted: { bg: '#dcfce7', color: '#16a34a' },
  Voided: { bg: '#fee2e2', color: '#dc2626' },
};
function StatusBadge({ status }: { status: string }) {
  const s = S_STYLE[status as VoucherStatus] ?? S_STYLE.Draft;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 7px', borderRadius: 8,
      background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

/* ── TypeChip ───────────────────────────────────────────────────────────── */
function TypeChip({ type, size = 'sm' }: { type: string; size?: 'sm' | 'xs' }) {
  const m = VOUCHER_META[type as VoucherType];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontWeight: 800,
      fontSize: size === 'xs' ? '0.6rem' : '0.7rem',
      color: m?.color ?? '#475569',
      background: `${m?.color ?? '#475569'}1a`,
      padding: size === 'xs' ? '1px 5px' : '2px 7px',
      borderRadius: 4, border: `1px solid ${m?.color ?? '#475569'}30`,
    }}>{type}</span>
  );
}

/* ── AccountPicker ──────────────────────────────────────────────────────── */
function AccountPicker({ value, label, onSelect, autoFocus }: {
  value: string; label: string; onSelect: (id: string, code: string, name: string) => void; autoFocus?: boolean;
}) {
  const [q, setQ]       = useState(label);
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(label); }, [label]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);

  const { data } = trpc.accounts.list.useQuery(
    { page: 1, limit: 20, search: q, is_posting: true },
    { enabled: open && q.length >= 1 },
  );

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input ref={ref} className="form-input"
        style={{ fontSize: '0.75rem', padding: '3px 8px', height: 28, width: '100%' }}
        value={q} placeholder="Search account…"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
      />
      {open && (data?.data ?? []).length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, minWidth: 340,
          background: 'var(--color-surface)', border: '1.5px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 250, overflowY: 'auto',
        }}>
          {(data?.data ?? []).map((a: any) => (
            <div key={a.id}
              onMouseDown={() => { onSelect(a.id, a.code, a.name); setQ(`${a.code} — ${a.name}`); setOpen(false); }}
              style={{ padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', gap: 10, alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-table-row-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-primary)', minWidth: 40 }}>{a.code}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Amount input ───────────────────────────────────────────────────────── */
function AmtInput({ value, onChange, placeholder = '0.00', style: extraStyle }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <input className="form-input"
      style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600,
        fontSize: '0.8125rem', padding: '3px 8px', height: 28, ...extraStyle }}
      placeholder={placeholder} value={value}
      onFocus={e => e.target.select()}
      onChange={e => onChange(e.target.value)}
    />
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   CREATE FORM — full work-area mode
   ══════════════════════════════════════════════════════════════════════════ */
function CreateForm({ voucherType, onSaved, onCancel }: {
  voucherType: VoucherType; onSaved: (id: string) => void; onCancel: () => void;
}) {
  const utils = trpc.useUtils();
  const meta  = VOUCHER_META[voucherType];

  const [date,      setDate]      = useState(today());
  const [refNo,     setRefNo]     = useState('');
  const [narration, setNarration] = useState('');
  const [lines,     setLines]     = useState<LineRow[]>([blank(1), blank(2), blank(3)]);
  const [error,     setError]     = useState('');
  const [dateErr,   setDateErr]   = useState('');
  const nextKey = useRef(4);

  /* Fiscal date validation */
  const dateVal = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: new Date(date) }, { enabled: date.length === 10, retry: false },
  );
  useEffect(() => {
    if (date.length < 10) { setDateErr(''); return; }
    if (dateVal.isLoading) return;
    if (dateVal.error) { setDateErr(dateVal.error.message); return; }
    setDateErr(dateVal.data?.canPost ? '' : (dateVal.data?.reason ?? 'Outside open fiscal period'));
  }, [date, dateVal.data, dateVal.error, dateVal.isLoading]);

  /* Line helpers */
  const addLine    = () => setLines(ls => [...ls, blank(nextKey.current++)]);
  const removeLine = (key: number) => setLines(ls => ls.length > 2 ? ls.filter(l => l.key !== key) : ls);
  const upd        = (key: number, f: keyof LineRow, v: string) => setLines(ls => ls.map(l => l.key === key ? { ...l, [f]: v } : l));
  const pickAcc    = (key: number, id: string, code: string, name: string) => setLines(ls => ls.map(l => l.key === key ? { ...l, account_id: id, account_code: code, account_name: name } : l));

  /* For bank/cash: primary = line[0], contra = rest */
  const primaryLine = meta.isBankCash ? lines[0] : null;
  const contraLines = meta.isBankCash ? lines.slice(1) : lines;
  const contraDr    = contraLines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0);
  const contraCr    = contraLines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0);

  /* Auto-fill primary amount from contra total */
  useEffect(() => {
    if (!meta.isBankCash) return;
    const amt = meta.primarySide === 'Dr' ? contraCr : contraDr;
    if (amt > 0) {
      const s = amt.toFixed(2);
      setLines(ls => ls.map((l, i) => i !== 0 ? l : { ...l,
        dr_amount: meta.primarySide === 'Dr' ? s : '',
        cr_amount: meta.primarySide === 'Cr' ? s : '',
      }));
    }
  }, [contraDr, contraCr, meta.isBankCash, meta.primarySide]);

  /* Totals & balance */
  const totalDr  = lines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0);
  const totalCr  = lines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0);
  const diff     = Math.abs(totalDr - totalCr);
  const balanced = diff < 0.001 && totalDr > 0;

  /* Mutation */
  const createMut = trpc.vouchers.create.useMutation({
    onSuccess: v => { utils.vouchers.list.invalidate(); onSaved(v.id); },
    onError:   e => setError(e.message),
  });

  function save() {
    setError('');
    if (dateErr) { setError(dateErr); return; }
    const valid = lines.filter(l => l.account_id && (parseFloat(l.dr_amount) || parseFloat(l.cr_amount)));
    if (valid.length < 2) { setError('At least 2 account lines with amounts are required.'); return; }
    if (!balanced)        { setError(`Voucher is not balanced — Debit ${fmtN(totalDr) || '0.00'} ≠ Credit ${fmtN(totalCr) || '0.00'}`); return; }
    createMut.mutate({
      voucher_type: voucherType, voucher_date: date,
      reference: refNo || undefined, narration: narration || undefined,
      lines: valid.map((l, i) => ({
        account_id: l.account_id, account_code: l.account_code, account_name: l.account_name,
        dr_amount: parseFloat(l.dr_amount) || 0, cr_amount: parseFloat(l.cr_amount) || 0,
        narration: l.narration || undefined, line_no: i + 1,
      })),
    });
  }

  /* ── Column grid: Account | Dr | Cr | Note | Del ── */
  const COLS = '1fr 130px 130px 1fr 30px';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - var(--header-height))',
      background: 'var(--color-surface)',
    }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 24px',
        height: 52,
        background: meta.color,
        borderBottom: `2px solid ${meta.color}cc`,
        flexShrink: 0,
      }}>
        {/* Back button */}
        <button onClick={onCancel} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.30)',
          borderRadius: 'var(--radius)', color: '#fff', fontWeight: 700,
          fontSize: '0.8rem', padding: '4px 12px', cursor: 'pointer',
          transition: 'background var(--transition)',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to List
        </button>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.75rem', color: '#fff', background: 'rgba(255,255,255,0.20)', padding: '2px 8px', borderRadius: 4 }}>{voucherType}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>›</span>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#fff' }}>{meta.label}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>›</span>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'rgba(255,255,255,0.85)' }}>New Entry</span>
        </div>

        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.70)', fontStyle: 'italic' }}>{meta.desc}</span>
      </div>

      {/* ── Header fields row ── */}
      <div style={{
        padding: '12px 24px',
        background: `${meta.color}0d`,
        borderBottom: `1px solid ${meta.color}22`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 180px 1fr auto', gap: 16, alignItems: 'end' }}>

          {/* Date */}
          <div>
            <label style={LBL}>Date <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <input type="date" className="form-input" value={date} required
              style={{ borderColor: dateErr ? 'var(--color-danger)' : undefined }}
              onChange={e => setDate(e.target.value)}
            />
            {dateErr && <p style={{ fontSize: '0.6rem', color: 'var(--color-danger)', marginTop: 2 }}>⚠ {dateErr}</p>}
            {!dateErr && dateVal.data?.canPost && (
              <p style={{ fontSize: '0.6rem', color: 'var(--color-success)', marginTop: 2 }}>✓ {dateVal.data.period?.period_name}</p>
            )}
          </div>

          {/* Reference */}
          <div>
            <label style={LBL}>Reference / Cheque No.</label>
            <input className="form-input" value={refNo} placeholder="e.g. CHQ-001234"
              onChange={e => setRefNo(e.target.value)}
            />
          </div>

          {/* Narration */}
          <div>
            <label style={LBL}>Narration / Description</label>
            <input className="form-input" value={narration} placeholder="Brief description of this voucher…"
              onChange={e => setNarration(e.target.value)}
            />
          </div>

          {/* Balance indicator */}
          <div style={{ paddingBottom: 2 }}>
            {totalDr > 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3,
              }}>
                <span style={{
                  fontSize: '0.625rem', fontWeight: 800, padding: '3px 12px', borderRadius: 20,
                  background: balanced ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                  color:      balanced ? 'var(--color-success)'    : 'var(--color-danger)',
                  border:     `1.5px solid ${balanced ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {balanced ? '✓ Balanced' : `Diff: ${fmtN(diff)}`}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Dr {fmtN(totalDr) || '0.00'} / Cr {fmtN(totalCr) || '0.00'}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Enter amounts below</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Lines table — takes all remaining height ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Column header */}
        <div style={{
          display: 'grid', gridTemplateColumns: COLS,
          padding: '6px 24px', gap: 8,
          background: 'var(--color-table-head-bg)',
          borderBottom: '2px solid var(--color-panel-header-border)',
          fontSize: '0.625rem', fontWeight: 800,
          color: 'var(--color-table-head-text)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          flexShrink: 0,
        }}>
          <span>Account</span>
          <span style={{ textAlign: 'right' }}>Debit (Dr)</span>
          <span style={{ textAlign: 'right' }}>Credit (Cr)</span>
          <span>Line Narration</span>
          <span />
        </div>

        {/* Scrollable rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* Bank / Cash primary account row */}
          {meta.isBankCash && primaryLine && (
            <>
              <div style={{
                padding: '5px 24px',
                background: `${meta.color}10`,
                borderBottom: `1px solid ${meta.color}25`,
                fontSize: '0.65rem', fontWeight: 800,
                color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {meta.primaryLabel}
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: COLS,
                padding: '6px 24px', gap: 8, alignItems: 'center',
                background: `${meta.color}07`,
                borderBottom: `2px solid ${meta.color}20`,
              }}>
                <AccountPicker
                  value={primaryLine.account_id}
                  label={primaryLine.account_id ? `${primaryLine.account_code} — ${primaryLine.account_name}` : ''}
                  onSelect={(id, c, n) => pickAcc(primaryLine.key, id, c, n)}
                  autoFocus
                />
                <AmtInput value={primaryLine.dr_amount}
                  onChange={v => { upd(primaryLine.key, 'dr_amount', v); if (v) upd(primaryLine.key, 'cr_amount', ''); }} />
                <AmtInput value={primaryLine.cr_amount}
                  onChange={v => { upd(primaryLine.key, 'cr_amount', v); if (v) upd(primaryLine.key, 'dr_amount', ''); }} />
                <input className="form-input" value={primaryLine.narration} placeholder="Note…"
                  style={{ fontSize: '0.8rem', padding: '3px 8px', height: 28 }}
                  onChange={e => upd(primaryLine.key, 'narration', e.target.value)} />
                <span />
              </div>

              {/* Contra header */}
              <div style={{
                padding: '5px 24px',
                background: 'var(--color-table-head-bg)',
                borderBottom: '1px solid var(--color-panel-header-border)',
                fontSize: '0.625rem', fontWeight: 800,
                color: 'var(--color-table-head-text)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                Contra / Party Lines
              </div>
            </>
          )}

          {/* Contra / JV lines */}
          {contraLines.map((line, i) => (
            <div key={line.key} style={{
              display: 'grid', gridTemplateColumns: COLS,
              padding: '5px 24px', gap: 8, alignItems: 'center',
              borderBottom: '1px solid var(--color-border-subtle)',
              background: i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)',
            }}>
              <AccountPicker
                value={line.account_id}
                label={line.account_id ? `${line.account_code} — ${line.account_name}` : ''}
                onSelect={(id, c, n) => pickAcc(line.key, id, c, n)}
              />
              <AmtInput value={line.dr_amount}
                onChange={v => { upd(line.key, 'dr_amount', v); if (v) upd(line.key, 'cr_amount', ''); }} />
              <AmtInput value={line.cr_amount}
                onChange={v => { upd(line.key, 'cr_amount', v); if (v) upd(line.key, 'dr_amount', ''); }} />
              <input className="form-input" value={line.narration} placeholder="Optional note…"
                style={{ fontSize: '0.8rem', padding: '3px 8px', height: 28 }}
                onChange={e => upd(line.key, 'narration', e.target.value)} />
              <button onClick={() => removeLine(line.key)} style={{
                width: 26, height: 26, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 16, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transition: 'all var(--transition)',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-danger-bg)'; e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'var(--color-danger-border)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.color = 'var(--color-text-muted)'; e.currentTarget.style.borderColor = 'var(--color-border)'; }}
              >×</button>
            </div>
          ))}

          {/* Add line row */}
          <div style={{ padding: '8px 24px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <button onClick={addLine} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', border: '1.5px dashed var(--color-border)',
              borderRadius: 'var(--radius)', background: 'transparent',
              fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)',
              cursor: 'pointer', transition: 'all var(--transition)',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
              Add Line
            </button>
          </div>
        </div>

        {/* Totals footer — sticky */}
        <div style={{
          display: 'grid', gridTemplateColumns: COLS,
          padding: '10px 24px', gap: 8,
          background: 'var(--color-table-foot-bg)',
          borderTop: '2px solid var(--color-border)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center' }}>
            TOTALS
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9375rem', color: totalDr > 0 ? 'var(--color-debit)' : 'var(--color-text-muted)', paddingRight: 8 }}>
            {fmtN(totalDr) || '—'}
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9375rem', color: totalCr > 0 ? 'var(--color-credit)' : 'var(--color-text-muted)', paddingRight: 8 }}>
            {fmtN(totalCr) || '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {totalDr > 0 && !balanced && (
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-danger)' }}>
                Diff: {fmtN(diff)}
              </span>
            )}
          </div>
          <span />
        </div>
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div style={{
          padding: '8px 24px', flexShrink: 0,
          background: 'var(--color-danger-bg)',
          borderTop: '1.5px solid var(--color-danger-border)',
        }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--color-danger-text)', fontWeight: 600, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {/* ── Action footer ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 24px',
        background: 'var(--color-panel-footer-bg)',
        borderTop: '1.5px solid var(--color-panel-footer-border)',
        flexShrink: 0,
      }}>
        <button className="btn btn-primary"
          disabled={createMut.isPending || !!dateErr || dateVal.isLoading}
          onClick={save}
          style={{ background: meta.color, borderColor: meta.color, minWidth: 140 }}
        >
          {createMut.isPending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Saving…</>
            : <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v13a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save as Draft
              </>}
        </button>

        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>

        <div style={{ flex: 1 }} />

        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Voucher will be saved as <strong style={{ color: 'var(--color-text-secondary)' }}>Draft</strong> — you can post it from the list.
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   DETAIL PANEL — right slide-in, alongside the list
   ══════════════════════════════════════════════════════════════════════════ */
function DetailPanel({ id, onClose, onPosted, voucherType }: {
  id: string; onClose: () => void; onPosted?: () => void; voucherType: VoucherType;
}) {
  const utils = trpc.useUtils();
  const [voidReason, setVoidReason] = useState('');
  const [showVoid,   setShowVoid]   = useState(false);

  const { data: v, isLoading } = trpc.vouchers.getById.useQuery({ id });
  const postMut = trpc.vouchers.post.useMutation({
    onSuccess: () => { utils.vouchers.list.invalidate(); onPosted?.(); },
  });
  const voidMut = trpc.vouchers.void.useMutation({
    onSuccess: () => { utils.vouchers.list.invalidate(); setShowVoid(false); },
  });

  if (isLoading) return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 8 }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading…
    </div>
  );
  if (!v) return null;

  const meta    = VOUCHER_META[v.voucher_type as VoucherType] ?? VOUCHER_META[voucherType];
  const lines   = v.lines ?? [];
  const totalDr = lines.reduce((s: number, l: any) => s + parseFloat(l.dr_amount), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + parseFloat(l.cr_amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `3px solid ${meta.color}` }}>

      {/* Header */}
      <div style={{
        padding: '10px 16px', flexShrink: 0,
        background: meta.color,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 900, fontSize: '0.75rem', color: '#fff', background: 'rgba(255,255,255,0.22)', padding: '1px 7px', borderRadius: 4 }}>
              {v.voucher_type}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.875rem', color: '#fff' }}>
              {v.voucher_number}
            </span>
            <StatusBadge status={v.status} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.80)', margin: 0 }}>
            {fmt(v.voucher_date)}
            {v.reference && <> · <strong style={{ color: '#fff' }}>{v.reference}</strong></>}
            {v.narration  && <> · {v.narration}</>}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.30)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 8px', color: '#fff' }}>×</button>
      </div>

      {/* Lines table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead style={{ position: 'sticky', top: 0 }}>
            <tr style={{ background: 'var(--color-table-head-bg)' }}>
              {['#', 'Account', 'Debit', 'Credit', 'Note'].map((h, i) => (
                <th key={h} style={{
                  padding: '6px 12px', textAlign: i >= 2 && i <= 3 ? 'right' : 'left',
                  fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--color-table-head-text)',
                  borderBottom: '2px solid var(--color-panel-header-border)',
                  whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={l.id} style={{
                borderBottom: '1px solid var(--color-border-subtle)',
                background: i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)',
              }}>
                <td style={{ padding: '6px 12px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{l.line_no}</td>
                <td style={{ padding: '6px 12px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.7rem', color: 'var(--color-primary)', marginRight: 7 }}>{l.account_code}</span>
                  <span style={{ color: 'var(--color-text)' }}>{l.account_name}</span>
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: parseFloat(l.dr_amount) > 0 ? 'var(--color-debit)' : 'var(--color-text-muted)' }}>
                  {parseFloat(l.dr_amount) > 0 ? fmtN(l.dr_amount) : '—'}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: parseFloat(l.cr_amount) > 0 ? 'var(--color-credit)' : 'var(--color-text-muted)' }}>
                  {parseFloat(l.cr_amount) > 0 ? fmtN(l.cr_amount) : '—'}
                </td>
                <td style={{ padding: '6px 12px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{l.narration ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--color-table-foot-bg)', borderTop: '2px solid var(--color-border)' }}>
              <td colSpan={2} style={{ padding: '7px 12px', fontWeight: 800, fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>TOTAL</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-debit)' }}>{fmtN(totalDr)}</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-credit)' }}>{fmtN(totalCr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 16px', borderTop: '1.5px solid var(--color-panel-footer-border)',
        background: 'var(--color-panel-footer-bg)',
        display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {v.status === 'Draft' && (
          <>
            <button className="btn btn-primary btn-sm"
              style={{ background: meta.color, borderColor: meta.color }}
              disabled={postMut.isPending}
              onClick={() => postMut.mutate({ id: v.id })}
            >
              {postMut.isPending
                ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} /> Posting…</>
                : '✓ Post Voucher'}
            </button>
            {postMut.isError && (
              <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)' }}>{postMut.error.message}</span>
            )}
          </>
        )}

        {v.status === 'Posted' && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 700 }}>✓ Posted</span>
        )}

        {v.status !== 'Voided' && (
          showVoid ? (
            <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <input className="form-input"
                style={{ flex: 1, minWidth: 120, fontSize: '0.75rem', padding: '4px 8px', height: 30 }}
                placeholder="Reason for voiding…"
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
              />
              <button className="btn btn-danger btn-sm"
                disabled={!voidReason.trim() || voidMut.isPending}
                onClick={() => voidMut.mutate({ id: v.id, reason: voidReason })}
              >{voidMut.isPending ? 'Voiding…' : 'Confirm Void'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVoid(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setShowVoid(true)}
              style={{ marginLeft: 'auto', background: 'var(--color-danger-bg)', border: '1.5px solid var(--color-danger-border)', color: 'var(--color-danger-text)' }}
            >Void Voucher</button>
          )
        )}
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   VOUCHER LIST — full-width dense table
   ══════════════════════════════════════════════════════════════════════════ */
function VoucherList({ voucherType, selectedId, onSelect, onNewClick, detailOpen }: {
  voucherType: VoucherType;
  selectedId:  string | null;
  onSelect:    (id: string) => void;
  onNewClick:  () => void;
  detailOpen:  boolean;
}) {
  const meta = VOUCHER_META[voucherType];

  const [search,    setSearch]    = useState('');
  const [statusFlt, setStatusFlt] = useState<VoucherStatus | ''>('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');
  const [page,      setPage]      = useState(1);
  const LIMIT = 60;

  const { data, isLoading } = trpc.vouchers.list.useQuery({
    page, limit: LIMIT, voucher_type: voucherType,
    status:    statusFlt || undefined,
    search:    search    || undefined,
    date_from: dateFrom  || undefined,
    date_to:   dateTo    || undefined,
  }, { placeholderData: prev => prev });

  const rows  = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pages = data?.pagination?.pages ?? 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '8px 16px',
        background: 'var(--color-surface)',
        borderBottom: '1.5px solid var(--color-border)',
        flexShrink: 0,
      }}>
        {/* Type badge */}
        <TypeChip type={voucherType} size="sm" />
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-heading)' }}>{meta.label}</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', background: 'var(--color-border-subtle)', padding: '1px 8px', borderRadius: 10 }}>
          {total} record{total !== 1 ? 's' : ''}
        </span>

        <div style={{ flex: 1 }} />

        {/* Filters */}
        <input className="form-input" placeholder="Search no. / reference…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 10px', height: 32, width: 190 }}
        />
        <select className="form-select" value={statusFlt}
          onChange={e => { setStatusFlt(e.target.value as any); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 110 }}
        >
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Posted">Posted</option>
          <option value="Voided">Voided</option>
        </select>
        <input type="date" className="form-input" value={dateFrom} title="From date"
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 138 }}
        />
        <input type="date" className="form-input" value={dateTo} title="To date"
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          style={{ fontSize: '0.8rem', padding: '4px 8px', height: 32, width: 138 }}
        />

        <button className="btn btn-primary btn-sm"
          onClick={onNewClick}
          style={{ background: meta.color, borderColor: meta.color, paddingLeft: 14, paddingRight: 16 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          New {meta.shortLabel}
        </button>
      </div>

      {/* ── Table ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: detailOpen ? 78 : 88 }} />
            <col style={{ width: detailOpen ? 120 : 140 }} />
            <col style={{ width: detailOpen ? 90 : 110 }} />
            <col />
            <col style={{ width: detailOpen ? 105 : 125 }} />
            <col style={{ width: detailOpen ? 105 : 125 }} />
            <col style={{ width: 76 }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
            <tr style={{ background: 'var(--color-table-head-bg)', borderBottom: '2px solid var(--color-panel-header-border)' }}>
              {[
                { label: '#',          align: 'left'  },
                { label: 'Date',       align: 'left'  },
                { label: 'Voucher No.', align: 'left' },
                { label: 'Reference',  align: 'left'  },
                { label: 'Narration',  align: 'left'  },
                { label: 'Debit',      align: 'right' },
                { label: 'Credit',     align: 'right' },
                { label: 'Status',     align: 'center'},
              ].map(col => (
                <th key={col.label} style={{
                  padding: '7px 10px', textAlign: col.align as any,
                  fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
                  letterSpacing: '0.07em', color: 'var(--color-table-head-text)',
                  whiteSpace: 'nowrap',
                }}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> Loading vouchers…
                </div>
              </td></tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, fontSize: '0.9375rem' }}>
                  No {meta.shortLabel} vouchers yet
                </p>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: 16 }}>
                  Click <strong>New {meta.shortLabel}</strong> to create your first entry.
                </p>
                <button className="btn btn-primary btn-sm" onClick={onNewClick}
                  style={{ background: meta.color, borderColor: meta.color }}
                >
                  + New {meta.shortLabel}
                </button>
              </td></tr>
            )}
            {rows.map((v: any, i: number) => {
              const active = selectedId === v.id;
              const rowNum = (page - 1) * LIMIT + i + 1;
              return (
                <tr key={v.id}
                  onClick={() => onSelect(v.id)}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    background: active
                      ? `${meta.color}18`
                      : i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)',
                    cursor: 'pointer',
                    outline: active ? `2px solid ${meta.color}50` : 'none',
                    outlineOffset: -1,
                    transition: 'background var(--transition)',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-table-row-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = i % 2 === 0 ? 'var(--color-table-row-odd)' : 'var(--color-table-row-even)'; }}
                >
                  <td style={TD}><span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{rowNum}</span></td>
                  <td style={TD}><span style={{ color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmt(v.voucher_date)}</span></td>
                  <td style={TD}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.78rem', color: meta.color }}>
                      {v.voucher_number}
                    </span>
                  </td>
                  <td style={{ ...TD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
                    {v.reference ?? ''}
                  </td>
                  <td style={{ ...TD, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                    {v.narration ?? ''}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: parseFloat(v.total_debit) > 0 ? 'var(--color-debit)' : 'var(--color-text-muted)' }}>
                    {fmtN(v.total_debit) || '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: parseFloat(v.total_credit) > 0 ? 'var(--color-credit)' : 'var(--color-text-muted)' }}>
                    {fmtN(v.total_credit) || '—'}
                  </td>
                  <td style={{ ...TD, textAlign: 'center' }}>
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
        padding: '6px 16px',
        background: 'var(--color-panel-footer-bg)',
        borderTop: '1.5px solid var(--color-panel-footer-border)',
        flexShrink: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)',
      }}>
        <span>Page {page} of {pages} · {total} record{total !== 1 ? 's' : ''}</span>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={PG_BTN}>‹ Prev</button>
        <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={PG_BTN}>Next ›</button>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   PAGE ROOT — mode switcher
   ══════════════════════════════════════════════════════════════════════════ */
export default function VoucherEntryPage({ voucherType }: { voucherType: VoucherType }) {
  const [mode,       setMode]       = useState<PageMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function openCreate()         { setSelectedId(null); setMode('create'); }
  function openDetail(id: string) { setSelectedId(id); setMode('detail'); }
  function backToList()         { setMode('list'); }
  function handleSaved(id: string) { setSelectedId(id); setMode('detail'); }

  return (
    <div style={{ height: 'calc(100vh - var(--header-height))', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── CREATE MODE — full work area ── */}
      {mode === 'create' && (
        <CreateForm
          voucherType={voucherType}
          onSaved={handleSaved}
          onCancel={backToList}
        />
      )}

      {/* ── LIST + DETAIL MODE ── */}
      {mode !== 'create' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* List — full width in list mode, 57% in detail mode */}
          <div style={{
            flex: mode === 'detail' ? '0 0 57%' : '1',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            transition: 'flex 0.18s ease',
            borderRight: mode === 'detail' ? '1.5px solid var(--color-border)' : 'none',
          }}>
            <VoucherList
              voucherType={voucherType}
              selectedId={selectedId}
              onSelect={openDetail}
              onNewClick={openCreate}
              detailOpen={mode === 'detail'}
            />
          </div>

          {/* Detail panel — slides in on the right */}
          {mode === 'detail' && selectedId && (
            <div style={{ flex: '0 0 43%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <DetailPanel
                id={selectedId}
                voucherType={voucherType}
                onClose={() => { setSelectedId(null); setMode('list'); }}
                onPosted={() => {}}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── shared micro-styles ─────────────────────────────────────────────────── */
const LBL: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem', fontWeight: 700,
  color: 'var(--color-text-secondary)', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const TD: React.CSSProperties = { padding: '5px 10px', verticalAlign: 'middle', fontSize: '0.8rem' };
const PG_BTN: React.CSSProperties = {
  padding: '3px 12px', borderRadius: 'var(--radius-sm)',
  border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)',
};
