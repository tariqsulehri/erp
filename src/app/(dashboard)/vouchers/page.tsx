'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc/client';

type VoucherType   = 'PV' | 'RV' | 'JV' | 'CV' | 'DN' | 'CN';
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

/* ── constants ──────────────────────────────────────────────────────── */
const VOUCHER_TYPES: { value: VoucherType; label: string; desc: string; color: string }[] = [
  { value: 'PV', label: 'Payment',     desc: 'Cash/bank payment out', color: '#b91c1c' },
  { value: 'RV', label: 'Receipt',     desc: 'Cash/bank receipt in',  color: '#15803d' },
  { value: 'JV', label: 'Journal',     desc: 'General journal entry', color: '#1d4ed8' },
  { value: 'CV', label: 'Contra',      desc: 'Cash ↔ Bank transfer',  color: '#7c3aed' },
  { value: 'DN', label: 'Debit Note',  desc: 'Debit memo to party',   color: '#b45309' },
  { value: 'CN', label: 'Credit Note', desc: 'Credit memo to party',  color: '#0891b2' },
];

const STATUS_STYLE: Record<VoucherStatus, { bg: string; color: string; border: string }> = {
  Draft:  { bg: 'var(--color-border-subtle)', color: 'var(--color-text-secondary)', border: 'var(--color-border)' },
  Posted: { bg: 'var(--color-success-bg)',    color: 'var(--color-success)',         border: 'var(--color-success-border)' },
  Voided: { bg: 'var(--color-danger-bg)',     color: 'var(--color-danger)',          border: 'var(--color-danger-border)' },
};

