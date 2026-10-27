import type { ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

/** Icon-only button. `label` is required: it becomes both the tooltip (title) and the screen-reader name. */
export function IconButton({ icon, label, variant = 'ghost', size = 'sm', ...props }: Omit<ButtonProps, 'children' | 'icon' | 'title' | 'aria-label'> & {
  icon: ReactNode;
  label: string;
}) {
  return <Button variant={variant} size={size} icon={icon} title={label} aria-label={label} {...props} />;
}
