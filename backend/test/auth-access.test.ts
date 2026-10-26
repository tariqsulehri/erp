import { describe, expect, it } from 'vitest';
import { accessProblem, canManageUsers, hasAllBranchAccess } from '../src/modules/auth/access-rules.js';
import { hashPassword, verifyPassword } from '../src/modules/auth/password.js';

const BRANCH_ID = 'b0000000-0000-0000-0000-000000000001';
const WAREHOUSE_ID = 'c0000000-0000-0000-0000-000000000001';

describe('Password Hashing', () => {
  it('verifies the original password and rejects a different one', async () => {
    const stored = await hashPassword('Correct-Password-1');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('Correct-Password-1');
    expect(await verifyPassword('Correct-Password-1', stored)).toBe(true);
    expect(await verifyPassword('Wrong-Password-1', stored)).toBe(false);
  });

  it('creates a different hash each time for the same password', async () => {
    expect(await hashPassword('Same-Password-1')).not.toBe(await hashPassword('Same-Password-1'));
  });

  it('rejects malformed stored values instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});

describe('User Access Rules', () => {
  it('gives All Branches access only to Admin and Top Management', () => {
    expect(hasAllBranchAccess('admin')).toBe(true);
    expect(hasAllBranchAccess('top_management')).toBe(true);
    expect(hasAllBranchAccess('manager')).toBe(false);
    expect(hasAllBranchAccess('sales_staff')).toBe(false);
  });

  it('lets only Admin and Top Management manage users', () => {
    expect(canManageUsers('admin')).toBe(true);
    expect(canManageUsers('top_management')).toBe(true);
    expect(canManageUsers('accountant')).toBe(false);
  });

  it('requires All Branches for Admin and Top Management', () => {
    expect(accessProblem('admin', 'ALL_BRANCHES')).toBeNull();
    expect(accessProblem('top_management', 'BRANCH', BRANCH_ID)).not.toBeNull();
  });

  it('blocks All Branches for every other role', () => {
    expect(accessProblem('manager', 'ALL_BRANCHES')).not.toBeNull();
    expect(accessProblem('viewer', 'ALL_BRANCHES')).not.toBeNull();
  });

  it('requires a branch for Branch access and a warehouse for Warehouse access', () => {
    expect(accessProblem('manager', 'BRANCH', null)).toBe('Please select a Branch.');
    expect(accessProblem('manager', 'BRANCH', BRANCH_ID)).toBeNull();
    expect(accessProblem('manager', 'WAREHOUSE', null, null)).toBe('Please select a Warehouse.');
    expect(accessProblem('manager', 'WAREHOUSE', null, WAREHOUSE_ID)).toBeNull();
  });

  it('keeps Sales Staff in a branch and Warehouse Staff in a warehouse', () => {
    expect(accessProblem('sales_staff', 'WAREHOUSE', null, WAREHOUSE_ID)).not.toBeNull();
    expect(accessProblem('sales_staff', 'BRANCH', BRANCH_ID)).toBeNull();
    expect(accessProblem('warehouse_staff', 'BRANCH', BRANCH_ID)).not.toBeNull();
    expect(accessProblem('warehouse_staff', 'WAREHOUSE', null, WAREHOUSE_ID)).toBeNull();
  });
});
