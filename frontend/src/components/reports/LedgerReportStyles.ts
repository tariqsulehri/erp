import type { CSSProperties } from 'react';

export const reportToolbarStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--color-workspace-shadow)',
  padding: '8px 10px',
  flexShrink: 0,
};

export const reportTitleIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 'var(--radius)',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
  background: 'linear-gradient(135deg, #155eef, #0f766e)',
};

export const reportFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(260px, 1.7fr) 132px 132px auto',
  gap: 8,
  alignItems: 'end',
  overflow: 'visible',
};

export const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
};

export function reportTableHeadStyle(right = false): CSSProperties {
  return {
    height: 30,
    padding: '5px 7px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    border: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
    fontWeight: 900,
  };
}

export function reportTableCellStyle(right = false): CSSProperties {
  return {
    padding: '5px 7px',
    border: '1px solid var(--color-border-subtle)',
    background: 'var(--color-surface)',
    verticalAlign: 'middle',
    textAlign: right ? 'right' : 'left',
    fontFamily: right ? 'var(--font-mono)' : undefined,
    fontWeight: right ? 800 : undefined,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
}

export function reportTableTotalCellStyle(right = false): CSSProperties {
  return {
    ...reportTableCellStyle(right),
    background: 'var(--color-primary-light)',
    color: 'var(--color-heading)',
    borderTop: '2px solid var(--color-primary)',
    borderBottom: '1px solid var(--color-primary)',
    padding: '7px 7px',
    fontSize: '0.78rem',
    fontWeight: 900,
  };
}

export function summaryBoxStyle(accent = false): CSSProperties {
  return {
    minHeight: 56,
    border: `1px solid ${accent ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius)',
    background: accent ? 'var(--color-primary-light)' : 'var(--color-surface)',
    padding: '9px 10px',
    display: 'grid',
    gap: 4,
    alignContent: 'space-between',
  };
}
