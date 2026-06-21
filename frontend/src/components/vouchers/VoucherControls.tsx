'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatMoney } from '@/lib/app-settings';

export interface VoucherSelectOption {
  value: string;
  label: string;
  searchText?: string;
}

function dropdownButton(selected: boolean): CSSProperties {
  return {
    width: '100%',
    display: 'block',
    padding: '7px 9px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: selected ? 'var(--color-primary-light)' : 'transparent',
    color: selected ? 'var(--color-primary-text)' : 'var(--color-text)',
    textAlign: 'left',
    fontSize: '0.8rem',
    fontWeight: selected ? 700 : 500,
    cursor: 'pointer',
  };
}

export function SearchableSelect({
  value,
  options,
  onChange,
  onFocus,
  placeholder,
  disabled = false,
}: {
  value: string;
  options: VoucherSelectOption[];
  onChange: (value: string) => void;
  onFocus?: () => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find(option => option.value === value);
  const visibleValue = open ? query : selected?.label ?? '';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className="form-input"
        value={visibleValue}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          onFocus?.();
          setOpen(true);
          setQuery('');
        }}
        onChange={event => {
          setQuery(event.currentTarget.value);
          setOpen(true);
        }}
        style={{ height: 28, minHeight: 28, padding: '3px 24px 3px 8px' }}
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
          fontSize: 10,
        }}
      >
        ▼
      </span>
      {open && !disabled && (
        <div
          style={{
            position: 'absolute',
            zIndex: 80,
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
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('');
              setOpen(false);
              setQuery('');
            }}
            style={dropdownButton(value === '')}
          >
            {placeholder}
          </button>
          {filtered.map(option => (
            <button
              key={option.value}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
              style={dropdownButton(option.value === value)}
            >
              {option.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              No Record Found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldLabel({ label, required = false, children }: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          marginBottom: 2,
          color: 'var(--color-text-secondary)',
          fontSize: '0.67rem',
          fontWeight: 800,
          lineHeight: 1.15,
        }}
      >
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

export function SummaryRow({
  label,
  value,
  strong = false,
  danger = false,
  width = 124,
  formatMoneyValue = formatMoney,
}: {
  label: string;
  value: number;
  strong?: boolean;
  danger?: boolean;
  width?: number;
  formatMoneyValue?: (value: number) => string;
}) {
  return (
    <div style={{ width, minWidth: 0 }}>
      <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: '0.66rem', fontWeight: 800, lineHeight: 1.1 }}>
        {label}
      </span>
      <span
        style={{
          display: 'block',
          marginTop: 4,
          minHeight: 32,
          padding: '6px 8px',
          border: `1px solid ${danger ? 'var(--color-danger-border)' : strong ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius)',
          background: danger ? 'var(--color-danger-bg)' : strong ? 'var(--color-primary-light)' : 'var(--color-surface)',
          fontFamily: 'var(--font-mono)',
          fontSize: strong ? '0.82rem' : '0.78rem',
          fontWeight: strong ? 900 : 800,
          color: danger ? 'var(--color-danger-text)' : strong ? 'var(--color-heading)' : 'var(--color-amount)',
          textAlign: 'right',
          lineHeight: 1.2,
        }}
      >
        {formatMoneyValue(value)}
      </span>
    </div>
  );
}
