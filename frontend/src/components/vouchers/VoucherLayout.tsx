'use client';

import type { ReactNode } from 'react';
import { IconCircleCheck, IconDeviceFloppy, IconFilePlus, IconPrinter, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { voucherSummaryFooterStyle, voucherSummaryValuesStyle } from './VoucherShared';
import type { VoucherMessageKind } from './VoucherShared';

/**
 * Voucher page header: title, voucher type code, mode, and status on the left; actions on the right.
 * `badgeColor`, `badgeBackground`, `accent`, and `icon` are accepted for older callers but no longer
 * drawn — the standard header has no colored icon tile (DESIGN.md, The One Blue Rule).
 */
export function VoucherPageHeader({
  title,
  badgeText,
  mode = 'Add',
  status = 'Draft',
  actions,
}: {
  title: string;
  badgeText: string;
  badgeColor?: string;
  badgeBackground?: string;
  accent?: string;
  icon?: ReactNode;
  mode?: 'Add' | 'Edit' | 'View';
  status?: string;
  actions: ReactNode;
}) {
  return (
    <header className="page-head" style={{ flexWrap: 'wrap' }}>
      <div className="page-head-text" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h1 className="page-head-title">{title}</h1>
        <Badge variant="neutral" title="Voucher Type">{badgeText}</Badge>
        <Badge variant="info">{mode === 'Add' ? 'New' : mode}</Badge>
        <Badge variant={status === 'Posted' || status === 'Approved' ? 'success' : status === 'Pending' ? 'warning' : 'neutral'}>{status}</Badge>
      </div>
      <div className="page-head-actions" style={{ flexWrap: 'wrap' }}>{actions}</div>
    </header>
  );
}

export function VoucherMessageBanner({ message }: { message: { kind: VoucherMessageKind; text: string } | null }) {
  if (!message) return null;
  return <InlineAlert tone={message.kind === 'success' ? 'success' : 'danger'}>{message.text}</InlineAlert>;
}

/** Standard voucher actions: secondary tools first, then Cancel, Save Draft, and the one primary action. */
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
  const icon = (Icon: typeof IconFilePlus) => <Icon size={16} stroke={1.8} />;
  return (
    <>
      <Button variant="secondary" icon={icon(IconFilePlus)} disabled={saving || newDisabled} onClick={onNew} title={newDisabledReason}>New</Button>
      <Button variant="secondary" icon={icon(IconRefresh)} disabled={saving} onClick={onRefresh} aria-label="Refresh" title="Refresh" />
      <Button variant="secondary" icon={icon(IconPrinter)} disabled={saving} onClick={onPrint} aria-label="Print" title="Print" />
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant="secondary" icon={icon(IconDeviceFloppy)} disabled={actionDisabled} onClick={onSaveDraft}>Save Draft</Button>
      <Button variant="primary" icon={icon(IconCircleCheck)} disabled={actionDisabled} loading={saving} onClick={onProcess}>{processLabel}</Button>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '0 0 8px' }}>
        <h2 className="panel-title">{title}</h2>
        <Button variant="secondary" size="sm" icon={<IconFilePlus size={16} stroke={1.8} />} onClick={onAddLine}>Add Line</Button>
      </div>
      {children}
    </div>
  );
}

export function VoucherSummaryFooter({ activeLines, children }: { activeLines: number; children: ReactNode }) {
  return (
    <div style={voucherSummaryFooterStyle}>
      <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', whiteSpace: 'nowrap', paddingBottom: 7 }}>
        Active Lines <strong style={{ color: 'var(--color-heading)', fontWeight: 600 }}>{activeLines}</strong>
      </span>
      <div style={voucherSummaryValuesStyle}>{children}</div>
    </div>
  );
}
