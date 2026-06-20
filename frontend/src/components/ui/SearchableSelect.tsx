'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  searchText?: string;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
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
          setOpen(true);
          setQuery('');
        }}
        onChange={event => {
          setQuery(event.currentTarget.value);
          setOpen(true);
        }}
        style={compactInputStyle}
      />
      <span aria-hidden style={chevronStyle(open)}>▼</span>
      {open && !disabled && (
        <div style={dropdownMenuStyle}>
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
            <div style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              No Record Found
            </div>
          )}
        </div>
      )}
    </div>
  );
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
    fontSize: '0.76rem',
    fontWeight: selected ? 700 : 500,
    cursor: 'pointer',
  };
}

function chevronStyle(open: boolean): CSSProperties {
  return {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: `translateY(-50%) ${open ? 'rotate(180deg)' : 'rotate(0deg)'}`,
    color: 'var(--color-text-muted)',
    pointerEvents: 'none',
    fontSize: 10,
  };
}

const compactInputStyle: CSSProperties = {
  height: 28,
  minHeight: 28,
  padding: '3px 8px',
  fontSize: '0.76rem',
};

const dropdownMenuStyle: CSSProperties = {
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
};
