import { renderHook } from '@testing-library/react';
import { roleCannotSave, usePermission } from '@/lib/auth/use-permission';

let role: string | undefined = 'viewer';
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: role ? { user: { role } } : null }),
}));

describe('usePermission', () => {
  it('follows the role table the backend enforces', () => {
    role = 'viewer';
    expect(renderHook(() => usePermission('purchases.edit')).result.current).toBe(false);
    role = 'warehouse_staff';
    expect(renderHook(() => usePermission('purchases.edit')).result.current).toBe(true);
    expect(renderHook(() => usePermission('sales.edit')).result.current).toBe(false);
    role = 'sales_staff';
    expect(renderHook(() => usePermission('stock_adjustments.edit')).result.current).toBe(false);
    role = 'manager';
    expect(renderHook(() => usePermission('stock_adjustments.edit')).result.current).toBe(true);
  });

  it('allows nothing without a session', () => {
    role = undefined;
    expect(renderHook(() => usePermission('sales.edit')).result.current).toBe(false);
  });

  it('explains in plain words why an action is not available', () => {
    expect(roleCannotSave('Sale Vouchers')).toBe('Your role can view Sale Vouchers but cannot save or post them.');
  });
});
