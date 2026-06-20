import type { ReactNode } from 'react';

export function FieldLabel({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>
        {label}{required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </span>
      {children}
    </label>
  );
}

const labelStyle = {
  display: 'block',
  marginBottom: 2,
  color: 'var(--color-text-secondary)',
  fontSize: '0.67rem',
  fontWeight: 800,
  lineHeight: 1.15,
} as const;
