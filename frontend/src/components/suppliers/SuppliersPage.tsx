'use client';

/**
 * SuppliersPage — AP sub-ledger master management.
 *
 * Features:
 *  - KPI chips: Total / Active / Inactive / Total Payables
 *  - Search + type filter + active toggle
 *  - Table with hover, icon action buttons (fade on hover)
 *  - Side form panel: Identity / Contact / Financial / Bank tabs
 *  - COA account selector (AP control + advance accounts)
 *  - Bank details: bank name, account no, SWIFT, IBAN
 *  - Styled ConfirmModal for delete
 */

import { useState } from 'react';
import { useGeneralSettings } from '@/lib/api/settings';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSupplierAccounts,
  useSupplierNextCode,
  useSupplierStats,
  useSuppliersList,
  useUpdateSupplier,
} from '@/lib/api/parties';
import type { CreateSupplierInput } from '@/modules/suppliers/supplier.schema';
import { SUPPLIER_TYPES } from '@/modules/suppliers/supplier.schema';
import { APP_CURRENCY_OPTIONS } from '@/lib/app-settings';

/* ═══ Types ═══════════════════════════════════════════════════════════════ */
interface SupplierRow {
  id: string; code: string; name: string; trade_name?: string | null;
  supplier_type: string; tax_registration_no?: string | null;
  party_type: 'Supplier' | 'Customer And Supplier'; main_role: 'Supplier';
  email?: string | null; phone?: string | null; mobile?: string | null;
  address?: string | null;
  city?: string | null; country?: string | null; postal_code?: string | null;
  payment_terms_days: number; currency_code: string;
  ap_account_id?: string | null; advance_account_id?: string | null;
  bank_name?: string | null; bank_account_no?: string | null;
  bank_swift_code?: string | null; bank_iban?: string | null;
  is_active: boolean; notes?: string | null;
}

interface AccountOption { id: string; code: string; name: string; account_type: string; }

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  company:    { label: 'Company',    color: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)'  },
  individual: { label: 'Individual', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
  government: { label: 'Government', color: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.2)'  },
};

const PARTY_ROLE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Supplier: { label: 'Supplier', color: '#0891b2', bg: 'rgba(8,145,178,0.08)', border: 'rgba(8,145,178,0.22)' },
  'Customer And Supplier': { label: 'Customer And Supplier', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', border: 'rgba(15,118,110,0.22)' },
};

const NUMERIC_INPUT_STYLE = { textAlign: 'right' as const, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 };
const CURRENCY_SELECT_STYLE = { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, textAlign: 'center' as const };
function selectNumericValue(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}
function keepNumericValueSelected(event: { preventDefault: () => void }) {
  event.preventDefault();
}

const EMPTY_FORM: CreateSupplierInput = {
  name: '', code: '', trade_name: '', supplier_type: 'company',
  party_type: 'Supplier', main_role: 'Supplier',
  tax_registration_no: '', email: '', phone: '', mobile: '',
  address: '', city: '', country: '', postal_code: '',
  payment_terms_days: 30, currency_code: 'PKR',
  ap_account_id: undefined, advance_account_id: undefined,
  bank_name: '', bank_account_no: '', bank_swift_code: '', bank_iban: '',
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
      <span style={{ color: '#0891b2' }}>{icon}</span>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0, color: 'var(--color-text-muted)' }}>{title}</span>
    </div>
  );
}

