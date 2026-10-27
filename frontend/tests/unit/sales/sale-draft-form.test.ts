import { buildSalePayload, saleFormFromDetail } from '@/components/sales/SaleVoucherBusiness';

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 's-1',
    sale_number: 'SI-2025-0004',
    sale_date: '2025-10-04T00:00:00.000Z',
    customer_id: 'c-1',
    payment_type: 'Credit',
    due_date: '2025-11-03',
    delivery_date: '2025-10-05T00:00:00.000Z',
    branch_id: 'b-1',
    location_id: 'l-1',
    customer_reference_number: 'PO-77',
    delivery_note_number: null,
    freight_amount: '0',
    lines: [
      { line_number: 1, item_id: 'i-a', item_code: 'ITEM-A', item_name: 'Item A', uom_name: 'PCS', quantity: '3', sale_price: '70.5', discount_amount: '0', tax_amount: '0', line_total: '211.50', description: null },
    ],
    ...overrides,
  };
}

describe('saleFormFromDetail', () => {
  it('maps a saved draft sale to the entry form, with the sale price in the shared line editor', () => {
    const form = saleFormFromDetail(detail());
    expect(form).toMatchObject({
      id: 's-1',
      saleNumber: 'SI-2025-0004',
      saleDate: '2025-10-04',
      customerId: 'c-1',
      paymentType: 'Credit',
      dueDate: '2025-11-03',
      deliveryDate: '2025-10-05',
      branchId: 'b-1',
      locationId: 'l-1',
      customerReferenceNumber: 'PO-77',
      deliveryNoteNumber: '',
      freightAmount: '',
    });
    expect(form.lines).toEqual([{
      id: 1, itemId: 'i-a', itemCode: 'ITEM-A', itemName: 'Item A', uomName: 'PCS',
      quantity: '3.0000', purchasePrice: '70.50', discountAmount: '0.00', taxAmount: '0.00', lineTotal: 211.5, description: '',
    }]);
  });

  it('round-trips into the same sale payload fields', () => {
    const form = saleFormFromDetail(detail({ payment_type: 'Cash', due_date: null }));
    const payload = buildSalePayload({
      saleDate: form.saleDate,
      customerId: form.customerId,
      paymentType: form.paymentType,
      dueDate: form.dueDate,
      deliveryDate: form.deliveryDate,
      branchId: form.branchId,
      locationId: form.locationId,
      customerReferenceNumber: form.customerReferenceNumber,
      deliveryNoteNumber: form.deliveryNoteNumber,
      generatedVoucherDetails: 'Sale',
      freight: 0,
      lines: form.lines,
    });
    expect(payload).toMatchObject({ sale_date: '2025-10-04', payment_type: 'Cash', due_date: undefined, branch_id: 'b-1', location_id: 'l-1' });
    expect(payload.lines).toEqual([{ item_id: 'i-a', quantity: 3, sale_price: 70.5, discount_amount: 0, tax_amount: 0, description: undefined }]);
  });
});
