/**
 * Manual voucher tests (JV, CRV, CPV, BRV, BPV, CV) against the real database, inside an isolated test company.
 * Covers account rules, editing, approval workflow, posting, amounts, numbering, list filters and void.
 * Reversal, year-end closing and GL-vs-stock checks live in ledger-integrity.integration.test.ts.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

type VoucherServiceType = typeof import('../src/modules/vouchers/voucher.service.js')['VoucherService'];
type VoucherSchemas = typeof import('../src/modules/vouchers/voucher.schema.js');
type Line = { account_id: string; account_code: string; account_name: string; dr_amount: number; cr_amount: number; line_no: number; narration?: string };
type VoucherType = 'JV' | 'CRV' | 'CPV' | 'BRV' | 'BPV' | 'CV';

describe.skipIf(!databaseUrl)('Manual vouchers (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let VoucherService: VoucherServiceType;
  let schemas: VoucherSchemas;
  let vouchers: InstanceType<VoucherServiceType>;

  // Different people for maker-checker checks (the voucher columns are plain uuids).
  const maker = randomUUID();
  const checker = randomUUID();
  const requester = randomUUID();

  const accounts: Record<string, { id: string; code: string; name: string }> = {};
  let bankAccountRowId = '';
  const searchTag = `VCHTEST${randomUUID().slice(0, 6).toUpperCase()}`;

  async function addAccount(key: string, code: string, name: string, type: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense', normal: 'Debit' | 'Credit') {
    const id = await insertAccount(prisma, companyId, code, name, type, normal);
    accounts[key] = { id, code, name };
  }

  function line(key: string, dr: number, cr: number, lineNo: number): Line {
    const account = accounts[key];
    return { account_id: account.id, account_code: account.code, account_name: account.name, dr_amount: dr, cr_amount: cr, line_no: lineNo };
  }

  function input(type: VoucherType, date: string, lines: Line[], extra: Record<string, unknown> = {}) {
    return { voucher_type: type, voucher_date: date, submit_for_approval: false, lines, ...extra } as Parameters<InstanceType<VoucherServiceType>['create']>[0];
  }

  async function approvedVoucher(type: VoucherType, date: string, lines: Line[], extra: Record<string, unknown> = {}) {
    const draft = await vouchers.create(input(type, date, lines, { submit_for_approval: true, ...extra }), maker);
    await vouchers.approve(draft.id, {}, checker);
    return draft;
  }

  async function approvalHistory(voucherId: string) {
    return prisma.documentApproval.findMany({
      where: { companyId, documentType: 'Voucher', documentId: voucherId },
      orderBy: { createdAt: 'asc' },
    });
  }

  beforeAll(async () => {
    company = await createTestCompany('Vouchers');
    prisma = company.prisma;
    companyId = company.companyId;
    VoucherService = (await import('../src/modules/vouchers/voucher.service.js')).VoucherService;
    schemas = await import('../src/modules/vouchers/voucher.schema.js');
    const { FiscalYearService } = await import('../src/modules/fiscal-years/fiscal-year.service.js');
    const { BankAccountService } = await import('../src/modules/bank-accounts/bank-account.service.js');
    vouchers = new VoucherService(companyId);

    const years = new FiscalYearService(companyId);
    await years.create({ fiscal_year: '2025-2026', year_basis: 'july', start_date: '2025-07-01', end_date: '2026-06-30', number_of_periods: 12, posting_cutoff_days: 0 });

    await addAccount('cash', '0101100001', 'Cash In Hand Test', 'Asset', 'Debit');
    await addAccount('pettyCash', '0101010002', 'Petty Cash Test', 'Asset', 'Debit');
    await addAccount('bank', '0101200001', 'Bank Ledger Test', 'Asset', 'Debit');
    await addAccount('bank2', '0101200002', 'Second Bank Ledger Test', 'Asset', 'Debit');
    await addAccount('unlinkedBank', '0101200003', 'Unlinked Bank Ledger Test', 'Asset', 'Debit');
    await addAccount('customer', '0103010001', 'Customer Receivable Test', 'Asset', 'Debit');
    await addAccount('supplier', '0201010001', 'Supplier Payable Test', 'Liability', 'Credit');
    await addAccount('expense', '0601010001', 'Office Expense Test', 'Expense', 'Debit');
    await addAccount('revenue', '0401010001', 'Other Income Test', 'Revenue', 'Credit');

    const banks = new BankAccountService(companyId);
    const bankRow = await banks.create({
      code: 'BANK-1', ledger_account_id: accounts.bank.id, bank_name: 'Test Bank', account_title: 'Main', account_number: 'ACC-001',
      currency_code: 'PKR', opening_balance: 0, is_default: true, is_active: true,
    } as never, maker);
    bankAccountRowId = (bankRow.bank_account as { id: string }).id;
    await banks.create({
      code: 'BANK-2', ledger_account_id: accounts.bank2.id, bank_name: 'Test Bank', account_title: 'Second', account_number: 'ACC-002',
      currency_code: 'PKR', opening_balance: 0, is_default: false, is_active: true,
    } as never, maker);
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  describe('account rules per voucher type', () => {
    it('creates a JV between any posting accounts', async () => {
      const voucher = await vouchers.create(input('JV', '2025-08-01', [line('expense', 100, 0, 1), line('supplier', 0, 100, 2)]), maker);
      expect(voucher.voucher_type).toBe('JV');
      expect(voucher.status).toBe('Draft');
      expect(voucher.approval_status).toBe('Not Required');
      expect(voucher.total_debit).toBe('100');
      expect(voucher.lines).toHaveLength(2);
    });

    it('CRV needs a Debit Cash primary line and Credit counter lines', async () => {
      const ok = await vouchers.create(input('CRV', '2025-08-02', [line('cash', 50, 0, 1), line('customer', 0, 50, 2)]), maker);
      expect(ok.voucher_number).toMatch(/^CRV-2025-\d{4}$/);
      await expect(vouchers.create(input('CRV', '2025-08-02', [line('customer', 50, 0, 1), line('revenue', 0, 50, 2)]), maker))
        .rejects.toThrow(/Cash Account must be an active Cash posting account/);
      await expect(vouchers.create(input('CRV', '2025-08-02', [line('cash', 0, 50, 1), line('customer', 50, 0, 2)]), maker))
        .rejects.toThrow(/Cash Account must be a Debit line/);
    });

    it('CPV needs a Credit Cash primary line and Debit counter lines', async () => {
      const ok = await vouchers.create(input('CPV', '2025-08-02', [line('pettyCash', 0, 40, 1), line('expense', 40, 0, 2)]), maker);
      expect(ok.voucher_number).toMatch(/^CPV-2025-\d{4}$/);
      await expect(vouchers.create(input('CPV', '2025-08-02', [line('cash', 40, 0, 1), line('expense', 0, 40, 2)]), maker))
        .rejects.toThrow(/Cash Account must be a Credit line/);
      await expect(vouchers.create(input('CPV', '2025-08-02', [line('cash', 0, 40, 1), line('supplier', 0, 0, 2), line('expense', 40, 0, 3)]), maker))
        .rejects.toThrow(/Debit or Credit amount is required on line 2/);
    });

    it('BRV needs a Debit linked Bank Account primary line', async () => {
      const ok = await vouchers.create(input('BRV', '2025-08-03', [line('bank', 300, 0, 1), line('customer', 0, 300, 2)]), maker);
      expect(ok.voucher_number).toMatch(/^BRV-2025-\d{4}$/);
      await expect(vouchers.create(input('BRV', '2025-08-03', [line('unlinkedBank', 300, 0, 1), line('customer', 0, 300, 2)]), maker))
        .rejects.toThrow(/must be an active linked Bank Account/);
      await expect(vouchers.create(input('BRV', '2025-08-03', [line('cash', 300, 0, 1), line('customer', 0, 300, 2)]), maker))
        .rejects.toThrow(/must be an active linked Bank Account/);
      await expect(vouchers.create(input('BRV', '2025-08-03', [line('bank', 0, 300, 1), line('customer', 300, 0, 2)]), maker))
        .rejects.toThrow(/Bank Account must be a Debit line/);
    });

    it('BPV needs a Credit linked Bank Account primary line and Debit counter lines', async () => {
      const ok = await vouchers.create(input('BPV', '2025-08-03', [line('bank', 0, 120, 1), line('supplier', 120, 0, 2)]), maker);
      expect(ok.voucher_number).toMatch(/^BPV-2025-\d{4}$/);
      await expect(vouchers.create(input('BPV', '2025-08-03', [line('bank', 0, 120, 1), line('supplier', 0, 120, 2), line('expense', 240, 0, 3)]), maker))
        .rejects.toThrow(/Paid To Account must be a Debit line on line 2/);
    });

    it('rejects a bank voucher when the linked Bank Account is inactive', async () => {
      await prisma.bankAccount.update({ where: { id: bankAccountRowId }, data: { isActive: false } });
      try {
        await expect(vouchers.create(input('BPV', '2025-08-03', [line('bank', 0, 10, 1), line('supplier', 10, 0, 2)]), maker))
          .rejects.toThrow(/must be an active linked Bank Account/);
      } finally {
        await prisma.bankAccount.update({ where: { id: bankAccountRowId }, data: { isActive: true } });
      }
    });

    it('does not allow Cash or Bank accounts, or the primary account, as counter lines', async () => {
      await expect(vouchers.create(input('CRV', '2025-08-04', [line('cash', 10, 0, 1), line('pettyCash', 0, 10, 2)]), maker))
        .rejects.toThrow(/cannot be a Cash or Bank control account on line 2/);
      await expect(vouchers.create(input('BPV', '2025-08-04', [line('bank', 0, 10, 1), line('bank2', 10, 0, 2)]), maker))
        .rejects.toThrow(/cannot be a Cash or Bank control account on line 2/);
      await expect(vouchers.create(input('CPV', '2025-08-04', [line('cash', 0, 10, 1), line('cash', 10, 0, 2)]), maker))
        .rejects.toThrow(/cannot be the selected Cash Account on line 2/);
    });

    it('rejects stale account code/name and inactive accounts on cash and bank vouchers', async () => {
      const stale = { ...line('customer', 0, 10, 2), account_name: 'Old Name' };
      await expect(vouchers.create(input('CRV', '2025-08-04', [line('cash', 10, 0, 1), stale]), maker))
        .rejects.toThrow(/Account details on line 2 have changed/);
      await prisma.account.update({ where: { id: accounts.revenue.id }, data: { isActive: false } });
      try {
        await expect(vouchers.create(input('CRV', '2025-08-04', [line('cash', 10, 0, 1), line('revenue', 0, 10, 2)]), maker))
          .rejects.toThrow(/not found or is inactive on line 2/);
      } finally {
        await prisma.account.update({ where: { id: accounts.revenue.id }, data: { isActive: true } });
      }
    });

    // Regression: accounts used to be checked only for CRV/CPV/BRV/BPV, so JV and CV accepted inactive accounts.
    it('rejects an inactive account on a JV line', async () => {
      await prisma.account.update({ where: { id: accounts.revenue.id }, data: { isActive: false } });
      try {
        await expect(vouchers.create(input('JV', '2025-08-04', [line('expense', 10, 0, 1), line('revenue', 0, 10, 2)]), maker))
          .rejects.toThrow(/inactive/);
      } finally {
        await prisma.account.update({ where: { id: accounts.revenue.id }, data: { isActive: true } });
      }
    });

    it('creates a CV (contra) between cash and bank and posts it', async () => {
      const draft = await approvedVoucher('CV', '2025-08-05', [line('bank', 500, 0, 1), line('cash', 0, 500, 2)]);
      expect(draft.voucher_number).toMatch(/^CV-2025-\d{4}$/);
      const posted = await vouchers.post(draft.id, maker);
      expect(posted.status).toBe('Posted');
      expect(posted.posted_by).toBe(maker);
    });

    it('does not accept system types (PI, SI, RV, CL) as manual vouchers', () => {
      for (const type of ['PI', 'SI', 'RV', 'CL', 'SA']) {
        const result = schemas.createVoucherInputSchema.safeParse(input(type as VoucherType, '2025-08-05', [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)]));
        expect(result.success).toBe(false);
      }
    });

    it('rejects unsupported fields (auto reverse date, cost centre)', async () => {
      await expect(vouchers.create(input('JV', '2025-08-05', [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)], { auto_reverse_date: '2025-09-01' }), maker))
        .rejects.toThrow(/Auto Reverse Date/);
      const withCostCentre = { ...line('expense', 1, 0, 1), cost_center_id: randomUUID() };
      await expect(vouchers.create(input('JV', '2025-08-05', [withCostCentre, line('supplier', 0, 1, 2)]), maker))
        .rejects.toThrow(/Cost Center/);
    });

    it('rejects a voucher dated outside any fiscal year', async () => {
      await expect(vouchers.create(input('JV', '2024-01-05', [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)]), maker))
        .rejects.toThrow(/Voucher Date cannot be used/);
    });
  });

  describe('amounts', () => {
    it('allows at most 2 decimal places in the request schema', () => {
      const bad = schemas.createVoucherInputSchema.safeParse(input('JV', '2025-08-06', [line('expense', 10.005, 0, 1), line('supplier', 0, 10.005, 2)]));
      expect(bad.success).toBe(false);
      const good = schemas.createVoucherInputSchema.safeParse(input('JV', '2025-08-06', [line('expense', 10.05, 0, 1), line('supplier', 0, 10.05, 2)]));
      expect(good.success).toBe(true);
      const tooFew = schemas.createVoucherInputSchema.safeParse(input('JV', '2025-08-06', [line('expense', 10, 0, 1)]));
      expect(tooFew.success).toBe(false);
    });

    it('balances exactly in decimals (0.10 + 0.20 = 0.30) and stores 2-decimal totals', async () => {
      const voucher = await vouchers.create(input('JV', '2025-08-06', [
        line('expense', 0.1, 0, 1), line('expense', 0.2, 0, 2), line('supplier', 0, 0.3, 3),
      ]), maker);
      expect(Number(voucher.total_debit)).toBe(0.3);
      expect(voucher.total_debit).toBe(voucher.total_credit);
    });

    it('rejects a one-cent imbalance, lines with both sides, and negative amounts', async () => {
      await expect(vouchers.create(input('JV', '2025-08-06', [line('expense', 10.01, 0, 1), line('supplier', 0, 10, 2)]), maker))
        .rejects.toThrow(/not balanced/);
      await expect(vouchers.create(input('JV', '2025-08-06', [line('expense', 10, 10, 1), line('supplier', 0, 10, 2)]), maker))
        .rejects.toThrow(/cannot have both Debit and Credit/);
      await expect(vouchers.create(input('JV', '2025-08-06', [line('expense', -10, 0, 1), line('supplier', 0, -10, 2)]), maker))
        .rejects.toThrow(/cannot be negative/);
    });
  });

  describe('editing', () => {
    it('edits a Draft voucher and replaces its lines', async () => {
      const draft = await vouchers.create(input('JV', '2025-08-07', [line('expense', 10, 0, 1), line('supplier', 0, 10, 2)]), maker);
      const updated = await vouchers.update(draft.id, input('JV', '2025-08-08', [
        line('expense', 20, 0, 1), line('expense', 5, 0, 2), line('supplier', 0, 25, 3),
      ], { reference: 'Edited' }), maker);
      expect(updated.total_debit).toBe('25');
      expect(updated.reference).toBe('Edited');
      expect(updated.voucher_number).toBe(draft.voucher_number);
      expect(await prisma.voucherLine.count({ where: { voucherId: draft.id } })).toBe(3);
      await expect(vouchers.update(draft.id, input('CV', '2025-08-08', [line('bank', 25, 0, 1), line('cash', 0, 25, 2)]), maker))
        .rejects.toThrow(/Voucher Type cannot be changed/);
    });

    it('blocks editing Pending, Approved, Posted and Voided vouchers', async () => {
      const lines = [line('expense', 10, 0, 1), line('supplier', 0, 10, 2)];
      const pending = await vouchers.create(input('JV', '2025-08-07', lines, { submit_for_approval: true }), maker);
      await expect(vouchers.update(pending.id, input('JV', '2025-08-07', lines), maker)).rejects.toThrow(/waiting for approval/);

      await vouchers.approve(pending.id, {}, checker);
      await expect(vouchers.update(pending.id, input('JV', '2025-08-07', lines), maker)).rejects.toThrow(/Approved vouchers cannot be edited/);

      await vouchers.post(pending.id, maker);
      await expect(vouchers.update(pending.id, input('JV', '2025-08-07', lines), maker)).rejects.toThrow(/Only Draft vouchers can be edited/);

      const toVoid = await vouchers.create(input('JV', '2025-08-07', lines), maker);
      await vouchers.void(toVoid.id, 'Not needed', maker);
      await expect(vouchers.update(toVoid.id, input('JV', '2025-08-07', lines), maker)).rejects.toThrow(/Only Draft vouchers can be edited/);
    });

    it('lets a Rejected voucher be edited and sent again', async () => {
      const lines = [line('expense', 10, 0, 1), line('supplier', 0, 10, 2)];
      const draft = await vouchers.create(input('JV', '2025-08-07', lines, { submit_for_approval: true }), maker);
      await vouchers.reject(draft.id, { reason: 'Wrong amount' }, checker);
      const updated = await vouchers.update(draft.id, input('JV', '2025-08-07', [line('expense', 12, 0, 1), line('supplier', 0, 12, 2)], { submit_for_approval: true }), maker);
      expect(updated.approval_status).toBe('Pending');
      expect(updated.rejection_reason).toBeNull();
      expect(updated.rejected_by).toBeNull();
    });
  });

  describe('approval workflow', () => {
    it('records request, rejection with reason, re-request and approval in document_approvals', async () => {
      const draft = await vouchers.create(input('JV', '2025-08-09', [line('expense', 15, 0, 1), line('supplier', 0, 15, 2)]), maker);
      expect(await approvalHistory(draft.id)).toHaveLength(0);

      const requested = await vouchers.requestApproval(draft.id, { note: 'Please check' }, maker);
      expect(requested.approval_status).toBe('Pending');
      expect(requested.approval_requested_by).toBe(maker);
      await expect(vouchers.requestApproval(draft.id, {}, maker)).rejects.toThrow(/already waiting/);

      expect(schemas.voucherRejectActionSchema.safeParse({ reason: '  ' }).success).toBe(false);
      const rejected = await vouchers.reject(draft.id, { reason: 'Missing receipt' }, checker);
      expect(rejected.approval_status).toBe('Rejected');
      expect(rejected.rejection_reason).toBe('Missing receipt');
      expect(rejected.rejected_by).toBe(checker);
      await expect(vouchers.approve(draft.id, {}, checker)).rejects.toThrow(/Only vouchers waiting for approval/);
      await expect(vouchers.post(draft.id, maker)).rejects.toThrow(/must be approved/);

      await vouchers.requestApproval(draft.id, {}, maker);
      const approved = await vouchers.approve(draft.id, { note: 'OK' }, checker);
      expect(approved.approval_status).toBe('Approved');
      expect(approved.approved_by).toBe(checker);
      expect(approved.rejection_reason).toBeNull();
      await expect(vouchers.requestApproval(draft.id, {}, maker)).rejects.toThrow(/already approved/);
      await expect(vouchers.reject(draft.id, { reason: 'late' }, checker)).rejects.toThrow(/Only vouchers waiting for approval/);

      const history = await approvalHistory(draft.id);
      expect(history.map(row => row.approvalStatus)).toEqual(['Pending', 'Rejected', 'Pending', 'Approved']);
      expect(history[0].remarks).toBe('Please check');
      expect(history[1].remarks).toBe('Missing receipt');
      expect(history[1].approvedById).toBe(checker);
      expect(history[3].remarks).toBe('OK');
    });

    it('writes a Pending history row when created with submit_for_approval', async () => {
      const draft = await vouchers.create(input('JV', '2025-08-09', [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)], { submit_for_approval: true }), maker);
      const history = await approvalHistory(draft.id);
      expect(history).toHaveLength(1);
      expect(history[0].approvalStatus).toBe('Pending');
      expect(history[0].approvedById).toBe(maker);
    });

    it('enforces maker-checker for both the creator and the requester', async () => {
      const draft = await vouchers.create(input('JV', '2025-08-09', [line('expense', 2, 0, 1), line('supplier', 0, 2, 2)]), maker);
      await vouchers.requestApproval(draft.id, {}, requester);
      await expect(vouchers.approve(draft.id, {}, maker)).rejects.toThrow(/another approver/i);
      await expect(vouchers.approve(draft.id, {}, requester)).rejects.toThrow(/another approver/i);
      await expect(vouchers.reject(draft.id, { reason: 'x' }, requester)).rejects.toThrow(/another approver/i);
      await expect(vouchers.approve(draft.id, {}, undefined)).rejects.toThrow(/sign in/i);
      const approved = await vouchers.approve(draft.id, {}, checker);
      expect(approved.approval_status).toBe('Approved');
    });

    it('does not allow the approval process on Posted or Voided vouchers', async () => {
      const posted = await approvedVoucher('JV', '2025-08-09', [line('expense', 3, 0, 1), line('supplier', 0, 3, 2)]);
      await vouchers.post(posted.id, maker);
      await expect(vouchers.requestApproval(posted.id, {}, maker)).rejects.toThrow(/Only Draft vouchers can be sent for approval/);
      const voided = await vouchers.create(input('JV', '2025-08-09', [line('expense', 3, 0, 1), line('supplier', 0, 3, 2)]), maker);
      await vouchers.void(voided.id, 'x', maker);
      await expect(vouchers.requestApproval(voided.id, {}, maker)).rejects.toThrow(/Only Draft vouchers can be sent for approval/);
    });
  });

  describe('posting', () => {
    it('posts only approved Draft vouchers, once', async () => {
      const notRequired = await vouchers.create(input('JV', '2025-08-10', [line('expense', 7, 0, 1), line('supplier', 0, 7, 2)]), maker);
      await expect(vouchers.post(notRequired.id, maker)).rejects.toThrow(/must be approved/);

      const pending = await vouchers.create(input('JV', '2025-08-10', [line('expense', 7, 0, 1), line('supplier', 0, 7, 2)], { submit_for_approval: true }), maker);
      await expect(vouchers.post(pending.id, maker)).rejects.toThrow(/must be approved/);

      await vouchers.approve(pending.id, {}, checker);
      const posted = await vouchers.post(pending.id, maker);
      expect(posted.status).toBe('Posted');
      expect(posted.total_debit).toBe('7');
      expect(posted.posted_at).toBeTruthy();
      await expect(vouchers.post(pending.id, maker)).rejects.toThrow(/Only Draft vouchers can be posted/);

      await vouchers.void(notRequired.id, 'x', maker);
      await expect(vouchers.post(notRequired.id, maker)).rejects.toThrow(/Only Draft vouchers can be posted/);
    });

    it('posts every manual type and keeps debit equal to credit', async () => {
      const cases: Array<[VoucherType, Line[]]> = [
        ['CRV', [line('cash', 80, 0, 1), line('customer', 0, 80, 2)]],
        ['CPV', [line('cash', 0, 30, 1), line('expense', 30, 0, 2)]],
        ['BRV', [line('bank', 200, 0, 1), line('customer', 0, 150, 2), line('revenue', 0, 50, 3)]],
        ['BPV', [line('bank', 0, 60, 1), line('supplier', 60, 0, 2)]],
        ['JV', [line('expense', 9.99, 0, 1), line('supplier', 0, 9.99, 2)]],
      ];
      for (const [type, lines] of cases) {
        const draft = await approvedVoucher(type, '2025-08-11', lines);
        const posted = await vouchers.post(draft.id, maker);
        expect(posted.status).toBe('Posted');
        expect(posted.total_debit).toBe(posted.total_credit);
      }
    });

    it('rejects a missing voucher and a voucher from another company id', async () => {
      await expect(vouchers.post(randomUUID(), maker)).rejects.toThrow(/not found/);
      const draft = await vouchers.create(input('JV', '2025-08-11', [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)]), maker);
      await expect(new VoucherService(randomUUID()).getById(draft.id)).rejects.toThrow(/not found/);
    });
  });

  describe('numbering', () => {
    it('numbers each type separately and per calendar year of the voucher date', async () => {
      const lines = [line('expense', 1, 0, 1), line('supplier', 0, 1, 2)];
      const a = await vouchers.create(input('JV', '2025-12-30', lines), maker);
      const b = await vouchers.create(input('JV', '2025-12-31', lines), maker);
      const c = await vouchers.create(input('JV', '2026-01-02', lines), maker);
      const d = await vouchers.create(input('JV', '2026-01-03', lines), maker);
      const seq = (number: string) => Number(number.split('-')[2]);
      expect(a.voucher_number).toMatch(/^JV-2025-\d{4}$/);
      expect(seq(b.voucher_number)).toBe(seq(a.voucher_number) + 1);
      expect(c.voucher_number).toBe('JV-2026-0001');
      expect(d.voucher_number).toBe('JV-2026-0002');

      const crv = await vouchers.create(input('CRV', '2026-01-04', [line('cash', 1, 0, 1), line('customer', 0, 1, 2)]), maker);
      expect(crv.voucher_number).toBe('CRV-2026-0001');
    });

    it('does not reuse the number of a voided voucher', async () => {
      const first = await vouchers.create(input('CPV', '2026-02-01', [line('cash', 0, 1, 1), line('expense', 1, 0, 2)]), maker);
      await vouchers.void(first.id, 'x', maker);
      const second = await vouchers.create(input('CPV', '2026-02-02', [line('cash', 0, 1, 1), line('expense', 1, 0, 2)]), maker);
      expect(first.voucher_number).toBe('CPV-2026-0001');
      expect(second.voucher_number).toBe('CPV-2026-0002');
    });
  });

  describe('list filters', () => {
    let draftId = '';
    let pendingId = '';
    let postedId = '';

    beforeAll(async () => {
      const draft = await vouchers.create(input('JV', '2026-03-01', [line('expense', 111.11, 0, 1), line('supplier', 0, 111.11, 2)], { narration: `${searchTag} draft` }), maker);
      const pending = await vouchers.create(input('CRV', '2026-03-05', [line('cash', 222.22, 0, 1), line('customer', 0, 222.22, 2)], { reference: `${searchTag}-REF`, submit_for_approval: true }), maker);
      const posted = await approvedVoucher('BPV', '2026-03-10', [line('bank', 0, 333.33, 1), line('supplier', 333.33, 0, 2)], { narration: `${searchTag} posted` });
      await vouchers.post(posted.id, maker);
      draftId = draft.id;
      pendingId = pending.id;
      postedId = posted.id;
    });

    const query = (extra: Record<string, unknown>) => schemas.listVouchersQuerySchema.parse({ limit: 200, search: searchTag, ...extra });
    const ids = (result: { data: Array<{ id: string }> }) => result.data.map(row => row.id).sort();

    it('searches number, reference and narration (case-insensitive)', async () => {
      const result = await vouchers.list(query({ search: searchTag.toLowerCase() }));
      expect(ids(result)).toEqual([draftId, pendingId, postedId].sort());
      expect(result.pagination.total).toBe(3);
      const byNumber = await vouchers.getById(postedId);
      const numberResult = await vouchers.list(schemas.listVouchersQuerySchema.parse({ search: byNumber.voucher_number }));
      expect(ids(numberResult)).toEqual([postedId]);
    });

    it('filters by type, status and approval status', async () => {
      expect(ids(await vouchers.list(query({ voucher_type: 'CRV' })))).toEqual([pendingId]);
      expect(ids(await vouchers.list(query({ status: 'Posted' })))).toEqual([postedId]);
      expect(ids(await vouchers.list(query({ status: 'Draft' })))).toEqual([draftId, pendingId].sort());
      expect(ids(await vouchers.list(query({ approval_status: 'Pending' })))).toEqual([pendingId]);
      expect(ids(await vouchers.list(query({ approval_status: 'Not Required' })))).toEqual([draftId]);
      expect(ids(await vouchers.list(query({ approval_status: 'Approved' })))).toEqual([postedId]);
    });

    it('filters by date range (inclusive) and amount range', async () => {
      expect(ids(await vouchers.list(query({ date_from: '2026-03-05', date_to: '2026-03-10' })))).toEqual([pendingId, postedId].sort());
      expect(ids(await vouchers.list(query({ date_to: '2026-03-01' })))).toEqual([draftId]);
      expect(ids(await vouchers.list(query({ amount_from: 200, amount_to: 300 })))).toEqual([pendingId]);
      expect(ids(await vouchers.list(query({ amount_from: 333.33 })))).toEqual([postedId]);
      expect(ids(await vouchers.list(query({ amount_to: 111.11 })))).toEqual([draftId]);
    });

    it('pages newest first and never returns another company', async () => {
      const page1 = await vouchers.list(query({ limit: 2, page: 1 }));
      const page2 = await vouchers.list(query({ limit: 2, page: 2 }));
      expect(page1.pagination.pages).toBe(2);
      expect(page1.data.map(row => row.id)).toEqual([postedId, pendingId]);
      expect(page2.data.map(row => row.id)).toEqual([draftId]);
      const other = await new VoucherService(randomUUID()).list(query({}));
      expect(other.pagination.total).toBe(0);
    });
  });

  describe('void', () => {
    it('voids only Draft vouchers and records who and why', async () => {
      const draft = await vouchers.create(input('JV', '2025-08-12', [line('expense', 4, 0, 1), line('supplier', 0, 4, 2)], { submit_for_approval: true }), maker);
      const voided = await vouchers.void(draft.id, 'Duplicate entry', maker);
      expect(voided.status).toBe('Voided');
      expect(voided.void_reason).toBe('Duplicate entry');
      expect(voided.voided_by).toBe(maker);
      await expect(vouchers.void(draft.id, 'again', maker)).rejects.toThrow(/already voided/);
      await expect(vouchers.approve(draft.id, {}, checker)).rejects.toThrow(/Only Draft vouchers/);

      const posted = await approvedVoucher('JV', '2025-08-12', [line('expense', 4, 0, 1), line('supplier', 0, 4, 2)]);
      await vouchers.post(posted.id, maker);
      await expect(vouchers.void(posted.id, 'x', maker)).rejects.toThrow(/Posted vouchers cannot be voided/);
      await expect(vouchers.void(randomUUID(), 'x', maker)).rejects.toThrow(/not found/);
    });
  });
});
