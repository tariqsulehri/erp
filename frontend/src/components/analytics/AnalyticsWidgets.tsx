import type { CSSProperties, ReactNode } from 'react';

export function AnalyticsKpi({
  label,
  value,
  detail,
  accent,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
  tone: 'blue' | 'teal' | 'violet' | 'orange';
}) {
  return (
    <div style={{ ...analyticsKpiStyle, borderTopColor: accent, background: analyticsKpiBackground[tone] }}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 800 }}>{label}</span>
      <strong style={{ color: 'var(--color-heading)', fontSize: '1.05rem', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{value}</strong>
      <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.68rem', fontWeight: 800, textAlign: 'right' }}>{detail}</span>
    </div>
  );
}

export function InsightBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div style={analyticsInsightBoxStyle}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.66rem', fontWeight: 900 }}>{label}</span>
      <strong style={{ color: 'var(--color-heading)', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</strong>
      <span style={{ color: 'var(--color-amount)', fontFamily: 'var(--font-mono)', fontSize: '0.76rem', fontWeight: 900 }}>{detail}</span>
    </div>
  );
}

export function ChartMetricBadge({ label, value }: { label: string; value: string }) {
  return (
    <div style={chartMetricBadgeStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ChartTitle({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start', marginBottom: 8 }}>
      <div>
        <h2 style={{ margin: 0, color: 'var(--color-heading)', fontSize: '0.88rem', lineHeight: 1.15 }}>{title}</h2>
        <div style={{ marginTop: 3, color: 'var(--color-text-muted)', fontSize: '0.68rem', fontWeight: 700 }}>{subtitle}</div>
      </div>
      {right}
    </div>
  );
}

const analyticsKpiBackground = {
  blue: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12), var(--color-surface) 58%)',
  teal: 'linear-gradient(135deg, rgba(15, 118, 110, 0.12), var(--color-surface) 58%)',
  violet: 'linear-gradient(135deg, rgba(124, 58, 237, 0.12), var(--color-surface) 58%)',
  orange: 'linear-gradient(135deg, rgba(194, 65, 12, 0.12), var(--color-surface) 58%)',
} as const;

const analyticsKpiStyle: CSSProperties = {
  minHeight: 82,
  display: 'grid',
  gridTemplateRows: 'auto 1fr auto',
  gap: 5,
  padding: '10px 12px',
  border: '1px solid var(--color-border)',
  borderTop: '3px solid var(--color-primary)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
};

const analyticsInsightBoxStyle: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto auto',
  gap: 4,
  minHeight: 70,
  padding: '9px 11px',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(180deg, var(--color-surface), var(--color-surface-alt))',
};

const chartMetricBadgeStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 108,
  padding: '6px 9px',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--color-surface)',
  textAlign: 'right',
  color: 'var(--color-text-secondary)',
  fontSize: '0.62rem',
  fontWeight: 800,
};
