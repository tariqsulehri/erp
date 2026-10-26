import { describe, it, expect } from 'vitest';
import { createVoucherInputSchema, voucherLineInputSchema } from '../src/modules/vouchers/voucher.schema.js';
import { VoucherService } from '../src/modules/vouchers/voucher.service.js';

describe('Accounting Rules - 10-Digit Account Codes', () => {
  it('accepts valid 10-digit numeric account codes (MM GG SS PPPP)', () => {
    const validCodes = [
      '0101100001', // Cash / Bank
      '0103010001', // Customer AR start
      '0103999999', // Customer AR end
      '0201010001', // Supplier AP start
      '0201999999', // Supplier AP end
      '0401100001', // Sales revenue
      '0501100001', // Expense
    ];

    for (const code of validCodes) {
      const result = voucherLineInputSchema.safeParse({
        account_id: 'a0000000-0000-0000-0000-000000000001',
        account_code: code,
        account_name: 'Test Account',
        dr_amount: 100,
        cr_amount: 0,
      });
      expect(result.success, `Expected code ${code} to be valid`).toBe(true);
    }
  });

  it('rejects obsolete legacy 4-digit, 6-digit, 8-digit, or alphanumeric account codes', () => {
    const invalidCodes = [
      '0101',       // 4-digit legacy
      '010110',     // 6-digit legacy
      '01011000',   // 8-digit legacy
      '01011000010', // 11 digits
      '010110000A', // Alphanumeric
      'ACCOUNT-01', // String code
      '',           // Empty
    ];

    for (const code of invalidCodes) {
      const result = voucherLineInputSchema.safeParse({
        account_id: 'a0000000-0000-0000-0000-000000000001',
        account_code: code,
        account_name: 'Test Account',
        dr_amount: 100,
        cr_amount: 0,
      });
      expect(result.success, `Expected code ${code} to be invalid`).toBe(false);
    }
  });
});

describe('Accounting Rules - Double-Entry Balance', () => {
  const service = new VoucherService('c0000000-0000-0000-0000-000000000001');

  it('passes when total debit strictly equals total credit', () => {
    const validVoucher = {
      voucher_type: 'JV' as const,
      voucher_date: '2026-06-25',
      lines: [
        {
          account_id: 'a0000000-0000-0000-0000-000000000001',
          account_code: '0101100001',
          account_name: 'Cash in Hand',
          dr_amount: 2500.50,
          cr_amount: 0,
          line_no: 1,
        },
        {
          account_id: 'a0000000-0000-0000-0000-000000000002',
          account_code: '0401100001',
          account_name: 'Sales Revenue',
          dr_amount: 0,
          cr_amount: 2500.50,
          line_no: 2,
        },
      ],
    };

    const schemaResult = createVoucherInputSchema.safeParse(validVoucher);
    expect(schemaResult.success).toBe(true);

    const validateLines = (service as any).validateLines.bind(service);
    const balance = validateLines(schemaResult.data);
    expect(balance.totalDebit).toBe(2500.50);
    expect(balance.totalCredit).toBe(2500.50);
  });

  it('throws a business error when total debit does not match total credit', () => {
    const unbalancedVoucher = {
      voucher_type: 'JV' as const,
      voucher_date: '2026-06-25',
      lines: [
        {
          account_id: 'a0000000-0000-0000-0000-000000000001',
          account_code: '0101100001',
          account_name: 'Cash in Hand',
          dr_amount: 3000.00,
          cr_amount: 0,
          line_no: 1,
        },
        {
          account_id: 'a0000000-0000-0000-0000-000000000002',
          account_code: '0401100001',
          account_name: 'Sales Revenue',
          dr_amount: 0,
          cr_amount: 2500.00,
          line_no: 2,
        },
      ],
    };

    const schemaResult = createVoucherInputSchema.safeParse(unbalancedVoucher);
    expect(schemaResult.success).toBe(true);

    const validateLines = (service as any).validateLines.bind(service);
    expect(() => validateLines(schemaResult.data)).toThrowError(
      /Voucher is not balanced/i
    );
  });

  it('requires at least 2 voucher lines', () => {
    const singleLineVoucher = {
      voucher_type: 'JV' as const,
      voucher_date: '2026-06-25',
      lines: [
        {
          account_id: 'a0000000-0000-0000-0000-000000000001',
          account_code: '0101100001',
          account_name: 'Cash in Hand',
          dr_amount: 100,
          cr_amount: 0,
          line_no: 1,
        },
      ],
    };

    const schemaResult = createVoucherInputSchema.safeParse(singleLineVoucher);
    expect(schemaResult.success).toBe(false);
  });

  it('rejects negative debit or credit amounts', () => {
    const negativeLine = {
      account_id: 'a0000000-0000-0000-0000-000000000001',
      account_code: '0101100001',
      account_name: 'Cash in Hand',
      dr_amount: -500,
      cr_amount: 0,
    };

    const result = voucherLineInputSchema.safeParse(negativeLine);
    expect(result.success).toBe(false);
  });

  it('rejects a voucher line with both debit and credit amounts', () => {
    const bothAmountsVoucher = {
      voucher_type: 'JV' as const,
      voucher_date: '2026-06-25',
      lines: [
        {
          account_id: 'a0000000-0000-0000-0000-000000000001',
          account_code: '0101100001',
          account_name: 'Cash in Hand',
          dr_amount: 100,
          cr_amount: 100,
          line_no: 1,
        },
        {
          account_id: 'a0000000-0000-0000-0000-000000000002',
          account_code: '0401100001',
          account_name: 'Sales Revenue',
          dr_amount: 0,
          cr_amount: 100,
          line_no: 2,
        },
      ],
    };

    const validateLines = (service as any).validateLines.bind(service);
    expect(() => validateLines(bothAmountsVoucher)).toThrowError(
      /cannot have both Debit and Credit amounts/i
    );
  });
});
