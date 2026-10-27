'use client';

import type { ReactNode } from 'react';
import { IconChartBar, IconListSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui/Button';
import { DocumentActions, DocumentHeader, DocumentStatusBadges } from '@/components/documents';

interface PurchaseToolbarProps {
  actionDisabled: boolean;
  saving: boolean;
  title?: string;
  documentCode?: string;
  postedListLabel?: string;
  analyticsLabel?: string;
  showAnalytics?: boolean;
  newDisabled?: boolean;
  newDisabledReason?: string;
  onNew: () => void;
  onPostedPurchases: () => void;
  onAnalytics?: () => void;
  onRefresh: () => void;
  onPrint: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onProcess: () => void;
  /** Plain-words help for the screen. */
  help?: ReactNode;
}

/** Page header of the trade documents (Purchase, Sale and their Returns): title, badges and actions. */
export function PurchaseToolbar({
  actionDisabled,
  saving,
  title = 'Purchase Voucher',
  documentCode = 'PI',
  postedListLabel = 'Posted Purchases',
  analyticsLabel = 'Analytics',
  showAnalytics = true,
  newDisabled = false,
  newDisabledReason,
  onNew,
  onPostedPurchases,
  onAnalytics,
  onRefresh,
  onPrint,
  onCancel,
  onSaveDraft,
  onProcess,
  help,
}: PurchaseToolbarProps) {
  return (
    <DocumentHeader
      title={title}
      help={help}
      badges={<DocumentStatusBadges code={documentCode} />}
      actions={(
        <DocumentActions
          saving={saving}
          actionDisabled={actionDisabled}
          newDisabled={newDisabled}
          newDisabledReason={newDisabledReason}
          before={(
            <>
              <Button variant="secondary" icon={<IconListSearch size={16} stroke={1.8} aria-hidden />} onClick={onPostedPurchases}>{postedListLabel}</Button>
              {showAnalytics && onAnalytics && (
                <Button variant="secondary" icon={<IconChartBar size={16} stroke={1.8} aria-hidden />} onClick={onAnalytics}>{analyticsLabel}</Button>
              )}
            </>
          )}
          onNew={onNew}
          onRefresh={onRefresh}
          onPrint={onPrint}
          onCancel={onCancel}
          onSaveDraft={onSaveDraft}
          onProcess={onProcess}
        />
      )}
    />
  );
}
