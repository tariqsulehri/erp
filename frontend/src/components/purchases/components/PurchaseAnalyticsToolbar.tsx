'use client';

import { IconFilePlus, IconListSearch, IconRefresh } from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import {
  badgeStyle,
  compactButtonStyle,
  statusBadgeStyle,
  toolbarStyle,
} from '../PurchaseVoucherStyles';

type GeneralSettings = Parameters<typeof formatNumber>[1];

interface PurchaseAnalyticsToolbarProps {
  dateFrom: string;
  dateTo: string;
  generalSettings: GeneralSettings;
  onRefresh: () => void;
  onPostedPurchases: () => void;
  onNewPurchase: () => void;
  newDisabled?: boolean;
  newDisabledReason?: string;
}

export function PurchaseAnalyticsToolbar({
  dateFrom,
  dateTo,
  generalSettings,
  onRefresh,
  onPostedPurchases,
  onNewPurchase,
  newDisabled = false,
  newDisabledReason,
}: PurchaseAnalyticsToolbarProps) {
  return (
    <section style={toolbarStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 className="page-head-title">Purchase Analytics</h1>
              <span style={badgeStyle('var(--color-info-text)', 'var(--color-info-bg)')}>Decision View</span>
              <span style={statusBadgeStyle}>{dateFrom ? formatDate(dateFrom, generalSettings) : 'Start'} To {dateTo ? formatDate(dateTo, generalSettings) : 'Today'}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn-secondary" type="button" onClick={onRefresh} style={compactButtonStyle}><IconRefresh size={15} /> Refresh</button>
          <button className="btn-secondary" type="button" onClick={onPostedPurchases} style={compactButtonStyle}><IconListSearch size={15} /> Posted Purchases</button>
          <button className="btn-primary" type="button" disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase} style={compactButtonStyle}><IconFilePlus size={15} /> New Purchase</button>
        </div>
      </div>
    </section>
  );
}
