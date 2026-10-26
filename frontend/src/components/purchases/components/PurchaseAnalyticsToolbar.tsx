'use client';

import { IconFilePlus, IconListSearch, IconRefresh } from '@tabler/icons-react';
import { formatDate, formatNumber } from '@/lib/app-settings';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocumentHeader } from '@/components/documents';

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
  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;
  return (
    <DocumentHeader
      title="Purchase Analytics"
      badges={(
        <>
          <Badge variant="info">Decision View</Badge>
          <Badge variant="neutral">{dateFrom ? formatDate(dateFrom, generalSettings) : 'Start'} To {dateTo ? formatDate(dateTo, generalSettings) : 'Today'}</Badge>
        </>
      )}
      actions={(
        <>
          <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={onRefresh}>Refresh</Button>
          <Button variant="secondary" icon={<IconListSearch {...iconProps} />} onClick={onPostedPurchases}>Posted Purchases</Button>
          <Button variant="primary" icon={<IconFilePlus {...iconProps} />} disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase}>New Purchase</Button>
        </>
      )}
    />
  );
}
