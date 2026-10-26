import type { ReactNode } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconInfoCircle, IconX } from '@tabler/icons-react';

type Tone = 'success' | 'danger' | 'warning' | 'info';

const ICONS = { success: IconCircleCheck, danger: IconCircleX, warning: IconAlertTriangle, info: IconInfoCircle };

/** Inline message above the content it is about. Say what happened and what to do next. */
export function InlineAlert({ tone, children, onDismiss }: { tone: Tone; children: ReactNode; onDismiss?: () => void }) {
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={16} stroke={1.8} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {onDismiss && (
        <button type="button" className="alert-dismiss" onClick={onDismiss} aria-label="Dismiss Message" title="Dismiss Message">
          <IconX size={14} stroke={1.8} aria-hidden />
        </button>
      )}
    </div>
  );
}
