'use client';

/**
 * Settings Page
 *
 * Tabs:
 *  Company Profile  — name, registration, tax ID, contact, address
 *  Accounting       — currency, fiscal year basis, number of periods
 *  Chart of Accounts — COA summary stats (read-only)
 *  Security         — placeholder (user/role management coming soon)
 */

import { useState, useEffect } from 'react';
import { useAccountsList } from '@/lib/api/accounts';
import {
  useCompanyProfile,
  useGeneralSettings,
  useUpdateCompanyProfile,
  useUpdateGeneralSettings,
} from '@/lib/api/settings';
import {
  APP_COUNTRY_OPTIONS,
  APP_CURRENCY_POSITION_OPTIONS,
  APP_CURRENCY_OPTIONS,
  APP_CURRENCY_SYMBOLS,
  APP_DATE_FORMAT_OPTIONS,
  APP_LOCALE_OPTIONS,
  APP_TIME_ZONE_OPTIONS,
  defaultAppFormatSettings,
  formatDate,
  formatMoney,
} from '@/lib/app-settings';

type Tab = 'company' | 'regional' | 'accounting' | 'coa' | 'security';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'company',    label: 'Company Profile',    icon: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8' },
  { id: 'regional',   label: 'Regional Settings',  icon: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 010 18M12 3a14 14 0 000 18' },
  { id: 'accounting', label: 'Accounting',         icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z' },
  { id: 'coa',        label: 'Chart of Accounts',  icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id: 'security',   label: 'Security',           icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
];

/* ── Shared input wrapper ───────────────────────────────────────────── */
function FormRow({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start', padding: '16px 0', borderBottom: '1px solid var(--color-border)' }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        {hint && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ maxWidth: 420 }}>{children}</div>
    </div>
  );
}

function selectNumericValue(event: { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

function keepNumericValueSelected(event: { preventDefault: () => void }) {
  event.preventDefault();
}

function formatSampleDate(format: string) {
  switch (format) {
    case 'MM/dd/yyyy': return '12/31/2026';
    case 'yyyy-MM-dd': return '2026-12-31';
    case 'dd-MMM-yyyy': return '31-Dec-2026';
    default: return '31/12/2026';
  }
}

function formatSampleNumber(decimalPlaces: number, thousandSeparator: string, decimalSeparator: string) {
  const normalizedPlaces = Math.max(0, Math.min(6, Number(decimalPlaces) || 0));
  const fixed = (1234567.89).toFixed(normalizedPlaces);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSeparator);
  return fraction ? `${grouped}${decimalSeparator}${fraction}` : grouped;
}

/* ── Regional Settings tab ─────────────────────────────────────────── */
function RegionalTab({ settings }: { settings: any }) {
  const [form, setForm] = useState({
    currency_code: settings.currency_code ?? defaultAppFormatSettings.currencyCode,
    currency_symbol: settings.currency_symbol ?? defaultAppFormatSettings.currencySymbol,
    decimal_places: Number(settings.decimal_places ?? defaultAppFormatSettings.decimalPlaces),
    thousand_separator: settings.thousand_separator ?? defaultAppFormatSettings.thousandsSeparator,
    decimal_separator: settings.decimal_separator ?? defaultAppFormatSettings.decimalSeparator,
    date_format: settings.date_format ?? defaultAppFormatSettings.dateDisplayFormat,
    time_format: settings.time_format ?? defaultAppFormatSettings.timeFormat,
    time_zone: settings.time_zone ?? defaultAppFormatSettings.timeZone,
    locale: settings.locale ?? defaultAppFormatSettings.locale,
    default_country_code: settings.default_country_code ?? defaultAppFormatSettings.countryCode,
    currency_position: settings.currency_position ?? defaultAppFormatSettings.currencyPosition,
  });
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      currency_code: settings.currency_code ?? defaultAppFormatSettings.currencyCode,
      currency_symbol: settings.currency_symbol ?? defaultAppFormatSettings.currencySymbol,
      decimal_places: Number(settings.decimal_places ?? defaultAppFormatSettings.decimalPlaces),
      thousand_separator: settings.thousand_separator ?? defaultAppFormatSettings.thousandsSeparator,
      decimal_separator: settings.decimal_separator ?? defaultAppFormatSettings.decimalSeparator,
      date_format: settings.date_format ?? defaultAppFormatSettings.dateDisplayFormat,
      time_format: settings.time_format ?? defaultAppFormatSettings.timeFormat,
      time_zone: settings.time_zone ?? defaultAppFormatSettings.timeZone,
      locale: settings.locale ?? defaultAppFormatSettings.locale,
      default_country_code: settings.default_country_code ?? defaultAppFormatSettings.countryCode,
      currency_position: settings.currency_position ?? defaultAppFormatSettings.currencyPosition,
    });
    setDirty(false);
    setSaved(false);
    setError('');
  }, [settings?.id]);

  const mutation = useUpdateGeneralSettings();

  useEffect(() => {
    if (mutation.isSuccess) {
      setSaved(true);
      setDirty(false);
      setError('');
      const timeoutId = window.setTimeout(() => setSaved(false), 3000);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [mutation.isSuccess]);

  useEffect(() => {
    if (mutation.error) {
      setError(mutation.error.message);
    }
  }, [mutation.error]);

  const set = (field: keyof typeof form, value: string | number) => {
    setForm(current => ({ ...current, [field]: value }));
    setDirty(true);
    setSaved(false);
    setError('');
  };

  const separatorError = form.thousand_separator === form.decimal_separator
    ? 'Thousand Separator and Decimal Separator cannot be the same.'
    : '';
  const sampleNumber = formatSampleNumber(form.decimal_places, form.thousand_separator, form.decimal_separator);

  return (
    <div>
      <div style={{ padding: '10px 0 8px', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: 0 }}>
        Location And Time
      </div>

      <FormRow label="Country" hint="Default country for reports, addresses, and new records">
        <select className="form-input" value={form.default_country_code} onChange={e => set('default_country_code', e.target.value)}>
          {APP_COUNTRY_OPTIONS.map(country => (
            <option key={country.code} value={country.code}>{country.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Time Zone" hint="Used for transaction time, reports, and audit dates">
        <select className="form-input" value={form.time_zone} onChange={e => set('time_zone', e.target.value)}>
          {APP_TIME_ZONE_OPTIONS.map(timeZone => (
            <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Language / Locale" hint="Controls local date, number, and language conventions">
        <select className="form-input" value={form.locale} onChange={e => set('locale', e.target.value)}>
          {APP_LOCALE_OPTIONS.map(locale => (
            <option key={locale.value} value={locale.value}>{locale.label}</option>
          ))}
        </select>
      </FormRow>

      <div style={{ padding: '20px 0 8px', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: 0 }}>
        Date And Number Format
      </div>

      <FormRow label="Date Format" hint="How dates should appear on screens and printed documents">
        <select className="form-input" value={form.date_format} onChange={e => set('date_format', e.target.value)}>
          {APP_DATE_FORMAT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.value} - {option.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Time Format" hint="How time should appear in the application">
        <select className="form-input" value={form.time_format} onChange={e => set('time_format', e.target.value)}>
          <option value="12-hour">12-Hour Time</option>
          <option value="24-hour">24-Hour Time</option>
        </select>
      </FormRow>

      <FormRow label="Decimal Places" hint="Default digits after decimal for money values">
        <input
          className="form-input"
          type="number"
          min={0}
          max={6}
          step={1}
          inputMode="numeric"
          value={form.decimal_places}
          onFocus={selectNumericValue}
          onMouseUp={keepNumericValueSelected}
          onChange={e => set('decimal_places', Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
          style={{ width: 120, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}
        />
      </FormRow>

      <FormRow label="Thousand Separator" hint="Character used to group thousands">
        <select className="form-input" value={form.thousand_separator} onChange={e => set('thousand_separator', e.target.value)} style={{ width: 160 }}>
          <option value=",">Comma (,)</option>
          <option value=".">Dot (.)</option>
          <option value="'">Apostrophe (')</option>
          <option value=" ">Space</option>
        </select>
      </FormRow>

      <FormRow label="Decimal Separator" hint="Character used before decimal digits">
        <select className="form-input" value={form.decimal_separator} onChange={e => set('decimal_separator', e.target.value)} style={{ width: 160 }}>
          <option value=".">Dot (.)</option>
          <option value=",">Comma (,)</option>
        </select>
      </FormRow>

      <div style={{ padding: '20px 0 8px', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: 0 }}>
        Currency
      </div>

      <FormRow label="Currency" hint="Default currency used for new records and reports">
        <select
          className="form-input"
          value={form.currency_code}
          onChange={e => {
            const currencyCode = e.target.value;
            setForm(current => ({
              ...current,
              currency_code: currencyCode,
              currency_symbol: APP_CURRENCY_SYMBOLS[currencyCode] ?? currencyCode,
            }));
            setDirty(true);
            setSaved(false);
            setError('');
          }}
        >
          {APP_CURRENCY_OPTIONS.map(currency => (
            <option key={currency.code} value={currency.code}>{currency.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Currency Symbol" hint="Short symbol or code shown before money values">
        <input className="form-input" value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value.slice(0, 10))} maxLength={10} style={{ width: 140, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} />
      </FormRow>

      <FormRow label="Currency Position" hint="Choose where the currency symbol appears">
        <select
          className="form-input"
          value={form.currency_position}
          onChange={e => set('currency_position', e.target.value)}
          style={{ width: 190 }}
        >
          {APP_CURRENCY_POSITION_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FormRow>

      <div style={{
        marginTop: 16,
        padding: '14px 16px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 12,
      }}>
        {[
          { label: 'Date Preview', value: formatDate('2026-12-31', form) || formatSampleDate(form.date_format) },
          { label: 'Number Preview', value: sampleNumber },
          { label: 'Money Preview', value: formatMoney(1234567.89, form) },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, color: 'var(--color-text)', fontSize: 'var(--font-size-sm)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {separatorError && <div className="alert alert-danger" style={{ marginTop: 16 }}>{separatorError}</div>}
      {error && <div className="alert alert-danger" style={{ marginTop: 16 }}>{error}</div>}
      {saved  && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
          Regional settings saved
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary"
          onClick={() => mutation.mutate(form)}
          disabled={!dirty || mutation.isPending || Boolean(separatorError)}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {mutation.isPending && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          {mutation.isPending ? 'Saving...' : 'Save Regional Settings'}
        </button>
      </div>
    </div>
  );
}

/* ── Company Profile tab ────────────────────────────────────────────── */
function CompanyTab({ company }: { company: any }) {
  const [form, setForm]     = useState({ ...company });
  const [dirty, setDirty]   = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { setForm({ ...company }); setDirty(false); }, [company?.id]);

  const mutation = useUpdateCompanyProfile();

  useEffect(() => {
    if (mutation.isSuccess) {
      setSaved(true);
      setDirty(false);
      setError('');
      const timeoutId = window.setTimeout(() => setSaved(false), 3000);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [mutation.isSuccess]);

  useEffect(() => {
    if (mutation.error) {
      setError(mutation.error.message);
    }
  }, [mutation.error]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f: any) => ({ ...f, [field]: e.target.value || null }));
    setDirty(true);
    setSaved(false);
  };

  return (
    <div>
      <FormRow label="Company Name" hint="Legal entity name as registered">
        <input className="form-input" value={form.name ?? ''} onChange={set('name')} maxLength={100} />
      </FormRow>
      <FormRow label="Description" hint="Optional short description">
        <textarea className="form-input" value={form.description ?? ''} onChange={set('description')} rows={2} style={{ resize: 'vertical' }} maxLength={500} />
      </FormRow>
      <FormRow label="Registration No." hint="Company registration or incorporation number">
        <input className="form-input" value={form.registration_number ?? ''} onChange={set('registration_number')} maxLength={50} />
      </FormRow>
      <FormRow label="Tax ID / NTN" hint="National Tax Number or VAT registration">
        <input className="form-input" value={form.tax_id ?? ''} onChange={set('tax_id')} maxLength={50} />
      </FormRow>

      <div style={{ padding: '16px 0 8px', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: 0 }}>
        Contact
      </div>

      <FormRow label="Email" hint="Primary company email">
        <input className="form-input" type="email" value={form.email ?? ''} onChange={set('email')} maxLength={100} />
      </FormRow>
      <FormRow label="Phone" hint="Primary contact number">
        <input className="form-input" type="tel" value={form.phone ?? ''} onChange={set('phone')} maxLength={30} />
      </FormRow>

      <div style={{ padding: '16px 0 8px', fontWeight: 700, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', letterSpacing: 0 }}>
        Address
      </div>

      <FormRow label="Street Address">
        <input className="form-input" value={form.address ?? ''} onChange={set('address')} maxLength={200} />
      </FormRow>
      <FormRow label="City">
        <input className="form-input" value={form.city ?? ''} onChange={set('city')} maxLength={100} />
      </FormRow>
      <FormRow label="Country">
        <input className="form-input" value={form.country ?? ''} onChange={set('country')} maxLength={100} />
      </FormRow>

      {error && <div className="alert alert-danger" style={{ marginTop: 16 }}>{error}</div>}
      {saved  && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
          ✓ Company profile saved
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary"
          onClick={() => mutation.mutate(form)}
          disabled={!dirty || mutation.isPending || !form.name?.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {mutation.isPending && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          {mutation.isPending ? 'Saving…' : 'Save Company Profile'}
        </button>
      </div>
    </div>
  );
}

/* ── Accounting tab ─────────────────────────────────────────────────── */
function AccountingTab({ company }: { company: any }) {
  const [fyBasis,   setFyBasis]   = useState(company.fiscal_year_basis ?? 'calendar');
  const [periods,   setPeriods]   = useState(String(company.number_of_periods ?? 12));
  const [dirty,     setDirty]     = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    setFyBasis(company.fiscal_year_basis ?? 'calendar');
    setPeriods(String(company.number_of_periods ?? 12));
    setDirty(false);
  }, [company?.id]);

  const mutation = useUpdateCompanyProfile();

  useEffect(() => {
    if (mutation.isSuccess) {
      setSaved(true);
      setDirty(false);
      setError('');
      const timeoutId = window.setTimeout(() => setSaved(false), 3000);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [mutation.isSuccess]);

  useEffect(() => {
    if (mutation.error) {
      setError(mutation.error.message);
    }
  }, [mutation.error]);

  const FY_OPTIONS = [
    { value: 'calendar', label: 'Calendar Year (Jan – Dec)' },
    { value: 'july',     label: 'July – June  (Pakistani FY)' },
    { value: 'april',    label: 'April – March (UK / India FY)' },
  ];

  return (
    <div>
      <FormRow label="Fiscal Year" hint="When your company's financial year starts">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {FY_OPTIONS.map(opt => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="radio" name="fy_basis" value={opt.value}
                checked={fyBasis === opt.value}
                onChange={() => { setFyBasis(opt.value); setDirty(true); setSaved(false); }}
              />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>{opt.label}</span>
            </label>
          ))}
        </div>
      </FormRow>

      <FormRow label="Accounting Periods" hint="Number of periods per fiscal year (typically 12 monthly)">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[12, 4, 1].map(n => (
            <button key={n}
              onClick={() => { setPeriods(String(n)); setDirty(true); setSaved(false); }}
              style={{
                padding: '6px 18px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${periods === String(n) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: periods === String(n) ? 'var(--color-primary)' : 'var(--color-surface)',
                color: periods === String(n) ? 'white' : 'var(--color-text)',
                fontWeight: 600, cursor: 'pointer', fontSize: 'var(--font-size-sm)',
              }}
            >
              {n === 12 ? '12 — Monthly' : n === 4 ? '4 — Quarterly' : '1 — Annual'}
            </button>
          ))}
        </div>
      </FormRow>

      {/* Info box */}
      <div style={{
        marginTop: 12, padding: '12px 16px',
        background: '#fffbeb', border: '1px solid #fde68a',
        borderRadius: 'var(--radius)', fontSize: 'var(--font-size-xs)',
        color: '#92400e',
      }}>
        ⚠ Changing fiscal year or currency settings after transactions have been entered may cause inconsistencies. Make these changes before recording any journal entries.
      </div>

      {error && <div className="alert alert-danger" style={{ marginTop: 16 }}>{error}</div>}
      {saved  && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 'var(--radius)', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
          ✓ Accounting settings saved
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <button className="btn btn-primary"
          onClick={() => mutation.mutate({ fiscal_year_basis: fyBasis as any, number_of_periods: parseInt(periods) })}
          disabled={!dirty || mutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {mutation.isPending && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
          {mutation.isPending ? 'Saving…' : 'Save Accounting Settings'}
        </button>
      </div>
    </div>
  );
}

/* ── COA tab ────────────────────────────────────────────────────────── */
function COATab({ generalSettings }: { generalSettings: any }) {
  const { data } = useAccountsList({ page: 1, limit: 1000 });
  const accounts = data?.data ?? [];

  const stats = [
    { label: 'Total Accounts',    value: data?.pagination?.total ?? 0,                   color: '#2563eb' },
    { label: 'Posting Accounts',  value: accounts.filter((a: any) => a.is_posting).length,  color: '#16a34a' },
    { label: 'Header Accounts',   value: accounts.filter((a: any) => !a.is_posting).length, color: '#7c3aed' },
    { label: 'Inactive Accounts', value: accounts.filter((a: any) => !a.is_active).length,  color: '#dc2626' },
  ];

  const byType = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => ({
    type:  t,
    count: accounts.filter((a: any) => a.account_type === t).length,
  })).filter(t => t.count > 0);

  const withBalance = accounts.filter((a: any) => a.is_posting && a.opening_balance != null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding: '16px', borderRadius: 'var(--radius)',
            border: `1px solid ${s.color}30`,
            background: `${s.color}08`, textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* By type */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">Accounts by Type</h3></div>
        <div className="card-body">
          {byType.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>No accounts yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {byType.map(t => {
                const pct = data?.pagination?.total ? Math.round((t.count / data.pagination.total) * 100) : 0;
                return (
                  <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 80, fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{t.type}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 4 }} />
                    </div>
                    <span style={{ width: 40, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textAlign: 'right' }}>{t.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Opening balances summary */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Opening Balances</h3>
        </div>
        <div className="card-body">
          {withBalance.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No opening balances set. Edit individual accounts in the Chart of Accounts to add them.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '6px 0', textAlign: 'left', fontWeight: 600 }}>Code</th>
                  <th style={{ padding: '6px 0', textAlign: 'left', fontWeight: 600 }}>Account</th>
                  <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>As of Date</th>
                </tr>
              </thead>
              <tbody>
                {withBalance.map((a: any) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 0', fontFamily: 'monospace', fontWeight: 700 }}>{a.code}</td>
                    <td style={{ padding: '8px 12px' }}>{a.name}</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: a.opening_balance >= 0 ? '#16a34a' : '#dc2626' }}>
                      {formatMoney(parseFloat(a.opening_balance), generalSettings)}
                    </td>
                    <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
                      {a.opening_balance_date ? formatDate(a.opening_balance_date, generalSettings) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Security tab ───────────────────────────────────────────────────── */
function SecurityTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {[
        { title: 'User Management',    desc: 'Add, remove, and manage user accounts and permissions.',       badge: 'Coming Soon' },
        { title: 'Role-Based Access',  desc: 'Define roles (Admin, Accountant, Viewer) and assign to users.', badge: 'Coming Soon' },
        { title: 'Audit Log',          desc: 'Full system-wide audit trail of all user actions.',            badge: 'Coming Soon' },
        { title: 'Password Policy',    desc: 'Enforce minimum length, complexity, and rotation rules.',      badge: 'Coming Soon' },
        { title: '2FA / MFA',          desc: 'Require two-factor authentication for all or admin users.',    badge: 'Coming Soon' },
      ].map(item => (
        <div key={item.title} style={{
          padding: 20, borderRadius: 'var(--radius)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          opacity: 0.7,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 2 }}>{item.title}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>{item.desc}</div>
          </div>
          <span style={{
            fontSize: '0.6875rem', fontWeight: 700,
            color: '#7c3aed', background: '#f5f3ff',
            padding: '3px 10px', borderRadius: 10, border: '1px solid #ddd6fe',
            flexShrink: 0,
          }}>{item.badge}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company');

  const { data: company, isLoading, error } = useCompanyProfile();
  const {
    data: generalSettings,
    isLoading: isGeneralSettingsLoading,
    error: generalSettingsError,
  } = useGeneralSettings();

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure your company profile and system preferences</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error.message}</div>}
      {generalSettingsError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{generalSettingsError.message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left nav ────────────────────────────────────────────── */}
        <div className="card" style={{ position: 'sticky', top: 24 }}>
          <nav style={{ padding: '8px 0' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 16px',
                background: tab === t.id ? 'var(--color-primary-light)' : 'none',
                border: 'none', borderLeft: `3px solid ${tab === t.id ? 'var(--color-primary)' : 'transparent'}`,
                cursor: 'pointer', textAlign: 'left',
                color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text)',
                fontWeight: tab === t.id ? 700 : 400,
                fontSize: 'var(--font-size-sm)',
                transition: 'all 0.1s',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
                  <path d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Company badge at bottom */}
          {company && (
            <div style={{
              padding: '12px 16px', margin: '8px', borderRadius: 'var(--radius)',
              background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: 2 }}>Active Company</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 700, color: 'var(--color-text)' }}>{company.name}</div>
              {generalSettings?.currency_code && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', marginTop: 2, fontWeight: 600 }}>
                  {generalSettings.currency_code}
                </div>
              )}
              {generalSettings?.time_zone && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {generalSettings.time_zone}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">{TABS.find(t => t.id === tab)?.label}</h2>
          </div>
          <div className="card-body" style={{ padding: '8px 24px 24px' }}>
            {isLoading || isGeneralSettingsLoading ? (
              <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
              </div>
            ) : (
              <>
                {tab === 'company'    && company && <CompanyTab    company={company} />}
                {tab === 'regional'   && generalSettings && <RegionalTab settings={generalSettings} />}
                {tab === 'accounting' && company && <AccountingTab company={company} />}
                {tab === 'coa'                   && generalSettings && <COATab generalSettings={generalSettings} />}
                {tab === 'security'              && <SecurityTab />}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
