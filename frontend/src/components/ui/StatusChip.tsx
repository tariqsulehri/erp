/**
 * ERP status as a chip, with the colours fixed by documents/design/DESIGN_STANDARDS.md ("ERP status mapping").
 * The label is always shown, so colour is never the only signal.
 */
export type StatusTone = 'draft' | 'pending' | 'done' | 'problem' | 'open' | 'flagged';

const STATUS_TONES: Record<string, StatusTone> = {
  draft: 'draft',
  submitted: 'pending', pending: 'pending', 'pending approval': 'pending', waiting: 'pending', locked: 'pending',
  approved: 'done', posted: 'done', paid: 'done', active: 'done', received: 'done',
  rejected: 'problem', overdue: 'problem', cancelled: 'problem', canceled: 'problem', voided: 'problem', inactive: 'problem',
  'in progress': 'open', open: 'open',
  flagged: 'flagged', 'needs attention': 'flagged',
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status.trim().toLowerCase()] ?? 'draft';
}

export function StatusChip({ status, label, tone }: { status: string; label?: string; tone?: StatusTone }) {
  return <span className={`status-chip status-chip-${tone ?? statusTone(status)}`}>{label ?? status}</span>;
}
