import type { Prisma, PrismaClient } from '@prisma/client';

const CUSTOMER_ACCOUNT_CODE_PREFIX = '0103';
const SUPPLIER_ACCOUNT_CODE_PREFIX = '0201';
const CUSTOMER_ACCOUNT_CODE_START = '0103010001';
const CUSTOMER_ACCOUNT_CODE_END = '0103999999';
const SUPPLIER_ACCOUNT_CODE_START = '0201010001';
const SUPPLIER_ACCOUNT_CODE_END = '0201999999';
const PARTY_ACCOUNT_SUBGROUP_MIN = 1;
const PARTY_ACCOUNT_SUBGROUP_MAX = 99;
const POSTING_ACCOUNT_MIN = 1;
const POSTING_ACCOUNT_MAX = 9999;

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export type PartyAccountRole = 'customer' | 'supplier';

function buildPostingAccountCode(prefix: string, subgroup: number, posting: number) {
  return `${prefix}${String(subgroup).padStart(2, '0')}${String(posting).padStart(4, '0')}`;
}

export class PartyAccountService {
  async nextLinkedAccountCode(companyId: string, role: PartyAccountRole, client: TransactionClient) {
    const isCustomer = role === 'customer';
    const rows = await client.account.findMany({
      where: {
        companyId,
        code: {
          gte: isCustomer ? CUSTOMER_ACCOUNT_CODE_START : SUPPLIER_ACCOUNT_CODE_START,
          lte: isCustomer ? CUSTOMER_ACCOUNT_CODE_END : SUPPLIER_ACCOUNT_CODE_END,
        },
      },
      select: { code: true },
    });

    const usedCodes = new Set(rows.map(row => row.code));
    const prefix = isCustomer ? CUSTOMER_ACCOUNT_CODE_PREFIX : SUPPLIER_ACCOUNT_CODE_PREFIX;

    for (let subgroup = PARTY_ACCOUNT_SUBGROUP_MIN; subgroup <= PARTY_ACCOUNT_SUBGROUP_MAX; subgroup += 1) {
      for (let posting = POSTING_ACCOUNT_MIN; posting <= POSTING_ACCOUNT_MAX; posting += 1) {
        const code = buildPostingAccountCode(prefix, subgroup, posting);
        if (!usedCodes.has(code)) return code;
      }
    }

    const label = isCustomer ? 'Customer' : 'Supplier';
    const range = isCustomer
      ? `${CUSTOMER_ACCOUNT_CODE_START}-${CUSTOMER_ACCOUNT_CODE_END}`
      : `${SUPPLIER_ACCOUNT_CODE_START}-${SUPPLIER_ACCOUNT_CODE_END}`;
    throw new Error(`${label} linked account range (${range}) is full. Please extend the Chart of Accounts.`);
  }

  async createLinkedAccount(companyId: string, role: PartyAccountRole, partyName: string, client: TransactionClient) {
    const isCustomer = role === 'customer';
    const code = await this.nextLinkedAccountCode(companyId, role, client);
    const account = await client.account.create({
      data: {
        companyId,
        code,
        name: partyName.slice(0, 100),
        accountType: isCustomer ? 'Asset' : 'Liability',
        normalBalance: isCustomer ? 'Debit' : 'Credit',
        isPosting: true,
        isSystem: false,
        isActive: true,
        description: `${isCustomer ? 'Customer' : 'Supplier'} linked account - ${partyName}`,
      } satisfies Prisma.AccountUncheckedCreateInput,
      select: { id: true, code: true },
    });

    return account;
  }

  async syncLinkedAccountName(
    companyId: string,
    accountId: string | null | undefined,
    role: PartyAccountRole,
    partyName: string,
    client: TransactionClient,
  ) {
    if (!accountId) return;

    await client.account.updateMany({
      where: { id: accountId, companyId },
      data: {
        name: partyName.slice(0, 100),
        description: `${role === 'customer' ? 'Customer' : 'Supplier'} linked account - ${partyName}`,
      },
    });
  }
}
