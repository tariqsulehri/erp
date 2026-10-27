import { buildPurchasePayload, purchaseFormFromDetail } from '@/components/purchases/PurchaseVoucherBusiness';
import { purchaseStatusLabel, PURCHASE_STATUS_OPTIONS } from '@/components/purchases/PurchaseVoucherHelpers';

function detail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    purchase_number: 'PI-2025-0007',
    purchase_date: '2025-10-04T00:00:00.000Z',
    supplier_id: 's-1',
    payment_type: 'Credit',
    supplier_invoice_number: 'BILL-9',
    supplier_invoice_date: '2025-10-03',
    due_date: '2025-11-03T00:00:00.000Z',
    warehouse_id: 'w-1',
    location_id: null,
    reference_number: null,
    freight_amount: '5.00',
    status: 'Draft',
    lines: [
      { line_number: 2, item_id: 'i-a', item_code: 'ITEM-A', item_name: 'Item A', uom_name: 'PCS', quantity: '1.0000', purchase_price: '10.00', discount_amount: '0.00', tax_amount: '0.00', line_total: '10.00', description: null },
      { line_number: 1, item_id: 'i-b', item_code: 'ITEM-B', item_name: 'Item B', uom_name: null, quantity: '2.5', purchase_price: '40', discount_amount: '1.5', tax_amount: '2', line_total: '100.50', description: 'Blue' },
    ],
    ...overrides,
  };
}

describe('purchaseFormFromDetail', () => {
  it('maps a saved draft to the entry form, keeping line order and dates as YYYY-MM-DD', () => {
    const form = purchaseFormFromDetail(detail());
    expect(form).toMatchObject({
      id: 'p-1',
      purchaseNumber: 'PI-2025-0007',
      purchaseDate: '2025-10-04',
      supplierId: 's-1',
      paymentType: 'Credit',
      supplierInvoiceNumber: 'BILL-9',
      supplierInvoiceDate: '2025-10-03',
      dueDate: '2025-11-03',
      warehouseId: 'w-1',
      locationId: '',
      referenceNumber: '',
      freightAmount: '5.00',
    });
    expect(form.lines.map(line => [line.id, line.itemId])).toEqual([[1, 'i-b'], [2, 'i-a']]);
    expect(form.lines[0]).toEqual({
      id: 1, itemId: 'i-b', itemCode: 'ITEM-B', itemName: 'Item B', uomName: '',
      quantity: '2.5000', purchasePrice: '40.00', discountAmount: '1.50', taxAmount: '2.00', lineTotal: 100.5, description: 'Blue',
    });
  });

  it('handles empty values: no freight, no dates, no lines, Cash payment', () => {
    const form = purchaseFormFromDetail(detail({
      freight_amount: '0.00', supplier_invoice_date: null, due_date: null, payment_type: 'Cash', lines: undefined,
    }));
    expect(form.freightAmount).toBe('');
    expect(form.supplierInvoiceDate).toBe('');
    expect(form.dueDate).toBe('');
    expect(form.paymentType).toBe('Cash');
    expect(form.lines).toEqual([]);
  });

  it('produces lines that build the same save payload the backend validates', () => {
    const form = purchaseFormFromDetail(detail());
    const payload = buildPurchasePayload({
      purchaseDate: form.purchaseDate,
      supplierId: form.supplierId,
      supplierInvoiceNumber: form.supplierInvoiceNumber,
      supplierInvoiceDate: form.supplierInvoiceDate,
      paymentType: form.paymentType,
      dueDate: form.dueDate,
      warehouseId: form.warehouseId,
      locationId: form.locationId,
      referenceNumber: form.referenceNumber,
      generatedVoucherDetails: 'Purchase',
      freight: 5,
      lines: form.lines,
    });
    expect(payload.lines).toEqual([
      { item_id: 'i-b', warehouse_id: 'w-1', quantity: 2.5, purchase_price: 40, discount_amount: 1.5, tax_amount: 2, description: 'Blue' },
      { item_id: 'i-a', warehouse_id: 'w-1', quantity: 1, purchase_price: 10, discount_amount: 0, tax_amount: 0, description: undefined },
    ]);
    expect(payload.due_date).toBe('2025-11-03');
    expect(payload.location_id).toBeUndefined();
  });
});

describe('purchase status labels', () => {
  it('shows a cancelled draft (stored as Voided) as Cancelled', () => {
    expect(purchaseStatusLabel('Voided')).toBe('Cancelled');
    expect(purchaseStatusLabel('Draft')).toBe('Draft');
    expect(purchaseStatusLabel('Posted')).toBe('Posted');
    expect(PURCHASE_STATUS_OPTIONS.map(option => option.value)).toEqual(['Posted', 'Draft', 'Voided']);
  });
});
