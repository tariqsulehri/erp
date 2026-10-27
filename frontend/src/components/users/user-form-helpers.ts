import type { UserPayload, UserRow } from '@/lib/api/users';
import { ALL_BRANCH_ROLES, type AccessLevel, type UserRole } from '@/lib/auth/session-user';

export const PASSWORD_MIN_LENGTH = 8;

export interface UserFormState {
  full_name: string;
  email: string;
  password: string;
  role: UserRole | '';
  access_level: AccessLevel | '';
  branch_id: string;
  warehouse_id: string;
  is_active: boolean;
  is_system?: boolean;
}

export const EMPTY_USER_FORM: UserFormState = {
  full_name: '',
  email: '',
  password: '',
  role: '',
  access_level: '',
  branch_id: '',
  warehouse_id: '',
  is_active: true,
  is_system: false,
};

export function formFromUser(user: UserRow): UserFormState {
  return {
    full_name: user.full_name,
    email: user.email,
    password: '',
    role: user.role,
    access_level: user.access_level ?? '',
    branch_id: user.branch?.id ?? '',
    warehouse_id: user.warehouse?.id ?? '',
    is_active: user.is_active,
    is_system: user.is_system,
  };
}

/** Access levels allowed for a role. Mirrors the backend rules so the form never offers an invalid choice. */
export function accessLevelsForRole(role: UserRole | ''): AccessLevel[] {
  if (!role) return [];
  if (ALL_BRANCH_ROLES.includes(role)) return ['ALL_BRANCHES'];
  if (role === 'sales_staff') return ['BRANCH'];
  if (role === 'warehouse_staff') return ['WAREHOUSE'];
  return ['BRANCH', 'WAREHOUSE'];
}

/** When the role changes, keep the access level if it is still allowed; otherwise pick the first allowed one. */
export function withRole(form: UserFormState, role: UserRole | ''): UserFormState {
  const allowed = accessLevelsForRole(role);
  const accessLevel = form.access_level && allowed.includes(form.access_level) ? form.access_level : allowed[0] ?? '';
  return { ...form, role, access_level: accessLevel };
}

export function validateUserForm(form: UserFormState, isNew: boolean) {
  if (!form.full_name.trim()) return 'Enter the Full Name.';
  if (!form.email.trim()) return 'Enter the Email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email is not correct. Use a format like name@company.com.';
  if (isNew && form.password !== '1234' && form.password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!form.role) return 'Select a Role.';
  if (!form.access_level) return 'Select an Access Level.';
  if (form.access_level === 'BRANCH' && !form.branch_id) return 'Select the Branch this user works in.';
  if (form.access_level === 'WAREHOUSE' && !form.warehouse_id) return 'Select the Warehouse this user works in.';
  return '';
}

export function buildUserPayload(form: UserFormState, isNew: boolean): UserPayload {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim().toLowerCase(),
    ...(isNew ? { password: form.password } : {}),
    role: form.role || undefined,
    access_level: form.access_level || undefined,
    branch_id: form.access_level === 'BRANCH' ? form.branch_id : null,
    warehouse_id: form.access_level === 'WAREHOUSE' ? form.warehouse_id : null,
    is_active: form.is_active,
  };
}
