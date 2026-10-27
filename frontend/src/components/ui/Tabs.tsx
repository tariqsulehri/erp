'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Optional count shown after the label, e.g. number of records. */
  count?: number;
}

/**
 * Underline tabs for switching between views of one page (Bank Accounts / Cheque Books…).
 * Arrow keys move between tabs. Panels should use role="tabpanel" with aria-labelledby={`tab-${value}`}.
 */
export function Tabs<T extends string>({ value, items, onChange, label }: {
  value: T;
  items: Array<TabItem<T>>;
  onChange: (value: T) => void;
  label: string;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const index = items.findIndex(item => item.value === value);
    const next = items[(index + (event.key === 'ArrowRight' ? 1 : items.length - 1)) % items.length];
    onChange(next.value);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab="${next.value}"]`)?.focus();
  }

  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tabindex: the active tab takes focus, arrow keys move it
    <div className="tabs" role="tablist" aria-label={label} ref={listRef} onKeyDown={onKeyDown}>
      {items.map(item => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={`tab-${item.value}`}
            data-tab={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined && <span className="tab-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
