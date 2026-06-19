'use client';

/**
 * CustomersPage — AR sub-ledger master management.
 *
 * Features:
 *  - KPI chips: Total / Active / Inactive / Total Credit Limit
 *  - Search + type filter + active toggle
 *  - Table with hover, icon action buttons (fade on hover)
 *  - Side form panel: Basic Info / Contact / Financial sections
 *  - COA account selector (AR control + advance accounts)
 *  - Styled ConfirmModal for delete
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import type { CreateCustomerInput } from '@/modules/customers/customer.schema';
import { CUSTOMER_TYPES } from '@/modules/customers/customer.schema';

/* ═══ Types ═══════════════════════════════════════════════════════════════ */
interface CustomerRow {
  id: string; code: string; name: string; trade_name?: string | null;
  customer_type: string; tax_registration_no?: string | null;
  email?: string | null; phone?: string | null; mobile?: string | null;
  billing_address?: string | null; shipping_address?: string | null;
  city?: string | null; country?: string | null; postal_code?: string | null;
  payment_terms_days: number; credit_limit: number; currency_code: string;
  ar_account_id?: string | null; advance_account_id?: string | null;
  is_active: boolean; notes?: string | null;
}

interface AccountOption { id: string; code: string; name: string; account_type: string; }

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  company:    { label: 'Company',    color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',  border: 'rgba(29,78,216,0.2)'  },
  individual: { label: 'Individual', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  government: { label: 'Government', color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)'  },
};

const EMPTY_FORM: CreateCustomerInput = {
  name: '', code: '', trade_name: '', customer_type: 'company',
  tax_registration_no: '', email: '', phone: '', mobile: '',
  billing_address: '', shipping_address: '', city: '', country: '', postal_code: '',
  payment_terms_days: 30, credit_limit: 0, currency_code: 'USD',
  ar_account_id: undefined, advance_account_id: undefined,
  is_active: true, notes: '',
};

/* ═══ ConfirmModal ════════════════════════════════════════════════════════ */
function ConfirmModal({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--color-surface)', borderRadius: 14, padding: '28px 32px', width: 430, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>{title}</h3>
            <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 22px', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', border: 'none', background: '#dc2626', color: '#fff' }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Section divider in form ═════════════════════════════════════════════ */
function Section({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 2px', paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
      <span style={{ color: '#1d4ed8' }}>{icon}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0, color: 'var(--color-text-muted)' }}>{title}</span>
    </div>
  );
}