/* ═══ Main ════════════════════════════════════════════════════════════════ */
export default function SuppliersPage() {
  const [showForm,     setShowForm]     = useState(false);
  const [editId,       setEditId]       = useState<string | null>(null);
  const [form,         setForm]         = useState<CreateSupplierInput>(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [formError,    setFormError]    = useState('');
  const [bannerError,  setBannerError]  = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [searchText,   setSearchText]   = useState('');
  const [search,       setSearch]       = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [activeTab,    setActiveTab]    = useState<'basic' | 'contact' | 'financial' | 'bank'>('basic');

  /* ── Queries ── */
  const { data: listData, isLoading, isFetching } = useSuppliersList({
    search: search || undefined,
    type: (typeFilter as 'individual'|'company'|'government') || undefined,
    is_active: showInactive ? undefined : true,
    page: 1, limit: 200,
  });
  const { data: statsData } = useSupplierStats();
  const { data: nextCode }  = useSupplierNextCode(!editId && showForm);
  const { data: accounts = [] } = useSupplierAccounts();
  const { data: generalSettings } = useGeneralSettings();

  /* ── Mutations ── */
  const createMut = useCreateSupplier();
  const updateMut = useUpdateSupplier();
  const deleteMut = useDeleteSupplier();

  /* ── Derived ── */
  const rows = (listData?.data ?? []) as SupplierRow[];

  /* ── Form helpers ── */
  function openNew() {
    setEditId(null); setForm({ ...EMPTY_FORM, code: nextCode ?? '', currency_code: generalSettings?.currency_code ?? EMPTY_FORM.currency_code });
    setFormError(''); setSaving(false); setActiveTab('basic'); setShowForm(true);
  }
  function openEdit(s: SupplierRow) {
    setEditId(s.id);
    setForm({
      code: s.code, name: s.name, trade_name: s.trade_name ?? '',
      supplier_type: s.supplier_type as 'individual'|'company'|'government',
      party_type: (s.party_type ?? 'Supplier') as 'Supplier' | 'Customer And Supplier',
      main_role: 'Supplier',
      tax_registration_no: s.tax_registration_no ?? '',
      email: s.email ?? '', phone: s.phone ?? '', mobile: s.mobile ?? '',
      address: s.address ?? '',
      city: s.city ?? '', country: s.country ?? '', postal_code: s.postal_code ?? '',
      payment_terms_days: s.payment_terms_days,
      currency_code: s.currency_code,
      ap_account_id: s.ap_account_id ?? undefined,
      advance_account_id: s.advance_account_id ?? undefined,
      bank_name: s.bank_name ?? '',
      bank_account_no: s.bank_account_no ?? '',
      bank_swift_code: s.bank_swift_code ?? '',
      bank_iban: s.bank_iban ?? '',
      is_active: s.is_active, notes: s.notes ?? '',
    });
    setFormError(''); setSaving(false); setActiveTab('basic'); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setFormError(''); setSaving(false); }
  function setF(key: keyof CreateSupplierInput, val: unknown) { setForm(f => ({ ...f, [key]: val })); }

  function applySearch() {
    setSearch(searchText.trim());
  }

  function clearSearch() {
    setSearchText('');
    setSearch('');
  }

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
      address:     form.address?.trim()     || undefined,
      city:        form.city?.trim()        || undefined,
      country:     form.country?.trim()     || undefined,
      postal_code: form.postal_code?.trim() || undefined,
      bank_name:       form.bank_name?.trim()       || undefined,
      bank_account_no: form.bank_account_no?.trim() || undefined,
      bank_swift_code: form.bank_swift_code?.trim() || undefined,
      bank_iban:       form.bank_iban?.trim()       || undefined,
      notes:       form.notes?.trim()       || undefined,
    };
    const callbacks = {
      onSuccess: () => closeForm(),
      onError: (error: Error) => { setFormError(error.message); setSaving(false); },
    };
    if (editId) updateMut.mutate({ id: editId, ...payload }, callbacks);
    else        createMut.mutate(payload, callbacks);
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ padding: showForm ? 0 : '20px 24px', display: 'flex', flexDirection: 'column', gap: showForm ? 0 : 18, height: showForm ? '100%' : undefined, minHeight: 0 }}>

      <style>{`
        .supp-row td { transition: background 0.1s; }
        .supp-row:hover td { background: rgba(8,145,178,0.04) !important; }
        .supp-row.supp-editing td { background: rgba(8,145,178,0.07) !important; }
        .supp-row.supp-editing td:first-child { box-shadow: inset 3px 0 0 #0891b2; }
        .supp-actions { opacity: 0; transition: opacity 0.15s; display: inline-flex; gap: 2px; }
        .supp-row:hover .supp-actions,
        .supp-row.supp-editing .supp-actions { opacity: 1; }
        .supp-ibtn { background: transparent; border: none; cursor: pointer; padding: 5px; border-radius: 6px; display: inline-flex; align-items: center; color: var(--color-text-muted); transition: background 0.12s, color 0.12s; }
        .supp-ibtn.edit:hover { background: rgba(8,145,178,0.1); color: #0891b2; }
        .supp-ibtn.del:hover  { background: rgba(220,38,38,0.1);  color: #dc2626; }
        .supp-tab { padding: 6px 14px; border: none; border-bottom: 2px solid transparent; background: transparent; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--color-text-muted); transition: all 0.15s; }
        .supp-tab.active { color: #0891b2; border-bottom-color: #0891b2; }
        .supp-tab:hover:not(.active) { color: var(--color-text); }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ display: showForm ? 'none' : 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#0c4a6e,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 10px rgba(8,145,178,0.35)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>Suppliers</h1>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Accounts Payable sub-ledger</p>
          </div>
        </div>
        <button className={showForm ? 'btn-secondary' : 'btn-primary'} onClick={showForm ? closeForm : openNew}
          style={{ background: showForm ? undefined : 'linear-gradient(135deg,#0c4a6e,#0891b2)', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontWeight: 700, whiteSpace: 'nowrap' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          {showForm ? 'Back To List' : 'New Supplier'}
        </button>
      </div>

      {/* ── KPI chips ── */}
      <div style={{ display: showForm ? 'none' : 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, maxWidth: 580 }}>
        {[
          { label: 'Total',    value: statsData?.total    ?? 0, col: '#0891b2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg> },
          { label: 'Active',   value: statsData?.active   ?? 0, col: '#15803d', bg: 'rgba(21,128,61,0.08)',  border: 'rgba(21,128,61,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> },
          { label: 'Inactive', value: statsData?.inactive ?? 0, col: '#b45309', bg: 'rgba(180,83,9,0.08)',   border: 'rgba(180,83,9,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
          { label: 'With Bank', value: statsData?.with_bank_details ?? 0, col: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M4 7v13M8 7v13M12 7v13M16 7v13M20 7v13M3 20h18"/></svg> },
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
      <div style={{ display: showForm ? 'none' : 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 260 }}>
          <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="input"
            placeholder="Search name, code, email…"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') applySearch();
            }}
            style={{ paddingLeft: 30, width: '100%' }}
          />
        </div>
        <button className="btn-secondary" type="button" onClick={applySearch} disabled={isFetching} style={{ padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isFetching && <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />}
          {isFetching ? 'Searching...' : 'Search'}
        </button>
        {(search || searchText) && (
          <button className="btn-secondary" type="button" onClick={clearSearch} disabled={isFetching} style={{ padding: '7px 12px', fontSize: '0.78rem', fontWeight: 700 }}>
            Clear
          </button>
        )}
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 5 }}>
          {(['', ...SUPPLIER_TYPES] as const).map(t => {
            const meta = t ? TYPE_META[t] : null;
            const active = typeFilter === t;
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? (meta?.color ?? '#0891b2') : 'var(--color-border)'}`, background: active ? (meta?.bg ?? 'rgba(8,145,178,0.1)') : 'var(--color-surface)', color: active ? (meta?.color ?? '#0891b2') : 'var(--color-text-muted)', transition: 'all 0.15s' }}>
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

      {/* ── Main view ── */}
      <div style={{ display: 'block', flex: showForm ? 1 : undefined, minHeight: 0 }}>

        {/* ─── Table ─── */}
        <div style={{ display: showForm ? 'none' : 'block', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Code','Name','Party Type','Terms','Contact','Bank','Status',''].map((h, i) => (
                  <th key={h+i} style={{ padding: '10px 12px', textAlign: i >= 6 ? 'center' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0, background: 'var(--color-table-head-bg)', color: 'var(--color-table-head-fg)', borderBottom: '2px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Loading suppliers…
                  </div>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '52px 24px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 58, height: 58, borderRadius: 14, background: 'var(--color-surface-alt)', border: '2px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--color-text)', fontSize: '0.9rem' }}>
                        {search || typeFilter ? 'No suppliers match this filter' : 'No suppliers yet'}
                      </p>
                      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                        {search || typeFilter ? 'Try adjusting your search or filter' : 'Add your first supplier to get started'}
                      </p>
                    </div>
                    {!search && !typeFilter && (
                      <button className="btn-primary" onClick={openNew}
                        style={{ fontSize: '0.82rem', background: 'linear-gradient(135deg,#0c4a6e,#0891b2)' }}>
                        Add First Supplier
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : rows.map((s, idx) => {
                const isEditing = editId === s.id && showForm;
                const meta = TYPE_META[s.supplier_type] ?? TYPE_META.company;
                const roleMeta = PARTY_ROLE_META[s.party_type ?? 'Supplier'] ?? PARTY_ROLE_META.Supplier;
                const hasBank = !!(s.bank_account_no || s.bank_iban);
                return (
                  <tr key={s.id} className={`supp-row${isEditing ? ' supp-editing' : ''}`}
                    style={{ borderBottom: '1px solid var(--color-border)', background: idx % 2 === 0 ? 'var(--color-table-row-even)' : 'var(--color-table-row-odd)' }}>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '0.78rem', color: '#0891b2', background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.2)', padding: '2px 7px', borderRadius: 5 }}>{s.code}</span>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</div>
                      {s.trade_name && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{s.trade_name}</div>}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 9px', borderRadius: 5, background: roleMeta.bg, color: roleMeta.color, border: `1px solid ${roleMeta.border}` }}>{roleMeta.label}</span>
                      <div style={{ marginTop: 3, fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>
                        Main Role: Supplier
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      Net {s.payment_terms_days}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {s.email && <div style={{ fontSize: '0.78rem', color: 'var(--color-text)' }}>{s.email}</div>}
                      {s.phone && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{s.phone}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      {hasBank ? (
                        <span title={s.bank_account_no ?? ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: '#7c3aed', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', padding: '2px 7px', borderRadius: 5 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M4 7v13M20 7v13M3 20h18"/></svg>
                          Yes
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.05em', padding: '3px 9px', borderRadius: 12, background: s.is_active ? 'rgba(21,128,61,0.1)' : 'rgba(100,116,139,0.1)', color: s.is_active ? '#15803d' : '#64748b', border: `1px solid ${s.is_active ? '#86efac' : '#cbd5e1'}` }}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                      <span className="supp-actions">
                        <button className="supp-ibtn edit" title="Edit" onClick={() => openEdit(s)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="supp-ibtn del" title="Delete" onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>
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
          <div style={{ width: '100%', height: '100%', border: 'none', borderRadius: 0, background: 'var(--color-surface)', overflow: 'hidden', boxShadow: 'none', display: 'flex', flexDirection: 'column', maxHeight: 'none', minHeight: 0 }}>

            {/* Header */}
            <div style={{ padding: '15px 20px', background: 'linear-gradient(135deg,#0c4a6e,#0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                    {editId ? 'Edit Supplier' : 'New Supplier'}
                  </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.65)' }}>
                    One linked account for this party
                  </p>
                </div>
              </div>
              <button onClick={closeForm} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: 7, padding: '5px 6px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
              {(['basic', 'contact', 'financial', 'bank'] as const).map(tab => (
                <button key={tab} className={`supp-tab${activeTab === tab ? ' active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab === 'basic' ? 'Identity' : tab === 'contact' ? 'Contact' : tab === 'financial' ? 'Financial' : 'Bank'}
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
                      <input className="input" value={form.code ?? ''} onChange={e => setF('code', e.target.value.toUpperCase())} placeholder={nextCode ?? 'SUP-0001'} maxLength={20} style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Name <span style={{ color: '#dc2626' }}>*</span></label>
                      <input className="input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="ABC Suppliers LLC" maxLength={200} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Trade / Display Name</label>
                    <input className="input" value={form.trade_name ?? ''} onChange={e => setF('trade_name', e.target.value)} placeholder="ABC Suppliers (optional)" maxLength={200} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Party Type</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 38 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '6px 12px', borderRadius: 7, background: PARTY_ROLE_META.Supplier.bg, color: PARTY_ROLE_META.Supplier.color, border: `1px solid ${PARTY_ROLE_META.Supplier.border}` }}>
                        Supplier
                      </span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.84rem', fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={form.party_type === 'Customer And Supplier'}
                          onChange={event => {
                            setF('party_type', event.target.checked ? 'Customer And Supplier' : 'Supplier');
                            setF('main_role', 'Supplier');
                          }}
                          style={{ width: 16, height: 16, accentColor: '#0891b2' }}
                        />
                        Also Works As Customer
                      </label>
                    </div>
                    {form.party_type === 'Customer And Supplier' && (
                      <div style={{ marginTop: 6, fontSize: '0.72rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                        Main Role: <strong style={{ color: 'var(--color-text)' }}>Supplier</strong>. This party can also buy from us, using the same linked account.
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Business Type</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SUPPLIER_TYPES.map(t => {
                        const m = TYPE_META[t]; const active = form.supplier_type === t;
                        return (
                          <button key={t} type="button" onClick={() => setF('supplier_type', t)}
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Status</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} style={{ width: 15, height: 15, accentColor: '#0891b2' }} />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Active</span>
                    </label>
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
                    <input className="input" type="email" value={form.email ?? ''} onChange={e => setF('email', e.target.value)} placeholder="accounts@supplier.com" maxLength={200} />
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
                  <Section title="Address" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>} />
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Street / P.O. Box</label>
                    <textarea className="input" value={form.address ?? ''} onChange={e => setF('address', e.target.value)} placeholder="123 Industrial Road, Suite 200" rows={2} style={{ resize: 'vertical' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">City</label>
                      <input className="input" value={form.city ?? ''} onChange={e => setF('city', e.target.value)} placeholder="Chicago" maxLength={100} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Country</label>
                      <input className="input" value={form.country ?? ''} onChange={e => setF('country', e.target.value)} placeholder="United States" maxLength={100} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">ZIP</label>
                      <input className="input" value={form.postal_code ?? ''} onChange={e => setF('postal_code', e.target.value)} placeholder="60601" maxLength={20} />
                    </div>
                  </div>
                </>
              )}

              {/* ── FINANCIAL TAB ── */}
	              {activeTab === 'financial' && (
	                <>
	                  <Section title="Payment Terms" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} />
	                  <div style={{ display: 'grid', gridTemplateColumns: '150px 92px', gap: 12, alignItems: 'end', justifyContent: 'start' }}>
	                    <div className="form-group" style={{ marginBottom: 0 }}>
	                      <label className="form-label">Payment Terms (days)</label>
                      <input
                        className="input"
                        type="number"
                        min={0}
                        max={365}
                        step={1}
	                        inputMode="numeric"
	                        value={form.payment_terms_days}
	                        onFocus={selectNumericValue}
	                        onMouseUp={keepNumericValueSelected}
	                        onChange={e => setF('payment_terms_days', Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
	                        style={NUMERIC_INPUT_STYLE}
	                      />
	                    </div>
	                    <div className="form-group" style={{ marginBottom: 0 }}>
	                      <label className="form-label">Currency</label>
	                      <select className="input" value={form.currency_code} onChange={e => setF('currency_code', e.target.value)} style={CURRENCY_SELECT_STYLE}>
	                        {APP_CURRENCY_OPTIONS.map(currency => (
	                          <option key={currency.code} value={currency.code}>{currency.code}</option>
	                        ))}
                      </select>
                    </div>
                  </div>

                  <Section title="Linked Account" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} />

                  {/* Auto-assigned GL account display */}
                  {editId ? (
                    (() => {
                      const assigned = (accounts as AccountOption[]).find(a => a.id === form.ap_account_id);
                      return assigned ? (
                        <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(8,145,178,0.07)', border: '1px solid rgba(8,145,178,0.22)', display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(8,145,178,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0891b2', letterSpacing: 0, marginBottom: 3 }}>Linked Account (Auto Assigned)</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, fontSize: '0.9rem', color: '#0891b2', background: 'rgba(8,145,178,0.12)', padding: '2px 8px', borderRadius: 5 }}>{assigned.code}</span>
                              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{assigned.name}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.15)', fontSize: '0.78rem', color: '#0891b2' }}>
                          Linked Account is not yet assigned. It will be auto-created on next save.
                        </div>
                      );
                    })()
                  ) : (
                    <div style={{ padding: '12px 14px', borderRadius: 9, background: 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.18)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(8,145,178,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0891b2', marginBottom: 3 }}>Linked Account Will Be Auto Created</div>
                        <div style={{ fontSize: '0.74rem', color: '#0891b2', opacity: 0.8, lineHeight: 1.6 }}>
                          One posting account will be automatically created in the Chart of Accounts and linked to this party when you save.
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── BANK TAB ── */}
              {activeTab === 'bank' && (
                <>
                  <Section title="Bank Details" icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="4" rx="1"/><path d="M4 7v13M8 7v13M12 7v13M16 7v13M20 7v13M3 20h18"/></svg>} />
                  <div style={{ padding: '10px 12px', background: 'rgba(124,58,237,0.05)', borderRadius: 8, border: '1px solid rgba(124,58,237,0.15)', fontSize: '0.78rem', color: '#7c3aed', lineHeight: 1.6, marginBottom: 4 }}>
                    Bank details are used when generating payment advice or EFT/wire transfer files for this supplier.
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Bank Name</label>
                    <input className="input" value={form.bank_name ?? ''} onChange={e => setF('bank_name', e.target.value)} placeholder="e.g. Citibank N.A." maxLength={100} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Account Number</label>
                    <input className="input" value={form.bank_account_no ?? ''} onChange={e => setF('bank_account_no', e.target.value)} placeholder="e.g. 001234567890" maxLength={50} style={{ fontFamily: 'monospace' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">SWIFT / BIC Code</label>
                      <input className="input" value={form.bank_swift_code ?? ''} onChange={e => setF('bank_swift_code', e.target.value.toUpperCase())} placeholder="e.g. CITIUS33" maxLength={20} style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">IBAN</label>
                      <input className="input" value={form.bank_iban ?? ''} onChange={e => setF('bank_iban', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="e.g. GB29NWBK60161331926819" maxLength={34} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                    </div>
                  </div>
                  {(form.bank_account_no || form.bank_iban) && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(21,128,61,0.07)', border: '1px solid rgba(21,128,61,0.2)', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', color: '#15803d' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Bank details saved — payment advice can be generated for this supplier.
                    </div>
                  )}
                </>
              )}

              {/* Footer actions */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--color-border)', marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['basic', 'contact', 'financial', 'bank'] as const).filter(t => t !== activeTab).slice(0, 2).map(t => (
                    <button key={t} type="button" className="btn-ghost" style={{ fontSize: '0.78rem', padding: '6px 12px' }} onClick={() => setActiveTab(t)}>
                      {t === 'basic' ? 'Identity' : t === 'contact' ? 'Contact' : t === 'financial' ? 'Financial' : 'Bank'} →
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-ghost" onClick={closeForm} disabled={saving}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={saving}
                    style={{ minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: saving ? undefined : 'linear-gradient(135deg,#0c4a6e,#0891b2)' }}>
                    {saving ? <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} />Saving…</> : editId ? 'Save Changes' : 'Create Supplier'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete Supplier?"
          message={`"${deleteTarget.name}" will be marked inactive and hidden from new transactions.`}
          onConfirm={() => deleteMut.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null),
            onError: (error: Error) => { setBannerError(error.message); setDeleteTarget(null); },
          })}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
