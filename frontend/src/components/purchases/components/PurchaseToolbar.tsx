'use client';

import {
  IconChartBar,
  IconCircleCheck,
  IconCircleX,
  IconDeviceFloppy,
  IconFilePlus,
  IconListSearch,
  IconPrinter,
  IconRefresh,
  IconShoppingCart,
} from '@tabler/icons-react';
import {
  badgeStyle,
  compactButtonStyle,
  statusBadgeStyle,
  titleIconStyle,
  toolbarStyle,
} from '../PurchaseVoucherStyles';

interface PurchaseToolbarProps {
  actionDisabled: boolean;
  saving: boolean;
  title?: string;
  documentCode?: string;
  postedListLabel?: string;
  analyticsLabel?: string;
  showAnalytics?: boolean;
  onNew: () => void;
  onPostedPurchases: () => void;
  onAnalytics?: () => void;
  onRefresh: () => void;
  onPrint: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onProcess: () => void;
}

export function PurchaseToolbar({
  actionDisabled,
  saving,
  title = 'Purchase Voucher',
  documentCode = 'PI',
  postedListLabel = 'Posted Purchases',
  analyticsLabel = 'Analytics',
  showAnalytics = true,
  onNew,
  onPostedPurchases,
  onAnalytics,
  onRefresh,
  onPrint,
  onCancel,
  onSaveDraft,
  onProcess,
}: PurchaseToolbarProps) {
  return (
    <section style={toolbarStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={titleIconStyle}><IconShoppingCart size={20} stroke={1.8} /></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>{title}</h1>
            <span style={badgeStyle('#1d4ed8', '#dbeafe')}>{documentCode}</span>
            <span style={statusBadgeStyle}><span style={{ color: 'var(--color-text-muted)' }}>Status</span> Draft</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn-secondary" type="button" onClick={onNew} style={compactButtonStyle}><IconFilePlus size={15} /> New</button>
          <button className="btn-secondary" type="button" onClick={onPostedPurchases} style={compactButtonStyle}><IconListSearch size={15} /> {postedListLabel}</button>
          {showAnalytics && onAnalytics && (
            <button className="btn-secondary" type="button" onClick={onAnalytics} style={compactButtonStyle}><IconChartBar size={15} /> {analyticsLabel}</button>
          )}
          <button className="btn-secondary" type="button" disabled={saving} onClick={onRefresh} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-secondary" type="button" disabled={saving} onClick={onPrint} style={compactButtonStyle}><IconPrinter size={15} /> Print</button>
          <button className="btn-secondary" type="button" onClick={onCancel} style={compactButtonStyle}><IconCircleX size={15} /> Cancel</button>
          <button className="btn-secondary" type="button" disabled={actionDisabled} onClick={onSaveDraft} style={compactButtonStyle}><IconDeviceFloppy size={15} /> Save Draft</button>
          <button className="btn-primary" type="button" disabled={actionDisabled} onClick={onProcess} style={compactButtonStyle}><IconCircleCheck size={15} /> Process</button>
        </div>
      </div>
    </section>
  );
}
