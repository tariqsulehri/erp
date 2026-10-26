/**
 * Bank Account and Cheque Book tests against the real PostgreSQL database.
 * Everything happens inside a new test company that is removed afterwards.
 * There is no Bank Deposit service yet (only the bank_deposits table), so deposits are not covered here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestCompany, databaseUrl, insertAccount, type TestCompany } from './support/test-database.js';

describe.skipIf(!databaseUrl)('Bank Accounts and Cheques (database)', () => {
  let company: TestCompany;
  let prisma: TestCompany['prisma'];
  let companyId = '';
  let userId = '';
  let BankAccountService: typeof import('../src/modules/bank-accounts/bank-account.service.js')['BankAccountService'];
  let BankChequeService: typeof import('../src/modules/bank-cheques/bank-cheque.service.js')['BankChequeService'];
  let schemas: typeof import('../src/modules/bank-accounts/bank-account.schema.js');
  let chequeSchemas: typeof import('../src/modules/bank-cheques/bank-cheque.schema.js');

  let bankLedgerOne = '';
  let bankLedgerTwo = '';
  let bankLedgerThree = '';
  let liabilityAccount = '';
  let capitalAccount = '';
  let bankOneId = '';
  let bankTwoId = '';

  const bankInput = (overrides: Record<string, unknown> = {}) => schemas.BankAccountInput.parse({
    code: 'BANK-1',
    ledger_account_id: bankLedgerOne,
    bank_name: 'Test Bank',
    account_title: 'Main Current Account',
    account_number: '000111222',
    ...overrides,
  });

  const bookInput = (overrides: Record<string, unknown> = {}) => chequeSchemas.CreateChequeBookInput.parse({
    bank_account_id: bankOneId,
    book_number: 'BOOK-1',
    start_cheque_number: '000101',
    end_cheque_number: '000110',
    ...overrides,
  });

  beforeAll(async () => {
    company = await createTestCompany('Bank');
    prisma = company.prisma;
    companyId = company.companyId;
    userId = company.userId;
    BankAccountService = (await import('../src/modules/bank-accounts/bank-account.service.js')).BankAccountService;
    BankChequeService = (await import('../src/modules/bank-cheques/bank-cheque.service.js')).BankChequeService;
    schemas = await import('../src/modules/bank-accounts/bank-account.schema.js');
    chequeSchemas = await import('../src/modules/bank-cheques/bank-cheque.schema.js');

    bankLedgerOne = await insertAccount(prisma, companyId, '0101200001', 'Bank One', 'Asset', 'Debit');
    bankLedgerTwo = await insertAccount(prisma, companyId, '0101200002', 'Bank Two', 'Asset', 'Debit');
    bankLedgerThree = await insertAccount(prisma, companyId, '0101200003', 'Bank Three', 'Asset', 'Debit');
    liabilityAccount = await insertAccount(prisma, companyId, '0202010001', 'Some Liability', 'Liability', 'Credit');
    capitalAccount = await insertAccount(prisma, companyId, '0301010001', 'Capital', 'Equity', 'Credit');
  }, 120000);

  afterAll(async () => {
    await company?.cleanup();
    await prisma?.$disconnect();
  }, 120000);

  describe('Bank Accounts', () => {
    it('creates a bank account linked to an Asset posting account', async () => {
      const result = await new BankAccountService(companyId).create(bankInput({ is_default: true, opening_balance: 1000, currency_code: 'pkr' }), userId);
      bankOneId = result.bank_account.id;
      expect(result.bank_account.code).toBe('BANK-1');
      expect(result.bank_account.ledger_account_id).toBe(bankLedgerOne);
      expect(result.bank_account.currency_code).toBe('PKR');
      expect(result.bank_account.is_default).toBe(true);
      expect(result.bank_account.created_by_id).toBe(userId);
    });

    it('rejects a linked account that is not an active Asset posting account', async () => {
      const service = new BankAccountService(companyId);
      await expect(service.create(bankInput({ code: 'X1', account_number: 'X1', ledger_account_id: liabilityAccount }), userId))
        .rejects.toThrow(/not an Asset posting account/);

      const inactive = await insertAccount(prisma, companyId, '0101200009', 'Inactive Bank', 'Asset', 'Debit');
      await prisma.$executeRaw`UPDATE accounts SET is_active = false WHERE id = CAST(${inactive} AS uuid)`;
      await expect(service.create(bankInput({ code: 'X2', account_number: 'X2', ledger_account_id: inactive }), userId))
        .rejects.toThrow(/inactive/);

      const header = await insertAccount(prisma, companyId, '0101200008', 'Bank Header', 'Asset', 'Debit');
      await prisma.$executeRaw`UPDATE accounts SET is_posting = false WHERE id = CAST(${header} AS uuid)`;
      await expect(service.create(bankInput({ code: 'X3', account_number: 'X3', ledger_account_id: header }), userId))
        .rejects.toThrow(/Linked Account/);
    });

    it('rejects duplicate code (ignoring case), account number and linked account', async () => {
      const service = new BankAccountService(companyId);
      await expect(service.create(bankInput({ code: 'bank-1', account_number: 'NEW-1', ledger_account_id: bankLedgerTwo }), userId))
        .rejects.toThrow(/Code is already used/);
      await expect(service.create(bankInput({ code: 'BANK-2', account_number: '000111222', ledger_account_id: bankLedgerTwo }), userId))
        .rejects.toThrow(/Account Number is already used/);
      await expect(service.create(bankInput({ code: 'BANK-2', account_number: 'NEW-1' }), userId))
        .rejects.toThrow(/Linked Account is already used/);
    });

    it('rejects a negative opening balance and an invalid email in the input schema', () => {
      expect(() => bankInput({ opening_balance: -1 })).toThrow(/cannot be negative/);
      expect(() => bankInput({ email: 'not-an-email' })).toThrow(/Email is not valid/);
    });

    it('keeps only one default bank account', async () => {
      const service = new BankAccountService(companyId);
      const second = await service.create(bankInput({
        code: 'BANK-2', account_number: '999888', ledger_account_id: bankLedgerTwo, bank_name: 'Another Bank', is_default: true,
      }), userId);
      bankTwoId = second.bank_account.id;

      const defaults = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM bank_accounts WHERE company_id = CAST(${companyId} AS uuid) AND is_default = true
      `;
      expect(defaults.map(row => row.id)).toEqual([bankTwoId]);

      await service.update(bankOneId, { is_default: true }, userId);
      const after = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM bank_accounts WHERE company_id = CAST(${companyId} AS uuid) AND is_default = true
      `;
      expect(after.map(row => row.id)).toEqual([bankOneId]);
    });

    it('updates fields, keeps unchanged ones and checks uniqueness against other accounts only', async () => {
      const service = new BankAccountService(companyId);
      const updated = await service.update(bankOneId, { branch_name: 'Mall Road', account_number: '000111222' }, userId);
      expect(updated.bank_account.branch_name).toBe('Mall Road');
      expect(updated.bank_account.account_number).toBe('000111222');
      expect(updated.bank_account.bank_name).toBe('Test Bank');

      await expect(service.update(bankOneId, { code: 'bank-2' }, userId)).rejects.toThrow(/Code is already used/);
      await expect(service.update(bankOneId, { ledger_account_id: bankLedgerTwo }, userId)).rejects.toThrow(/Linked Account is already used/);
      await expect(service.update('00000000-0000-4000-8000-000000000000', { bank_name: 'x' }, userId))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('lists with search and active filter and shows the current balance from posted vouchers only', async () => {
      const service = new BankAccountService(companyId);
      // One Posted and one Draft voucher against Bank One; only the Posted one counts.
      for (const [number, status] of [['JV-2030-0001', 'Posted'], ['JV-2030-0002', 'Draft']] as const) {
        await prisma.voucher.create({
          data: {
            companyId, voucherNumber: number, voucherType: 'JV', voucherDate: new Date('2030-01-05'), status,
            totalDebit: 250, totalCredit: 250, approvalStatus: 'Approved',
            lines: {
              create: [
                { companyId, accountId: bankLedgerOne, accountCode: '0101200001', accountName: 'Bank One', debitAmount: 250, creditAmount: 0, lineNo: 1 },
                { companyId, accountId: capitalAccount, accountCode: '0301010001', accountName: 'Capital', debitAmount: 0, creditAmount: 250, lineNo: 2 },
              ],
            },
          },
        });
      }

      const all = await service.list(schemas.ListBankAccountsQuery.parse({}));
      expect(all.total).toBe(2);
      const one = all.data.find(row => row.id === bankOneId);
      expect(Number(one.current_balance)).toBe(1250);
      expect(one.ledger_account_code).toBe('0101200001');
      // Default account comes first.
      expect(all.data[0].id).toBe(bankOneId);

      const searched = await service.list(schemas.ListBankAccountsQuery.parse({ search: 'another' }));
      expect(searched.data.map(row => row.id)).toEqual([bankTwoId]);
      const byNumber = await service.list(schemas.ListBankAccountsQuery.parse({ search: '999888' }));
      expect(byNumber.total).toBe(1);

      await service.update(bankTwoId, { is_active: false }, userId);
      const active = await service.list({ page: 1, limit: 50, is_active: true });
      expect(active.data.map(row => row.id)).toEqual([bankOneId]);
      const inactive = await service.list({ page: 1, limit: 50, is_active: false });
      expect(inactive.data.map(row => row.id)).toEqual([bankTwoId]);

      const paged = await service.list({ page: 2, limit: 1 });
      expect(paged.total).toBe(2);
      expect(paged.totalPages).toBe(2);
      expect(paged.data).toHaveLength(1);
    });

    // Regression: z.coerce.boolean() used to turn the query string "false" into true.
    it('parses is_active=false from the query string as false', () => {
      expect(schemas.ListBankAccountsQuery.parse({ is_active: 'false' }).is_active).toBe(false);
    });

    it('offers only active Asset posting accounts as linked account choices', async () => {
      const { accounts } = await new BankAccountService(companyId).supportData() as { accounts: Array<{ id: string; account_type: string }> };
      const ids = accounts.map(row => row.id);
      expect(ids).toContain(bankLedgerOne);
      expect(ids).toContain(bankLedgerThree);
      expect(ids).not.toContain(liabilityAccount);
      expect(accounts.every(row => row.account_type === 'Asset')).toBe(true);
    });
  });

  describe('Cheque Books', () => {
    let bookId = '';

    beforeAll(async () => {
      const service = new BankChequeService(companyId);
      const one = await service.createBook(bookInput({ book_number: 'BOOK-1', prefix: 'CH', suffix: 'A' }), userId);
      bookId = one.cheque_book.id;
      await service.createBook(bookInput({ book_number: 'BOOK-2', start_cheque_number: '000101', end_cheque_number: '000103' }), userId);
    });

    it('generates one Available leaf per number with padding, serials and Created events', async () => {
      const bank = await new BankAccountService(companyId).create(bankInput({
        code: 'BANK-3', account_number: '333', ledger_account_id: bankLedgerThree,
      }), userId);
      const service = new BankChequeService(companyId);
      const result = await service.createBook(bookInput({
        bank_account_id: bank.bank_account.id, book_number: 'GEN-BOOK', prefix: 'G', suffix: 'Z',
      }), userId);
      const generatedId = result.cheque_book.id;
      expect(result.generated_cheques).toBe(10);
      expect(result.cheque_book.total_cheques).toBe(10);
      expect(result.cheque_book.status).toBe('Active');

      const cheques = await service.listCheques(chequeSchemas.ListChequesQuery.parse({ cheque_book_id: generatedId }));
      expect(cheques.total).toBe(10);
      expect(cheques.data.map(row => row.cheque_number)).toEqual(
        Array.from({ length: 10 }, (_, index) => `G${String(101 + index).padStart(6, '0')}Z`),
      );
      expect(cheques.data.map(row => row.serial_number)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
      expect(cheques.data.every(row => row.status === 'Available')).toBe(true);

      const events = await prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM bank_cheque_events e
        JOIN bank_cheques c ON c.id = e.bank_cheque_id
        WHERE e.company_id = CAST(${companyId} AS uuid) AND c.bank_cheque_book_id = CAST(${generatedId} AS uuid) AND e.event_type = 'Created'
      `;
      expect(events[0].count).toBe(10);
    });

    it('rejects a reversed range, more than 1000 leaves and non-digit numbers', async () => {
      const service = new BankChequeService(companyId);
      await expect(service.createBook(bookInput({ book_number: 'B-R', start_cheque_number: '20', end_cheque_number: '10' }), userId))
        .rejects.toThrow(/greater than or equal/);
      await expect(service.createBook(bookInput({ book_number: 'B-BIG', start_cheque_number: '1', end_cheque_number: '1001' }), userId))
        .rejects.toThrow(/maximum of 1000/);
      expect(() => bookInput({ start_cheque_number: '12A' })).toThrow(/digits only/);
    });

    it('rejects a duplicate book number for the same bank account', async () => {
      await expect(new BankChequeService(companyId).createBook(bookInput({ start_cheque_number: '000500', end_cheque_number: '000501' }), userId))
        .rejects.toThrow(/Book Number is already used/);
    });

    it('rejects cheque numbers that already exist for the same bank account', async () => {
      await expect(new BankChequeService(companyId).createBook(bookInput({
        book_number: 'BOOK-3', prefix: 'CH', suffix: 'A', start_cheque_number: '000110', end_cheque_number: '000112',
      }), userId)).rejects.toThrow(/CH000110A already exists/);
    });

    it('rejects a cheque book for an inactive bank account', async () => {
      // Bank Two was made inactive in the bank account tests.
      await expect(new BankChequeService(companyId).createBook(bookInput({ bank_account_id: bankTwoId }), userId))
        .rejects.toThrow(/not found or is inactive/);
      const { bank_accounts } = await new BankChequeService(companyId).supportData();
      const ids = bank_accounts.map(row => row.id);
      expect(ids).toContain(bankOneId);
      expect(ids).not.toContain(bankTwoId);
    });

    it('issues a cheque with payee and amount, records an event, and refuses to issue it twice', async () => {
      const service = new BankChequeService(companyId);
      const [first] = await service.availableCheques({ bank_account_id: bankOneId, search: 'CH', limit: 50 });
      expect(first.cheque_number).toBe('CH000101A');

      const issued = await service.issueCheque(first.id, chequeSchemas.IssueChequeInput.parse({
        issue_date: '2030-02-01', payee_name: '  Ali Traders ', payment_reference: 'BPV-2030-0001', amount: '1500.50',
      }), userId);
      expect(issued.cheque.status).toBe('Issued');
      expect(issued.cheque.payee_name).toBe('Ali Traders');
      expect(Number(issued.cheque.amount)).toBe(1500.5);
      expect(issued.cheque.payment_reference).toBe('BPV-2030-0001');

      const events = await prisma.$queryRaw<{ event_type: string; notes: string | null }[]>`
        SELECT event_type, notes FROM bank_cheque_events WHERE bank_cheque_id = CAST(${first.id} AS uuid) ORDER BY created_at
      `;
      // The leaf gets a Created event when the book is generated, then an Issued event.
      expect(events.map(row => row.event_type)).toEqual(['Created', 'Issued']);
      expect(events[1].notes).toBe('BPV-2030-0001');

      await expect(service.issueCheque(first.id, { issue_date: '2030-02-02', payee_name: 'x', amount: 1 }, userId))
        .rejects.toThrow(/Only Available or Reserved cheques can be issued/);
      await expect(service.voidCheque(first.id, { reason: 'Torn' }, userId))
        .rejects.toThrow(/Only Available or Reserved cheques can be voided/);

      const available = await service.availableCheques({ bank_account_id: bankOneId, search: 'CH', limit: 50 });
      expect(available.map(row => row.id)).not.toContain(first.id);
    });

    it('rejects an issue without payee or with a zero amount', () => {
      expect(() => chequeSchemas.IssueChequeInput.parse({ issue_date: '2030-02-01', payee_name: ' ', amount: 10 })).toThrow(/Payee Name is required/);
      expect(() => chequeSchemas.IssueChequeInput.parse({ issue_date: '2030-02-01', payee_name: 'A', amount: 0 })).toThrow(/greater than zero/);
    });

    it('voids an Available cheque with a reason, keeps it in the register and blocks issuing it', async () => {
      const service = new BankChequeService(companyId);
      const cheques = await service.listCheques({ page: 1, limit: 50, cheque_book_id: bookId, status: 'Available' });
      const target = cheques.data[0];

      const voided = await service.voidCheque(target.id, { reason: 'Writing Mistake', notes: 'Wrong spelling' }, userId);
      expect(voided.cheque.status).toBe('Void');
      expect(voided.cheque.void_reason).toBe('Writing Mistake');
      expect(voided.cheque.void_notes).toBe('Wrong spelling');
      expect(voided.cheque.voided_by_id).toBe(userId);

      await expect(service.issueCheque(target.id, { issue_date: '2030-02-01', payee_name: 'x', amount: 1 }, userId))
        .rejects.toThrow(/can be issued/);
      await expect(service.voidCheque(target.id, { reason: 'Torn' }, userId)).rejects.toThrow(/can be voided/);
      expect(() => chequeSchemas.VoidChequeInput.parse({ reason: 'Because' })).toThrow();

      const stillListed = await service.listCheques({ page: 1, limit: 50, status: 'Void' });
      expect(stillListed.data.map(row => row.id)).toEqual([target.id]);
    });

    it('issues and voids a Reserved cheque', async () => {
      const service = new BankChequeService(companyId);
      const cheques = await service.listCheques({ page: 1, limit: 50, cheque_book_id: bookId, status: 'Available' });
      const [first, second] = cheques.data;
      await prisma.$executeRaw`UPDATE bank_cheques SET status = 'Reserved' WHERE id IN (CAST(${first.id} AS uuid), CAST(${second.id} AS uuid))`;
      expect((await service.issueCheque(first.id, { issue_date: '2030-02-03', payee_name: 'Payee', amount: 10 }, userId)).cheque.status).toBe('Issued');
      expect((await service.voidCheque(second.id, { reason: 'Other' }, userId)).cheque.status).toBe('Void');
    });

    it('returns 404 for a cheque of another company or an unknown id', async () => {
      const service = new BankChequeService(companyId);
      await expect(service.voidCheque('00000000-0000-4000-8000-000000000000', { reason: 'Torn' }, userId)).rejects.toMatchObject({ statusCode: 404 });
      await expect(service.issueCheque('00000000-0000-4000-8000-000000000000', { issue_date: '2030-02-01', payee_name: 'x', amount: 1 }, userId))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    it('lists books with status counts and filters cheques by status and search', async () => {
      const service = new BankChequeService(companyId);
      const books = await service.listBooks(chequeSchemas.ListChequeBooksQuery.parse({ bank_account_id: bankOneId }));
      expect(books.total).toBe(2);
      const book = books.data.find(row => row.id === bookId);
      expect(book.cheque_count).toBe(10);
      expect(book.issued_count).toBe(2);
      expect(book.void_count).toBe(2);
      expect(book.available_count).toBe(6);

      const searched = await service.listBooks({ page: 1, limit: 50, search: 'BOOK-2' });
      expect(searched.data.map(row => row.book_number)).toEqual(['BOOK-2']);
      const closed = await service.listBooks({ page: 1, limit: 50, status: 'Closed' });
      expect(closed.total).toBe(0);

      const issued = await service.listCheques({ page: 1, limit: 50, status: 'Issued' });
      expect(issued.total).toBe(2);
      const byPayee = await service.listCheques({ page: 1, limit: 50, search: 'Ali Traders' });
      expect(byPayee.data.map(row => row.cheque_number)).toEqual(['CH000101A']);

      const available = await service.availableCheques({ bank_account_id: bankOneId, limit: 50 });
      expect(available).toHaveLength(6 + 3);
      expect(available.every(row => row.bank_account_id === bankOneId)).toBe(true);
    });
  });
});
