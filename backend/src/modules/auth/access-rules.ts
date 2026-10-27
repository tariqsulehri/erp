export const USER_ROLES = ['admin', 'top_management', 'manager', 'accountant', 'sales_staff', 'warehouse_staff', 'viewer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCESS_LEVELS = ['ALL_BRANCHES', 'BRANCH', 'WAREHOUSE'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** Only these roles see every branch and warehouse of a company. Everyone else works in one branch or one warehouse. */
export const ALL_BRANCH_ROLES: readonly UserRole[] = ['admin', 'top_management'];

/** Roles that may create users and change user access. */
export const USER_MANAGER_ROLES: readonly UserRole[] = ['admin', 'top_management'];

/**
 * Who may do each sensitive action. Business documents (purchases, sales, stock) are also limited to the
 * user's own Branch or Warehouse by the access scope; these rules add the role check on top.
 * The frontend mirrors this list in `src/lib/auth/session-user.ts` to hide actions a role cannot use.
 */
export const PERMISSION_ROLES = {
  /** Create, edit and send manual vouchers for approval. */
  'vouchers.edit': ['admin', 'top_management', 'manager', 'accountant'],
  /** Approve or reject vouchers waiting for approval. */
  'vouchers.approve': ['admin', 'top_management', 'manager'],
  /** Post approved vouchers to the ledger. */
  'vouchers.post': ['admin', 'top_management', 'manager', 'accountant'],
  /** Reverse posted vouchers and void draft vouchers. */
  'vouchers.reverse': ['admin', 'top_management', 'manager'],
  /** Create fiscal years, lock or close periods and years, and unlock years. */
  'fiscal_years.manage': ['admin', 'top_management'],
  /** Change company profile, regional settings and posting accounts. */
  'settings.manage': ['admin', 'top_management'],
  /** Add and change Chart of Accounts and Bank Accounts, cheque books and cheques. */
  'accounts.manage': ['admin', 'top_management', 'manager', 'accountant'],
  /** Add and change Branches, Warehouses and their Locations. */
  'organization.manage': ['admin', 'top_management'],
  /** Add and change States, Cities and Areas. */
  'locations.manage': ['admin', 'top_management', 'manager'],
  /** Open Ledger, Trial Balance, Profit And Loss and Balance Sheet. */
  'reports.financial': ['admin', 'top_management', 'manager', 'accountant'],
  /** Save and post Sale Vouchers and Sale Returns (only at a Branch, by the access scope). */
  'sales.edit': ['admin', 'top_management', 'manager', 'accountant', 'sales_staff'],
  /** Save and post Purchase Vouchers and Purchase Returns (only at a Warehouse, by the access scope). */
  'purchases.edit': ['admin', 'top_management', 'manager', 'accountant', 'warehouse_staff'],
  /** Save and post Stock Transfers. */
  'stock_transfers.edit': ['admin', 'top_management', 'manager', 'sales_staff', 'warehouse_staff'],
  /** Save and post Stock Adjustments. */
  'stock_adjustments.edit': ['admin', 'top_management', 'manager'],
  /** Add, change and delete Products and their setup lists (categories, brands, sizes, colours, units...). */
  'products.manage': ['admin', 'top_management', 'manager'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSION_ROLES;

export function hasPermission(role: UserRole, permission: Permission) {
  return (PERMISSION_ROLES[permission] as readonly UserRole[]).includes(role);
}

export function permissionsForRole(role: UserRole) {
  return (Object.keys(PERMISSION_ROLES) as Permission[]).filter(permission => hasPermission(role, permission));
}

export interface CompanyAccess {
  companyId: string;
  accessLevel: AccessLevel;
  branchId: string | null;
  warehouseId: string | null;
}

/** The company and the one branch or warehouse a request works in (or All Branches). */
export interface AccessScope {
  companyId: string;
  userId: string;
  role: UserRole;
  accessLevel: AccessLevel;
  /** Set when the user works in one branch. */
  branchId: string | null;
  /** Set when the user works in one warehouse. */
  warehouseId: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  access: CompanyAccess[];
}

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}

export function hasAllBranchAccess(role: UserRole) {
  return ALL_BRANCH_ROLES.includes(role);
}

export function canManageUsers(role: UserRole) {
  return USER_MANAGER_ROLES.includes(role);
}

/** Returns a user-facing problem with the role and access combination, or null when it is valid. */
export function accessProblem(role: UserRole, accessLevel: AccessLevel, branchId?: string | null, warehouseId?: string | null) {
  if (hasAllBranchAccess(role) && accessLevel !== 'ALL_BRANCHES') {
    return 'Admin and Top Management users must have All Branches access.';
  }
  if (!hasAllBranchAccess(role) && accessLevel === 'ALL_BRANCHES') {
    return 'Only Admin and Top Management users can have All Branches access.';
  }
  if (role === 'warehouse_staff' && accessLevel !== 'WAREHOUSE') {
    return 'Warehouse Staff must be assigned to a Warehouse.';
  }
  if (role === 'sales_staff' && accessLevel !== 'BRANCH') {
    return 'Sales Staff must be assigned to a Branch.';
  }
  if (accessLevel === 'BRANCH' && !branchId) return 'Please select a Branch.';
  if (accessLevel === 'WAREHOUSE' && !warehouseId) return 'Please select a Warehouse.';
  return null;
}