/* ═══ Main ════════════════════════════════════════════════════════════════ */
export default function CustomersPage() {
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [form,         setForm]         = useState<CreateCustomerInput>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState('');
  const [bannerError,  setBannerError]  = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'basic' | 'contact' | 'financial'>('basic');

  const utils = trpc.useUtils();

  /* ── Queries ── */
  const { data: listData, isLoading } = trpc.customers.list.useQuery({
    search: search || undefined,
    customer_type: (typeFilter as 'individual'|'company'|'government') || undefined,
    is_active: showInactive ? undefined : true,
    page: 1, limit: 200,
  });
  const { data: statsData } = trpc.customers.stats.useQuery();
  const { data: nextCode }  = trpc.customers.nextCode.useQuery(undefined, { enabled: !editId && showForm });
  const { data: accounts = [] } = trpc.customers.listAccounts.useQuery();

  /* ── Mutations ── */
  const createMut = trpc.customers.create.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); utils.customers.stats.invalidate(); closeForm(); },
    onError: e => { setFormError(e.message); setSaving(false); },
  });
  const updateMut = trpc.customers.update.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); utils.customers.stats.invalidate(); closeForm(); },
    onError: e => { setFormError(e.message); setSaving(false); },
  });
  const deleteMut = trpc.customers.delete.useMutation({
    onSuccess: () => { utils.customers.list.invalidate(); utils.customers.stats.invalidate(); setDeleteTarget(null); },
    onError: e => { setBannerError(e.message); setDeleteTarget(null); },
  });

  /* ── Derived ── */
  const rows = (listData?.data ?? []) as CustomerRow[];

  const accountOptions = useMemo(() => {
    const ar   = (accounts as AccountOption[]).filter(a => ['asset','Asset','ASSET'].includes(a.account_type));
    const liab = (accounts as AccountOption[]).filter(a => ['liability','Liability','LIABILITIES','LIABILITY'].includes(a.account_type));
    return { ar, liab, all: accounts as AccountOption[] };
  }, [accounts]);

  /* ── Form helpers ── */
  function openNew() {
    setEditId(null); setForm({ ...EMPTY_FORM, code: nextCode ?? '' });
    setFormError(''); setSaving(false); setActiveTab('basic'); setShowForm(true);
  }
  function openEdit(c: CustomerRow) {
    setEditId(c.id);
    setForm({
      code: c.code, name: c.name, trade_name: c.trade_name ?? '',
      customer_type: c.customer_type as 'individual'|'company'|'government',
      tax_registration_no: c.tax_registration_no ?? '',
      email: c.email ?? '', phone: c.phone ?? '', mobile: c.mobile ?? '',
      billing_address: c.billing_address ?? '', shipping_address: c.shipping_address ?? '',
      city: c.city ?? '', country: c.country ?? '', postal_code: c.postal_code ?? '',
      payment_terms_days: c.payment_terms_days, credit_limit: c.credit_limit,
      currency_code: c.currency_code,
      ar_account_id: c.ar_account_id ?? undefined,
      advance_account_id: c.advance_account_id ?? undefined,
      is_active: c.is_active, notes: c.notes ?? '',
    });
    setFormError(''); setSaving(false); setActiveTab('basic'); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setFormError(''); setSaving(false); }
  function setF(key: keyof CreateCustomerInput, val: unknown) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true); setFormError('');
    const payload = {
      ...form,
      code:        form.code?.trim().toUpperCase() || undefined,
      email:       form.email?.trim()       || undefined,
      trade_name:  form.trade_name?.trim()  || undefined,
      tax_registration_no: form.tax_registration_no?.trim() || undefined,
      phone:  form.phone?.trim()  || undefined,
      mobile: form.mobile?.trim() || undefined,
      billing_address:  form.billing_address?.trim()  || undefined,
      shipping_address: form.shipping_address?.trim() || undefined,
      city:        form.city?.trim()        || undefined,
      country:     form.country?.trim()     || undefined,
      postal_code: form.postal_code?.trim() || undefined,
      notes:       form.notes?.trim()       || undefined,
    };
    if (editId) updateMut.mutate({ id: editId, ...payload });
    else        createMut.mutate(payload);
  }

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

      <style>{`
        .cust-row td { transition: background 0.1s; }
        .cust-row:hover td { background: rgba(29,78,216,0.04) !important; }
        .cust-row.cust-editing td { background: rgba(29,78,216,0.07) !important; }
        .cust-row.cust-editing td:first-child { box-shadow: inset 3px 0 0 #1d4ed8; }
        .cust-actions { opacity: 0; transition: opacity 0.15s; display: inline-flex; gap: 2px; }
        .cust-row:hover .cust-actions,
        .cust-row.cust-editing .cust-actions { opacity: 1; }
        .cust-ibtn { background: transparent; border: none; cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; align-items: center; color: var(--color-text-muted); transition: background 0.12s, color 0.12s; }
        .cust-ibtn.edit:hover { background: rgba(29,78,216,0.1); color: #1d4ed8; }
        .cust-ibtn.del:hover  { background: rgba(220,38,38,0.1);  color: #dc2626; }
        .form-tab { padding: 6px 14px; border: none; border-bottom: 2px solid transparent; background: transparent; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); transition: all 0.15s; }
        .form-tab.active { color: #1d4ed8; border-bottom-color: #1d4ed8; }
        .form-tab:hover:not(.active) { color: var(--color-text); }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(29,78,216,0.35)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>Customers</h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Accounts Receivable sub-ledger</p>
          </div>
        </div>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Customer
        </button>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, maxWidth: 580 }}>
        {[
          { label: 'Total',        value: statsData?.total    ?? 0, col: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',  border: 'rgba(29,78,216,0.2)',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
          { label: 'Active',       value: statsData?.active   ?? 0, col: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.2)',  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: 'Inactive',     value: statsData?.inactive ?? 0, col: '#b45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.2)',   icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
          { label: 'Credit Limit', value: `$${fmt(statsData?.total_credit_limit ?? 0)}`, col: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
        ].map(s => (
          <div key={s.label} style={{ padding: '11px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ color: s.col, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: s.col, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              <div style={{ fontSize: '0.64rem', color: s.col, fontWeight: 600, opacity: 0.75, marginTop: 2, letterSpacing: 0 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Error banner ── */}
      {bannerError && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: '#dc2626', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          {bannerError}
          <button onClick={() => setBannerError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '1.2rem', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 260 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="input" placeholder="Search name, code, email…" value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 30, width: '100%' }} />
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 5 }}>
          {(['', ...CUSTOMER_TYPES] as const).map(t => {
            const meta = t ? TYPE_META[t] : null;
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? (meta?.color ?? '#1d4ed8') : 'var(--color-border)'}`, background: active ? (meta?.bg ?? 'rgba(29,78,216,0.1)') : 'var(--color-surface)', color: active ? (meta?.color ?? '#1d4ed8') : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
                {t ? TYPE_META[t].label : 'All'}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} style={{ width: 14, height: 14, accentColor: 'var(--color-primary)' }} />
          Show inactive
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          {rows.length} record{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Main split ── */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

        {/* ─── Table ─── */}
        <div style={{ flex: showForm ? '0 0 55%' : 1, border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Code','Name','Type','Terms','Contact','Status',''].map((h, i) => (
                  <th key={h+i} style={{ padding: '10px 12px', textAlign: i >= 5 ? 'center' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0, background: 'var(--color-table-head-bg)', color: 'var(--color-table-head-fg)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading customers…
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '52px 24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--color-surface-alt)', border: '2px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                        {search || typeFilter ? 'No customers match this filter' : 'No customers yet'}
                      </p>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {search || typeFilter ? 'Try adjusting your search or filter' : 'Add your first customer to get started'}
                      </p>
                    </div>
                    {!search && !typeFilter && (
                      <button className="btn-primary" onClick={openNew} style={{ fontSize: '0.82rem' }}>Add First Customer</button>
                    )}
                  </div>
                </td></tr>
              ) : rows.map((c, idx) => {
                const isEditing = editId === c.id && showForm;
                const meta = TYPE_META[c.customer_type] ?? TYPE_META.company;
                return (
                  <tr key={c.id} className={`cust-row${isEditing ? ' cust-editing' : ''}`}
                    style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)' }}>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '0.78rem', color: '#1d4ed8', background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.2)', padding: '2px 7px', borderRadius: 5 }}>{c.code}</span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>{c.name}</div>
                      {c.trade_name && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{c.trade_name}</div>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      Net {c.payment_terms_days}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {c.email && <div style={{ fontSize: '0.78rem', color: 'var(--color-text)' }}>{c.email}</div>}
                      {c.phone && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{c.phone}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 12, background: c.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)', color: c.is_active ? '#15803d' : '#64748b', border: `1px solid ${c.is_active ? '#86efac' : '#cbd5e1'}` }}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <span className="cust-actions">
                        <button className="cust-ibtn edit" title="Edit" onClick={() => openEdit(c)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="cust-ibtn del" title="Delete" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ─── Form panel ─── */}
        {showForm && (
          <div style={{ flex: '0 0 43%', border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-surface)', overflow: 'hidden', boxShadow: '0 6px 28px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 200px)' }}>

            {/* Header */}
            <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg,#1e3a5f,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                    {editId ? 'Edit Customer' : 'New Customer'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>
                    Accounts Receivable sub-ledger
                  </p>
                </div>
              </div>
              <button onClick={closeForm} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: 7, padding: '5px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
              {(['basic', 'contact', 'financial'] as const).map(tab => (
                <button key={tab} className={`form-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab === 'basic' ? 'Identity' : tab === 'contact' ? 'Contact' : 'Financial'}
                </button>
              ))}
            </div>

            {/* Form body */}
            <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {formError && (
                <div style={{ padding: '9px 12px', borderRadius: 7, fontSize: '0.82rem', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626', display: 'flex', gap: 7, alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {formError}
                </div>
              )}

              {/* ── BASIC TAB ── */}
              {activeTab === 'basic' && (
                <>
                  <Section title="Identity" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
                  <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Code</label>
                      <input className="input" value={form.code ?? ''} onChange={e => setF('code', e.target.value.toUpperCase())} placeholder={nextCode ?? 'CUS-0001'} maxLength={20} style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="ABC Corporation Ltd." maxLength={200} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Trade / Display Name</label>
                    <input className="input" value={form.trade_name ?? ''} onChange={e => setF('trade_name', e.target.value)} placeholder="ABC Corp (optional)" maxLength={200} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Customer Type</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {CUSTOMER_TYPES.map(t => {
                        const m = TYPE_META[t]; const active = form.customer_type === t;
                        return (
                          <button key={t} type="button" onClick={() => setF('customer_type', t)}
                            style={{ padding: '6px 14px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? m.color : 'var(--color-border)'}`, background: active ? m.bg : 'var(--color-surface-alt)', color: active ? m.color : 'var(--color-text-muted)', transition: 'all 0.15s', boxShadow: active ? `0 0 0 2px ${m.color}25` : 'none' }}>
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Tax Registration No (VAT / GST / TRN)</label>
                    <input className="input" value={form.tax_registration_no ?? ''} onChange={e => setF('tax_registration_no', e.target.value)} placeholder="e.g. 100234567890003" maxLength={50} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Status</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer' }}>
                        <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 15, height: 15, accentColor: 'var(--color-primary)' }} />
                        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Active</span>
                      </label>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes</label>
                    <textarea className="input" value={form.notes ?? ''} onChange={e => setF('notes', e.target.value)} placeholder="Internal notes…" rows={2} style={{ resize: 'vertical' }} />
                  </div>
                </>
              )}

              {/* ── CONTACT TAB ── */}
              {activeTab === 'contact' && (
                <>
                  <Section title="Communication" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.63a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>} />
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email</label>
                    <input className="input" type="email" value={form.email ?? ''} onChange={e => setF('email', e.target.value)} placeholder="accounts@customer.com" maxLength={200} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Phone</label>
                      <input className="input" value={form.phone ?? ''} onChange={e => setF('phone', e.target.value)} placeholder="+1 555 000 0000" maxLength={30} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Mobile</label>
                      <input className="input" value={form.mobile ?? ''} onChange={e => setF('mobile', e.target.value)} placeholder="+1 555 000 0001" maxLength={30} />
                    </div>
                  </div>
                  <Section title="Billing Address" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>} />
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Street / P.O. Box</label>
                    <textarea className="input" value={form.billing_address ?? ''} onChange={e => setF('billing_address', e.target.value)} placeholder="123 Main Street, Suite 400" rows={2} style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">City</label>
                      <input className="input" value={form.city ?? ''} onChange={e => setF('city', e.target.value)} placeholder="New York" maxLength={100} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Country</label>
                      <input className="input" value={form.country ?? ''} onChange={e => setF('country', e.target.value)} placeholder="United States" maxLength={100} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">ZIP</label>
                      <input className="input" value={form.postal_code ?? ''} onChange={e => setF('postal_code', e.target.value)} placeholder="10001" maxLength={20} />
                    </div>
                  </div>
                  <Section title="Shipping Address" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>} />
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Delivery Address (if different from billing)</label>
                    <textarea className="input" value={form.shipping_address ?? ''} onChange={e => setF('shipping_address', e.target.value)} placeholder="Leave blank if same as billing address" rows={2} style={{ resize: 'vertical' }} />
                  </div>
                </>
              )}

              {/* ── FINANCIAL TAB ── */}
              {activeTab === 'financial' && (
                <>
                  <Section title="Payment Terms" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Payment Terms (days)</label>
                      <select className="input" value={form.payment_terms_days} onChange={e => setF('payment_terms_days', Number(e.target.value))}>
                        {[7, 14, 30, 45, 60, 90, 120].map(d => <option key={d} value={d}>Net {d}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Credit Limit</label>
                      <input className="input" type="number" min={0} step={100} value={form.credit_limit} onChange={e => setF('credit_limit', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Currency</label>
                      <input className="input" value={form.currency_code} onChange={e => setF('currency_code', e.target.value.toUpperCase().slice(0,3))} maxLength={3} style={{ fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }} />
                    </div>
                  </div>

                  <Section title="GL Sub-ledger Account" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />

                  {/* Auto-assigned GL account display */}
                  {editId ? (
                    (() => {
                      const assigned = (accounts as AccountOption[]).find(a => a.id === form.ar_account_id);
                      return assigned ? (
                        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(21,128,61,0.07)', border: '1px solid rgba(21,128,61,0.22)', display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(21,128,61,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d', letterSpacing: 0, marginBottom: 3 }}>AR Sub-ledger Account (Auto-assigned)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: '0.9rem', color: '#15803d', background: 'rgba(21,128,61,0.12)', padding: '2px 8px', borderRadius: 5 }}>{assigned.code}</span>
                              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assigned.name}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.15)', fontSize: '0.78rem', color: '#1d4ed8' }}>
                          GL account not yet assigned — will be auto-created on next save.
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(29,78,216,0.05)', border: '1px solid rgba(29,78,216,0.18)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(29,78,216,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8', marginBottom: 3 }}>GL Account will be auto-created</div>
                        <div style={{ fontSize: '0.74rem', color: '#1d4ed8', opacity: 0.8, lineHeight: 1.6 }}>
                          A dedicated AR sub-ledger posting account (code range <strong>1300001–1399999</strong>, up to 99,999 customers) will be automatically created in the Chart of Accounts and linked to this customer when you save.
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Advance / Customer Deposit Account</label>
                    <select className="input" value={form.advance_account_id ?? ''} onChange={e => setF('advance_account_id', e.target.value || undefined)}>
                      <option value="">(Use company default advance account)</option>
                      {(accounts as AccountOption[]).map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['basic', 'contact', 'financial'] as const).filter(t => t !== activeTab).map(t => (
                    <button key={t} type="button" className="btn-ghost" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setActiveTab(t)}>
                      {t === 'basic' ? 'Identity' : t === 'contact' ? 'Contact' : 'Financial'} →
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving} style={{ minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    {saving ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Saving…</> : editId ? 'Save Changes' : 'Create Customer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Customer?"
          message={`"${deleteTarget.name}" will be permanently removed. Customers with invoices or transactions cannot be deleted.`}
          onConfirm={() => deleteMut.mutate({ id: deleteTarget.id })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
