import type { ReactNode } from 'react';

/** Label above a field. Title Case text; required fields show a red asterisk. */
export function FieldLabel({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span className="field-label">
        {label}{required && <span className="field-required" aria-hidden>*</span>}
      </span>
      {children}
    </label>
  );
}
