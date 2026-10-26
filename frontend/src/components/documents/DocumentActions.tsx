'use client';

import type { ReactNode } from 'react';
import { IconCircleCheck, IconDeviceFloppy, IconFilePlus, IconPrinter, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useSaveShortcutLabel } from './useLineEntryKeyboard';

const icon = (Icon: typeof IconFilePlus) => <Icon size={16} stroke={1.8} aria-hidden />;

/** Document type code, mode and status badges shown next to the page title. */
export function DocumentStatusBadges({
  code,
  mode = 'Add',
  status = 'Draft',
}: {
  code: string;
  mode?: 'Add' | 'Edit' | 'View';
  status?: string;
}) {
  return (
    <>
      <Badge variant="neutral" title="Document Type">{code}</Badge>
      <Badge variant="info">{mode === 'Add' ? 'New' : mode}</Badge>
      <Badge variant={status === 'Posted' || status === 'Approved' ? 'success' : status === 'Pending' ? 'warning' : 'neutral'}>{status}</Badge>
    </>
  );
}

/**
 * Standard document actions for the top of the screen: New, any extra navigation (`before`),
 * Refresh and Print, then Cancel, Save Draft and the one primary action (Process / Save For Approval).
 * Save Draft shows its keyboard shortcut in the tooltip.
 */
export function DocumentActions({
  saving,
  actionDisabled,
  newDisabled = false,
  newDisabledReason,
  processLabel = 'Process',
  before,
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
  /** Extra secondary actions placed after New, e.g. links to the posted list or analytics. */
  before?: ReactNode;
  onNew: () => void;
  onRefresh: () => void;
  onPrint: () => void;
  onCancel: () => void;
  onSaveDraft: () => void;
  onProcess: () => void;
}) {
  const saveShortcut = useSaveShortcutLabel();
  return (
    <>
      <Button variant="secondary" icon={icon(IconFilePlus)} disabled={saving || newDisabled} onClick={onNew} title={newDisabled ? newDisabledReason : 'Start A New Document'}>New</Button>
      {before}
      <Button variant="secondary" icon={icon(IconRefresh)} disabled={saving} onClick={onRefresh} aria-label="Refresh" title="Refresh" />
      <Button variant="secondary" icon={icon(IconPrinter)} disabled={saving} onClick={onPrint} aria-label="Print" title="Print" />
      <Button variant="ghost" onClick={onCancel} title="Clear This Form">Cancel</Button>
      <Button variant="secondary" icon={icon(IconDeviceFloppy)} disabled={actionDisabled} onClick={onSaveDraft} title={`Save Draft (${saveShortcut})`} aria-keyshortcuts="Control+S Meta+S">
        Save Draft
      </Button>
      <Button variant="primary" icon={icon(IconCircleCheck)} disabled={actionDisabled} loading={saving} onClick={onProcess} title={`${processLabel} (Asks For Confirmation)`}>
        {processLabel}
      </Button>
    </>
  );
}
