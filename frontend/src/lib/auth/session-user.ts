export type UserRole = 'admin' | 'top_management' | 'manager' | 'accountant' | 'sales_staff' | 'warehouse_staff' | 'viewer';
export type AccessLevel = 'ALL_BRANCHES' | 'BRANCH' | 'WAREHOUSE';

export interface SessionBranch {
  id: string;
  code: string;
  name: string;
  city?: string | null;
}

export interface SessionWarehouse {
  id: string;
  code: string;
  name: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  top_management: 'Top Management',
  manager: 'Manager',
  accountant: 'Accountant',
  sales_staff: 'Sales Staff',
  warehouse_staff: 'Warehouse Staff',
  viewer: 'Viewer',
};

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  ALL_BRANCHES: 'All Branches',
  BRANCH: 'Branch',
  WAREHOUSE: 'Warehouse',
};

/** Roles that see every branch and warehouse, and can manage users. Mirrors the backend access rules. */
export const ALL_BRANCH_ROLES: readonly UserRole[] = ['admin', 'top_management'];

export function roleLabel(role?: string | null) {
  return role && role in ROLE_LABELS ? ROLE_LABELS[role as UserRole] : 'User';
}

export function canManageUsers(role?: string | null) {
  return ALL_BRANCH_ROLES.includes(role as UserRole);
}

/** Who may do each sensitive action. Mirrors `PERMISSION_ROLES` in the backend access rules, which enforce it. */
export const PERMISSION_ROLES = {
  'vouchers.edit': ['admin', 'top_management', 'manager', 'accountant'],
  'vouchers.approve': ['admin', 'top_management', 'manager'],
  'vouchers.post': ['admin', 'top_management', 'manager', 'accountant'],
  'vouchers.reverse': ['admin', 'top_management', 'manager'],
  'fiscal_years.manage': ['admin', 'top_management'],
  'settings.manage': ['admin', 'top_management'],
  'accounts.manage': ['admin', 'top_management', 'manager', 'accountant'],
  'organization.manage': ['admin', 'top_management'],
  'locations.manage': ['admin', 'top_management', 'manager'],
  'reports.financial': ['admin', 'top_management', 'manager', 'accountant'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSION_ROLES;

export function hasPermission(role: string | null | undefined, permission: Permission) {
  return Boolean(role) && (PERMISSION_ROLES[permission] as readonly string[]).includes(role as string);
}

/** Where the user works, for the header: the branch or warehouse name, or All Branches. */
export function workplaceLabel(user: { accessLevel?: AccessLevel; branch?: SessionBranch | null; warehouse?: SessionWarehouse | null }) {
  if (user.accessLevel === 'BRANCH' && user.branch) return user.branch.name;
  if (user.accessLevel === 'WAREHOUSE' && user.warehouse) return user.warehouse.name;
  return 'All Branches';
}
