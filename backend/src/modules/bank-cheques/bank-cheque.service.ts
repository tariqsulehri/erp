import { prisma } from '../../db/prisma.js';
import type {
  AvailableChequesQuery,
  CreateChequeBookInput,
  IssueChequeInput,
  ListChequeBooksQuery,
  ListChequesQuery,
  VoidChequeInput,
} from './bank-cheque.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function textOrNull(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function dateTextOrNull(value?: string | Date | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const clean = value.trim();
  return clean ? clean : null;
}

function userIdOrNull(userId?: string | null) {
  return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
}

function chequeRange(input: CreateChequeBookInput) {
  const start = BigInt(input.start_cheque_number);
  const end = BigInt(input.end_cheque_number);
  if (end < start) throw businessError('End Cheque Number must be greater than or equal to Start Cheque Number.');
  const total = end - start + 1n;
  if (total > 1000n) throw businessError('One Cheque Book can generate a maximum of 1000 cheques.');
  return {
    start,
    end,
    total: Number(total),
    width: Math.max(input.start_cheque_number.length, input.end_cheque_number.length),
  };
}

export class BankChequeService {
  constructor(private readonly companyId: string) {}

  async supportData() {
    const bankAccounts = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        code,
        bank_name,
        branch_name,
        account_title,
        account_number,
        currency_code
      FROM bank_accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND is_active = true
      ORDER BY is_default DESC, bank_name ASC, account_title ASC
      LIMIT 200
    `;

    return { bank_accounts: bankAccounts };
  }

  async listBooks(query: ListChequeBooksQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['b.company_id = CAST($1 AS uuid)'];

    if (query.bank_account_id) {
      params.push(query.bank_account_id);
      where.push(`b.bank_account_id = CAST($${params.length} AS uuid)`);
    }
    if (query.status) {
      params.push(query.status);
      where.push(`b.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(
        b.book_number ILIKE ${p}
        OR COALESCE(b.prefix, '') ILIKE ${p}
        OR COALESCE(b.suffix, '') ILIKE ${p}
        OR b.start_cheque_number ILIKE ${p}
        OR b.end_cheque_number ILIKE ${p}
        OR ba.bank_name ILIKE ${p}
        OR ba.account_title ILIKE ${p}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
       FROM bank_cheque_books b
       JOIN bank_accounts ba ON ba.id = b.bank_account_id AND ba.company_id = b.company_id
       WHERE ${whereSql}`,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          b.*,
          ba.code AS bank_account_code,
          ba.bank_name,
          ba.branch_name,
          ba.account_title,
          ba.account_number,
          COUNT(c.id)::int AS cheque_count,
          COUNT(c.id) FILTER (WHERE c.status = 'Available')::int AS available_count,
          COUNT(c.id) FILTER (WHERE c.status = 'Issued')::int AS issued_count,
          COUNT(c.id) FILTER (WHERE c.status = 'Void')::int AS void_count
        FROM bank_cheque_books b
        JOIN bank_accounts ba ON ba.id = b.bank_account_id AND ba.company_id = b.company_id
        LEFT JOIN bank_cheques c ON c.bank_cheque_book_id = b.id AND c.company_id = b.company_id
        WHERE ${whereSql}
        GROUP BY b.id, ba.id
        ORDER BY b.created_at DESC, b.book_number DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);
    return { data: rows, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async createBook(input: CreateChequeBookInput, userId?: string | null) {
    const range = chequeRange(input);
    const userIdValue = userIdOrNull(userId);
    const prefix = textOrNull(input.prefix) ?? '';
    const suffix = textOrNull(input.suffix) ?? '';

    return prisma.$transaction(async transaction => {
      await this.validateBankAccount(transaction, input.bank_account_id);
      await this.assertUniqueBookNumber(transaction, input.bank_account_id, input.book_number);
      await this.assertGeneratedChequesAreNew(transaction, input.bank_account_id, prefix, suffix, input.start_cheque_number, input.end_cheque_number, range.width);

      const bookRows = await transaction.$queryRaw<any[]>`
        INSERT INTO bank_cheque_books (
          company_id, bank_account_id, book_number, prefix, suffix,
          start_cheque_number, end_cheque_number, total_cheques,
          issued_date, received_date, status, notes,
          is_active, created_by_id, updated_by_id, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${input.bank_account_id} AS uuid),
          ${input.book_number.trim()},
          ${textOrNull(input.prefix)},
          ${textOrNull(input.suffix)},
          ${input.start_cheque_number},
          ${input.end_cheque_number},
          ${range.total},
          ${dateTextOrNull(input.issued_date)}::date,
          ${dateTextOrNull(input.received_date)}::date,
          'Active',
          ${textOrNull(input.notes)},
          true,
          ${userIdValue}::uuid,
          ${userIdValue}::uuid,
          now()
        )
        RETURNING *
      `;

      const book = bookRows[0];
      await transaction.$queryRaw`
        INSERT INTO bank_cheques (
          company_id, bank_cheque_book_id, bank_account_id, serial_number,
          cheque_number, status, is_active, created_by_id, updated_by_id, updated_at
        )
        SELECT
          CAST(${this.companyId} AS uuid),
          CAST(${book.id} AS uuid),
          CAST(${input.bank_account_id} AS uuid),
          (gs - CAST(${input.start_cheque_number} AS bigint) + 1)::int AS serial_number,
          (${prefix} || LPAD(gs::text, ${range.width}, '0') || ${suffix}) AS cheque_number,
          'Available',
          true,
          ${userIdValue}::uuid,
          ${userIdValue}::uuid,
          now()
        FROM generate_series(CAST(${input.start_cheque_number} AS bigint), CAST(${input.end_cheque_number} AS bigint)) AS gs
      `;

      await transaction.$queryRaw`
        INSERT INTO bank_cheque_events (company_id, bank_cheque_id, event_type, reason, notes, created_by_id)
        SELECT
          CAST(${this.companyId} AS uuid),
          id,
          'Created',
          'Cheque Book Generated',
          ${`Cheque Book ${input.book_number.trim()}`},
          ${userIdValue}::uuid
        FROM bank_cheques
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND bank_cheque_book_id = CAST(${book.id} AS uuid)
      `;

      return {
        success: true,
        cheque_book: book,
        generated_cheques: range.total,
        message: `${range.total} cheques generated successfully.`,
      };
    });
  }

  async listCheques(query: ListChequesQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['c.company_id = CAST($1 AS uuid)'];

    if (query.bank_account_id) {
      params.push(query.bank_account_id);
      where.push(`c.bank_account_id = CAST($${params.length} AS uuid)`);
    }
    if (query.cheque_book_id) {
      params.push(query.cheque_book_id);
      where.push(`c.bank_cheque_book_id = CAST($${params.length} AS uuid)`);
    }
    if (query.status) {
      params.push(query.status);
      where.push(`c.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(
        c.cheque_number ILIKE ${p}
        OR COALESCE(c.payee_name, '') ILIKE ${p}
        OR COALESCE(c.payment_reference, '') ILIKE ${p}
        OR b.book_number ILIKE ${p}
        OR ba.bank_name ILIKE ${p}
        OR ba.account_title ILIKE ${p}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total
       FROM bank_cheques c
       JOIN bank_cheque_books b ON b.id = c.bank_cheque_book_id AND b.company_id = c.company_id
       JOIN bank_accounts ba ON ba.id = c.bank_account_id AND ba.company_id = c.company_id
       WHERE ${whereSql}`,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          c.*,
          b.book_number,
          ba.code AS bank_account_code,
          ba.bank_name,
          ba.branch_name,
          ba.account_title,
          ba.account_number
        FROM bank_cheques c
        JOIN bank_cheque_books b ON b.id = c.bank_cheque_book_id AND b.company_id = c.company_id
        JOIN bank_accounts ba ON ba.id = c.bank_account_id AND ba.company_id = c.company_id
        WHERE ${whereSql}
        ORDER BY ba.bank_name ASC, b.book_number ASC, c.serial_number ASC, c.id ASC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);
    return { data: rows, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async availableCheques(query: AvailableChequesQuery) {
    const search = query.search ? `%${query.search}%` : null;
    return prisma.$queryRaw<any[]>`
      SELECT
        c.id,
        c.cheque_number,
        c.serial_number,
        b.book_number,
        c.bank_account_id
      FROM bank_cheques c
      JOIN bank_cheque_books b ON b.id = c.bank_cheque_book_id AND b.company_id = c.company_id
      WHERE c.company_id = CAST(${this.companyId} AS uuid)
        AND c.bank_account_id = CAST(${query.bank_account_id} AS uuid)
        AND c.status = 'Available'
        AND (${search}::text IS NULL OR c.cheque_number ILIKE ${search} OR b.book_number ILIKE ${search})
      ORDER BY b.book_number ASC, c.serial_number ASC
      LIMIT ${query.limit}
    `;
  }

  async voidCheque(id: string, input: VoidChequeInput, userId?: string | null) {
    const userIdValue = userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const rows = await transaction.$queryRaw<any[]>`
        SELECT *
        FROM bank_cheques
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
        LIMIT 1
      `;
      const cheque = rows[0];
      if (!cheque) throw businessError('Cheque was not found.', 404);
      if (!['Available', 'Reserved'].includes(cheque.status)) {
        throw businessError('Only Available or Reserved cheques can be voided from this screen.');
      }

      const updatedRows = await transaction.$queryRaw<any[]>`
        UPDATE bank_cheques
        SET status = 'Void',
            voided_by_id = ${userIdValue}::uuid,
            voided_at = now(),
            void_reason = ${input.reason},
            void_notes = ${textOrNull(input.notes)},
            updated_by_id = ${userIdValue}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        RETURNING *
      `;

      await transaction.$queryRaw`
        INSERT INTO bank_cheque_events (company_id, bank_cheque_id, event_type, reason, notes, created_by_id)
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${id} AS uuid),
          'Void',
          ${input.reason},
          ${textOrNull(input.notes)},
          ${userIdValue}::uuid
        )
      `;

      return { success: true, cheque: updatedRows[0], message: 'Cheque voided and kept in the register.' };
    });
  }

  async issueCheque(id: string, input: IssueChequeInput, userId?: string | null) {
    const userIdValue = userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const rows = await transaction.$queryRaw<any[]>`
        SELECT *
        FROM bank_cheques
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
        LIMIT 1
      `;
      const cheque = rows[0];
      if (!cheque) throw businessError('Cheque was not found.', 404);
      if (!['Available', 'Reserved'].includes(cheque.status)) {
        throw businessError('Only Available or Reserved cheques can be issued.');
      }

      const updatedRows = await transaction.$queryRaw<any[]>`
        UPDATE bank_cheques
        SET status = 'Issued',
            issue_date = ${input.issue_date}::date,
            payee_name = ${input.payee_name.trim()},
            payment_reference = ${textOrNull(input.payment_reference)},
            amount = CAST(${input.amount} AS numeric),
            updated_by_id = ${userIdValue}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        RETURNING *
      `;

      await transaction.$queryRaw`
        INSERT INTO bank_cheque_events (company_id, bank_cheque_id, event_type, reason, notes, created_by_id)
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${id} AS uuid),
          'Issued',
          'Payment',
          ${textOrNull(input.payment_reference)},
          ${userIdValue}::uuid
        )
      `;

      return { success: true, cheque: updatedRows[0], message: 'Cheque marked as Issued.' };
    });
  }

  private async validateBankAccount(transaction: any, bankAccountId: string) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT id
      FROM bank_accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${bankAccountId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    if (!rows[0]) throw businessError('Bank Account was not found or is inactive.');
  }

  private async assertUniqueBookNumber(transaction: any, bankAccountId: string, bookNumber: string) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT id
      FROM bank_cheque_books
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND bank_account_id = CAST(${bankAccountId} AS uuid)
        AND book_number = ${bookNumber.trim()}
      LIMIT 1
    `;
    if (rows[0]) throw businessError('Cheque Book Number is already used for this Bank Account.');
  }

  private async assertGeneratedChequesAreNew(
    transaction: any,
    bankAccountId: string,
    prefix: string,
    suffix: string,
    startChequeNumber: string,
    endChequeNumber: string,
    width: number,
  ) {
    const rows = await transaction.$queryRaw<any[]>`
      WITH generated AS (
        SELECT (${prefix} || LPAD(gs::text, ${width}, '0') || ${suffix}) AS cheque_number
        FROM generate_series(CAST(${startChequeNumber} AS bigint), CAST(${endChequeNumber} AS bigint)) AS gs
      )
      SELECT c.cheque_number
      FROM bank_cheques c
      JOIN generated g ON g.cheque_number = c.cheque_number
      WHERE c.company_id = CAST(${this.companyId} AS uuid)
        AND c.bank_account_id = CAST(${bankAccountId} AS uuid)
      LIMIT 1
    `;
    if (rows[0]) throw businessError(`Cheque Number ${rows[0].cheque_number} already exists for this Bank Account.`);
  }
}
