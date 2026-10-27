import { transferFormFromDetail } from '@/components/stock-transfers/transfer-drafts';

describe('transferFormFromDetail', () => {
  it('maps a Warehouse (with shelf) to Branch draft, keeping line order', () => {
    const form = transferFormFromDetail({
      id: 't-1', transfer_number: 'ST-2025-0009', transfer_date: '2025-12-01T00:00:00.000Z',
      from_branch_id: null, from_warehouse_id: 'w-1', from_location_id: 'l-1',
      to_branch_id: 'b-2', to_warehouse_id: null, to_location_id: null,
      reference_number: null, description: 'Weekly refill',
      lines: [
        { line_number: 2, item_id: 'i-b', item_code: 'B', item_name: 'Item B', uom_name: null, quantity: '1.5000', description: null },
        { line_number: 1, item_id: 'i-a', item_code: 'A', item_name: 'Item A', uom_name: 'PCS', quantity: '6.0000', description: 'Front shelf' },
      ],
    });
    expect(form).toMatchObject({
      id: 't-1', transferNumber: 'ST-2025-0009', transferDate: '2025-12-01',
      from: { kind: 'WAREHOUSE', id: 'w-1', locationId: 'l-1' },
      to: { kind: 'BRANCH', id: 'b-2', locationId: '' },
      referenceNumber: '', description: 'Weekly refill',
    });
    expect(form.lines).toEqual([
      { itemId: 'i-a', itemCode: 'A', itemName: 'Item A', uomName: 'PCS', quantity: '6', description: 'Front shelf' },
      { itemId: 'i-b', itemCode: 'B', itemName: 'Item B', uomName: '', quantity: '1.5', description: '' },
    ]);
  });

  it('maps Branch to Warehouse and copes with no lines', () => {
    const form = transferFormFromDetail({ id: 't', transfer_number: 'ST', transfer_date: '2025-12-02', from_branch_id: 'b-1', to_warehouse_id: 'w-9' });
    expect(form.from).toEqual({ kind: 'BRANCH', id: 'b-1', locationId: '' });
    expect(form.to).toEqual({ kind: 'WAREHOUSE', id: 'w-9', locationId: '' });
    expect(form.lines).toEqual([]);
  });
});
