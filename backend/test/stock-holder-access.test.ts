import { describe, expect, it } from 'vitest';
import type { AccessScope } from '../src/modules/auth/access-rules.js';
import { branchHolder, holderFromColumns, warehouseHolder } from '../src/modules/inventory/stock-holder.js';
import {
  canUseHolder,
  purchaseWarehouseFilter,
  resolvePurchasingWarehouseId,
  resolveSellingBranchId,
} from '../src/modules/inventory/stock-holder-access.js';

const COMPANY = 'a0000000-0000-0000-0000-000000000001';
const BRANCH_A = 'b0000000-0000-0000-0000-00000000000a';
const BRANCH_B = 'b0000000-0000-0000-0000-00000000000b';
const WAREHOUSE_A = 'c0000000-0000-0000-0000-00000000000a';
const WAREHOUSE_B = 'c0000000-0000-0000-0000-00000000000b';

function scope(accessLevel: AccessScope['accessLevel'], place: { branchId?: string; warehouseId?: string } = {}): AccessScope {
  return {
    companyId: COMPANY,
    userId: 'd0000000-0000-0000-0000-000000000001',
    role: accessLevel === 'ALL_BRANCHES' ? 'top_management' : accessLevel === 'BRANCH' ? 'sales_staff' : 'warehouse_staff',
    accessLevel,
    branchId: place.branchId ?? null,
    warehouseId: place.warehouseId ?? null,
  };
}

function statusOf(action: () => unknown) {
  try {
    action();
    return 'ok';
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
}

describe('Stock Holders', () => {
  it('builds a Branch holder or a Warehouse holder, never both', () => {
    expect(holderFromColumns(BRANCH_A, null)).toEqual(branchHolder(BRANCH_A));
    expect(holderFromColumns(null, WAREHOUSE_A, 'e0000000-0000-0000-0000-000000000001').kind).toBe('WAREHOUSE');
    expect(() => holderFromColumns(null, null)).toThrow();
  });
});

describe('Who Can Use Which Stock', () => {
  it('lets All Branches users use every Branch and Warehouse', () => {
    const all = scope('ALL_BRANCHES');
    expect(canUseHolder(all, branchHolder(BRANCH_B))).toBe(true);
    expect(canUseHolder(all, warehouseHolder(WAREHOUSE_B))).toBe(true);
  });

  it('limits a Branch user to their own Branch', () => {
    const branchUser = scope('BRANCH', { branchId: BRANCH_A });
    expect(canUseHolder(branchUser, branchHolder(BRANCH_A))).toBe(true);
    expect(canUseHolder(branchUser, branchHolder(BRANCH_B))).toBe(false);
    expect(canUseHolder(branchUser, warehouseHolder(WAREHOUSE_A))).toBe(false);
  });

  it('limits a Warehouse user to their own Warehouse', () => {
    const warehouseUser = scope('WAREHOUSE', { warehouseId: WAREHOUSE_A });
    expect(canUseHolder(warehouseUser, warehouseHolder(WAREHOUSE_A))).toBe(true);
    expect(canUseHolder(warehouseUser, warehouseHolder(WAREHOUSE_B))).toBe(false);
    expect(canUseHolder(warehouseUser, branchHolder(BRANCH_A))).toBe(false);
  });
});

describe('Sales Happen At A Branch', () => {
  it('always uses the Branch user\'s own Branch', () => {
    const branchUser = scope('BRANCH', { branchId: BRANCH_A });
    expect(resolveSellingBranchId(branchUser, undefined, 'Sale Voucher')).toBe(BRANCH_A);
    expect(statusOf(() => resolveSellingBranchId(branchUser, BRANCH_B, 'Sale Voucher'))).toBe(403);
  });

  it('requires All Branches users to choose a Branch', () => {
    expect(statusOf(() => resolveSellingBranchId(scope('ALL_BRANCHES'), undefined, 'Sale Voucher'))).toBe(400);
    expect(resolveSellingBranchId(scope('ALL_BRANCHES'), BRANCH_B, 'Sale Voucher')).toBe(BRANCH_B);
  });

  it('does not let Warehouse users sell', () => {
    expect(statusOf(() => resolveSellingBranchId(scope('WAREHOUSE', { warehouseId: WAREHOUSE_A }), BRANCH_A, 'Sale Voucher'))).toBe(403);
  });
});

describe('Purchases Happen At A Warehouse', () => {
  it('does not let Branch users buy or open purchases', () => {
    const branchUser = scope('BRANCH', { branchId: BRANCH_A });
    expect(statusOf(() => resolvePurchasingWarehouseId(branchUser, WAREHOUSE_A, 'Purchase Voucher'))).toBe(403);
    expect(statusOf(() => purchaseWarehouseFilter(branchUser, 'Purchase Voucher'))).toBe(403);
  });

  it('keeps Warehouse users on their own Warehouse', () => {
    const warehouseUser = scope('WAREHOUSE', { warehouseId: WAREHOUSE_A });
    expect(resolvePurchasingWarehouseId(warehouseUser, WAREHOUSE_A, 'Purchase Voucher')).toBe(WAREHOUSE_A);
    expect(statusOf(() => resolvePurchasingWarehouseId(warehouseUser, WAREHOUSE_B, 'Purchase Voucher'))).toBe(403);
    expect(purchaseWarehouseFilter(warehouseUser, 'Purchase Voucher')).toBe(WAREHOUSE_A);
  });

  it('lets All Branches users buy into any Warehouse', () => {
    expect(resolvePurchasingWarehouseId(scope('ALL_BRANCHES'), WAREHOUSE_B, 'Purchase Voucher')).toBe(WAREHOUSE_B);
    expect(purchaseWarehouseFilter(scope('ALL_BRANCHES'), 'Purchase Voucher')).toBeNull();
  });
});
