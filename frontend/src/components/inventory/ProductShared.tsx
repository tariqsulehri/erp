'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  formatDate,
  formatMoney,
  formatNumber,
  type AppFormatSettingsSource,
} from '@/lib/app-settings';

export const PRODUCT_TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  Finished:     { label: 'Finished Good',   color: '#0050b3', bg: '#e6f4ff' },
  RawMaterial:  { label: 'Raw Material',    color: '#047857', bg: '#d1fae5' },
  SemiFinished: { label: 'Semi-Finished',   color: '#006d75', bg: '#e6fffb' },
  Service:      { label: 'Service',         color: '#7c3aed', bg: '#f3e8ff' },
  Consumable:   { label: 'Consumable',      color: '#a16207', bg: '#fef9c3' },
};

export const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Active:       { label: 'Active',       color: '#14532d', bg: '#dcfce7', border: '#86efac' },
  Inactive:     { label: 'Inactive',     color: '#854d0e', bg: '#fef9c3', border: '#fde68a' },
  Discontinued: { label: 'Discontinued', color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
};

export const TAX_CATS   = ['Standard', 'Zero-Rated', 'Exempt'] as const;
export const PROD_TYPES = ['Finished', 'RawMaterial', 'SemiFinished', 'Service', 'Consumable'] as const;
export const STATUSES   = ['Active', 'Inactive', 'Discontinued'] as const;
export const TABS       = ['Basic', 'Pricing & Tax', 'Stock Control', 'Physical & Notes'] as const;

export type TabLabel = typeof TABS[number];
export type PageMode = 'list' | 'form' | 'detail';
export type SelectOption = { value: string; label: string; searchText?: string };

export const STATUS_OPTIONS: SelectOption[] = STATUSES.map(status => ({ value: status, label: STATUS_META[status].label }));
export const PRODUCT_TYPE_OPTIONS: SelectOption[] = PROD_TYPES.map(type => ({ value: type, label: PRODUCT_TYPE_META[type].label }));
export const TAX_CATEGORY_OPTIONS: SelectOption[] = TAX_CATS.map(tax => ({ value: tax, label: tax }));
export const STOCK_FILTER_OPTIONS: SelectOption[] = [
  { value: 'need_order', label: 'Need To Order', searchText: 'order reorder minimum low stock' },
  { value: 'below_minimum', label: 'Below Minimum', searchText: 'minimum low stock' },
  { value: 'at_or_below_reorder', label: 'At Or Below Reorder Level', searchText: 'reorder level order' },
  { value: 'out_of_stock', label: 'Out Of Stock', searchText: 'zero stock out' },
];

export const fmtAmt = (n: string | number | undefined, settings?: AppFormatSettingsSource | null) => {
  const v = Number(n ?? 0);
  return formatNumber(v, settings);
};

export const fmtQty = (n: string | number | undefined, settings?: AppFormatSettingsSource | null) => {
  const v = Number(n ?? 0);
  const baseSettings = settings ?? {};
  return v % 1 === 0
    ? formatNumber(v, { ...baseSettings, decimal_places: 0 })
    : formatNumber(v, { ...baseSettings, decimal_places: 3 });
};

export const fmtDate = (d: string | Date, settings?: AppFormatSettingsSource | null) => formatDate(d, settings);

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.Active;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: 10,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      letterSpacing: 0, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const m = PRODUCT_TYPE_META[type] ?? PRODUCT_TYPE_META.Finished;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: m.bg, color: m.color, whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

export function MoneyCell({ value, muted = false, settings }: { value?: string | number; muted?: boolean; settings?: AppFormatSettingsSource | null }) {
  return (
    <span
      style={{
        display: 'block',
        alignItems: 'baseline',
        width: '100%',
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: '0.8rem',
        color: muted ? 'var(--color-text-secondary)' : 'var(--color-debit)',
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
      }}
    >
      {formatMoney(Number(value ?? 0), settings)}
    </span>
  );
}

export function StockIndicator({ onHand, minLevel, reorderLevel, settings }: { onHand: string; minLevel?: string; reorderLevel?: string; settings?: AppFormatSettingsSource | null }) {
  const qty = parseFloat(onHand) || 0;
  const min = minLevel ? parseFloat(minLevel) : null;
  const reorder = reorderLevel ? parseFloat(reorderLevel) : null;
  const isBelowMin = min !== null && qty < min;
  const isAtReorder = reorder !== null && qty <= reorder;
  const isOut = qty <= 0;
  const badge = isOut ? 'Out' : isBelowMin ? 'Below Min' : isAtReorder ? 'Reorder' : null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, width: '100%' }}>
      <span style={{
        fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.8rem',
        minWidth: 56, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
        color: isOut ? 'var(--color-danger)' : (isBelowMin || isAtReorder) ? 'var(--color-warning)' : 'var(--color-text)',
      }}>
        {fmtQty(qty, settings)}
      </span>
      {badge && (
        <span style={{
          width: 58,
          textAlign: 'center',
          fontSize: '0.55rem',
          fontWeight: 800,
          color: isOut ? '#fff' : '#92400e',
          background: isOut ? 'var(--color-danger)' : '#fef3c7',
          padding: '1px 5px',
          borderRadius: 3,
          border: isOut ? 'none' : '1px solid #fcd34d',
          whiteSpace: 'nowrap',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

export function LabelInput({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 700,
        color: 'var(--color-text-secondary)',
        letterSpacing: 0, marginBottom: 4 }}>
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = 'Select',
  disabled = false,
  compact = false,
  width,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  width?: number | string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const visibleValue = open ? query : selected?.label ?? '';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => {
      const text = `${option.label} ${option.searchText ?? ''}`.toLowerCase();
      return text.includes(needle);
    });
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: width ?? '100%' }}>
      <input
        className="form-input"
        value={visibleValue}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={event => { setQuery(event.target.value); setOpen(true); }}
        style={{
          height: compact ? 32 : 36,
          paddingRight: 30,
          cursor: disabled ? 'not-allowed' : 'text',
          fontSize: compact ? '0.78rem' : '0.8125rem',
        }}
      />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: `translateY(-50%) ${open ? 'rotate(180deg)' : 'rotate(0deg)'}`,
          color: 'var(--color-text-muted)',
          pointerEvents: 'none',
          fontSize: 11,
          transition: 'transform var(--transition)',
        }}
      >
        ▼
      </span>
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            zIndex: 90,
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: 230,
            overflowY: 'auto',
            background: 'var(--color-surface)',
            border: '1.5px solid var(--color-border-focus)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)',
            padding: 4,
          }}
        >
          {placeholder && (
            <button
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
              style={{
                width: '100%',
                padding: compact ? '6px 8px' : '7px 9px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: value === '' ? 'var(--color-primary-light)' : 'transparent',
                color: 'var(--color-text-muted)',
                textAlign: 'left',
                fontSize: compact ? '0.76rem' : '0.8rem',
                cursor: 'pointer',
              }}
            >
              {placeholder}
            </button>
          )}
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 9px', color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
              No matching option
            </div>
          ) : filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }}
              style={{
                width: '100%',
                padding: compact ? '6px 8px' : '7px 9px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: value === option.value ? 'var(--color-primary-light)' : 'transparent',
                color: value === option.value ? 'var(--color-primary)' : 'var(--color-text)',
                textAlign: 'left',
                fontSize: compact ? '0.76rem' : '0.8rem',
                fontWeight: value === option.value ? 700 : 500,
                cursor: 'pointer',
                lineHeight: 1.35,
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
