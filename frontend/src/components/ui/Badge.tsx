import type { HTMLAttributes } from 'react';

type BadgeVariant =
  | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  | 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'neutral', className, ...props }: BadgeProps) {
  const classes = ['badge', `badge-${variant}`, className].filter(Boolean).join(' ');
  return <span className={classes} {...props} />;
}
