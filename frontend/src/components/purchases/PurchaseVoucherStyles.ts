import type { CSSProperties } from 'react';
import type { PurchaseMessageKind } from './PurchaseVoucherTypes';

// Shared style constants for trade documents and posted-document lists, built on the
// Calm Ledger tokens (see DESIGN.md). New screens should prefer the classes in globals.css.
export function badgeStyle(color: string, background: string): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    padding: '0 8px',
    borderRadius: 'var(--radius-full)',
    color,
    background,
    fontSize: 'var(--font-size-2xs)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  };
}

export function tableHeadStyle(right = false): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    height: 'var(--row-h)',
    padding: '0 8px',
    textAlign: right ? 'right' : 'left',
    background: 'var(--color-table-head-bg)',
    color: 'var(--color-table-head-text)',
    borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
    fontSize: 'var(--font-size-xs)',
    fontWeight: 600,
  };
}

export function tableCellStyle(right = false): CSSProperties {
  return {
    height: 'var(--row-h)',
    padding: '4px 8px',
    borderBottom: '1px solid var(--color-border-subtle)',
    background: 'var(--color-surface)',
    verticalAlign: 'middle',
    textAlign: right ? 'right' : 'left',
    fontVariantNumeric: right ? 'tabular-nums' : undefined,
    fontWeight: right ? 500 : undefined,
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
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 'var(--font-size-sm)',
  };
}

// Buttons take their size from the shared .btn-* classes.
export const compactButtonStyle: CSSProperties = {};

// Page header strip: unboxed, like PageHeader.
export const toolbarStyle: CSSProperties = {
  padding: '2px 0',
  flexShrink: 0,
};

export const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 20,
  padding: '0 8px',
  borderRadius: 'var(--radius-full)',
  border: '1px solid var(--color-neutral-border)',
  background: 'var(--color-neutral-bg)',
  color: 'var(--color-neutral-text)',
  fontSize: 'var(--font-size-2xs)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

export const dateMessageStyle: CSSProperties = {
  minHeight: 16,
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-danger-text)',
  fontWeight: 500,
  fontSize: 'var(--font-size-xs)',
  lineHeight: 1.3,
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
  // Wraps onto a second row instead of pushing the page sideways.
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '8px 12px',
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
  borderRadius: 'var(--radius-lg)',
  background: 'var(--color-surface)',
  padding: 12,
};

export const detailMessageStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 400,
  minHeight: 120,
};

export const purchaseListFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
  minHeight: 40,
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 500,
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
  width: 'var(--control-h-sm)',
  minWidth: 'var(--control-h-sm)',
  height: 'var(--control-h-sm)',
  padding: 0,
  color: 'var(--color-text-secondary)',
};
