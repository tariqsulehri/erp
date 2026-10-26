import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { BookAccountsQuery } from './business-report.schema.js';

interface BookAccountRow {
  account_id: string;
  account_code: string;
  account_name: string;
  label: string;
}

/**
 * Accounts for the Cash Book, Bank Book, Customer Ledger and Supplier Ledger pickers. All are read from
 * setup data, not fixed codes: Bank = ledger accounts linked to Bank Accounts; Cash = posting Asset
 * accounts in the same sub-group as the configured cash account, excluding bank accounts; Customer and
 * Supplier = each party's linked account. Searches on the server, at most 50 rows.
 */
export class BookAccountsService {
  constructor(private readonly companyId: string) {}

  async list(query: BookAccountsQuery) {
    const like = `%${query.search ?? ''}%`;

    if (query.kind === 'bank') {
      return prisma.$queryRaw<BookAccountRow[]>`
        SELECT a.id::text AS account_id, a.code AS account_code, a.name AS account_name,
               CONCAT(ba.bank_name, ' - ', ba.account_title) AS label
        FROM bank_accounts ba
        JOIN accounts a ON a.id = ba.ledger_account_id AND a.company_id = ba.company_id
        WHERE ba.company_id = CAST(${this.companyId} AS uuid)
          AND (a.code ILIKE ${like} OR a.name ILIKE ${like} OR ba.bank_name ILIKE ${like} OR ba.account_title ILIKE ${like})
        ORDER BY a.code
        LIMIT 50
      `;
    }

    if (query.kind === 'cash') {
      return prisma.$queryRaw<BookAccountRow[]>`
        WITH cash_groups AS (
          SELECT DISTINCT LEFT(a.code, 6) AS prefix
          FROM accounts a
          WHERE a.company_id = CAST(${this.companyId} AS uuid)
            AND a.id IN (
              SELECT default_cash_account_id FROM purchase_settings WHERE company_id = CAST(${this.companyId} AS uuid)
              UNION SELECT default_cash_account_id FROM sale_settings WHERE company_id = CAST(${this.companyId} AS uuid)
            )
        )
        SELECT a.id::text AS account_id, a.code AS account_code, a.name AS account_name, a.name AS label
        FROM accounts a
        JOIN cash_groups g ON LEFT(a.code, 6) = g.prefix
        WHERE a.company_id = CAST(${this.companyId} AS uuid)
          AND a.is_posting = true AND a.is_deleted = false AND a.account_type = 'Asset'
          AND a.id NOT IN (SELECT ledger_account_id FROM bank_accounts WHERE company_id = CAST(${this.companyId} AS uuid))
          AND (a.code ILIKE ${like} OR a.name ILIKE ${like})
        ORDER BY a.code
        LIMIT 50
      `;
    }

    const partyTable = Prisma.raw(query.kind === 'customer' ? 'customers' : 'suppliers');
    const accountColumn = Prisma.raw(query.kind === 'customer' ? 'ar_account_id' : 'ap_account_id');
    return prisma.$queryRaw<BookAccountRow[]>`
      SELECT a.id::text AS account_id, a.code AS account_code, a.name AS account_name,
             CONCAT(p.code, ' - ', p.name) AS label
      FROM ${partyTable} p
      JOIN accounts a ON a.id = p.${accountColumn} AND a.company_id = p.company_id
      WHERE p.company_id = CAST(${this.companyId} AS uuid)
        AND (p.code ILIKE ${like} OR p.name ILIKE ${like} OR a.code ILIKE ${like})
      ORDER BY p.name
      LIMIT 50
    `;
  }
}
