'use client';

import { useState } from 'react';
import { IconArrowBackUp } from '@tabler/icons-react';
import { friendlyErrorMessage } from '@/lib/erp-utils';
import { Button } from '@/components/ui/Button';
import { FormDialog } from '@/components/ui/FormDialog';
import { DateField, TextField } from '@/components/ui/FormFields';
import { DetailActions } from './DocumentDetailPanel';
import type { DraftActionMessage } from './DraftDocumentActions';

/** Today's date (YYYY-MM-DD) on the user's computer, not in UTC. */
function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface ReverseDocumentActionProps {
  /** e.g. 'Stock Transfer'. */
  documentName: string;
  documentNumber: string;
  /** What reversing does, for the dialog, e.g. 'The items go back to the sending place.' */
  reverseEffect: string;
  /** Reverses the posted document. Resolves with its number. */
  onReverse: (reversalDate: string, reason: string) => Promise<string>;
  /** Shows the result above the list. */
  onMessage: (message: DraftActionMessage) => void;
}

/**
 * Reverse action for a selected posted document: asks for the Reversal Date and a reason, then posts the
 * opposite entries. Render it only for posted documents and only for roles that may reverse them.
 */
export function ReverseDocumentAction({ documentName, documentNumber, reverseEffect, onReverse, onMessage }: ReverseDocumentActionProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reversalDate, setReversalDate] = useState(localToday());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function openDialog() {
    setReversalDate(localToday());
    setReason('');
    setError('');
    setOpen(true);
  }

  async function reverse() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reversalDate)) {
      setError('Enter the Reversal Date.');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Enter a reason of at least 3 characters.');
      return;
    }
    setSaving(true);
    try {
      const number = await onReverse(reversalDate, reason.trim());
      setOpen(false);
      onMessage({ tone: 'success', text: `${number} reversed. It stays in the list with Status Reversed.` });
    } catch (reverseError) {
      setError(friendlyErrorMessage(reverseError, `Could not reverse the ${documentName}. Please try again.`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DetailActions>
        <Button variant="danger" size="sm" icon={<IconArrowBackUp size={16} stroke={1.8} aria-hidden />} onClick={openDialog}>Reverse</Button>
      </DetailActions>

      <FormDialog
        open={open}
        title={`Reverse ${documentName} ${documentNumber}`}
        saveLabel="Reverse"
        cancelLabel="Keep As Posted"
        saving={saving}
        onSave={reverse}
        onCancel={() => setOpen(false)}
      >
        <p style={{ marginTop: 0 }}>{reverseEffect} The {documentName} stays in the list with Status Reversed. This cannot be undone.</p>
        <DateField
          label="Reversal Date"
          value={reversalDate}
          onChange={value => { setReversalDate(value); setError(''); }}
          required
          hint="Must be in an open Period and not before the document date."
        />
        <TextField
          label="Reason"
          value={reason}
          onChange={value => { setReason(value); setError(''); }}
          required
          placeholder="Why is this reversed?"
          error={error || undefined}
        />
      </FormDialog>
    </>
  );
}
