import type { ReactNode } from 'react';

/** Label above a field. Title Case text; required fields show a red asterisk. */
export function FieldLabel({
  label,
  required = false,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} style={{ display: 'block', minWidth: 0 }}>
      <span className="field-label">
        {label}{required && <span className="field-required" aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  );
}
