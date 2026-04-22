'use client';

/**
 * VoucherEntryPage — shared dense full-screen voucher entry component.
 *
 * Layout: full-width table (max rows on screen) + right slide-over form.
 *
 * Voucher type is locked to the prop passed from each individual page:
 *   BRV  Bank Receipt Voucher
 *   BPV  Bank Payment Voucher
 *   CRV  Cash Receipt Voucher
 *   CPV  Cash Payment Voucher
 *   JV   Journal Voucher
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';

/* ── types ─────────────────────────────────────────────────────────────── */
type VoucherType   = 'BRV' | 'BPV' | 'CRV' | 'CPV' | 'JV' | 'CV' | 'DN' | 'CN';
type VoucherStatus = 'Draft' | 'Posted' | 'Voided';

interface LineRow {
  key:          number;
  account_id:   string;
  account_code: string;
  account_name: string;
  dr_amount:    string;
  cr_amount:    string;
  narration:    string;
}

/* ── metadata ───────────────────────────────────────────────────────────── */
export const VOUCHER_META: Record<VoucherType, {
  label: string; shortLabel: string; color: string;
  icon: string; primarySide: 'Dr' | 'Cr'; primaryLabel: string; desc: string;
}> = {
  BRV: {
    label: 'Bank Receipt Voucher',  shortLabel: 'Bank Receipt',
    color: '#15803d', icon: '↙', primarySide: 'Dr',
    primaryLabel: 'Bank Account (Receiving)',
    desc: 'Money received into the bank account',
  },
  BPV: {
    label: 'Bank Payment Voucher',  shortLabel: 'Bank Payment',
    color: '#b91c1c', icon: '↗', primarySide: 'Cr',
    primaryLabel: 'Bank Account (Paying)',
    desc: 'Money paid out of the bank account',
  },
  CRV: {
    label: 'Cash Receipt Voucher',  shortLabel: 'Cash Receipt',
    color: '#0891b2', icon: '↙', primarySide: 'Dr',
    primaryLabel: 'Cash Account (Receiving)',
    desc: 'Cash received in hand',
  },
  CPV: {
    label: 'Cash Payment Voucher',  shortLabel: 'Cash Payment',
    color: '#d97706', icon: '↗', primarySide: 'Cr',
    primaryLabel: 'Cash Account (Paying)',
    desc: 'Cash paid out of hand',
  },
  JV: {
    label: 'Journal Voucher',       shortLabel: 'Journal',
    color: '#1d4ed8', icon: '⇄', primarySide: 'Dr',
    primaryLabel: '',
    desc: 'General / adjusting journal entry',
  },
  CV: {
    label: 'Contra Voucher',        shortLabel: 'Contra',
    color: '#7c3aed', icon: '↔', primarySide: 'Dr',
    primaryLabel: '',
    desc: 'Cash ↔ Bank transfer',
  },
  DN: {
    label: 'Debit Note',            shortLabel: 'Debit Note',
    color: '#b45309', icon: 'DN', primarySide: 'Dr',
    primaryLabel: '',
    desc: 'Debit memo to party',
  },
  CN: {
    label: 'Credit Note',           shortLabel: 'Credit Note',
    color: '#6d28d9', icon: 'CN', primarySide: 'Cr',
    primaryLabel: '',
    desc: 'Credit memo to party',
  },
};

/* ── helpers ────────────────────────────────────────────────────────────── */
function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}
function fmtAmt(n: string | number) {
  const num = Number(n);
  if (!num) return '';
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }
function emptyLine(key: number): LineRow {
  return { key, account_id: '', account_code: '', account_name: '', dr_amount: '', cr_amount: '', narration: '' };
}

/* ── StatusBadge ────────────────────────────────────────────────────────── */
const STATUS_STYLE: Record<VoucherStatus, { bg: string; color: string }> = {
  Draft:  { bg: '#f1f5f9', color: '#64748b' },
  Posted: { bg: '#dcfce7', color: '#16a34a' },
  Voided: { bg: '#fee2e2', color: '#dc2626' },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status as VoucherStatus] ?? STATUS_STYLE.Draft;
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 800, padding: '1px 6px', borderRadius: 8,
      background: s.bg, color: s.color, letterSpacing: '0.04em',
      textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

