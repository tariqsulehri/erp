import { Router } from 'express';
import { requireUser } from '../http/company-context.js';
import {
  ACCESS_LEVELS,
  ALL_BRANCH_ROLES,
  PERMISSION_ROLES,
  USER_MANAGER_ROLES,
  USER_ROLES,
  type UserRole,
} from '../modules/auth/access-rules.js';

export const rolesRouter = Router();

const ROLE_METADATA: Record<UserRole, { label: string; description: string; accessLevel: string }> = {
  admin: {
    label: 'Admin',
    description: 'Complete unrestricted access across all companies, branches, warehouses, users, and financial settings.',
    accessLevel: 'All Branches',
  },
  top_management: {
    label: 'Top Management',
    description: 'Executive overview with company-wide approval, financial reports, user management, and ledger posting rights.',
    accessLevel: 'All Branches',
  },
  manager: {
    label: 'Manager',
    description: 'Operational and financial oversight for an assigned Branch or Warehouse, including approvals and report generation.',
    accessLevel: 'Branch or Warehouse',
  },
  accountant: {
    label: 'Accountant',
    description: 'Day-to-day voucher creation, ledger posting, party accounting, and bank reconciliation.',
    accessLevel: 'Branch or Warehouse',
  },
  sales_staff: {
    label: 'Sales Staff',
    description: 'Sales voucher entry, customer records, and order fulfillment at an assigned Branch.',
    accessLevel: 'Branch only',
  },
  warehouse_staff: {
    label: 'Warehouse Staff',
    description: 'Stock receipts, warehouse inventory transfers, stock adjustments, and supplier purchase receiving.',
    accessLevel: 'Warehouse only',
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to browse master catalogs and standard dashboard overview.',
    accessLevel: 'Branch or Warehouse',
  },
};

rolesRouter.get('/', async (req, res, next) => {
  try {
    requireUser(req);
    const roles = USER_ROLES.map(role => {
      const meta = ROLE_METADATA[role];
      const permissions = Object.entries(PERMISSION_ROLES)
        .filter(([, allowedRoles]) => (allowedRoles as readonly UserRole[]).includes(role))
        .map(([perm]) => perm);

      return {
        role,
        label: meta.label,
        description: meta.description,
        access_level: meta.accessLevel,
        is_all_branches: ALL_BRANCH_ROLES.includes(role),
        can_manage_users: USER_MANAGER_ROLES.includes(role),
        permissions,
      };
    });

    res.json({
      data: roles,
      permission_definitions: Object.keys(PERMISSION_ROLES).map(key => ({
        key,
        label: key.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(': '),
        allowed_roles: PERMISSION_ROLES[key as keyof typeof PERMISSION_ROLES],
      })),
    });
  } catch (error) {
    next(error);
  }
});
