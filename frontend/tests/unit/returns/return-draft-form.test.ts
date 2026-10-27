import { buildPurchaseReturnPayload, purchaseReturnFormFromDetail } from '@/components/purchase-returns/PurchaseReturnBusiness';
import { buildSaleReturnPayload, saleReturnFormFromDetail } from '@/components/sale-returns/SaleReturnBusiness';

const line = { line_number: 1, item_id: 'i-a', item_code: 'ITEM-A', item_name: 'Item A', uom_name: 'PCS', quantity: '2', discount_amount: '0', tax_amount: '0', line_total: '80', description: 'Damaged' };

describe('saleReturnFormFromDetail', () => {
  it('maps a saved draft sale return to the form and back to the same payload', () => {
    const form = saleReturnFormFromDetail({
      id: 'r-1', sale_return_number: 'SR-2025-0003', sale_return_date: '2025-10-04T00:00:00.000Z', customer_id: 'c-1',
      payment_type: 'Cash', customer_return_number: 'CR-1', customer_return_date: null, branch_id: 'b-1', location_id: null,
      reference_number: 'REF', freight_amount: '0', lines: [{ ...line, sale_price: '40' }],
    });
    expect(form).toMatchObject({
      saleReturnNumber: 'SR-2025-0003', saleReturnDate: '2025-10-04', paymentType: 'Cash', customerReturnNumber: 'CR-1',
      customerReturnDate: '', branchId: 'b-1', locationId: '', referenceNumber: 'REF', freightAmount: '',
    });
    const payload = buildSaleReturnPayload({ ...form, generatedVoucherDetails: 'Return', freight: 0 });
    expect(payload.lines).toEqual([{ item_id: 'i-a', quantity: 2, sale_price: 40, discount_amount: 0, tax_amount: 0, description: 'Damaged' }]);
    expect(payload.location_id).toBeUndefined();
  });

  it('defaults an unknown payment type to Credit, as a new return does', () => {
    expect(saleReturnFormFromDetail({ id: 'r', sale_return_number: 'SR', payment_type: undefined }).paymentType).toBe('Credit');
  });
});

describe('purchaseReturnFormFromDetail', () => {
  it('maps a saved draft purchase return to the form and back to the same payload', () => {
    const form = purchaseReturnFormFromDetail({
      id: 'p-1', purchase_return_number: 'PR-2025-0002', purchase_return_date: '2025-11-04', supplier_id: 's-1',
      payment_type: 'Credit', supplier_return_number: null, supplier_return_date: '2025-11-03T00:00:00.000Z',
      warehouse_id: 'w-1', location_id: 'l-1', reference_number: null, freight_amount: '7.5', lines: [{ ...line, purchase_price: '40' }],
    });
    expect(form).toMatchObject({
      purchaseReturnNumber: 'PR-2025-0002', purchaseReturnDate: '2025-11-04', supplierReturnNumber: '', supplierReturnDate: '2025-11-03',
      warehouseId: 'w-1', locationId: 'l-1', freightAmount: '7.50',
    });
    const payload = buildPurchaseReturnPayload({ ...form, generatedVoucherDetails: 'Return', freight: 7.5 });
    expect(payload.lines).toEqual([{ item_id: 'i-a', warehouse_id: 'w-1', quantity: 2, purchase_price: 40, discount_amount: 0, tax_amount: 0, description: 'Damaged' }]);
    expect(payload).toMatchObject({ warehouse_id: 'w-1', location_id: 'l-1', freight_amount: 7.5 });
  });
});
