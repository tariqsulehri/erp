'use client';

import { useState } from 'react';
import { IconBan, IconFileCheck, IconPencil } from '@tabler/icons-react';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FormDialog } from '@/components/ui/FormDialog';
import { TextField } from '@/components/ui/FormFields';
import { DetailActions } from './DocumentDetailPanel';

/**
 * Staff see a Voided document as Cancelled when it was a Draft, and as Reversed when it had been posted
 * (it then has a posted date).
 */
export function documentStatusLabel(status: string, postedAt?: string | null) {
  if (status !== 'Voided') return status;
  return postedAt ? 'Reversed' : 'Cancelled';
}

/** Status filter choices for document lists that hold Posted, Draft and Cancelled documents. */
export const DOCUMENT_STATUS_OPTIONS = [
  { value: 'Posted', label: 'Posted' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Voided', label: 'Cancelled' },
];

/** Status filter choices for stock documents, whose posted documents can also be reversed. */
export const STOCK_DOCUMENT_STATUS_OPTIONS = [
  { value: 'Posted', label: 'Posted' },
  { value: 'Draft', label: 'Draft' },
  { value: 'Voided', label: 'Cancelled Or Reversed' },
];

export interface DraftActionMessage {
  tone: 'success' | 'danger';
  text: string;
}

interface DraftDocumentActionsProps {
  /** e.g. 'Sale Voucher'. */
  documentName: string;
  documentNumber: string;
  /** What posting changes, for the confirmation, e.g. 'Stock and the Customer balance are updated.' */
  postEffect: string;
  onOpen: () => void;
  /** Posts the Draft as saved. Resolves with the posted document number. */
  onPost: () => Promise<string>;
  /** Cancels the Draft with the reason. Resolves with the cancelled document number. */
  onCancel: (reason: string) => Promise<string>;
  /** Shows the result above the list. */
  onMessage: (message: DraftActionMessage) => void;
}

/**
 * Actions for a selected Draft in a document list: Open Draft, Post (with confirmation) and Cancel Draft
 * (asks for a reason). Render it only for Drafts and only for roles that may save the document.
 */
export function DraftDocumentActions({
  documentName,
  documentNumber,
  postEffect,
  onOpen,
  onPost,
  onCancel,
  onMessage,
}: DraftDocumentActionsProps) {
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const iconProps = { size: 16, stroke: 1.8, 'aria-hidden': true } as const;

  async function post() {
    setPosting(true);
    try {
      const number = await onPost();
      onMessage({ tone: 'success', text: `${number} posted. ${postEffect}` });
    } catch (error) {
      onMessage({ tone: 'danger', text: friendlyErrorMessage(error, `Could not post the ${documentName}. Please try again.`) });
    } finally {
      setPosting(false);
      setPostConfirmOpen(false);
    }
  }

  function openCancel() {
    setReason('');
    setReasonError('');
    setCancelOpen(true);
  }

  async function cancel() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setReasonError('Enter a reason of at least 3 characters.');
      return;
    }
    setCancelling(true);
    try {
      const number = await onCancel(trimmed);
      setCancelOpen(false);
      onMessage({ tone: 'success', text: `${number} cancelled. It stays in the list with Status Cancelled.` });
    } catch (error) {
      setReasonError(friendlyErrorMessage(error, 'Could not cancel the Draft. Please try again.'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <DetailActions>
        <Button variant="primary" size="sm" icon={<IconPencil {...iconProps} />} onClick={onOpen}>Open Draft</Button>
        <Button variant="secondary" size="sm" icon={<IconFileCheck {...iconProps} />} onClick={() => setPostConfirmOpen(true)}>Post</Button>
        <Button variant="danger" size="sm" icon={<IconBan {...iconProps} />} onClick={openCancel}>Cancel Draft</Button>
      </DetailActions>

      <ConfirmDialog
        open={postConfirmOpen}
        title={`Post ${documentName}?`}
        message={`This posts ${documentNumber} as it was saved. ${postEffect} You cannot change it after it is posted.`}
        confirmLabel="Yes, Post"
        cancelLabel="No"
        variant="warning"
        loading={posting}
        onConfirm={post}
        onCancel={() => setPostConfirmOpen(false)}
      />

      <FormDialog
        open={cancelOpen}
        title={`Cancel Draft ${documentNumber}`}
        saveLabel="Cancel Draft"
        cancelLabel="Keep Draft"
        saving={cancelling}
        onSave={cancel}
        onCancel={() => setCancelOpen(false)}
      >
        <p style={{ marginTop: 0 }}>The Draft stays in the list with Status Cancelled. It cannot be posted or changed after this.</p>
        <TextField
          label="Reason"
          value={reason}
          onChange={value => { setReason(value); setReasonError(''); }}
          required
          placeholder="Why is this Draft cancelled?"
          error={reasonError || undefined}
        />
      </FormDialog>
    </>
  );
}
