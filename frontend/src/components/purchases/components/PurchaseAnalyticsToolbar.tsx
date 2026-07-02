'use client';

import { IconChartBar, IconFilePlus, IconListSearch, IconRefresh } from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import {
  badgeStyle,
  compactButtonStyle,
  statusBadgeStyle,
  titleIconStyle,
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
          <div style={titleIconStyle}><IconChartBar size={20} stroke={1.8} /></div>
          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.1, color: 'var(--color-heading)' }}>Purchase Analytics</h1>
              <span style={badgeStyle('#1d4ed8', '#dbeafe')}>Decision View</span>
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
