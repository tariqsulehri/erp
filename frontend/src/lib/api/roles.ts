'use client';

import { useQuery } from '@tanstack/react-query';
import { backendGet } from './backend-client';

export const rolesQueryKey = ['backend', 'roles'] as const;

export interface RoleItem {
  role: string;
  label: string;
  description: string;
  access_level: string;
  is_all_branches: boolean;
  can_manage_users: boolean;
  permissions: string[];
}

export interface PermissionDefinition {
  key: string;
  label: string;
  allowed_roles: string[];
}

export interface RolesResponse {
  data: RoleItem[];
  permission_definitions: PermissionDefinition[];
}

export function useRoles() {
  return useQuery<RolesResponse>({
    queryKey: rolesQueryKey,
    queryFn: () => backendGet<RolesResponse>('/roles'),
    staleTime: 5 * 60 * 1000,
  });
}
