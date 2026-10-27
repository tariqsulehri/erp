/**
 * Fiscal Year, Fiscal Period and Posting Date tests against the real PostgreSQL database.
 * Everything happens inside one new test company that is deleted afterwards.
 * Each test uses its own calendar years so they do not overlap with each other.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

describe.skipIf(!databaseUrl)('Fiscal Years and Posting Dates (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';
  let FiscalYearService: typeof import('../src/modules/fiscal-years/fiscal-year.service.js')['FiscalYearService'];
  let PostingDateService: typeof import('../src/modules/fiscal-years/posting-date.service.js')['PostingDateService'];
  let VoucherService: typeof import('../src/modules/vouchers/voucher.service.js')['VoucherService'];
  let debitAccount = { id: '', code: '0105990001', name: 'Prepaid Test Account' };
  let creditAccount = { id: '', code: '0202990001', name: 'Accrued Test Liability' };

  beforeAll(async () => {
    company = await createTestCompany('Fiscal Years');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;
    FiscalYearService = (await import('../src/modules/fiscal-years/fiscal-year.service.js')).FiscalYearService;
    PostingDateService = (await import('../src/modules/fiscal-years/posting-date.service.js')).PostingDateService;
    VoucherService = (await import('../src/modules/vouchers/voucher.service.js')).VoucherService;
    const { PostingAccountSettingsService } = await import('../src/modules/settings/posting-account-settings.service.js');
    // Creates the default posting accounts, including Retained Earnings needed by year closing.
    await new PostingAccountSettingsService(companyId).get();
    debitAccount = { ...debitAccount, id: await insertAccount(prisma, companyId, debitAccount.code, debitAccount.name, 'Asset', 'Debit') };
    creditAccount = { ...creditAccount, id: await insertAccount(prisma, companyId, creditAccount.code, creditAccount.name, 'Liability', 'Credit') };
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  const service = () => new FiscalYearService(companyId);
  const postingDate = (date: string) => new PostingDateService(companyId).validate(date);

  async function createYear(
    name: string,
    basis: 'calendar' | 'july' | 'april',
    start: string,
    end: string,
    numberOfPeriods = 12,
    cutoffDays = 0,
  ) {
    return service().create({
      fiscal_year: name, year_basis: basis, start_date: start, end_date: end,
      number_of_periods: numberOfPeriods, posting_cutoff_days: cutoffDays,
    });
  }

  async function periodsOf(fiscalYearId: string) {
    return service().getPeriods(fiscalYearId);
  }

  async function createDraftJournal(date: string) {
    return new VoucherService(companyId).create({
      voucher_type: 'JV', voucher_date: date, submit_for_approval: false,
      lines: [
        { account_id: debitAccount.id, account_code: debitAccount.code, account_name: debitAccount.name, dr_amount: 75, cr_amount: 0, line_no: 1 },
        { account_id: creditAccount.id, account_code: creditAccount.code, account_name: creditAccount.name, dr_amount: 0, cr_amount: 75, line_no: 2 },
      ],
    } as never, userId);
  }

  describe('creating fiscal years', () => {
    it('creates a calendar year with 12 monthly periods covering January to December', async () => {
      const result = await createYear('FY 2030', 'calendar', '2030-01-01', '2030-12-31');
      expect(result.success).toBe(true);
      expect(result.fiscal_year).toMatchObject({
        company_id: companyId, fiscal_year: 'FY 2030', year_basis: 'calendar', start_date: '2030-01-01', end_date: '2030-12-31',
        number_of_periods: 12, period_type: 'monthly', status: 'open', is_active: true, is_locked: false,
      });
      expect(result.periods).toHaveLength(12);
      expect(result.periods.map(period => period.period_number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(result.periods[0]).toMatchObject({ period_name: 'January 2030', start_date: '2030-01-01', end_date: '2030-01-31', is_open: true, status: 'open' });
      expect(result.periods[1]).toMatchObject({ period_name: 'February 2030', start_date: '2030-02-01', end_date: '2030-02-28' });
      expect(result.periods[11]).toMatchObject({ period_name: 'December 2030', start_date: '2030-12-01', end_date: '2030-12-31' });
      expect(result.periods.every(period => period.company_id === companyId)).toBe(true);
    });

    it('creates a July to June year with a leap-year February', async () => {
      const result = await createYear('FY 2031-2032', 'july', '2031-07-01', '2032-06-30');
      expect(result.fiscal_year.year_basis).toBe('july');
      expect(result.periods.map(period => period.period_name)).toEqual([
        'July 2031', 'August 2031', 'September 2031', 'October 2031', 'November 2031', 'December 2031',
        'January 2032', 'February 2032', 'March 2032', 'April 2032', 'May 2032', 'June 2032',
      ]);
      const february = result.periods.find(period => period.period_name === 'February 2032');
      expect(february?.end_date).toBe('2032-02-29');
      expect(result.periods[11].end_date).toBe('2032-06-30');
    });

    it('creates an April to March year', async () => {
      const result = await createYear('FY 2033-2034', 'april', '2033-04-01', '2034-03-31', 12, 5);
      expect(result.fiscal_year.year_basis).toBe('april');
      expect(result.fiscal_year.posting_cutoff_days).toBe(5);
      expect(result.periods[0]).toMatchObject({ period_name: 'April 2033', start_date: '2033-04-01', end_date: '2033-04-30', posting_cutoff_days: 5 });
      expect(result.periods[11]).toMatchObject({ period_name: 'March 2034', start_date: '2034-03-01', end_date: '2034-03-31' });
    });

    it('keeps only the newest fiscal year active', async () => {
      const rows = await prisma.fiscalYear.findMany({ where: { companyId, isActive: true } });
      expect(rows).toHaveLength(1);
      expect(rows[0].fiscalYear).toBe('FY 2033-2034');
    });

    it('rejects a fiscal year that overlaps an existing one', async () => {
      await expect(createYear('Overlap Middle', 'july', '2030-07-01', '2031-06-30'))
        .rejects.toThrow(/overlap with an existing Fiscal Year/);
      // Sharing a single day is still an overlap.
      await expect(createYear('Overlap Edge', 'calendar', '2030-12-31', '2031-06-30'))
        .rejects.toThrow(/overlap/);
      // The whole of an existing year inside the new range.
      await expect(createYear('Overlap Around', 'calendar', '2029-01-01', '2031-12-31'))
        .rejects.toThrow(/overlap/);
      const count = await prisma.fiscalYear.count({ where: { companyId, fiscalYear: { startsWith: 'Overlap' } } });
      expect(count).toBe(0);
    });

    it('rejects a start date on or after the end date', async () => {
      await expect(createYear('Backwards', 'calendar', '2040-12-31', '2040-01-01')).rejects.toThrow(/Start Date must be before End Date/);
      await expect(createYear('Same Day', 'calendar', '2040-01-01', '2040-01-01')).rejects.toThrow(/Start Date must be before End Date/);
    });

    it('lists only this company fiscal years, newest first', async () => {
      const list = await service().list(1, 50);
      expect(list.data.every(year => year.company_id === companyId)).toBe(true);
      expect(list.data.map(year => year.fiscal_year).slice(0, 3)).toEqual(['FY 2033-2034', 'FY 2031-2032', 'FY 2030']);
      expect(list.pagination.total).toBe(list.data.length);
    });

    it('returns 404 for a fiscal year or period that does not exist', async () => {
      await expect(service().getPeriods(randomUUID())).rejects.toMatchObject({ statusCode: 404 });
      await expect(service().lockPeriod(randomUUID())).rejects.toMatchObject({ statusCode: 404 });
      await expect(service().closePeriod(randomUUID())).rejects.toMatchObject({ statusCode: 404 });
      await expect(service().lockFiscalYear(randomUUID(), userId)).rejects.toMatchObject({ statusCode: 404 });
    });

    // A 12-month year can only be split into equal whole-month periods (12, 6, 4, 3, 2 or 1).
    it('rejects a number of periods that does not divide the year evenly', async () => {
      await expect(createYear('FY 2045 Thirteen', 'calendar', '2045-01-01', '2045-12-31', 13))
        .rejects.toThrow(/Number Of Periods must split the 12-month year into equal parts/);
    });

    it('builds quarterly periods when 4 periods are requested', async () => {
      const result = await createYear('FY 2048 Quarterly', 'calendar', '2048-01-01', '2048-12-31', 4);
      expect(result.periods.map((period: { start_date: string; end_date: string }) => `${period.start_date}..${period.end_date}`))
        .toEqual(['2048-01-01..2048-03-31', '2048-04-01..2048-06-30', '2048-07-01..2048-09-30', '2048-10-01..2048-12-31']);
    });

    // Each period ends the day before the next starts, so a mid-month year has no gaps.
    it('covers every day of a year that starts mid-month', async () => {
      const result = await createYear('FY 2046 Mid Month', 'calendar', '2046-01-15', '2047-01-14');
      for (let index = 1; index < result.periods.length; index += 1) {
        const previousEnd = new Date(`${result.periods[index - 1].end_date}T00:00:00Z`);
        const nextStart = new Date(`${result.periods[index].start_date}T00:00:00Z`);
        expect(nextStart.getTime() - previousEnd.getTime()).toBe(24 * 60 * 60 * 1000);
      }
      expect((await postingDate('2046-02-05')).canPost).toBe(true);
    });
  });

  describe('period lock and close rules', () => {
    it('closes a period, refuses to lock it again and refuses posting into it', async () => {
      const year = (await prisma.fiscalYear.findFirstOrThrow({ where: { companyId, fiscalYear: 'FY 2030' } }));
      const periods = await periodsOf(year.id);
      const january = periods[0];

      const closed = await service().closePeriod(january.id);
      expect(closed.success).toBe(true);
      const row = await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: january.id } });
      expect(row).toMatchObject({ isOpen: false, isLocked: true, status: 'closed' });

      await expect(service().lockPeriod(january.id)).rejects.toThrow(/A closed Period cannot be locked again/);
      const check = await postingDate('2030-01-15');
      expect(check.canPost).toBe(false);
      expect(check.reason).toMatch(/Period "January 2030" is closed/);
      expect(check.period?.id).toBe(january.id);
    });

    it('locks a period and records when it was locked', async () => {
      const year = await prisma.fiscalYear.findFirstOrThrow({ where: { companyId, fiscalYear: 'FY 2030' } });
      const february = (await periodsOf(year.id))[1];
      await service().lockPeriod(february.id);
      const after = (await periodsOf(year.id))[1];
      expect(after).toMatchObject({ status: 'locked', is_open: false, is_locked: true });
      expect(after.locked_at).not.toBeNull();
      expect((await postingDate('2030-02-10')).canPost).toBe(false);
      // A locked period can still be closed while other periods remain open.
      await service().closePeriod(february.id);
      expect((await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: february.id } })).status).toBe('closed');
    });

    it('refuses to close the last open period of a year', async () => {
      const year = await prisma.fiscalYear.findFirstOrThrow({ where: { companyId, fiscalYear: 'FY 2030' } });
      const periods = await periodsOf(year.id);
      const open = periods.filter(period => period.is_open);
      for (const period of open.slice(0, -1)) {
        await service().closePeriod(period.id);
      }
      const last = open[open.length - 1];
      await expect(service().closePeriod(last.id)).rejects.toThrow(/You cannot close the last open Period/);
      const row = await prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: last.id } });
      expect(row.isOpen).toBe(true);
      expect((await postingDate(last.start_date)).canPost).toBe(true);
    });
  });

  describe('PostingDateService', () => {
    it('allows a date inside an open period and returns that period', async () => {
      const result = await postingDate('2031-09-15');
      expect(result.canPost).toBe(true);
      expect(result.period).toMatchObject({ period_name: 'September 2031', is_open: true });
    });

    it('refuses a date outside every fiscal year', async () => {
      const result = await postingDate('2028-03-10');
      expect(result).toEqual({ canPost: false, reason: 'This date is not in any active Fiscal Year.' });
    });

    it('refuses a date in a deleted fiscal year', async () => {
      const created = await createYear('FY 2038 Deleted', 'calendar', '2038-01-01', '2038-12-31');
      expect((await postingDate('2038-05-05')).canPost).toBe(true);
      await prisma.fiscalYear.update({ where: { id: created.fiscal_year.id }, data: { isDeleted: true } });
      expect((await postingDate('2038-05-05')).canPost).toBe(false);
    });

    it('prefers the period that contains the date over an earlier period still inside its cutoff days', async () => {
      const created = await createYear('FY 2037 Cutoff', 'calendar', '2037-01-01', '2037-12-31', 12, 10);
      const [january, february] = created.periods;

      // 5 February is inside January's 10-day cutoff window, but February contains it.
      const open = await postingDate('2037-02-05');
      expect(open.canPost).toBe(true);
      expect(open.period?.id).toBe(february.id);

      // With February locked, the date must not slip into the still-open January.
      await service().lockPeriod(february.id);
      const locked = await postingDate('2037-02-05');
      expect(locked.canPost).toBe(false);
      expect(locked.period?.id).toBe(february.id);
      expect(locked.reason).toMatch(/February 2037/);

      // January itself is still open.
      expect((await postingDate('2037-01-31')).period?.id).toBe(january.id);
      expect((await postingDate('2037-01-31')).canPost).toBe(true);
    });

    it('is used by vouchers: a voucher dated in a closed or locked period is refused', async () => {
      await expect(createDraftJournal('2030-01-10')).rejects.toThrow(/Voucher Date cannot be used\. Period "January 2030" is closed/);
      await expect(createDraftJournal('2028-01-10')).rejects.toThrow(/Voucher Date cannot be used\. This date is not in any active Fiscal Year/);
    });
  });

  describe('fiscal year lock and unlock', () => {
    let yearId = '';

    beforeAll(async () => {
      yearId = (await createYear('FY 2035', 'calendar', '2035-01-01', '2035-12-31')).fiscal_year.id;
    });

    it('locks the year, records the user and blocks posting into every period', async () => {
      expect((await postingDate('2035-06-15')).canPost).toBe(true);
      const result = await service().lockFiscalYear(yearId, userId);
      expect(result.success).toBe(true);

      const rows = await prisma.$queryRaw<{ locked_by_user_id: string | null; is_locked: boolean; status: string; locked_at: Date | null }[]>`
        SELECT locked_by_user_id::text, is_locked, status, locked_at FROM fiscal_years WHERE id = CAST(${yearId} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ locked_by_user_id: userId, is_locked: true, status: 'closing' });
      expect(rows[0].locked_at).not.toBeNull();

      const check = await postingDate('2035-06-15');
      expect(check).toEqual({ canPost: false, reason: 'This Fiscal Year is locked. You cannot post new entries in it.' });
      await expect(createDraftJournal('2035-06-15')).rejects.toThrow(/This Fiscal Year is locked/);
    });

    it('stores no user when the user id is not a valid id', async () => {
      await service().lockFiscalYear(yearId, 'not-a-user');
      const row = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: yearId } });
      expect(row.lockedByUserId).toBeNull();
    });

    it('unlocks the year and allows posting in open periods again', async () => {
      const result = await service().unlockFiscalYear(yearId);
      expect(result.message).toMatch(/^Fiscal Year unlocked\./);
      const row = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: yearId } });
      expect(row).toMatchObject({ isLocked: false, status: 'open', lockedAt: null });
      expect((await postingDate('2035-06-15')).canPost).toBe(true);

      const again = await service().unlockFiscalYear(yearId);
      expect(again.message).toMatch(/already unlocked/);
    });
  });

  describe('pre-close checks and closing a year', () => {
    let yearId = '';
    let draftVoucherId = '';
    let draftAdjustmentId = '';

    beforeAll(async () => {
      yearId = (await createYear('FY 2036', 'calendar', '2036-01-01', '2036-12-31')).fiscal_year.id;
      draftVoucherId = (await createDraftJournal('2036-03-10')).id;
      const warehouse = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO inventory_warehouses (company_id, code, name) VALUES (CAST(${companyId} AS uuid), 'WH-FY', 'Fiscal Test Warehouse') RETURNING id
      `;
      const adjustment = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO stock_adjustments (company_id, adjustment_number, adjustment_date, warehouse_id, status)
        VALUES (CAST(${companyId} AS uuid), 'SA-2036-0001', '2036-04-01', CAST(${warehouse[0].id} AS uuid), 'Draft') RETURNING id
      `;
      draftAdjustmentId = adjustment[0].id;
    }, 120000);

    it('reports open periods, draft vouchers and draft documents as blocking', async () => {
      const result = await service().preCloseCheck(yearId);
      expect(result.can_close).toBe(false);
      const byKey = new Map(result.checks.map(check => [check.key, check]));
      expect(byKey.get('fiscal_year_status')?.status).toBe('Passed');
      expect(byKey.get('periods_closed')).toMatchObject({ status: 'Failed', count: 12, blocking: true });
      expect(byKey.get('draft_vouchers')).toMatchObject({ status: 'Failed', count: 1, blocking: true });
      expect(byKey.get('draft_vouchers')?.details?.[0]).toMatchObject({ label: 'Journal Voucher', count: 1 });
      expect(byKey.get('unposted_documents')).toMatchObject({ status: 'Failed', count: 1 });
      expect(byKey.get('unposted_documents')?.details).toEqual([{ label: 'Stock Adjustments', count: 1 }]);
      expect(byKey.get('trial_balance')?.status).toBe('Passed');
      expect(byKey.get('cheque_clearance')?.status).toBe('Passed');
    });

    it('lists the blocking draft voucher and draft document as closing issues', async () => {
      const vouchers = await service().closingIssues(yearId, 'draft_vouchers', 1, 25);
      expect(vouchers.pagination.total).toBe(1);
      expect(vouchers.data[0]).toMatchObject({
        id: draftVoucherId, document_type: 'Journal Voucher', document_date: '2036-03-10', status: 'Draft', source_path: '/vouchers/journal',
      });
      const documents = await service().closingIssues(yearId, 'unposted_documents', 1, 25);
      expect(documents.pagination.total).toBe(1);
      expect(documents.data[0]).toMatchObject({ id: draftAdjustmentId, module_name: 'Stock Adjustments', document_number: 'SA-2036-0001' });
    });

    it('refuses to close while a draft voucher exists, even with every period locked', async () => {
      await expect(service().closeFiscalYear(yearId, {}, userId)).rejects.toThrow(/Fiscal Year cannot be closed/);
      for (const period of await periodsOf(yearId)) {
        await service().lockPeriod(period.id);
      }
      await prisma.$executeRaw`UPDATE stock_adjustments SET status = 'Voided' WHERE id = CAST(${draftAdjustmentId} AS uuid)`;
      const check = await service().preCloseCheck(yearId);
      expect(check.checks.find(item => item.key === 'periods_closed')?.status).toBe('Passed');
      expect(check.can_close).toBe(false);
      await expect(service().closeFiscalYear(yearId, {}, userId)).rejects.toThrow(/draft voucher\(s\) must be posted or voided/);
      const row = await prisma.fiscalYear.findUniqueOrThrow({ where: { id: yearId } });
      expect(row.status).toBe('open');
    });

    it('closes the year once the draft is voided, then refuses unlock and period changes', async () => {
      await new VoucherService(companyId).void(draftVoucherId, 'Not needed', userId);
      const check = await service().preCloseCheck(yearId);
      expect(check.can_close).toBe(true);

      const result = await service().closeFiscalYear(yearId, { remarks: 'Year closed by test' }, userId);
      expect(result.success).toBe(true);
      // No Revenue or Expense balance in this year, so no closing voucher is needed.
      expect(result.closing_voucher_number).toBeNull();

      const rows = await prisma.$queryRaw<{ status: string; is_locked: boolean; is_active: boolean; locked_by_user_id: string | null; notes: string | null; closing_completed_at: Date | null }[]>`
        SELECT status, is_locked, is_active, locked_by_user_id::text, notes, closing_completed_at
        FROM fiscal_years WHERE id = CAST(${yearId} AS uuid)
      `;
      expect(rows[0]).toMatchObject({ status: 'closed', is_locked: true, is_active: false, locked_by_user_id: userId, notes: 'Year closed by test' });
      expect(rows[0].closing_completed_at).not.toBeNull();
      const periods = await periodsOf(yearId);
      expect(periods.every(period => period.status === 'closed' && !period.is_open && period.is_locked)).toBe(true);

      await expect(service().unlockFiscalYear(yearId)).rejects.toThrow(/A closed Fiscal Year cannot be unlocked/);
      await expect(service().lockPeriod(periods[0].id)).rejects.toThrow(/A closed Period cannot be locked again/);
      expect((await postingDate('2036-06-01')).reason).toBe('This Fiscal Year is locked. You cannot post new entries in it.');

      const after = await service().preCloseCheck(yearId);
      expect(after.checks.find(item => item.key === 'fiscal_year_status')?.status).toBe('Failed');
      expect(after.can_close).toBe(false);
    });
  });
});
