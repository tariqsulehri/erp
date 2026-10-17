import { prisma } from '../../db/prisma.js';
import type { BankAccountInput, BankAccountUpdateInput, ListBankAccountsQuery } from './bank-account.schema.js';

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

export class BankAccountService {
  constructor(private readonly companyId: string) {}

  async supportData() {
    const accounts = await prisma.$queryRaw`
      SELECT id, code, name, account_type, normal_balance, opening_balance::text, opening_balance_date
      FROM accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND is_active = true
        AND is_posting = true
        AND is_deleted = false
        AND account_type = 'Asset'
      ORDER BY code ASC
      LIMIT 200
    `;

    return { accounts };
  }

  async list(query: ListBankAccountsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['ba.company_id = CAST($1 AS uuid)'];

    if (query.is_active !== undefined) {
      params.push(query.is_active);
      where.push(`ba.is_active = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(
        ba.code ILIKE ${p}
        OR ba.bank_name ILIKE ${p}
        OR ba.account_title ILIKE ${p}
        OR ba.account_number ILIKE ${p}
        OR COALESCE(ba.branch_name, '') ILIKE ${p}
        OR COALESCE(ba.iban, '') ILIKE ${p}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM bank_accounts ba WHERE ${whereSql}`,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const data = await prisma.$queryRawUnsafe<any[]>(
      `
        WITH page_rows AS (
          SELECT ba.*
          FROM bank_accounts ba
          WHERE ${whereSql}
          ORDER BY ba.is_default DESC, ba.bank_name ASC, ba.account_title ASC
          LIMIT $${params.length - 1}
          OFFSET $${params.length}
        ),
        posted_balances AS (
          SELECT
            vl.account_id,
            SUM(vl.dr_amount - vl.cr_amount) AS movement_amount
          FROM voucher_lines vl
          JOIN vouchers v
            ON v.id = vl.voucher_id
            AND v.company_id = vl.company_id
          JOIN page_rows ba
            ON ba.company_id = vl.company_id
            AND ba.ledger_account_id = vl.account_id
          WHERE vl.company_id = CAST($1 AS uuid)
            AND v.status = 'Posted'
          GROUP BY vl.account_id
        )
        SELECT
          ba.*,
          a.code AS ledger_account_code,
          a.name AS ledger_account_name,
          (ba.opening_balance + COALESCE(posted_balances.movement_amount, 0))::text AS current_balance
        FROM page_rows ba
        JOIN accounts a ON a.id = ba.ledger_account_id AND a.company_id = ba.company_id
        LEFT JOIN posted_balances ON posted_balances.account_id = ba.ledger_account_id
        ORDER BY ba.is_default DESC, ba.bank_name ASC, ba.account_title ASC
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);
    return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async create(input: BankAccountInput, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      await this.validateLedgerAccount(input.ledger_account_id);
      await this.assertUniqueCode(input.code);
      await this.assertUniqueAccountNumber(input.account_number);
      await this.assertUniqueLedgerAccount(input.ledger_account_id);

      const userIdValue = userIdOrNull(userId);
      if (input.is_default) {
        await transaction.$queryRaw`
          UPDATE bank_accounts
          SET is_default = false,
              updated_at = now()
          WHERE company_id = CAST(${this.companyId} AS uuid)
        `;
      }

      const rows = await transaction.$queryRaw<any[]>`
        INSERT INTO bank_accounts (
          company_id, ledger_account_id, code, bank_name, branch_name, branch_code,
          account_title, account_number, account_type, iban, swift_code, currency_code,
          opening_balance, opening_balance_date, contact_name, address, post_code,
          country, city, area, phone_1, phone_2, mobile_number, fax_number, email,
          website, notes, is_default, is_active, created_by_id, updated_by_id, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${input.ledger_account_id} AS uuid),
          ${input.code.trim()},
          ${input.bank_name.trim()},
          ${textOrNull(input.branch_name)},
          ${textOrNull(input.branch_code)},
          ${input.account_title.trim()},
          ${input.account_number.trim()},
          ${textOrNull(input.account_type)},
          ${textOrNull(input.iban)},
          ${textOrNull(input.swift_code)},
          ${input.currency_code.trim().toUpperCase()},
          CAST(${input.opening_balance} AS numeric),
          ${dateTextOrNull(input.opening_balance_date)}::date,
          ${textOrNull(input.contact_name)},
          ${textOrNull(input.address)},
          ${textOrNull(input.post_code)},
          ${textOrNull(input.country)},
          ${textOrNull(input.city)},
          ${textOrNull(input.area)},
          ${textOrNull(input.phone_1)},
          ${textOrNull(input.phone_2)},
          ${textOrNull(input.mobile_number)},
          ${textOrNull(input.fax_number)},
          ${textOrNull(input.email)},
          ${textOrNull(input.website)},
          ${textOrNull(input.notes)},
          ${input.is_default},
          ${input.is_active},
          ${userIdValue}::uuid,
          ${userIdValue}::uuid,
          now()
        )
        RETURNING *
      `;

      return { success: true, bank_account: rows[0], message: 'Bank Account saved successfully.' };
    });
  }

  async update(id: string, input: BankAccountUpdateInput, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const existingRows = await transaction.$queryRaw<any[]>`
        SELECT *
        FROM bank_accounts
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        LIMIT 1
      `;
      const existing = existingRows[0];
      if (!existing) throw businessError('Bank Account was not found.', 404);

      const next = {
        code: input.code ?? existing.code,
        ledger_account_id: input.ledger_account_id ?? existing.ledger_account_id,
        bank_name: input.bank_name ?? existing.bank_name,
        branch_name: input.branch_name ?? existing.branch_name,
        branch_code: input.branch_code ?? existing.branch_code,
        account_title: input.account_title ?? existing.account_title,
        account_number: input.account_number ?? existing.account_number,
        account_type: input.account_type ?? existing.account_type,
        iban: input.iban ?? existing.iban,
        swift_code: input.swift_code ?? existing.swift_code,
        currency_code: input.currency_code ?? existing.currency_code,
        opening_balance: input.opening_balance ?? existing.opening_balance,
        opening_balance_date: input.opening_balance_date ?? existing.opening_balance_date,
        contact_name: input.contact_name ?? existing.contact_name,
        address: input.address ?? existing.address,
        post_code: input.post_code ?? existing.post_code,
        country: input.country ?? existing.country,
        city: input.city ?? existing.city,
        area: input.area ?? existing.area,
        phone_1: input.phone_1 ?? existing.phone_1,
        phone_2: input.phone_2 ?? existing.phone_2,
        mobile_number: input.mobile_number ?? existing.mobile_number,
        fax_number: input.fax_number ?? existing.fax_number,
        email: input.email ?? existing.email,
        website: input.website ?? existing.website,
        notes: input.notes ?? existing.notes,
        is_default: input.is_default ?? existing.is_default,
        is_active: input.is_active ?? existing.is_active,
      };

      await this.validateLedgerAccount(next.ledger_account_id);
      await this.assertUniqueCode(next.code, id);
      await this.assertUniqueAccountNumber(next.account_number, id);
      await this.assertUniqueLedgerAccount(next.ledger_account_id, id);

      const userIdValue = userIdOrNull(userId);
      if (next.is_default) {
        await transaction.$queryRaw`
          UPDATE bank_accounts
          SET is_default = false,
              updated_at = now()
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND id <> CAST(${id} AS uuid)
        `;
      }

      const rows = await transaction.$queryRaw<any[]>`
        UPDATE bank_accounts
        SET ledger_account_id = CAST(${next.ledger_account_id} AS uuid),
            code = ${next.code.trim()},
            bank_name = ${next.bank_name.trim()},
            branch_name = ${textOrNull(next.branch_name)},
            branch_code = ${textOrNull(next.branch_code)},
            account_title = ${next.account_title.trim()},
            account_number = ${next.account_number.trim()},
            account_type = ${textOrNull(next.account_type)},
            iban = ${textOrNull(next.iban)},
            swift_code = ${textOrNull(next.swift_code)},
            currency_code = ${String(next.currency_code).trim().toUpperCase()},
            opening_balance = CAST(${next.opening_balance} AS numeric),
            opening_balance_date = ${dateTextOrNull(next.opening_balance_date)}::date,
            contact_name = ${textOrNull(next.contact_name)},
            address = ${textOrNull(next.address)},
            post_code = ${textOrNull(next.post_code)},
            country = ${textOrNull(next.country)},
            city = ${textOrNull(next.city)},
            area = ${textOrNull(next.area)},
            phone_1 = ${textOrNull(next.phone_1)},
            phone_2 = ${textOrNull(next.phone_2)},
            mobile_number = ${textOrNull(next.mobile_number)},
            fax_number = ${textOrNull(next.fax_number)},
            email = ${textOrNull(next.email)},
            website = ${textOrNull(next.website)},
            notes = ${textOrNull(next.notes)},
            is_default = ${next.is_default},
            is_active = ${next.is_active},
            updated_by_id = ${userIdValue}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        RETURNING *
      `;

      return { success: true, bank_account: rows[0], message: 'Bank Account updated successfully.' };
    });
  }

  private async validateLedgerAccount(accountId: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT id
      FROM accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${accountId} AS uuid)
        AND is_active = true
        AND is_posting = true
        AND is_deleted = false
        AND account_type = 'Asset'
      LIMIT 1
    `;
    if (!rows[0]) throw businessError('Linked Account was not found, inactive, or not an Asset posting account.');
  }

  private async assertUniqueCode(code: string, excludeId?: string) {
    const rows = excludeId
      ? await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND LOWER(code) = LOWER(${code.trim()})
            AND id <> CAST(${excludeId} AS uuid)
          LIMIT 1
        `
      : await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND LOWER(code) = LOWER(${code.trim()})
          LIMIT 1
        `;
    if (rows[0]) throw businessError('Code is already used by another Bank Account.');
  }

  private async assertUniqueAccountNumber(accountNumber: string, excludeId?: string) {
    const rows = excludeId
      ? await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND account_number = ${accountNumber.trim()}
            AND id <> CAST(${excludeId} AS uuid)
          LIMIT 1
        `
      : await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND account_number = ${accountNumber.trim()}
          LIMIT 1
        `;
    if (rows[0]) throw businessError('Account Number is already used by another Bank Account.');
  }

  private async assertUniqueLedgerAccount(accountId: string, excludeId?: string) {
    const rows = excludeId
      ? await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND ledger_account_id = CAST(${accountId} AS uuid)
            AND id <> CAST(${excludeId} AS uuid)
          LIMIT 1
        `
      : await prisma.$queryRaw<any[]>`
          SELECT id
          FROM bank_accounts
          WHERE company_id = CAST(${this.companyId} AS uuid)
            AND ledger_account_id = CAST(${accountId} AS uuid)
          LIMIT 1
        `;
    if (rows[0]) throw businessError('Linked Account is already used by another Bank Account.');
  }
}
