import { adjustmentFormFromDetail } from '@/components/stock-adjustments/adjustment-drafts';

describe('adjustmentFormFromDetail', () => {
  it('maps a Warehouse draft with Increase and Decrease lines, keeping line order', () => {
    const form = adjustmentFormFromDetail({
      id: 'a-1', adjustment_number: 'SA-2025-0004', adjustment_date: '2025-09-02T00:00:00.000Z',
      branch_id: null, warehouse_id: 'w-1', location_id: 'l-1', reference_number: null, reason: 'Recount', description: null,
      lines: [
        { line_number: 2, adjustment_type: 'Decrease', item_id: 'i-b', item_code: 'B', item_name: 'Item B', uom_name: null, quantity: '2.0000', unit_cost: '30.0000', description: 'Damaged' },
        { line_number: 1, adjustment_type: 'Increase', item_id: 'i-a', item_code: 'A', item_name: 'Item A', uom_name: 'PCS', quantity: '3.5000', unit_cost: '12.5000', description: null },
      ],
    });
    expect(form).toMatchObject({
      id: 'a-1', adjustmentNumber: 'SA-2025-0004', adjustmentDate: '2025-09-02', holderKind: 'WAREHOUSE',
      branchId: '', warehouseId: 'w-1', locationId: 'l-1', referenceNumber: '', reason: 'Recount', description: '',
    });
    expect(form.lines).toEqual([
      { adjustmentType: 'Increase', itemId: 'i-a', itemCode: 'A', itemName: 'Item A', uomName: 'PCS', quantity: '3.5', unitCost: '12.5', description: '' },
      { adjustmentType: 'Decrease', itemId: 'i-b', itemCode: 'B', itemName: 'Item B', uomName: '', quantity: '2', unitCost: '30', description: 'Damaged' },
    ]);
  });

  it('maps a Branch draft and copes with no lines', () => {
    const form = adjustmentFormFromDetail({ id: 'a', adjustment_number: 'SA', adjustment_date: '2025-09-03', branch_id: 'b-1' });
    expect(form).toMatchObject({ holderKind: 'BRANCH', branchId: 'b-1', warehouseId: '', locationId: '' });
    expect(form.lines).toEqual([]);
  });
});
