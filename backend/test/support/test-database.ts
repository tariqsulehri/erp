/**
 * Shared setup for database tests.
 *
 * Tests run against TEST_DATABASE_URL, or the backend .env DATABASE_URL when that is not set, so they can
 * check the real database. Each test file works only inside its own new company and removes every row of
 * that company (and any test users) when it finishes, so existing companies are never read or changed.
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';

export const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
}

export type Prisma = (typeof import('../../src/db/prisma.js'))['prisma'];

export interface TestCompany {
  prisma: Prisma;
  companyId: string;
  groupId: string;
  userId: string;
  /** Users created by the test (removed in cleanup). */
  createdUserIds: string[];
  cleanup: () => Promise<void>;
}

/** Creates an isolated company. Call `cleanup()` in afterAll. */
export async function createTestCompany(label: string): Promise<TestCompany> {
  const { prisma } = await import('../../src/db/prisma.js');
  const groupRows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO company_groups (name) VALUES (${`Automated Test Group ${randomUUID()}`}) RETURNING id
  `;
  const companyRows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO companies (group_id, name) VALUES (CAST(${groupRows[0].id} AS uuid), ${`Automated Test - ${label} - ${randomUUID().slice(0, 8)}`}) RETURNING id
  `;
  const company: TestCompany = {
    prisma,
    companyId: companyRows[0].id,
    groupId: groupRows[0].id,
    userId: randomUUID(),
    createdUserIds: [],
    cleanup: async () => deleteTestCompany(prisma, company),
  };
  return company;
}

/**
 * Deletes every row of the test company from every table that has company_id, then the company itself.
 * Foreign keys decide the order, so tables are retried until nothing is left or no progress is made.
 */
async function deleteTestCompany(prisma: Prisma, company: TestCompany) {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'company_id' AND t.table_type = 'BASE TABLE'
  `;
  let remaining = tables.map(row => row.table_name);
  for (let round = 0; round < 20 && remaining.length > 0; round += 1) {
    const failed: string[] = [];
    for (const table of remaining) {
      try {
        // Table names come from information_schema, not from input.
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE company_id = CAST($1 AS uuid)`, company.companyId);
      } catch {
        failed.push(table);
      }
    }
    if (failed.length === remaining.length) {
      throw new Error(`Test cleanup could not delete rows from: ${failed.join(', ')}`);
    }
    remaining = failed;
  }
  if (company.createdUserIds.length) {
    await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = ANY(CAST($1 AS uuid[]))`, company.createdUserIds);
  }
  await prisma.$executeRaw`DELETE FROM companies WHERE id = CAST(${company.companyId} AS uuid)`;
  await prisma.$executeRaw`DELETE FROM company_groups WHERE id = CAST(${company.groupId} AS uuid)`;
}

/** Adds a posting account to the test company and returns its id. */
export async function insertAccount(
  prisma: Prisma,
  companyId: string,
  code: string,
  name: string,
  accountType: 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense',
  normalBalance: 'Debit' | 'Credit',
) {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO accounts (company_id, code, name, account_type, normal_balance, is_posting, is_active, updated_at)
    VALUES (CAST(${companyId} AS uuid), ${code}, ${name}, ${accountType}, ${normalBalance}, true, true, now())
    RETURNING id
  `;
  return rows[0].id;
}
