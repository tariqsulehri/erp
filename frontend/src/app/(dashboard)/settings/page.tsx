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
import Link from 'next/link';
import {
  IconArrowsExchange,
  IconBuilding,
  IconCalculator,
  IconListTree,
  IconShieldLock,
  IconWorld,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TableMessageRow } from '@/components/ui/TableMessageRow';
import { useAccountsList, type AccountListItem } from '@/lib/api/accounts';
import {
  useCompanyProfile,
  useGeneralSettings,
  usePostingAccountSettings,
  useUpdateCompanyProfile,
  useUpdateGeneralSettings,
  useUpdatePostingAccountSettings,
  type PostingAccountSettings,
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

type Tab = 'company' | 'regional' | 'accounting' | 'posting-accounts' | 'coa' | 'security';

const TABS: { id: Tab; label: string; Icon: typeof IconBuilding }[] = [
  { id: 'company',          label: 'Company Profile',   Icon: IconBuilding },
  { id: 'regional',         label: 'Regional Settings', Icon: IconWorld },
  { id: 'accounting',       label: 'Accounting',        Icon: IconCalculator },
  { id: 'posting-accounts', label: 'Posting Accounts',  Icon: IconArrowsExchange },
  { id: 'coa',              label: 'Chart Of Accounts', Icon: IconListTree },
  { id: 'security',         label: 'Security',          Icon: IconShieldLock },
];

type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

type PostingAccountForm = {
  purchase: {
    default_cash_account_id: string;
    default_inventory_account_id: string;
    purchase_tax_account_id: string | null;
    freight_account_id: string | null;
    purchase_discount_account_id: string | null;
  };
  sale: {
    default_cash_account_id: string;
    default_inventory_account_id: string;
    sales_revenue_account_id: string;
    sales_tax_account_id: string | null;
    sales_discount_account_id: string | null;
    freight_income_account_id: string | null;
    cost_of_goods_sold_account_id: string;
  };
  stock_adjustment: {
    default_inventory_account_id: string;
    adjustment_gain_account_id: string;
    adjustment_loss_account_id: string;
  };
  year_end: {
    retained_earnings_account_id: string;
  };
};

type PostingAccountSectionKey = keyof PostingAccountForm;

type PostingAccountField = {
  section: PostingAccountSectionKey;
  idKey: string;
  codeKey: string;
  nameKey: string;
  label: string;
  hint: string;
  accountTypes: AccountType[];
  accountCodePrefixes: string[];
  required?: boolean;
};

/* ── Shared layout ──────────────────────────────────────────────────── */
/**
 * One settings row: label and a short description on the left, the control on the right.
 * Used for every setting on this page so all sections read the same way.
 */
function FormRow({
  label, hint, required = false, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="layout-label-row" style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <div style={{ paddingTop: 6 }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>
          {label}{required && <span className="field-required" aria-hidden>*</span>}
        </div>
        {hint && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ maxWidth: 420, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function RowGroupTitle({ children, first = false }: { children: React.ReactNode; first?: boolean }) {
  return <h3 className="form-section-title" style={{ margin: first ? '0 0 4px' : '20px 0 4px' }}>{children}</h3>;
}

/** Content panel for one settings section. The save action sits at the top right. */
function SettingsPanel({
  title, description, actions, children,
}: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div style={{ minWidth: 0 }}>
          <h2 className="panel-title">{title}</h2>
          {description && <p className="page-head-desc">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="panel-body" style={{ overflow: 'visible' }}>{children}</div>
    </section>
  );
}

function PanelLoading() {
  return (
    <div className="empty-state" style={{ padding: '32px 16px' }}>
      <span className="spinner" aria-hidden />
      <div className="empty-title">Loading Settings…</div>
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

function postingAccountFormFromSettings(settings: PostingAccountSettings): PostingAccountForm {
  return {
    purchase: {
      default_cash_account_id: settings.purchase?.default_cash_account_id ?? '',
      default_inventory_account_id: settings.purchase?.default_inventory_account_id ?? '',
      purchase_tax_account_id: settings.purchase?.purchase_tax_account_id ?? null,
      freight_account_id: settings.purchase?.freight_account_id ?? null,
      purchase_discount_account_id: settings.purchase?.purchase_discount_account_id ?? null,
    },
    sale: {
      default_cash_account_id: settings.sale?.default_cash_account_id ?? '',
      default_inventory_account_id: settings.sale?.default_inventory_account_id ?? '',
      sales_revenue_account_id: settings.sale?.sales_revenue_account_id ?? '',
      sales_tax_account_id: settings.sale?.sales_tax_account_id ?? null,
      sales_discount_account_id: settings.sale?.sales_discount_account_id ?? null,
      freight_income_account_id: settings.sale?.freight_income_account_id ?? null,
      cost_of_goods_sold_account_id: settings.sale?.cost_of_goods_sold_account_id ?? '',
    },
    stock_adjustment: {
      default_inventory_account_id: settings.stock_adjustment?.default_inventory_account_id ?? '',
      adjustment_gain_account_id: settings.stock_adjustment?.adjustment_gain_account_id ?? '',
      adjustment_loss_account_id: settings.stock_adjustment?.adjustment_loss_account_id ?? '',
    },
    year_end: {
      retained_earnings_account_id: settings.year_end?.retained_earnings_account_id ?? '',
    },
  };
}

function accountOption(account: AccountListItem): SelectOption {
  return {
    value: account.id,
    label: `${account.code} - ${account.name}`,
    searchText: `${account.code} ${account.name} ${account.account_type}`,
  };
}

function settingAccountOption(settings: PostingAccountSettings | undefined, field: PostingAccountField): SelectOption | null {
  const section = settings?.[field.section] as Record<string, string | null> | null | undefined;
  const value = section?.[field.idKey];
  const code = section?.[field.codeKey];
  const name = section?.[field.nameKey];
  if (!value || !code || !name) return null;
  return { value, label: `${code} - ${name}`, searchText: `${code} ${name}` };
}

function postingFieldValue(form: PostingAccountForm, field: PostingAccountField) {
  return ((form[field.section] as Record<string, string | null>)[field.idKey] ?? '') || '';
}

function typeHint(types: AccountType[]) {
  return types.length === 1 ? types[0] : types.join(' Or ');
}

function isRelevantPostingAccount(account: AccountListItem, field: PostingAccountField) {
  return field.accountTypes.includes(account.account_type as AccountType)
    && field.accountCodePrefixes.some(prefix => account.code.startsWith(prefix));
}

function categoryLabel(prefix: string) {
  if (prefix.startsWith('01')) return `Asset ${prefix}`;
  if (prefix.startsWith('02')) return `Liability ${prefix}`;
  if (prefix.startsWith('03')) return `Equity ${prefix}`;
  if (prefix.startsWith('04')) return `Revenue ${prefix}`;
  if (prefix.startsWith('05')) return `Expense ${prefix}`;
  return prefix;
}

const PURCHASE_POSTING_FIELDS: PostingAccountField[] = [
  {
    section: 'purchase',
    idKey: 'default_cash_account_id',
    codeKey: 'default_cash_account_code',
    nameKey: 'default_cash_account_name',
    label: 'Cash Account',
    hint: 'Credited when a purchase is paid by cash',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010110'],
    required: true,
  },
  {
    section: 'purchase',
    idKey: 'default_inventory_account_id',
    codeKey: 'default_inventory_account_code',
    nameKey: 'default_inventory_account_name',
    label: 'Inventory Account',
    hint: 'Debited for purchased stock value',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010130'],
    required: true,
  },
  {
    section: 'purchase',
    idKey: 'purchase_tax_account_id',
    codeKey: 'purchase_tax_account_code',
    nameKey: 'purchase_tax_account_name',
    label: 'Purchase Tax Account',
    hint: 'Debited for purchase tax you can claim back',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010140'],
  },
  {
    section: 'purchase',
    idKey: 'freight_account_id',
    codeKey: 'freight_account_code',
    nameKey: 'freight_account_name',
    label: 'Freight Account',
    hint: 'Debited for purchase freight and delivery charges',
    accountTypes: ['Expense'],
    accountCodePrefixes: ['050210'],
  },
  {
    section: 'purchase',
    idKey: 'purchase_discount_account_id',
    codeKey: 'purchase_discount_account_code',
    nameKey: 'purchase_discount_account_name',
    label: 'Purchase Discount Account',
    hint: 'Credited when purchase discount is posted',
    accountTypes: ['Expense'],
    accountCodePrefixes: ['050210'],
  },
];

const SALES_POSTING_FIELDS: PostingAccountField[] = [
  {
    section: 'sale',
    idKey: 'default_cash_account_id',
    codeKey: 'default_cash_account_code',
    nameKey: 'default_cash_account_name',
    label: 'Cash Account',
    hint: 'Debited when a sale is paid by cash',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010110'],
    required: true,
  },
  {
    section: 'sale',
    idKey: 'default_inventory_account_id',
    codeKey: 'default_inventory_account_code',
    nameKey: 'default_inventory_account_name',
    label: 'Inventory Account',
    hint: 'Credited when sold stock cost is posted',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010130'],
    required: true,
  },
  {
    section: 'sale',
    idKey: 'sales_revenue_account_id',
    codeKey: 'sales_revenue_account_code',
    nameKey: 'sales_revenue_account_name',
    label: 'Sales Revenue Account',
    hint: 'Credited for product sale value',
    accountTypes: ['Revenue'],
    accountCodePrefixes: ['040110'],
    required: true,
  },
  {
    section: 'sale',
    idKey: 'sales_tax_account_id',
    codeKey: 'sales_tax_account_code',
    nameKey: 'sales_tax_account_name',
    label: 'Sales Tax Account',
    hint: 'Credited for sales tax you must pay',
    accountTypes: ['Liability'],
    accountCodePrefixes: ['020130'],
  },
  {
    section: 'sale',
    idKey: 'sales_discount_account_id',
    codeKey: 'sales_discount_account_code',
    nameKey: 'sales_discount_account_name',
    label: 'Sales Discount Account',
    hint: 'Debited for discount allowed to customers',
    accountTypes: ['Expense'],
    accountCodePrefixes: ['050220'],
  },
  {
    section: 'sale',
    idKey: 'freight_income_account_id',
    codeKey: 'freight_income_account_code',
    nameKey: 'freight_income_account_name',
    label: 'Freight Income Account',
    hint: 'Credited for freight charged to customers',
    accountTypes: ['Revenue'],
    accountCodePrefixes: ['040120'],
  },
  {
    section: 'sale',
    idKey: 'cost_of_goods_sold_account_id',
    codeKey: 'cost_of_goods_sold_account_code',
    nameKey: 'cost_of_goods_sold_account_name',
    label: 'Cost Of Goods Sold Account',
    hint: 'Debited for sold stock cost',
    accountTypes: ['Expense'],
    accountCodePrefixes: ['050110'],
    required: true,
  },
];

const STOCK_ADJUSTMENT_POSTING_FIELDS: PostingAccountField[] = [
  {
    section: 'stock_adjustment',
    idKey: 'default_inventory_account_id',
    codeKey: 'default_inventory_account_code',
    nameKey: 'default_inventory_account_name',
    label: 'Inventory Account',
    hint: 'Debited or credited for inventory value changes',
    accountTypes: ['Asset'],
    accountCodePrefixes: ['010130'],
    required: true,
  },
  {
    section: 'stock_adjustment',
    idKey: 'adjustment_gain_account_id',
    codeKey: 'adjustment_gain_account_code',
    nameKey: 'adjustment_gain_account_name',
    label: 'Adjustment Gain Account',
    hint: 'Credited when stock value increases',
    accountTypes: ['Revenue'],
    accountCodePrefixes: ['040130'],
    required: true,
  },
  {
    section: 'stock_adjustment',
    idKey: 'adjustment_loss_account_id',
    codeKey: 'adjustment_loss_account_code',
    nameKey: 'adjustment_loss_account_name',
    label: 'Adjustment Loss Account',
    hint: 'Debited when stock value decreases',
    accountTypes: ['Expense'],
    accountCodePrefixes: ['050230'],
    required: true,
  },
];

const YEAR_END_POSTING_FIELDS: PostingAccountField[] = [
  {
    section: 'year_end',
    idKey: 'retained_earnings_account_id',
    codeKey: 'retained_earnings_account_code',
    nameKey: 'retained_earnings_account_name',
    label: 'Retained Earnings Account',
    hint: 'Receives the yearly profit or loss when a Fiscal Year is closed',
    accountTypes: ['Equity'],
    accountCodePrefixes: ['0302'],
    required: true,
  },
];

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
  }, [settings]);

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
    <SettingsPanel
      title="Regional Settings"
      description="Country, time zone, and how dates, numbers, and money appear."
      actions={(
        <Button variant="primary" onClick={() => mutation.mutate(form)} disabled={!dirty || Boolean(separatorError)} loading={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Regional Settings'}
        </Button>
      )}
    >
      <div style={{ display: 'grid', gap: 8, marginBottom: separatorError || error || saved ? 12 : 0 }}>
        {separatorError && <InlineAlert tone="danger">{separatorError}</InlineAlert>}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {saved && <InlineAlert tone="success">Regional settings saved.</InlineAlert>}
      </div>

      <RowGroupTitle first>Location And Time</RowGroupTitle>

      <FormRow label="Country" hint="Default country for reports, addresses, and new records">
        <select className="form-input" aria-label="Country" value={form.default_country_code} onChange={e => set('default_country_code', e.target.value)}>
          {APP_COUNTRY_OPTIONS.map(country => (
            <option key={country.code} value={country.code}>{country.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Time Zone" hint="Used for entry times, reports, and change history dates">
        <select className="form-input" aria-label="Time Zone" value={form.time_zone} onChange={e => set('time_zone', e.target.value)}>
          {APP_TIME_ZONE_OPTIONS.map(timeZone => (
            <option key={timeZone.value} value={timeZone.value}>{timeZone.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Language And Locale" hint="Sets the local style for dates, numbers, and language">
        <select className="form-input" aria-label="Language And Locale" value={form.locale} onChange={e => set('locale', e.target.value)}>
          {APP_LOCALE_OPTIONS.map(locale => (
            <option key={locale.value} value={locale.value}>{locale.label}</option>
          ))}
        </select>
      </FormRow>

      <RowGroupTitle>Date And Number Format</RowGroupTitle>

      <FormRow label="Date Format" hint="How dates appear on screens and printed documents">
        <select className="form-input" aria-label="Date Format" value={form.date_format} onChange={e => set('date_format', e.target.value)}>
          {APP_DATE_FORMAT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.value} - {option.label}</option>
          ))}
        </select>
      </FormRow>

      <FormRow label="Time Format" hint="How time appears in the application">
        <select className="form-input" aria-label="Time Format" value={form.time_format} onChange={e => set('time_format', e.target.value)}>
          <option value="12-hour">12-Hour Time</option>
          <option value="24-hour">24-Hour Time</option>
        </select>
      </FormRow>

      <FormRow label="Decimal Places" hint="Digits after the decimal point for money values">
        <input
          className="form-input is-numeric"
          aria-label="Decimal Places"
          type="number"
          min={0}
          max={6}
          step={1}
          inputMode="numeric"
          value={form.decimal_places}
          onFocus={selectNumericValue}
          onMouseUp={keepNumericValueSelected}
          onChange={e => set('decimal_places', Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
          style={{ width: 120, fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'right' }}
        />
      </FormRow>

      <FormRow label="Thousand Separator" hint="Character used to group thousands">
        <select className="form-input" aria-label="Thousand Separator" value={form.thousand_separator} onChange={e => set('thousand_separator', e.target.value)} style={{ width: 180 }}>
          <option value=",">Comma (,)</option>
          <option value=".">Dot (.)</option>
          <option value="'">Apostrophe (&apos;)</option>
          <option value=" ">Space</option>
        </select>
      </FormRow>

      <FormRow label="Decimal Separator" hint="Character used before decimal digits">
        <select className="form-input" aria-label="Decimal Separator" value={form.decimal_separator} onChange={e => set('decimal_separator', e.target.value)} style={{ width: 180 }}>
          <option value=".">Dot (.)</option>
          <option value=",">Comma (,)</option>
        </select>
      </FormRow>

      <RowGroupTitle>Currency</RowGroupTitle>

      <FormRow label="Currency" hint="Default currency for new records and reports">
        <select
          className="form-input"
          aria-label="Currency"
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

      <FormRow label="Currency Symbol" hint="Short symbol or code shown with money values">
        <input className="form-input" aria-label="Currency Symbol" value={form.currency_symbol} onChange={e => set('currency_symbol', e.target.value.slice(0, 10))} maxLength={10} style={{ width: 140 }} />
      </FormRow>

      <FormRow label="Currency Position" hint="Where the currency symbol appears">
        <select
          className="form-input"
          aria-label="Currency Position"
          value={form.currency_position}
          onChange={e => set('currency_position', e.target.value)}
          style={{ width: 200 }}
        >
          {APP_CURRENCY_POSITION_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </FormRow>

      <RowGroupTitle>Preview</RowGroupTitle>
      <dl className="detail-list" style={{ margin: '8px 0 0' }}>
        {[
          { label: 'Date', value: formatDate('2026-12-31', form) || formatSampleDate(form.date_format) },
          { label: 'Number', value: sampleNumber },
          { label: 'Money', value: formatMoney(1234567.89, form) },
        ].map(item => (
          <div key={item.label} className="detail-row" style={{ gridTemplateColumns: '220px minmax(0, 1fr)' }}>
            <dt>{item.label}</dt>
            <dd style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </SettingsPanel>
  );
}

/* ── Company Profile tab ────────────────────────────────────────────── */
function CompanyTab({ company }: { company: any }) {
  const [form, setForm]     = useState({ ...company });
  const [dirty, setDirty]   = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => { setForm({ ...company }); setDirty(false); }, [company]);

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
    <SettingsPanel
      title="Company Profile"
      description="Legal name, registration, contact, and address details."
      actions={(
        <Button variant="primary" onClick={() => mutation.mutate(form)} disabled={!dirty || !form.name?.trim()} loading={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save Company Profile'}
        </Button>
      )}
    >
      <div style={{ display: 'grid', gap: 8, marginBottom: error || saved ? 12 : 0 }}>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {saved && <InlineAlert tone="success">Company profile saved.</InlineAlert>}
      </div>

      <RowGroupTitle first>Company</RowGroupTitle>
      <FormRow label="Company Name" hint="Company name as it is registered" required>
        <input className="form-input" aria-label="Company Name" value={form.name ?? ''} onChange={set('name')} maxLength={100} aria-invalid={!form.name?.trim() || undefined} />
      </FormRow>
      <FormRow label="Description" hint="Optional short description">
        <textarea className="form-input" aria-label="Description" value={form.description ?? ''} onChange={set('description')} rows={2} style={{ resize: 'vertical' }} maxLength={500} />
      </FormRow>
      <FormRow label="Registration Number" hint="Number given when the company was registered">
        <input className="form-input" aria-label="Registration Number" value={form.registration_number ?? ''} onChange={set('registration_number')} maxLength={50} />
      </FormRow>
      <FormRow label="Tax ID Or NTN" hint="National Tax Number or VAT registration">
        <input className="form-input" aria-label="Tax ID Or NTN" value={form.tax_id ?? ''} onChange={set('tax_id')} maxLength={50} />
      </FormRow>

      <RowGroupTitle>Contact</RowGroupTitle>
      <FormRow label="Email Address" hint="Primary company email">
        <input className="form-input" aria-label="Email Address" type="email" value={form.email ?? ''} onChange={set('email')} maxLength={100} />
      </FormRow>
      <FormRow label="Phone" hint="Primary contact number">
        <input className="form-input" aria-label="Phone" type="tel" value={form.phone ?? ''} onChange={set('phone')} maxLength={30} />
      </FormRow>

      <RowGroupTitle>Address</RowGroupTitle>
      <FormRow label="Street Address">
        <input className="form-input" aria-label="Street Address" value={form.address ?? ''} onChange={set('address')} maxLength={200} />
      </FormRow>
      <FormRow label="City">
        <input className="form-input" aria-label="City" value={form.city ?? ''} onChange={set('city')} maxLength={100} />
      </FormRow>
      <FormRow label="Country">
        <input className="form-input" aria-label="Country" value={form.country ?? ''} onChange={set('country')} maxLength={100} />
      </FormRow>
    </SettingsPanel>
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
  }, [company?.id, company?.fiscal_year_basis, company?.number_of_periods]);

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
    { value: 'calendar', label: 'Calendar Year (January To December)' },
    { value: 'july',     label: 'July To June (Pakistan Fiscal Year)' },
    { value: 'april',    label: 'April To March (UK And India Fiscal Year)' },
  ];

  return (
    <SettingsPanel
      title="Accounting"
      description="When the fiscal year starts and how it is split into periods."
      actions={(
        <Button
          variant="primary"
          onClick={() => mutation.mutate({ fiscal_year_basis: fyBasis as any, number_of_periods: parseInt(periods) })}
          disabled={!dirty}
          loading={mutation.isPending}
        >
          {mutation.isPending ? 'Saving…' : 'Save Accounting Settings'}
        </Button>
      )}
    >
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        <InlineAlert tone="warning">
          If you change the fiscal year or currency after entering transactions, reports may not match. Make these changes before you enter any vouchers.
        </InlineAlert>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {saved && <InlineAlert tone="success">Accounting settings saved.</InlineAlert>}
      </div>

      <FormRow label="Fiscal Year" hint="When your company's financial year starts">
        <div role="radiogroup" aria-label="Fiscal Year" style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
          {FY_OPTIONS.map(opt => (
            <label key={opt.value} className="check-field" style={{ minHeight: 0 }}>
              <input type="radio" name="fy_basis" value={opt.value}
                checked={fyBasis === opt.value}
                onChange={() => { setFyBasis(opt.value); setDirty(true); setSaved(false); }}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FormRow>

      <FormRow label="Accounting Periods" hint="Number of periods in each fiscal year (usually 12 monthly periods)">
        <SegmentedControl
          label="Accounting Periods"
          value={periods}
          options={[
            { value: '12', label: '12 Monthly' },
            { value: '4', label: '4 Quarterly' },
            { value: '1', label: '1 Annual' },
          ]}
          onChange={value => { setPeriods(value); setDirty(true); setSaved(false); }}
        />
      </FormRow>
    </SettingsPanel>
  );
}

/* ── Posting Accounts tab ──────────────────────────────────────────── */
function PostingAccountsTab() {
  const settingsQuery = usePostingAccountSettings();
  const accountsQuery = useAccountsList({ page: 1, limit: 200, is_active: true, is_posting: true });
  const mutation = useUpdatePostingAccountSettings();
  const [form, setForm] = useState<PostingAccountForm | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!settingsQuery.data) return;
    setForm(postingAccountFormFromSettings(settingsQuery.data));
    setDirty(false);
    setError('');
  }, [settingsQuery.data]);

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
    if (mutation.error) setError(mutation.error.message);
  }, [mutation.error]);

  const accounts = accountsQuery.data?.data ?? [];
  const allFields = [
    ...PURCHASE_POSTING_FIELDS,
    ...SALES_POSTING_FIELDS,
    ...STOCK_ADJUSTMENT_POSTING_FIELDS,
    ...YEAR_END_POSTING_FIELDS,
  ];
  const missingRequiredFields = form
    ? allFields.filter(field => field.required && !postingFieldValue(form, field).trim())
    : [];

  const setFieldValue = (field: PostingAccountField, value: string) => {
    setForm(current => {
      if (!current) return current;
      const section = { ...(current[field.section] as Record<string, string | null>) };
      section[field.idKey] = value || null;
      return { ...current, [field.section]: section } as PostingAccountForm;
    });
    setDirty(true);
    setSaved(false);
    setError('');
  };

  const optionsFor = (field: PostingAccountField) => {
    const options = accounts
      .filter(account => isRelevantPostingAccount(account, field))
      .map(accountOption);
    const currentOption = settingAccountOption(settingsQuery.data, field);
    if (currentOption && !options.some(option => option.value === currentOption.value)) {
      return [currentOption, ...options];
    }
    return options;
  };

  const renderSection = (title: string, description: string, fields: PostingAccountField[], first = false) => (
    <section>
      <RowGroupTitle first={first}>{title}</RowGroupTitle>
      <p className="form-hint" style={{ margin: 0 }}>{description}</p>
      {fields.map(field => {
        const value = form ? postingFieldValue(form, field) : '';
        const selectedOption = settingAccountOption(settingsQuery.data, field);
        return (
          <FormRow
            key={`${field.section}-${field.idKey}`}
            label={field.label}
            required={field.required}
            hint={`${field.hint}. Account Type: ${typeHint(field.accountTypes)}.`}
          >
            <SearchableSelect
              value={value}
              options={optionsFor(field)}
              onChange={nextValue => setFieldValue(field, nextValue)}
              placeholder={field.required ? 'Select Account' : 'No Account'}
              selectedLabel={selectedOption?.label}
              disabled={settingsQuery.isLoading || accountsQuery.isLoading || mutation.isPending}
            />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
              {field.accountCodePrefixes.map(prefix => (
                <Badge key={prefix} variant="neutral">{categoryLabel(prefix)}</Badge>
              ))}
            </div>
          </FormRow>
        );
      })}
    </section>
  );

  const saveAction = (
    <Button
      variant="primary"
      onClick={() => form && mutation.mutate(form)}
      disabled={!dirty || missingRequiredFields.length > 0 || !form}
      loading={mutation.isPending}
    >
      {mutation.isPending ? 'Saving…' : 'Save Posting Accounts'}
    </Button>
  );

  const panelDescription = 'Used automatically when Purchase, Sales, Returns, and Stock Adjustment documents are posted, and when a Fiscal Year is closed.';

  if (settingsQuery.error) {
    return (
      <SettingsPanel title="Posting Accounts" description={panelDescription}>
        <InlineAlert tone="danger">{settingsQuery.error.message}</InlineAlert>
      </SettingsPanel>
    );
  }

  if (settingsQuery.isLoading || !form) {
    return <SettingsPanel title="Posting Accounts" description={panelDescription}><PanelLoading /></SettingsPanel>;
  }

  return (
    <SettingsPanel title="Posting Accounts" description={panelDescription} actions={saveAction}>
      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {accountsQuery.error && <InlineAlert tone="danger">{accountsQuery.error.message}</InlineAlert>}
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {saved && <InlineAlert tone="success">Posting accounts saved.</InlineAlert>}
        {missingRequiredFields.length > 0 && (
          <InlineAlert tone="danger">Select the required accounts: {missingRequiredFields.map(field => field.label).join(', ')}.</InlineAlert>
        )}
        {accountsQuery.data && accountsQuery.data.pagination.total > accounts.length && (
          <InlineAlert tone="warning">
            Only the first {accounts.length} active posting accounts are shown. Some accounts may be missing from the lists.
          </InlineAlert>
        )}
      </div>

      {renderSection('Purchase Posting Accounts', 'Default accounts used by purchase invoices and purchase returns.', PURCHASE_POSTING_FIELDS, true)}
      {renderSection('Sales Posting Accounts', 'Default accounts used by sale invoices and sale returns.', SALES_POSTING_FIELDS)}
      {renderSection('Stock Adjustment Posting Accounts', 'Default accounts used when stock value increases or decreases.', STOCK_ADJUSTMENT_POSTING_FIELDS)}
      {renderSection('Year-End Closing Account', 'Used when a Fiscal Year is closed, to move the year\'s profit or loss into Equity.', YEAR_END_POSTING_FIELDS)}
    </SettingsPanel>
  );
}

/* ── COA tab ────────────────────────────────────────────────────────── */
function COATab({ generalSettings }: { generalSettings: any }) {
  const { data } = useAccountsList({ page: 1, limit: 200 });
  const accounts = data?.data ?? [];

  const stats = [
    { label: 'Total Accounts', value: data?.pagination?.total ?? 0 },
    { label: 'Posting Accounts Shown', value: accounts.filter((a: any) => a.is_posting).length },
    { label: 'Header Accounts Shown', value: accounts.filter((a: any) => !a.is_posting).length },
    { label: 'Inactive Accounts Shown', value: accounts.filter((a: any) => !a.is_active).length },
  ];

  const byType = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(t => ({
    type:  t,
    count: accounts.filter((a: any) => a.account_type === t).length,
  })).filter(t => t.count > 0);

  const withBalance = accounts.filter((a: any) => a.is_posting && a.opening_balance !== null);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SettingsPanel title="Chart Of Accounts" description="A summary you can only view. Change accounts on the Chart Of Accounts screen.">
        <RowGroupTitle first>Summary</RowGroupTitle>
        <dl className="detail-list" style={{ margin: '8px 0 0' }}>
          {stats.map(stat => (
            <div key={stat.label} className="detail-row" style={{ gridTemplateColumns: '220px minmax(0, 1fr)' }}>
              <dt>{stat.label}</dt>
              <dd style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{stat.value}</dd>
            </div>
          ))}
        </dl>

        <RowGroupTitle>Accounts By Type</RowGroupTitle>
        {byType.length === 0 ? (
          <p className="form-hint">No accounts yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginTop: 8, maxWidth: 640 }}>
            {byType.map(t => {
              const pct = data?.pagination?.total ? Math.round((t.count / data.pagination.total) * 100) : 0;
              return (
                <div key={t.type} style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr) 48px', alignItems: 'center', gap: 12, fontSize: 'var(--font-size-sm)' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600, fontSize: 'var(--font-size-xs)' }}>{t.type}</span>
                  <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-border-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-primary)', borderRadius: 'var(--radius-full)' }} />
                  </div>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>{t.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </SettingsPanel>

      <section className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Opening Balances</h2>
          <span className="filter-bar-end">{withBalance.length} {withBalance.length === 1 ? 'Account' : 'Accounts'}</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Account Code</th>
                <th>Account Name</th>
                <th className="num" style={{ width: 180 }}>Opening Balance</th>
                <th style={{ width: 130 }}>As Of Date</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.length === 0 && (
                <TableMessageRow colSpan={4} title="No Opening Balances Yet" description="Edit accounts in the Chart Of Accounts to add opening balances." />
              )}
              {withBalance.map((a: any) => (
                <tr key={a.id}>
                  <td className="cell-strong">{a.code}</td>
                  <td>{a.name}</td>
                  <td className="num" style={parseFloat(a.opening_balance) < 0 ? { color: 'var(--color-negative)' } : undefined}>
                    {formatMoney(parseFloat(a.opening_balance), generalSettings)}
                  </td>
                  <td className="cell-muted">
                    {a.opening_balance_date ? formatDate(a.opening_balance_date, generalSettings) : 'Not Set'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ── Security tab ───────────────────────────────────────────────────── */
function SecurityTab() {
  const activeFeatures = [
    {
      title: 'User Management',
      desc: 'Add and remove users and set their workplace access.',
      href: '/settings/users',
      actionLabel: 'Manage Users',
    },
    {
      title: 'Access By Role',
      desc: 'Review roles (Admin, Manager, Accountant, Viewer) and their exact capabilities.',
      href: '/settings/roles',
      actionLabel: 'View Roles & Matrix',
    },
    {
      title: 'Audit Log',
      desc: 'A full chronological record of what each user does across the enterprise.',
      href: '/settings/audit-logs',
      actionLabel: 'Open Audit Log',
    },
  ];

  const plannedFeatures = [
    { title: 'Password Policy', desc: 'Set the minimum length, required characters, and how often passwords must change.' },
    { title: 'Two-Factor Sign-In', desc: 'Ask for a second sign-in step for all users, or for admins only.' },
  ];

  return (
    <SettingsPanel title="Security & Governance" description="User management, role-based access control, and enterprise activity logs.">
      {activeFeatures.map(item => (
        <FormRow key={item.title} label={item.title} hint={item.desc}>
          <div style={{ paddingTop: 6 }}>
            <Link href={item.href}>
              <Button variant="secondary" size="sm">{item.actionLabel}</Button>
            </Link>
          </div>
        </FormRow>
      ))}

      {plannedFeatures.map(item => (
        <FormRow key={item.title} label={item.title} hint={item.desc}>
          <div style={{ paddingTop: 6 }}><Badge variant="neutral">Planned</Badge></div>
        </FormRow>
      ))}
    </SettingsPanel>
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

  const loading = isLoading || isGeneralSettingsLoading;
  const activeTab = TABS.find(t => t.id === tab);

  return (
    <main className="page-shell">
      <PageHeader
        title="Settings"
        description="Company profile, regional formats, accounting, and posting accounts."
        help={(
          <>
            <p>Use this screen to set up your company. Pick a section on the left, make changes, then select its Save button.</p>
            <ul>
              <li>Regional Settings control how dates, numbers, and money appear everywhere.</li>
              <li>Accounting sets when the fiscal year starts and how many Periods it has.</li>
              <li>Posting Accounts are the accounts used automatically when documents are posted.</li>
            </ul>
            <p>Change the fiscal year or currency only before you enter any vouchers.</p>
          </>
        )}
      />

      {error && <InlineAlert tone="danger">{error.message}</InlineAlert>}
      {generalSettingsError && <InlineAlert tone="danger">{generalSettingsError.message}</InlineAlert>}

      <div className="layout-nav-content" style={{ flex: 1, minHeight: 0 }}>
        {/* Section navigation */}
        <nav className="panel" aria-label="Settings Sections" style={{ alignSelf: 'start' }}>
          <div style={{ padding: 6, display: 'grid', gap: 2 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="btn-ghost"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setTab(t.id)}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    gap: 10,
                    padding: '0 10px',
                    background: active ? 'var(--color-primary-light)' : undefined,
                    color: active ? 'var(--color-primary-text)' : 'var(--color-text-secondary)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <t.Icon size={16} stroke={1.8} aria-hidden />
                  {t.label}
                </button>
              );
            })}
          </div>

          {company && (
            <div style={{ padding: '10px 16px 12px', borderTop: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 2 }}>Active Company</div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-heading)' }}>{company.name}</div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                {[generalSettings?.currency_code, generalSettings?.time_zone].filter(Boolean).join(' · ') || 'Not Set'}
              </div>
            </div>
          )}
        </nav>

        {/* Section content */}
        <div style={{ minHeight: 0, overflow: 'auto' }}>
          {loading ? (
            <SettingsPanel title={activeTab?.label ?? 'Settings'}><PanelLoading /></SettingsPanel>
          ) : (
            <>
              {tab === 'company'          && company && <CompanyTab company={company} />}
              {tab === 'regional'         && generalSettings && <RegionalTab settings={generalSettings} />}
              {tab === 'accounting'       && company && <AccountingTab company={company} />}
              {tab === 'posting-accounts' && <PostingAccountsTab />}
              {tab === 'coa'              && generalSettings && <COATab generalSettings={generalSettings} />}
              {tab === 'security'         && <SecurityTab />}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
