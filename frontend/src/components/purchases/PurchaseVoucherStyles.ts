import type { CSSProperties } from 'react';
import type { PurchaseMessageKind } from './PurchaseVoucherTypes';

export function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 22,
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    color,
    background,
    fontSize: '0.68rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  };
}

export function tableHeadStyle(right = false): CSSProperties {
  return {
    height: 30,
    padding: '5px 7px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    border: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
  };
}

export function tableCellStyle(right = false): CSSProperties {
  return {
    padding: 4,
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

export function messageStyle(kind: PurchaseMessageKind): CSSProperties {
  return {
    flexShrink: 0,
    borderRadius: 'var(--radius)',
    padding: '7px 10px',
    border: `1px solid ${kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
    background: kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
    color: kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '0.78rem',
  };
}

export const compactButtonStyle: CSSProperties = {
  minHeight: 30,
  padding: '5px 10px',
  fontSize: '0.76rem',
};

export const toolbarStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: 'var(--color-workspace-shadow)',
  padding: '8px 10px',
  flexShrink: 0,
};

export const titleIconStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 'var(--radius)',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
  background: 'linear-gradient(135deg, #0f6bff, #14b8a6)',
};

export const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 22,
  padding: '2px 8px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-alt)',
  color: 'var(--color-text-secondary)',
  fontSize: '0.68rem',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};

export const dateMessageStyle: CSSProperties = {
  minHeight: 16,
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-danger-text)',
  fontWeight: 500,
  fontSize: '0.66rem',
  lineHeight: 1.2,
  padding: 0,
  overflow: 'hidden',
};

export const addLineRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'end',
  padding: '0 0 8px',
  minWidth: 0,
  position: 'relative',
  zIndex: 5,
  overflow: 'visible',
};

export const summaryFooterStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 12,
  alignItems: 'center',
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 10,
  minHeight: 66,
  overflow: 'hidden',
};

export const summaryValuesStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  overflow: 'hidden',
};

export const purchaseFilterGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.6fr) minmax(210px, 1.35fr) 112px minmax(190px, 1.2fr) 118px 118px 112px 112px auto',
  gap: 7,
  alignItems: 'end',
  overflow: 'visible',
  position: 'relative',
  zIndex: 6,
};

export const purchaseDetailPanelStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  gap: 8,
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  background: 'var(--color-surface)',
  padding: 8,
};

export const detailMessageStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  color: 'var(--color-text-muted)',
  fontSize: '0.76rem',
  fontWeight: 700,
  minHeight: 120,
};

export const purchaseListFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minHeight: 34,
  color: 'var(--color-text-muted)',
  fontSize: '0.74rem',
  fontWeight: 700,
  borderTop: '1px solid var(--color-border-subtle)',
  paddingTop: 6,
};

export const lineActionGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
};

export const lineActionButtonStyle: CSSProperties = {
  width: 20,
  minWidth: 20,
  minHeight: 24,
  padding: 2,
  color: 'var(--color-text-secondary)',
};
