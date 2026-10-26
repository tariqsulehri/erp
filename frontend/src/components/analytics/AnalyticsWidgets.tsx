import type { CSSProperties, ReactNode } from 'react';

/** Legend with a swatch, the name, and the value right-aligned. Use beside pies and donuts. */
export function ChartValueLegend({ items }: { items: Array<{ name: string; color: string; value: string }> }) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
      {items.map(item => (
        <li key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 'var(--radius-xs)', background: item.color, flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tooltip body shared by every chart: heading line, then swatch, name, and right-aligned value. */
export function ChartTooltipBox({ label, entries }: { label?: ReactNode; entries: Array<{ key: string; name: string; color?: string; value: string }> }) {
  return (
    <div style={chartTooltipStyle}>
      {label !== undefined && label !== '' && <strong style={{ display: 'block', marginBottom: 6, fontWeight: 600, color: 'var(--color-heading)' }}>{label}</strong>}
      {entries.map(entry => (
        <div key={entry.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1px 0' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 'var(--radius-xs)', background: entry.color, flexShrink: 0 }} />
          <span style={{ flex: 1, color: 'var(--color-text-muted)' }}>{entry.name}</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

const chartTooltipStyle: CSSProperties = {
  minWidth: 180,
  padding: '8px 10px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface-raised)',
  boxShadow: 'var(--shadow-overlay)',
  fontSize: 'var(--font-size-xs)',
  color: 'var(--color-text)',
};
