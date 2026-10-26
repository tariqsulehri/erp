import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

type Client = Prisma.TransactionClient | typeof prisma;

export function partyError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

const LINKED_ACCOUNT_RANGES = {
  customer: { label: 'Customer', from: '0103010001', to: '0103999999' },
  supplier: { label: 'Supplier', from: '0201010001', to: '0201999999' },
} as const;

/** A linked account chosen by the user must be an active posting account of this company in the party's range. */
export async function assertLinkedAccount(client: Client, companyId: string, accountId: string, kind: keyof typeof LINKED_ACCOUNT_RANGES) {
  const range = LINKED_ACCOUNT_RANGES[kind];
  const account = await client.account.findFirst({
    where: { id: accountId, companyId, isDeleted: false },
    select: { code: true, isActive: true, isPosting: true },
  });
  if (!account || !account.isActive || !account.isPosting) {
    throw partyError(`${range.label} Linked Account was not found or is not an active posting account.`);
  }
  if (account.code < range.from || account.code > range.to) {
    throw partyError(`${range.label} Linked Account must be between ${range.from} and ${range.to}. Selected account code is ${account.code}.`);
  }
}

/** Next code such as CUS-0001; numbers are compared as numbers so CUS-10000 follows CUS-9999. */
export async function nextPartyCode(companyId: string, table: 'customers' | 'suppliers', prefix: 'CUS' | 'SUP') {
  const rows = table === 'customers'
    ? await prisma.$queryRaw<{ last: number | null }[]>`
        SELECT MAX(CAST(substring(code FROM '^CUS-([0-9]+)$') AS integer)) AS last
        FROM customers WHERE company_id = CAST(${companyId} AS uuid)`
    : await prisma.$queryRaw<{ last: number | null }[]>`
        SELECT MAX(CAST(substring(code FROM '^SUP-([0-9]+)$') AS integer)) AS last
        FROM suppliers WHERE company_id = CAST(${companyId} AS uuid)`;
  return `${prefix}-${String(Number(rows[0]?.last ?? 0) + 1).padStart(4, '0')}`;
}
