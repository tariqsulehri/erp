import type { NextFunction, Request, Response } from 'express';
import type { AccessScope, Permission } from '../modules/auth/access-rules.js';
import { canManageUsers, hasPermission } from '../modules/auth/access-rules.js';
import { requireUser, resolveCompanyId } from './company-context.js';

export type { AccessScope };

/** The signed-in user's company and the one branch or warehouse they work in (or All Branches). */
export function resolveAccessScope(req: Request): AccessScope {
  const user = requireUser(req);
  const companyId = resolveCompanyId(req);
  const access = user.access.find(row => row.companyId === companyId);

  if (user.role === 'admin' || !access || access.accessLevel === 'ALL_BRANCHES') {
    return { companyId, userId: user.id, role: user.role, accessLevel: 'ALL_BRANCHES', branchId: null, warehouseId: null };
  }

  return {
    companyId,
    userId: user.id,
    role: user.role,
    accessLevel: access.accessLevel,
    branchId: access.branchId,
    warehouseId: access.warehouseId,
  };
}

/** The signed-in user's ID for created / updated / posted by fields. Never taken from a request header. */
export function currentUserId(req: Request) {
  return requireUser(req).id;
}

const permissionActionText: Record<Permission, string> = {
  'vouchers.edit': 'create or change vouchers',
  'vouchers.approve': 'approve or reject vouchers',
  'vouchers.post': 'post vouchers',
  'vouchers.reverse': 'reverse or void vouchers',
  'fiscal_years.manage': 'manage fiscal years and periods',
  'settings.manage': 'change company settings',
  'accounts.manage': 'change accounts, bank accounts and cheques',
  'organization.manage': 'change branches and warehouses',
  'locations.manage': 'change states, cities and areas',
  'reports.financial': 'open financial reports',
};

/** Route middleware: stops the request with 403 when the signed-in user's role may not do this action. */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = requireUser(req);
      if (!hasPermission(user.role, permission)) {
        const error = new Error(`Your role does not allow you to ${permissionActionText[permission]}.`);
        Object.assign(error, { statusCode: 403 });
        throw error;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireUserManager(req: Request) {
  const user = requireUser(req);
  if (!canManageUsers(user.role)) {
    const error = new Error('Only Admin and Top Management users can manage users.');
    Object.assign(error, { statusCode: 403 });
    throw error;
  }
  return user;
}