function fmt(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtAmt(n: string | number) {
  return Number(n).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }

/* ── Status badge ────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status as VoucherStatus] ?? STATUS_STYLE.Draft;
  return (
    <span style={{
      fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      flexShrink: 0,
    }}>
      {status}
    </span>
  );
}

/* ── Type chip ────────────────────────────────────────────────────── */
function TypeChip({ type, size = 'sm' }: { type: string; size?: 'sm' | 'xs' }) {
  const vt = VOUCHER_TYPES.find(v => v.value === type);
  const color = vt?.color ?? '#475569';
  return (
    <span style={{
      fontFamily: 'monospace', fontWeight: 800,
      fontSize: size === 'xs' ? '0.7rem' : '0.8125rem',
      color,
      background: `${color}18`,
      padding: size === 'xs' ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      border: `1px solid ${color}30`,
    }}>
      {type}
    </span>
  );
}

/* ── Account search dropdown ─────────────────────────────────────── */
function AccountPicker({ value, label, onSelect }: {
  value: string; label: string;
  onSelect: (id: string, code: string, name: string) => void;
}) {
  const [q,    setQ]    = useState(label);
  const [open, setOpen] = useState(false);

  const { data } = trpc.accounts.list.useQuery(
    { page: 1, limit: 20, search: q, is_posting: true },
    { enabled: open && q.length >= 1 },
  );
  const accounts = data?.data ?? [];

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="form-input"
        style={{ fontSize: 'var(--font-size-sm)' }}
        value={q}
        placeholder="Search account…"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
      />
      {open && accounts.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {accounts.map((a: any) => (
            <div
              key={a.id}
              onMouseDown={() => { onSelect(a.id, a.code, a.name); setQ(`${a.code} — ${a.name}`); setOpen(false); }}
              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 10, alignItems: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-panel-list-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-primary)', minWidth: 42 }}>{a.code}</span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Voucher form (create new) ───────────────────────────────────── */
function VoucherForm({ onSaved, onCancel }: { onSaved: (id: string) => void; onCancel: () => void }) {
  const utils = trpc.useUtils();
  const [type,      setType]      = useState<VoucherType>('JV');
  const [date,      setDate]      = useState(today());
  const [ref,       setRef]       = useState('');
  const [narration, setNarration] = useState('');
  const [lines,     setLines]     = useState<LineRow[]>([
    { key: 1, account_id: '', account_code: '', account_name: '', dr_amount: '', cr_amount: '', narration: '' },
    { key: 2, account_id: '', account_code: '', account_name: '', dr_amount: '', cr_amount: '', narration: '' },
  ]);
  const [error,   setError]   = useState('');
  const [dateErr, setDateErr] = useState('');

  const dateValidation = trpc.fiscalYear.validatePostingDate.useQuery(
    { date: new Date(date) },
    { enabled: date.length === 10, retry: false },
  );

  useEffect(() => {
    if (!date || date.length < 10) { setDateErr(''); return; }
    if (dateValidation.isLoading) return;
    if (dateValidation.error) {
      setDateErr(dateValidation.error.message);
    } else if (dateValidation.data && !dateValidation.data.canPost) {
      setDateErr(dateValidation.data.reason ?? 'Date is outside an open fiscal period');
    } else {
      setDateErr('');
    }
  }, [date, dateValidation.data, dateValidation.error, dateValidation.isLoading]);

  const nextKey = () => Math.max(...lines.map(l => l.key)) + 1;
  const addLine = () => setLines(ls => [...ls, { key: nextKey(), account_id: '', account_code: '', account_name: '', dr_amount: '', cr_amount: '', narration: '' }]);
  const removeLine = (key: number) => setLines(ls => ls.length > 2 ? ls.filter(l => l.key !== key) : ls);
  const updateLine = (key: number, field: keyof LineRow, val: string) => setLines(ls => ls.map(l => l.key === key ? { ...l, [field]: val } : l));
  const selectAccount = (key: number, id: string, code: string, name: string) => setLines(ls => ls.map(l => l.key === key ? { ...l, account_id: id, account_code: code, account_name: name } : l));

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.dr_amount) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.cr_amount) || 0), 0);
  const balanced = Math.abs(totalDr - totalCr) < 0.001 && totalDr > 0;

  const createMut = trpc.vouchers.create.useMutation({
    onSuccess: (v) => { utils.vouchers.list.invalidate(); onSaved(v.id); },
    onError:   (e) => setError(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (dateErr) return setError(dateErr);
    const validLines = lines.filter(l => l.account_id);
    if (validLines.length < 2) return setError('At least 2 account lines are required');
    if (!balanced) return setError(`Voucher is not balanced — Dr ${fmtAmt(totalDr)} ≠ Cr ${fmtAmt(totalCr)}`);
    createMut.mutate({
      voucher_type: type, voucher_date: date,
      reference: ref || undefined, narration: narration || undefined,
      lines: validLines.map((l, i) => ({
        account_id: l.account_id, account_code: l.account_code, account_name: l.account_name,
        dr_amount: parseFloat(l.dr_amount) || 0, cr_amount: parseFloat(l.cr_amount) || 0,
        narration: l.narration || undefined, line_no: i + 1,
      })),
    });
  }

  const vt = VOUCHER_TYPES.find(v => v.value === type)!;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Panel header */}
      <div className="pane-header" style={{ borderLeft: `4px solid ${vt.color}` }}>
        <div>
          <div className="pane-header-title">
            <TypeChip type={type} />
            New Voucher
          </div>
          <div className="pane-header-sub">{vt.desc}</div>
        </div>
        <button onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
      </div>

      <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '20px 22px' }}>

          {/* Voucher type selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Voucher Type</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {VOUCHER_TYPES.map(v => (
                <button
                  key={v.value} type="button" onClick={() => setType(v.value)}
                  style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: `1.5px solid ${type === v.value ? v.color : 'var(--color-border)'}`,
                    background: type === v.value ? `${v.color}12` : 'var(--color-input-bg)',
                    color: type === v.value ? v.color : 'var(--color-text-muted)',
                    fontWeight: 700, fontSize: '0.75rem', transition: 'var(--transition)',
                  }}
                >
                  {v.value} — {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Header fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 2fr', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input
                type="date" className="form-input" value={date} required
                onChange={e => setDate(e.target.value)}
                style={{ borderColor: dateErr ? 'var(--color-danger)' : undefined }}
              />
              {dateValidation.isLoading && date.length === 10 && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-light)', marginTop: 3 }}>Checking fiscal period…</p>
              )}
              {dateErr ? (
                <p style={{ fontSize: '0.6875rem', color: 'var(--color-danger)', marginTop: 3 }}>⚠ {dateErr}</p>
              ) : !dateValidation.isLoading && dateValidation.data?.canPost ? (
                <p style={{ fontSize: '0.6875rem', color: 'var(--color-success)', marginTop: 3 }}>✓ {dateValidation.data.period?.period_name}</p>
              ) : null}
            </div>
            <div>
              <label style={labelStyle}>Reference</label>
              <input className="form-input" placeholder="Cheque / Invoice no." value={ref} onChange={e => setRef(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Narration</label>
              <input className="form-input" placeholder="Description of this voucher" value={narration} onChange={e => setNarration(e.target.value)} />
            </div>
          </div>

          {/* Lines table */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Journal Lines</label>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 28px',
                background: 'var(--color-table-head-bg)',
                borderBottom: '2px solid var(--color-border)',
                padding: '7px 10px',
                fontSize: '0.6875rem', fontWeight: 700,
                color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <span>Account</span>
                <span style={{ textAlign: 'right' }}>Debit</span>
                <span style={{ textAlign: 'right' }}>Credit</span>
                <span>Line Narration</span>
                <span />
              </div>

              {/* Line rows */}
              {lines.map((line, i) => (
                <div
                  key={line.key}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 28px',
                    borderBottom: i < lines.length - 1 ? '1px solid var(--color-border)' : 'none',
                    padding: '6px 10px', alignItems: 'center',
                    background: i % 2 === 1 ? 'var(--color-border-subtle)' : 'transparent',
                  }}
                >
                  <AccountPicker
                    value={line.account_id}
                    label={line.account_id ? `${line.account_code} — ${line.account_name}` : ''}
                    onSelect={(id, code, name) => selectAccount(line.key, id, code, name)}
                  />
                  <input
                    className="form-input"
                    style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8125rem', margin: '0 4px' }}
                    placeholder="0.00" value={line.dr_amount}
                    onChange={e => { updateLine(line.key, 'dr_amount', e.target.value); if (e.target.value) updateLine(line.key, 'cr_amount', ''); }}
                  />
                  <input
                    className="form-input"
                    style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8125rem', margin: '0 4px' }}
                    placeholder="0.00" value={line.cr_amount}
                    onChange={e => { updateLine(line.key, 'cr_amount', e.target.value); if (e.target.value) updateLine(line.key, 'dr_amount', ''); }}
                  />
                  <input
                    className="form-input"
                    style={{ fontSize: '0.8125rem', margin: '0 4px' }}
                    placeholder="Line narration…" value={line.narration}
                    onChange={e => updateLine(line.key, 'narration', e.target.value)}
                  />
                  <button
                    type="button" onClick={() => removeLine(line.key)}
                    style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: 'var(--color-text-light)', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4 }}
                  >×</button>
                </div>
              ))}

              {/* Totals row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 100px 100px 1fr 28px',
                padding: '9px 10px',
                background: 'var(--color-table-foot-bg)',
                borderTop: '2px solid var(--color-border)',
              }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total
                </div>
                <div style={{ textAlign: 'right', margin: '0 4px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: totalDr > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {fmtAmt(totalDr)}
                </div>
                <div style={{ textAlign: 'right', margin: '0 4px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: totalCr > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                  {fmtAmt(totalCr)}
                </div>
                <div style={{ margin: '0 4px', display: 'flex', alignItems: 'center' }}>
                  {totalDr > 0 && (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 700, padding: '2px 10px', borderRadius: 10,
                      background: balanced ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                      color: balanced ? 'var(--color-success)' : 'var(--color-danger)',
                      border: `1px solid ${balanced ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
                    }}>
                      {balanced ? '✓ Balanced' : `Diff ${fmtAmt(Math.abs(totalDr - totalCr))}`}
                    </span>
                  )}
                </div>
                <span />
              </div>
            </div>

            <button
              type="button" onClick={addLine}
              style={{
                marginTop: 8, padding: '5px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--color-border)', background: 'transparent',
                fontSize: 'var(--font-size-xs)', fontWeight: 600,
                color: 'var(--color-text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              Add Line
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 0 }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="pane-footer">
          <button type="submit" className="btn btn-primary" disabled={createMut.isPending || !!dateErr || dateValidation.isLoading}>
            {createMut.isPending
              ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Saving…</>
              : 'Save as Draft'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

/* ── Voucher detail view ──────────────────────────────────────────── */
function VoucherDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [voidReason, setVoidReason] = useState('');
  const [showVoid,   setShowVoid]   = useState(false);

  const { data: voucher, isLoading } = trpc.vouchers.getById.useQuery({ id });

  const postMut = trpc.vouchers.post.useMutation({ onSuccess: () => utils.vouchers.list.invalidate() });
  const voidMut = trpc.vouchers.void.useMutation({
    onSuccess: () => { utils.vouchers.list.invalidate(); setShowVoid(false); },
  });

  if (isLoading) return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading…
    </div>
  );
  if (!voucher) return null;

  const vt     = VOUCHER_TYPES.find(v => v.value === voucher.voucher_type);
  const lines  = voucher.lines ?? [];
  const totalDr = lines.reduce((s: number, l: any) => s + parseFloat(l.dr_amount), 0);
  const totalCr = lines.reduce((s: number, l: any) => s + parseFloat(l.cr_amount), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Detail header — accented by voucher type colour */}
      <div className="pane-header" style={{ borderLeft: `4px solid ${vt?.color ?? '#475569'}` }}>
        <div style={{ flex: 1 }}>
          <div className="pane-header-title" style={{ gap: 10, marginBottom: 4 }}>
            <TypeChip type={voucher.voucher_type} />
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: vt?.color ?? 'var(--color-text)' }}>
              {voucher.voucher_number}
            </span>
            <StatusBadge status={voucher.status} />
          </div>
          <div className="pane-header-sub">
            {fmt(voucher.voucher_date)}
            {voucher.reference && <> · Ref: <strong style={{ color: 'var(--color-text)' }}>{voucher.reference}</strong></>}
            {voucher.narration  && <> · {voucher.narration}</>}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-light)', fontSize: 22, lineHeight: 1, padding: 4 }}>×</button>
      </div>

      {/* Lines */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th style={{ textAlign: 'right' }}>Debit</th>
              <th style={{ textAlign: 'right' }}>Credit</th>
              <th>Narration</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l: any, i: number) => (
              <tr key={l.id}>
                <td>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-primary)', marginRight: 8 }}>
                    {l.account_code}
                  </span>
                  {l.account_name}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: parseFloat(l.dr_amount) > 0 ? 'var(--color-primary)' : 'var(--color-text-light)' }}>
                  {parseFloat(l.dr_amount) > 0 ? fmtAmt(l.dr_amount) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', color: parseFloat(l.cr_amount) > 0 ? 'var(--color-primary)' : 'var(--color-text-light)' }}>
                  {parseFloat(l.cr_amount) > 0 ? fmtAmt(l.cr_amount) : '—'}
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                  {l.narration ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                TOTAL
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
                {fmtAmt(totalDr)}
              </td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
                {fmtAmt(totalCr)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer actions */}
      <div className="pane-footer">
        {voucher.status === 'Draft' && (
          <>
            <button className="btn btn-primary" disabled={postMut.isPending} onClick={() => postMut.mutate({ id: voucher.id })}>
              {postMut.isPending
                ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Posting…</>
                : '✓ Post Voucher'}
            </button>
            {postMut.isError && <span style={{ color: 'var(--color-danger)', fontSize: 'var(--font-size-xs)' }}>{postMut.error.message}</span>}
          </>
        )}
        {voucher.status !== 'Voided' && (
          showVoid ? (
            <div style={{ display: 'flex', gap: 8, flex: 1, alignItems: 'center' }}>
              <input
                className="form-input" style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                placeholder="Reason for voiding…"
                value={voidReason} onChange={e => setVoidReason(e.target.value)}
              />
              <button
                className="btn btn-danger btn-sm"
                disabled={!voidReason.trim() || voidMut.isPending}
                onClick={() => voidMut.mutate({ id: voucher.id, reason: voidReason })}
              >
                {voidMut.isPending ? 'Voiding…' : 'Confirm Void'}
              </button>
              <button onClick={() => setShowVoid(false)} className="btn btn-ghost btn-sm">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowVoid(true)}
              className="btn btn-sm"
              style={{ marginLeft: 'auto', background: 'var(--color-danger-bg)', border: `1px solid var(--color-danger-border)`, color: 'var(--color-danger)' }}
            >
              Void Voucher
            </button>
          )
        )}
      </div>
    </div>
  );
}

