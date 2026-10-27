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
      help={(
        <>
          <p>This screen shows charts and totals for your posted purchases.</p>
          <p>Use the filters to choose dates, a Supplier, a payment type or a Warehouse. Draft purchases are not counted.</p>
          <p>Select New Purchase to enter a purchase, or Purchase List to see all purchases and saved drafts.</p>
        </>
      )}
      badges={(
        <>
          <Badge variant="info">Posted Only</Badge>
          <Badge variant="neutral">{dateFrom ? formatDate(dateFrom, generalSettings) : 'Start'} To {dateTo ? formatDate(dateTo, generalSettings) : 'Today'}</Badge>
        </>
      )}
      actions={(
        <>
          <Button variant="secondary" icon={<IconRefresh {...iconProps} />} onClick={onRefresh}>Refresh</Button>
          <Button variant="secondary" icon={<IconListSearch {...iconProps} />} onClick={onPostedPurchases}>Purchase List</Button>
          <Button variant="primary" icon={<IconFilePlus {...iconProps} />} disabled={newDisabled} title={newDisabledReason} onClick={onNewPurchase}>New Purchase</Button>
        </>
      )}
    />
  );
}