/* ── AccountPicker ──────────────────────────────────────────────────────── */
function AccountPicker({ value, label, onSelect, autoFocus = false }: {
  value: string; label: string;
  onSelect: (id: string, code: string, name: string) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ]       = useState(label);
  const [open, setOpen] = useState(false);
  const ref             = useRef<HTMLInputElement>(null);

  useEffect(() => { setQ(label); }, [label]);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);

  const { data } = trpc.accounts.list.useQuery(
    { page: 1, limit: 20, search: q, is_posting: true },
    { enabled: open && q.length >= 1 },
  );
  const accounts = data?.data ?? [];

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        ref={ref}
        className="form-input"
        style={{ fontSize: '0.75rem', padding: '2px 7px', height: 26, width: '100%' }}
        value={q}
        placeholder="Search account…"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
      />
      {open && accounts.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, minWidth: 320,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {accounts.map((a: any) => (
            <div
              key={a.id}
              onMouseDown={() => { onSelect(a.id, a.code, a.name); setQ(`${a.code} — ${a.name}`); setOpen(false); }}
              style={{
                padding: '6px 12px', cursor: 'pointer',
                borderBottom: '1px solid var(--color-border)',
                display: 'flex', gap: 10, alignItems: 'center',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel-list-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.75rem', color: 'var(--color-primary)', minWidth: 36 }}>{a.code}</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AmtInput — numeric cell that highlights on focus ──────────────────── */
function AmtInput({ value, onChange, onTab }: {
  value: string;
  onChange: (v: string) => void;
  onTab?: () => void;
}) {
  return (
    <input
      className="form-input"
      style={{
        textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem',
        padding: '2px 6px', height: 26, width: '100%',
        color: value ? 'var(--color-text)' : 'var(--color-text-light)',
      }}
      placeholder="0.00"
      value={value}
      onFocus={e => e.target.select()}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => e.key === 'Tab' && onTab?.()}
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VoucherForm — right slide-over
   ══════════════════════════════════════════════════════════════════════════ */
function VoucherForm({
  voucherType, onSaved, onCancel, editId,
}: {
  voucherType: VoucherType;
  onSaved: (id: string) => void;
  onCancel: () => void;
  editId?: string;
}) {
  const utils = trpc.useUtils();
  const meta  = VOUCHER_META[voucherType];

  const [date,      setDate]      = useState(today());
  const [ref,       setRef]       = useState('');
  const [narration, setNarration] = useState('');
  const [lines,     setLines]     = useState<LineRow[]>([emptyLine(1), emptyLine(2)]);
  const [error,     setError]     = useState('');
  const [dateErr,   setDateErr]   = useState('');
  const keyRef = useRef(3);

  /* Date validation */
  const dateVal = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: new Date(date) },
    { enabled: date.length === 10, retry: false },
  );
  useEffect(() => {
    if (!date || date.length < 10) { setDateErr(''); return; }
    if (dateVal.isLoading) return;
    if (dateVal.error) { setDateErr(dateVal.error.message); return; }
    setDateErr(dateVal.data?.canPost ? '' : (dateVal.data?.reason ?? 'Outside open fiscal period'));
  }, [date, dateVal.data, dateVal.error, dateVal.isLoading]);

  /* Line helpers */
  const addLine = () => {
    setLines(ls => [...ls, emptyLine(keyRef.current++)]);
  };
  const removeLine = (key: number) => {
    setLines(ls => ls.length > 2 ? ls.filter(l => l.key !== key) : ls);
  };
  const update = (key: number, field: keyof LineRow, val: string) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, [field]: val } : l));
  const selectAccount = (key: number, id: string, code: string, name: string) =>
    setLines(ls => ls.map(l => l.key === key ? { ...l, account_id: id, account_code: code, account_name: name } : l));

  /* For bank/cash types: auto-fill primary side amount from contra lines */
  const isBankCash = voucherType !== 'JV' && voucherType !== 'CV' && voucherType !== 'DN' && voucherType !== 'CN';
  const primaryLine = isBankCash ? lines[0] : null;
  const contraLines = isBankCash ? lines.slice(1) : lines;

  const contraDr = contraLines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0);
  const contraCr = contraLines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0);

  /* Auto-compute primary amount */
  useEffect(() => {
    if (!isBankCash) return;
    const contraAmt = meta.primarySide === 'Dr' ? contraCr : contraDr;
    if (contraAmt > 0) {
      const amtStr = contraAmt.toFixed(2);
      setLines(ls => ls.map((l, i) => i === 0
        ? { ...l,
            dr_amount: meta.primarySide === 'Dr' ? amtStr : '',
            cr_amount: meta.primarySide === 'Cr' ? amtStr : '',
          }
        : l
      ));
    }
  }, [contraDr, contraCr, isBankCash, meta.primarySide]);

  const totalDr  = lines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0);
  const totalCr  = lines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;

  const createMut = trpc.vouchers.create.useMutation({
    onSuccess: (v) => { utils.vouchers.list.invalidate(); onSaved(v.id); },
    onError:   (e) => setError(e.message),
  });

  function submit(asDraft: boolean) {
    setError('');
    if (dateErr) return setError(dateErr);
    const validLines = lines.filter(l => l.account_id && (parseFloat(l.dr_amount) || parseFloat(l.cr_amount)));
    if (validLines.length < 2) return setError('At least 2 account lines are required');
    if (!balanced) return setError(`Not balanced — Dr ${fmtAmt(totalDr) || '0.00'} ≠ Cr ${fmtAmt(totalCr) || '0.00'}`);
    createMut.mutate({
      voucher_type: voucherType,
      voucher_date: date,
      reference:    ref || undefined,
      narration:    narration || undefined,
      lines: validLines.map((l, i) => ({
        account_id:   l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        dr_amount:    parseFloat(l.dr_amount) || 0,
        cr_amount:    parseFloat(l.cr_amount) || 0,
        narration:    l.narration || undefined,
        line_no:      i + 1,
      })),
    });
  }

  /* ── Column widths for line grid ────────────────────────────────────── */
  const GRID = '1fr 82px 82px 1fr 22px';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      borderLeft: `3px solid ${meta.color}`,
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--color-border)',
        background: `${meta.color}0c`, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'monospace', fontWeight: 900, fontSize: '0.875rem',
              color: meta.color, background: `${meta.color}18`,
              padding: '1px 7px', borderRadius: 4, border: `1px solid ${meta.color}30`,
            }}>
              {voucherType}
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
              {meta.label}
            </span>
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{meta.desc}</p>
        </div>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-light)', padding: '0 4px' }}
        >×</button>
      </div>

      {/* Header fields */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 2fr', gap: 10 }}>
          {/* Date */}
          <div>
            <label style={lbl}>Date *</label>
            <input
              type="date" className="form-input" value={date} required
              style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28, borderColor: dateErr ? 'var(--color-danger)' : undefined }}
              onChange={e => setDate(e.target.value)}
            />
            {dateErr && <p style={{ fontSize: '0.6rem', color: 'var(--color-danger)', marginTop: 2 }}>⚠ {dateErr}</p>}
            {!dateErr && dateVal.data?.canPost && (
              <p style={{ fontSize: '0.6rem', color: 'var(--color-success)', marginTop: 2 }}>✓ {dateVal.data.period?.period_name}</p>
            )}
          </div>
          {/* Reference */}
          <div>
            <label style={lbl}>Reference</label>
            <input
              className="form-input" value={ref} placeholder="Cheque / invoice no."
              style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28 }}
              onChange={e => setRef(e.target.value)}
            />
          </div>
          {/* Narration */}
          <div>
            <label style={lbl}>Narration</label>
            <input
              className="form-input" value={narration} placeholder="Description…"
              style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28 }}
              onChange={e => setNarration(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Lines table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '5px 10px', gap: 4,
          background: 'var(--color-table-head-bg)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '0.06em', color: 'var(--color-text-muted)',
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span>Account</span>
          <span style={{ textAlign: 'right' }}>Debit</span>
          <span style={{ textAlign: 'right' }}>Credit</span>
          <span>Line Narration</span>
          <span />
        </div>

        {/* Primary account row (Bank / Cash types only) */}
        {isBankCash && primaryLine && (
          <>
            <div style={{
              padding: '3px 8px',
              background: `${meta.color}08`,
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.65rem', fontWeight: 800,
              color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {meta.primaryLabel}
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: GRID,
              padding: '4px 8px', gap: 4, alignItems: 'center',
              borderBottom: '2px solid var(--color-border)',
              background: `${meta.color}06`,
            }}>
              <AccountPicker
                value={primaryLine.account_id}
                label={primaryLine.account_id ? `${primaryLine.account_code} — ${primaryLine.account_name}` : ''}
                onSelect={(id, code, name) => selectAccount(primaryLine.key, id, code, name)}
                autoFocus
              />
              <AmtInput
                value={primaryLine.dr_amount}
                onChange={v => { update(primaryLine.key, 'dr_amount', v); if (v) update(primaryLine.key, 'cr_amount', ''); }}
              />
              <AmtInput
                value={primaryLine.cr_amount}
                onChange={v => { update(primaryLine.key, 'cr_amount', v); if (v) update(primaryLine.key, 'dr_amount', ''); }}
              />
              <input
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '2px 6px', height: 26 }}
                placeholder="Note…"
                value={primaryLine.narration}
                onChange={e => update(primaryLine.key, 'narration', e.target.value)}
              />
              <span />
            </div>

            {/* Contra lines header */}
            <div style={{
              padding: '3px 8px',
              background: 'var(--color-table-head-bg)',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.65rem', fontWeight: 800,
              color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Contra Lines
            </div>
          </>
        )}

        {/* Contra / Journal lines */}
        {contraLines.map((line, i) => (
          <div
            key={line.key}
            style={{
              display: 'grid', gridTemplateColumns: GRID,
              padding: '3px 8px', gap: 4, alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              background: i % 2 === 1 ? 'var(--color-border-subtle)' : 'transparent',
            }}
          >
            <AccountPicker
              value={line.account_id}
              label={line.account_id ? `${line.account_code} — ${line.account_name}` : ''}
              onSelect={(id, code, name) => selectAccount(line.key, id, code, name)}
            />
            <AmtInput
              value={line.dr_amount}
              onChange={v => { update(line.key, 'dr_amount', v); if (v) update(line.key, 'cr_amount', ''); }}
            />
            <AmtInput
              value={line.cr_amount}
              onChange={v => { update(line.key, 'cr_amount', v); if (v) update(line.key, 'dr_amount', ''); }}
            />
            <input
              className="form-input"
              style={{ fontSize: '0.75rem', padding: '2px 6px', height: 26 }}
              placeholder="Note…"
              value={line.narration}
              onChange={e => update(line.key, 'narration', e.target.value)}
            />
            <button
              type="button" onClick={() => removeLine(line.key)}
              style={{
                width: 20, height: 20, border: 'none', background: 'transparent',
                color: 'var(--color-text-light)', cursor: 'pointer', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3,
              }}
            >×</button>
          </div>
        ))}

        {/* Totals row */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '5px 8px', gap: 4,
          background: 'var(--color-table-foot-bg)',
          borderTop: '2px solid var(--color-border)',
          position: 'sticky', bottom: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button" onClick={addLine}
              style={{
                padding: '2px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)', background: 'transparent',
                fontSize: '0.6875rem', fontWeight: 600,
                color: 'var(--color-text-muted)', cursor: 'pointer',
              }}
            >+ Add Line</button>
            {totalDr > 0 && (
              <span style={{
                fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 8,
                background: balanced ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                color:      balanced ? 'var(--color-success)'    : 'var(--color-danger)',
                border:     `1px solid ${balanced ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
              }}>
                {balanced ? '✓ Balanced' : `Diff ${fmtAmt(Math.abs(totalDr - totalCr))}`}
              </span>
            )}
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: totalDr > 0 ? 'var(--color-text)' : 'var(--color-text-light)', paddingRight: 6 }}>
            {totalDr > 0 ? fmtAmt(totalDr) : '—'}
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: totalCr > 0 ? 'var(--color-text)' : 'var(--color-text-light)', paddingRight: 6 }}>
            {totalCr > 0 ? fmtAmt(totalCr) : '—'}
          </div>
          <span /><span />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '6px 14px', background: 'var(--color-danger-bg)', borderTop: '1px solid var(--color-danger-border)', flexShrink: 0 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 8, flexShrink: 0,
        background: 'var(--color-surface)',
      }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={createMut.isPending || !!dateErr}
          onClick={() => submit(true)}
          style={{ flex: 1 }}
        >
          {createMut.isPending
            ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Saving…</>
            : <>Save Draft</>}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VoucherDetail — right slide-over view
   ══════════════════════════════════════════════════════════════════════════ */
function VoucherDetail({ id, onClose, onPosted }: {
  id: string; onClose: () => void; onPosted?: () => void;
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
    <div style={{ padding: 20, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-text-muted)' }}>
      <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading…
    </div>
  );
  if (!v) return null;

  const meta   = VOUCHER_META[v.voucher_type as VoucherType];
  const lines  = v.lines ?? [];
  const totalDr = lines.reduce((s: number, l: any) => s + parseFloat(l.dr_amount), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + parseFloat(l.cr_amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `3px solid ${meta.color}` }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid var(--color-border)',
        background: `${meta.color}0c`, flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.875rem', color: meta.color, background: `${meta.color}18`, padding: '1px 7px', borderRadius: 4, border: `1px solid ${meta.color}30` }}>
              {v.voucher_type}
            </span>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.9rem', color: meta.color }}>{v.voucher_number}</span>
            <StatusBadge status={v.status} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
            {fmt(v.voucher_date)}
            {v.reference && <> · <strong style={{ color: 'var(--color-text)' }}>{v.reference}</strong></>}
            {v.narration && <> · {v.narration}</>}
          </p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--color-text-light)', padding: '0 4px' }}>×</button>
      </div>

      {/* Lines */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr style={{ background: 'var(--color-table-head-bg)', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>#</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Account</th>
              <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Debit</th>
              <th style={{ textAlign: 'right', padding: '5px 10px', fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Credit</th>
              <th style={{ textAlign: 'left', padding: '5px 10px', fontWeight: 800, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Note</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 1 ? 'var(--color-border-subtle)' : 'transparent' }}>
                <td style={{ padding: '4px 10px', color: 'var(--color-text-light)', fontFamily: 'monospace', fontSize: '0.7rem' }}>{l.line_no}</td>
                <td style={{ padding: '4px 10px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.7rem', color: 'var(--color-primary)', marginRight: 7 }}>{l.account_code}</span>
                  {l.account_name}
                </td>
                <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: parseFloat(l.dr_amount) > 0 ? 'var(--color-text)' : 'var(--color-text-light)' }}>
                  {parseFloat(l.dr_amount) > 0 ? fmtAmt(l.dr_amount) : '—'}
                </td>
                <td style={{ padding: '4px 10px', textAlign: 'right', fontFamily: 'monospace', color: parseFloat(l.cr_amount) > 0 ? 'var(--color-text)' : 'var(--color-text-light)' }}>
                  {parseFloat(l.cr_amount) > 0 ? fmtAmt(l.cr_amount) : '—'}
                </td>
                <td style={{ padding: '4px 10px', color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>{l.narration ?? ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-table-foot-bg)' }}>
              <td colSpan={2} style={{ padding: '5px 10px', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>TOTAL</td>
              <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{fmtAmt(totalDr)}</td>
              <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8125rem', color: 'var(--color-text)' }}>{fmtAmt(totalCr)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--color-border)',
        display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
        background: 'var(--color-surface)',
      }}>
        {v.status === 'Draft' && (
          <button
            className="btn btn-primary btn-sm"
            disabled={postMut.isPending}
            onClick={() => postMut.mutate({ id: v.id })}
          >
            {postMut.isPending
              ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> Posting…</>
              : '✓ Post Voucher'}
          </button>
        )}
        {postMut.isError && (
          <span style={{ fontSize: '0.7rem', color: 'var(--color-danger)' }}>{postMut.error.message}</span>
        )}

        {v.status !== 'Voided' && (
          showVoid ? (
            <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center' }}>
              <input
                className="form-input"
                style={{ flex: 1, fontSize: '0.75rem', padding: '3px 7px', height: 28 }}
                placeholder="Reason for voiding…"
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
              />
              <button
                className="btn btn-danger btn-sm"
                disabled={!voidReason.trim() || voidMut.isPending}
                onClick={() => voidMut.mutate({ id: v.id, reason: voidReason })}
              >Void</button>
              <button onClick={() => setShowVoid(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowVoid(true)}
              className="btn btn-sm"
              style={{ marginLeft: 'auto', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)' }}
            >Void</button>
          )
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   VoucherEntryPage — main export
   Dense full-width table + right slide-over
   ══════════════════════════════════════════════════════════════════════════ */
export default function VoucherEntryPage({ voucherType }: { voucherType: VoucherType }) {
  const meta = VOUCHER_META[voucherType];

  const [showForm,   setShowForm]   = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [statusFlt,  setStatusFlt]  = useState<VoucherStatus | ''>('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [page,       setPage]       = useState(1);
  const LIMIT = 50;

  const { data, isLoading, refetch } = trpc.vouchers.list.useQuery({
    page, limit: LIMIT,
    voucher_type: voucherType,
    status:       statusFlt   || undefined,
    search:       search      || undefined,
    date_from:    dateFrom    || undefined,
    date_to:      dateTo      || undefined,
  }, { placeholderData: prev => prev });

  const vouchers   = data?.data ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination?.pages ?? 1;

  function handleSaved(id: string) {
    setShowForm(false);
    setSelectedId(id);
  }

  function newVoucher() {
    setSelectedId(null);
    setShowForm(true);
  }

  const panelOpen = showForm || !!selectedId;
  /* When panel is open use 60/40 split; otherwise full width for table */
  const tableWidth = panelOpen ? '55%' : '100%';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - var(--header-height) - 2px)',
      overflow: 'hidden',
    }}>
      {/* ── Top toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 16px',
        background: 'var(--color-panel-header-bg)',
        borderBottom: '1px solid var(--color-panel-header-border)',
        flexShrink: 0,
      }}>
        {/* Type badge */}
        <span style={{
          fontFamily: 'monospace', fontWeight: 900, fontSize: '0.75rem',
          color: meta.color, background: `${meta.color}18`,
          padding: '2px 9px', borderRadius: 4, border: `1px solid ${meta.color}30`,
          flexShrink: 0,
        }}>{voucherType}</span>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)', flexShrink: 0 }}>
          {meta.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {pagination?.total ?? '—'} records
        </span>

        <div style={{ flex: 1 }} />

        {/* Filters */}
        <input
          className="form-input"
          placeholder="Search…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ fontSize: '0.75rem', padding: '3px 8px', height: 28, width: 160 }}
        />
        <select
          className="form-select"
          value={statusFlt}
          onChange={e => { setStatusFlt(e.target.value as any); setPage(1); }}
          style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28, width: 100 }}
        >
          <option value="">All Status</option>
          <option value="Draft">Draft</option>
          <option value="Posted">Posted</option>
          <option value="Voided">Voided</option>
        </select>
        <input
          type="date" className="form-input" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28, width: 130 }}
          title="From date"
        />
        <input
          type="date" className="form-input" value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          style={{ fontSize: '0.75rem', padding: '3px 7px', height: 28, width: 130 }}
          title="To date"
        />

        <button
          className="btn btn-primary btn-sm"
          onClick={newVoucher}
          style={{ flexShrink: 0, background: meta.color, borderColor: meta.color }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
          </svg>
          New {meta.shortLabel}
        </button>
      </div>

      {/* ── Body: table + slide-over ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Table area */}
        <div style={{ width: tableWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width 0.2s' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 90 }} />
                <col />
                <col style={{ width: 110 }} />
                <col style={{ width: 110 }} />
                <col style={{ width: 72 }} />
              </colgroup>
              <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <tr style={{ background: 'var(--color-table-head-bg)', borderBottom: '2px solid var(--color-border)' }}>
                  <th style={th}>#</th>
                  <th style={th}>Date</th>
                  <th style={th}>Voucher No.</th>
                  <th style={th}>Reference</th>
                  <th style={th}>Narration</th>
                  <th style={{ ...th, textAlign: 'right' }}>Debit</th>
                  <th style={{ ...th, textAlign: 'right' }}>Credit</th>
                  <th style={{ ...th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                        <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading…
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && vouchers.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                      <p style={{ fontWeight: 600, marginBottom: 4 }}>No {meta.shortLabel} vouchers found</p>
                      <p style={{ fontSize: '0.7rem' }}>Click <strong>New {meta.shortLabel}</strong> to create one</p>
                    </td>
                  </tr>
                )}
                {vouchers.map((v: any, i: number) => {
                  const isActive = selectedId === v.id;
                  const rowNum   = (page - 1) * LIMIT + i + 1;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => { setSelectedId(v.id); setShowForm(false); }}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        background: isActive
                          ? `${meta.color}14`
                          : i % 2 === 1 ? 'var(--color-border-subtle)' : 'transparent',
                        cursor: 'pointer',
                        outline: isActive ? `1px solid ${meta.color}40` : 'none',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-panel-list-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = i % 2 === 1 ? 'var(--color-border-subtle)' : 'transparent'; }}
                    >
                      <td style={td}><span style={{ color: 'var(--color-text-light)', fontFamily: 'monospace' }}>{rowNum}</span></td>
                      <td style={td}><span style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(v.voucher_date)}</span></td>
                      <td style={td}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.75rem', color: meta.color }}>
                          {v.voucher_number}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.reference ?? ''}
                      </td>
                      <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)' }}>
                        {v.narration ?? ''}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
                        {fmtAmt(v.total_debit)}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
                        {fmtAmt(v.total_credit)}
                      </td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <StatusBadge status={v.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end',
            padding: '5px 14px', borderTop: '1px solid var(--color-border)',
            background: 'var(--color-panel-header-bg)', flexShrink: 0, fontSize: '0.7rem',
            color: 'var(--color-text-muted)',
          }}>
            <span>Page {page} of {totalPages} · {pagination?.total ?? 0} records</span>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={pageBtn}>‹ Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={pageBtn}>Next ›</button>
          </div>
        </div>

        {/* Slide-over panel */}
        {panelOpen && (
          <div style={{
            width: '45%', borderLeft: '1px solid var(--color-border)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {showForm ? (
              <VoucherForm
                voucherType={voucherType}
                onSaved={handleSaved}
                onCancel={() => { setShowForm(false); }}
              />
            ) : selectedId ? (
              <VoucherDetail
                id={selectedId}
                onClose={() => setSelectedId(null)}
                onPosted={() => refetch()}
              />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── micro-styles ───────────────────────────────────────────────────────── */
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.6rem', fontWeight: 800,
  color: 'var(--color-text-muted)', marginBottom: 3,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};
const th: React.CSSProperties = {
  padding: '5px 10px', textAlign: 'left',
  fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--color-text-muted)',
  whiteSpace: 'nowrap',
};
const td: React.CSSProperties = {
  padding: '3px 10px', verticalAlign: 'middle', fontSize: '0.75rem',
};
const pageBtn: React.CSSProperties = {
  padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-border)',
  background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.7rem',
  color: 'var(--color-text)',
};