/* ── Voucher list (left sidebar pane) ────────────────────────────── */
function VoucherList({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string) => void }) {
  const [typeFilter,   setTypeFilter]   = useState<VoucherType | ''>('');
  const [statusFilter, setStatusFilter] = useState<VoucherStatus | ''>('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);

  const { data, isLoading } = trpc.vouchers.list.useQuery({
    page, limit: 30,
    voucher_type: typeFilter   || undefined,
    status:       statusFilter || undefined,
    search:       search       || undefined,
  }, { placeholderData: prev => prev });

  const vouchers = data?.data ?? [];
  const total    = data?.pagination?.total ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter header */}
      <div style={{
        padding: '10px 12px',
        background: 'var(--color-panel-header-bg)',
        borderBottom: '1px solid var(--color-panel-header-border)',
        display: 'flex', flexDirection: 'column', gap: 7, flexShrink: 0,
      }}>
        <input
          className="form-input"
          placeholder="Search number, reference…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ fontSize: 'var(--font-size-sm)' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={typeFilter} onChange={e => { setTypeFilter(e.target.value as any); setPage(1); }}
            className="form-select" style={{ flex: 1, fontSize: 'var(--font-size-xs)', padding: '5px 7px' }}
          >
            <option value="">All Types</option>
            {VOUCHER_TYPES.map(vt => <option key={vt.value} value={vt.value}>{vt.value} — {vt.label}</option>)}
          </select>
          <select
            value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="form-select" style={{ flex: 1, fontSize: 'var(--font-size-xs)', padding: '5px 7px' }}
          >
            <option value="">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Posted">Posted</option>
            <option value="Voided">Voided</option>
          </select>
        </div>
      </div>

      {/* Count bar */}
      <div style={{ padding: '5px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)', background: 'var(--color-panel-list)', flexShrink: 0 }}>
        {total} voucher{total !== 1 ? 's' : ''}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: 24, display: 'flex', gap: 8, alignItems: 'center', color: 'var(--color-text-muted)' }}>
            <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Loading…
          </div>
        )}
        {!isLoading && vouchers.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            No vouchers found.
          </div>
        )}
        {vouchers.map((v: any) => {
          const vt = VOUCHER_TYPES.find(t => t.value === v.voucher_type);
          return (
            <div
              key={v.id}
              onClick={() => onSelect(v.id)}
              className={`voucher-list-item${selectedId === v.id ? ' selected' : ''}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TypeChip type={v.voucher_type} size="xs" />
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', color: vt?.color ?? 'var(--color-text)' }}>
                    {v.voucher_number}
                  </span>
                  {v.reference && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{v.reference}</span>
                  )}
                </div>
                <StatusBadge status={v.status} />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{fmt(v.voucher_date)}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-text)' }}>
                  {fmtAmt(v.total_debit)}
                </span>
              </div>
              {v.narration && (
                <div style={{ marginTop: 2, fontSize: '0.6875rem', color: 'var(--color-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.narration}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {(data?.pagination?.pages ?? 1) > 1 && (
        <div className="pane-footer" style={{ justifyContent: 'center', gap: 6 }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={pageBtnStyle}>‹</button>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            {page} / {data?.pagination?.pages}
          </span>
          <button disabled={page >= (data?.pagination?.pages ?? 1)} onClick={() => setPage(p => p + 1)} style={pageBtnStyle}>›</button>
        </div>
      )}
    </div>
  );
}

/* ── Page root ────────────────────────────────────────────────────── */
export default function VouchersPage() {
  const [mode,       setMode]       = useState<'list' | 'new'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSaved(id: string) { setMode('list'); setSelectedId(id); }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 48px)' }}>
      {/* Page header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">Payment, receipt, journal and contra entries</p>
        </div>
        <button
          className={mode === 'new' ? 'btn btn-secondary' : 'btn btn-primary'}
          onClick={() => { setMode(m => m === 'new' ? 'list' : 'new'); setSelectedId(null); }}
        >
          {mode === 'new' ? 'Cancel' : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
              </svg>
              New Voucher
            </>
          )}
        </button>
      </div>

      {/* Split workspace */}
      <div className="workspace">
        {/* Left — voucher list */}
        <div className="workspace-list">
          <div className="pane-header" style={{ justifyContent: 'flex-start' }}>
            <div className="pane-header-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
              </svg>
              Voucher List
            </div>
          </div>
          <VoucherList selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setMode('list'); }} />
        </div>

        {/* Right — form or detail */}
        <div className="workspace-detail">
          {mode === 'new' ? (
            <VoucherForm onSaved={handleSaved} onCancel={() => setMode('list')} />
          ) : selectedId ? (
            <VoucherDetail id={selectedId} onClose={() => setSelectedId(null)} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 0 }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: 16, opacity: 0.2 }}>
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>
              </svg>
              <p style={{ fontWeight: 600, fontSize: 'var(--font-size-base)', color: 'var(--color-text-secondary)', marginBottom: 5 }}>Select a voucher</p>
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>or create a new one using the button above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared micro-styles ─────────────────────────────────────────── */
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.6875rem',
  fontWeight: 700, color: 'var(--color-text-muted)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};
const pageBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 4,
  border: '1px solid var(--color-border)', background: 'var(--color-surface)',
  cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--color-text)',
};
