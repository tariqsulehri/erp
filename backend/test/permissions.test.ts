import { describe, expect, it } from 'vitest';
import { hasPermission, permissionsForRole, USER_ROLES } from '../src/modules/auth/access-rules.js';
import { createVoucherInputSchema } from '../src/modules/vouchers/voucher.schema.js';

describe('Role permissions', () => {
  it('lets only Admin and Top Management close fiscal years and change settings', () => {
    for (const role of USER_ROLES) {
      const allowed = role === 'admin' || role === 'top_management';
      expect(hasPermission(role, 'fiscal_years.manage')).toBe(allowed);
      expect(hasPermission(role, 'settings.manage')).toBe(allowed);
    }
  });

  it('keeps voucher approval away from Accountants, Staff and Viewers', () => {
    expect(hasPermission('manager', 'vouchers.approve')).toBe(true);
    expect(hasPermission('accountant', 'vouchers.approve')).toBe(false);
    expect(hasPermission('accountant', 'vouchers.post')).toBe(true);
    expect(hasPermission('sales_staff', 'vouchers.edit')).toBe(false);
    expect(hasPermission('warehouse_staff', 'vouchers.post')).toBe(false);
  });

  it('lets each role save and post only the business documents that fit its work', () => {
    const expected = {
      'sales.edit': ['admin', 'top_management', 'manager', 'accountant', 'sales_staff'],
      'purchases.edit': ['admin', 'top_management', 'manager', 'accountant', 'warehouse_staff'],
      'stock_transfers.edit': ['admin', 'top_management', 'manager', 'sales_staff', 'warehouse_staff'],
      'stock_adjustments.edit': ['admin', 'top_management', 'manager'],
      'products.manage': ['admin', 'top_management', 'manager'],
    } as const;
    for (const [permission, roles] of Object.entries(expected)) {
      for (const role of USER_ROLES) {
        expect(hasPermission(role, permission as keyof typeof expected), `${role} ${permission}`).toBe((roles as readonly string[]).includes(role));
      }
    }
  });

  it('gives Viewers no change permissions and no financial reports', () => {
    expect(permissionsForRole('viewer')).toEqual([]);
  });

  it('gives Admin every permission', () => {
    expect(permissionsForRole('admin').length).toBeGreaterThan(5);
    expect(permissionsForRole('admin')).toEqual(permissionsForRole('top_management'));
  });
});

describe('Manual voucher types', () => {
  it('rejects PI as a manual voucher type because Purchase Vouchers create it', () => {
    const result = createVoucherInputSchema.safeParse({
      voucher_type: 'PI',
      voucher_date: '2026-01-01',
      lines: [
        { account_id: 'a0000000-0000-0000-0000-000000000001', account_code: '0101100101', account_name: 'Cash', dr_amount: 10, cr_amount: 0 },
        { account_id: 'a0000000-0000-0000-0000-000000000002', account_code: '0201010001', account_name: 'Supplier', dr_amount: 0, cr_amount: 10 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects amounts with more than 2 decimal places', () => {
    const result = createVoucherInputSchema.safeParse({
      voucher_type: 'JV',
      voucher_date: '2026-01-01',
      lines: [
        { account_id: 'a0000000-0000-0000-0000-000000000001', account_code: '0101100101', account_name: 'Cash', dr_amount: 10.005, cr_amount: 0 },
        { account_id: 'a0000000-0000-0000-0000-000000000002', account_code: '0201010001', account_name: 'Supplier', dr_amount: 0, cr_amount: 10.005 },
      ],
    });
    expect(result.success).toBe(false);
  });
});
