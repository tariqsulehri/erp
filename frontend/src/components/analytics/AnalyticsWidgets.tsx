import type { CSSProperties, ReactNode } from 'react';

/**
 * Flat summary figure for analytics screens: 12px/600 muted label, figure in heading ink,
 * one line of muted context. No colored tops, tints, or shadows.
 * `accent` and `tone` are kept for existing callers and are intentionally ignored.
 */
export function AnalyticsKpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
  tone?: 'blue' | 'teal' | 'violet' | 'orange';
}) {
  return (
    <div style={analyticsKpiStyle}>
      <span style={labelStyle}>{label}</span>
      <strong style={{ color: 'var(--color-heading)', fontSize: 'var(--font-size-lg)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{value}</strong>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'right' }}>{detail}</span>
    </div>
  );
}

export function InsightBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={analyticsInsightBoxStyle}>
      <span style={labelStyle}>{label}</span>
      <strong style={{ color: 'var(--color-heading)', fontSize: 'var(--font-size-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</strong>
      <span style={{ color: 'var(--color-amount)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{detail}</span>
    </div>
  );
}

/** Small right-aligned figure in a chart header, e.g. Monthly Average. */
export function ChartMetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={chartMetricStyle}>
      <span style={labelStyle}>{label}</span>
      <strong style={{ color: 'var(--color-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</strong>
    </div>
  );
}

export function ChartTitle({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'start', marginBottom: 8 }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="panel-title">{title}</h2>
        <div style={{ marginTop: 2, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>{subtitle}</div>
      </div>
      {right}
    </div>
  );
}

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

/** Donut chart with its total in the middle and a value legend beside it. */
export function DonutLayout({ chart, centerLabel, centerValue, legend }: { chart: ReactNode; centerLabel: string; centerValue: string; legend: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(0, 1fr)', gap: 12, alignItems: 'center', minHeight: 185 }}>
      <div style={{ position: 'relative', height: 185 }}>
        {chart}
        <div style={donutCenterStyle}>
          <span>{centerLabel}</span>
          <strong style={{ color: 'var(--color-heading)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{centerValue}</strong>
        </div>
      </div>
      {legend}
    </div>
  );
}

const donutCenterStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'grid',
  gap: 2,
  textAlign: 'center',
  pointerEvents: 'none',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-xs)',
  maxWidth: 110,
};

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

/** Chart container: a flat panel. */
export const chartPanelStyle: CSSProperties = {
  minHeight: 0,
  padding: 12,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface)',
};

const labelStyle: CSSProperties = { color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', fontWeight: 600 };

const analyticsKpiStyle: CSSProperties = {
  minHeight: 68,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 4,
  padding: '10px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface)',
};

const analyticsInsightBoxStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto auto',
  gap: 4,
  minHeight: 58,
  padding: '8px 10px',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
};

const chartMetricStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 96,
  textAlign: 'right',
  fontSize: 'var(--font-size-xs)',
};
