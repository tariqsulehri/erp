'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, type Permission } from './session-user';

/**
 * True when the signed-in user's role may do this action. Screens use it to disable actions the role cannot
 * use; the backend refuses them anyway, so this only spares the user a refused save.
 */
export function usePermission(permission: Permission) {
  const { data: session } = useSession();
  return hasPermission(session?.user.role, permission);
}

/** Tooltip for an action the role may not use, e.g. roleCannotSave('Purchase Vouchers'). */
export function roleCannotSave(documents: string) {
  return `Your role can view ${documents} but cannot save or post them.`;
}
