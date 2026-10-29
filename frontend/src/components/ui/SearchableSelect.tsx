'use client';

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import { fieldStyle } from './FormFields';

export interface SelectOption {
  value: string;
  label: string;
  searchText?: string;
}

export function SearchableSelect({
  value,
  options,
  onChange,
  onSearchChange,
  onFocus,
  placeholder,
  disabled = false,
  selectedLabel,
  ariaLabel,
  style,
  className,
  hidePlaceholderOption = false,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  onSearchChange?: (value: string) => void;
  onFocus?: () => void;
  placeholder: string;
  disabled?: boolean;
  selectedLabel?: string;
  /** Accessible name when the field has no wrapping <label> (e.g. label in a separate column). */
  ariaLabel?: string;
  style?: CSSProperties;
  className?: string;
  /** When true, do not render the top placeholder as a selectable clear row. */
  hidePlaceholderOption?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // -1 is the "clear" row (placeholder), 0..n-1 are filtered options.
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = options.find(option => option.value === value);
  const visibleValue = open ? query : selected?.label ?? selectedLabel ?? '';
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => `${option.label} ${option.searchText ?? ''}`.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  });

  useEffect(() => {
    if (!open) return;
    const item = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, open]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  function choose(nextValue: string) {
    onChange(nextValue);
    close();
    onSearchChange?.('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(index => Math.max(-1, Math.min(filtered.length - 1, index + step)));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(activeIndex === -1 ? '' : filtered[activeIndex]?.value ?? value);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close();
    }
  }

  const optionId = (index: number) => `${listId}-option-${index + 1}`;

  return (
    <div ref={wrapRef} className={className} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        className="form-input"
        value={visibleValue}
        disabled={disabled}
        placeholder={placeholder}
        onClick={() => {
          if (!open && !disabled) {
            setOpen(true);
            setQuery('');
            setActiveIndex(Math.max(-1, options.findIndex(option => option.value === value)));
          }
        }}
        onFocus={() => {
          onFocus?.();
          setOpen(true);
          setQuery('');
          setActiveIndex(Math.max(-1, options.findIndex(option => option.value === value)));
          onSearchChange?.('');
        }}
        onChange={event => {
          const nextQuery = event.currentTarget.value;
          setQuery(nextQuery);
          setActiveIndex(nextQuery.trim() ? 0 : -1);
          onSearchChange?.(nextQuery);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        style={{ ...fieldStyle('compact'), paddingRight: 32, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
      <IconChevronDown size={16} stroke={1.8} aria-hidden style={chevronStyle(open)} />
      {open && !disabled && (
        <div ref={listRef} id={listId} role="listbox" style={dropdownMenuStyle}>
          {/* Combobox pattern: focus stays in the input and arrow keys move aria-activedescendant, so options take clicks only. */}
          {!hidePlaceholderOption && placeholder && (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              id={optionId(-1)}
              data-index={-1}
              role="option"
              aria-selected={value === ''}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(-1)}
              onClick={() => choose('')}
              style={dropdownButton(value === '', activeIndex === -1)}
            >
              {placeholder}
            </div>
          )}
          {filtered.map((option, index) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={option.value}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={option.value === value}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option.value)}
              style={dropdownButton(option.value === value, activeIndex === index)}
            >
              {option.label}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              No Match Found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function dropdownButton(selected: boolean, active: boolean): CSSProperties {
  return {
    width: '100%',
    display: 'block',
    minHeight: 30,
    padding: '6px 8px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    background: selected ? 'var(--color-primary-light)' : active ? 'var(--color-surface-alt)' : 'transparent',
    color: selected ? 'var(--color-primary-text)' : 'var(--color-text)',
    textAlign: 'left',
    fontSize: 'var(--font-size-sm)',
    fontWeight: selected ? 600 : 400,
    cursor: 'pointer',
  };
}

function chevronStyle(open: boolean): CSSProperties {
  return {
    position: 'absolute',
    right: 9,
    top: '50%',
    transform: `translateY(-50%) ${open ? 'rotate(180deg)' : 'rotate(0deg)'}`,
    transition: 'transform var(--transition)',
    color: 'var(--color-text-muted)',
    pointerEvents: 'none',
  };
}

const dropdownMenuStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 'var(--z-dropdown)',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  maxHeight: 230,
  overflowY: 'auto',
  background: 'var(--color-surface-raised)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-overlay)',
  padding: 4,
};
