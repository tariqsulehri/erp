'use client';

import type { ReactNode } from 'react';
import {
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconFilePlus,
  IconPrinter,
  IconReceipt,
  IconRefresh,
} from '@tabler/icons-react';
import { badgeStyle, compactButtonStyle, voucherSummaryFooterStyle, voucherSummaryValuesStyle } from './VoucherShared';
import type { VoucherMessageKind } from './VoucherShared';

export function VoucherPageHeader({
  title,
  badgeText,
  badgeColor,
  badgeBackground,
  accent,
  icon,
  mode = 'Add',
  status = 'Draft',
  actions,
}: {
  title: string;
  badgeText: string;
  badgeColor: string;
  badgeBackground: string;
  accent: string;
  icon: ReactNode;
  mode?: 'Add' | 'Edit' | 'View';
  status?: string;
  actions: ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--color-workspace-shadow)',
        padding: '8px 10px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 'var(--radius)',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: accent,
            }}
          >
            {icon}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>{title}</h1>
            <span style={badgeStyle(badgeColor, badgeBackground)}>{badgeText}</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                minHeight: 22,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-primary)',
                background: 'var(--color-primary-soft, rgba(37, 99, 235, 0.12))',
                color: 'var(--color-primary)',
                fontSize: '0.68rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>Mode</span>
              {mode}
            </span>
            <span
              style={{
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
              }}
            >
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>Status</span>
              {status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>
      </div>
    </section>
  );
}

export function VoucherMessageBanner({ message }: { message: { kind: VoucherMessageKind; text: string } | null }) {
  if (!message) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        borderRadius: 'var(--radius)',
        padding: '7px 10px',
        border: `1px solid ${message.kind === 'success' ? 'var(--color-success-border)' : 'var(--color-danger-border)'}`,
        background: message.kind === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
        color: message.kind === 'success' ? 'var(--color-success-text)' : 'var(--color-danger-text)',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        fontSize: '0.78rem',
        lineHeight: 1.35,
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0, paddingTop: 1 }}>
        {message.kind === 'success' ? <IconCircleCheck size={18} /> : <IconReceipt size={18} />}
      </span>
      <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{message.text}</span>
    </div>
  );
}

export function VoucherActionButtons({
  saving,
  actionDisabled,
  newDisabled = false,
  newDisabledReason,
  processLabel = 'Review & Post',
  onNew,
  onRefresh,
  onPrint,
  onCancel,
  onSaveDraft,
  onProcess,
}: {
  saving: boolean;
  actionDisabled: boolean;
  newDisabled?: boolean;
  newDisabledReason?: string;
  processLabel?: string;
  onNew: () => void;
  onRefresh: () => void;
  onPrint: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onProcess: () => void;
}) {
  return (
    <>
      <button
        className="btn-secondary"
        type="button"
        disabled={saving || newDisabled}
        onClick={onNew}
        title={newDisabledReason}
        style={compactButtonStyle}
      >
        <IconFilePlus size={15} /> New
      </button>
      <button className="btn-secondary" type="button" disabled={saving} onClick={onRefresh} style={compactButtonStyle}>
        <IconRefresh size={15} /> Refresh
      </button>
      <button className="btn-secondary" type="button" disabled={saving} onClick={onPrint} style={compactButtonStyle}>
        <IconPrinter size={15} /> Print
      </button>
      <button type="button" className="btn-secondary" onClick={onCancel} style={compactButtonStyle}>
        <IconCircleX size={15} /> Cancel
      </button>
      <button type="button" className="btn-secondary" disabled={actionDisabled} onClick={onSaveDraft} style={compactButtonStyle}>
        <IconDeviceFloppy size={15} /> Save Draft
      </button>
      <button type="button" className="btn-primary" disabled={actionDisabled} onClick={onProcess} style={compactButtonStyle}>
        <IconCircleCheck size={15} /> {processLabel}
      </button>
    </>
  );
}

export function VoucherLineSection({
  title,
  onAddLine,
  children,
}: {
  title: string;
  onAddLine: () => void;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: 0, display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0 0 6px' }}>
        <h2 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-heading)' }}>{title}</h2>
        <button type="button" className="btn-secondary" onClick={onAddLine} style={compactButtonStyle}>
          <IconFilePlus size={15} /> Add Line
        </button>
      </div>
      {children}
    </div>
  );
}

export function VoucherSummaryFooter({ activeLines, children }: { activeLines: number; children: ReactNode }) {
  return (
    <div style={voucherSummaryFooterStyle}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
        Active Lines: <strong style={{ color: 'var(--color-text)' }}>{activeLines}</strong>
      </span>
      <div style={voucherSummaryValuesStyle}>{children}</div>
    </div>
  );
}
