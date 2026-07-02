import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccountListQuery, CreateAccountInput, UpdateAccountInput } from './account.schema.js';

type AccountRow = Prisma.AccountGetPayload<Record<string, never>>;

interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isPosting: boolean;
  children: AccountTreeNode[];
}

function accountToResponse(account: AccountRow, currentBalance?: Prisma.Decimal | null) {
  return {
    id: account.id,
    company_id: account.companyId,
    code: account.code,
    name: account.name,
    description: account.description,
    account_type: account.accountType,
    normal_balance: account.normalBalance,
    is_posting: account.isPosting,
    is_system: account.isSystem,
    is_active: account.isActive,
    sort_order: account.sortOrder,
    opening_balance: account.openingBalance?.toString() ?? null,
    current_balance: currentBalance?.toString() ?? account.openingBalance?.toString() ?? '0',
    opening_balance_date: account.openingBalanceDate,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

function auditLogToResponse(log: Prisma.AccountAuditLogGetPayload<Record<string, never>>) {
  return {
    id: log.id,
    account_id: log.accountId,
    company_id: log.companyId,
    changed_by: log.changedBy,
    action: log.action,
    changes: log.changes,
    created_at: log.createdAt,
  };
}

function isTopLevelAccountCode(code: string) {
  return code.slice(2) === '00000000';
}

function getParentAccountCode(code: string) {
  const group = code.slice(2, 4);
  const subGroup = code.slice(4, 6);
  const posting = code.slice(6, 10);

  if (group === '00' && subGroup === '00' && posting === '0000') return null;
  if (subGroup === '00' && posting === '0000') return `${code.slice(0, 2)}00000000`;
  if (posting === '0000') return `${code.slice(0, 4)}000000`;
  return `${code.slice(0, 6)}0000`;
}

function getAccountLevel(code: string) {
  const group = code.slice(2, 4);
  const subGroup = code.slice(4, 6);
  const posting = code.slice(6, 10);

  if (group === '00' && subGroup === '00' && posting === '0000') return 1;
  if (subGroup === '00' && posting === '0000') return 2;
  if (posting === '0000') return 3;
  return 4;
}

function isValidAccountCode(code: string) {
  return /^\d{10}$/.test(code);
}

function isHeaderAccountCode(code: string) {
  return isValidAccountCode(code) && code.slice(6, 10) === '0000';
}

function toCurrentAccountCode(code: string, isPosting: boolean) {
  const clean = code.trim();
  if (isValidAccountCode(clean)) return clean;

  if (/^\d{6}$/.test(clean)) {
    const mainCategory = clean.slice(0, 1).padStart(2, '0');
    const group = clean.slice(1, 2).padStart(2, '0');
    const subGroup = clean.slice(2, 4).padStart(2, '0');
    const posting = isPosting ? clean.slice(4, 6).padStart(4, '0') : '0000';
    return `${mainCategory}${group}${subGroup}${posting}`;
  }

  return clean;
}

function getChildCodeRange(parentCode: string, isPosting = false) {
  const level = getAccountLevel(parentCode);

  if (level === 1 && !isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 2)}01000000`),
      rangeEnd: Number(`${parentCode.slice(0, 2)}99000000`) + 1,
      step: 1000000,
    };
  }

  if (level === 2 && !isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 4)}010000`),
      rangeEnd: Number(`${parentCode.slice(0, 4)}990000`) + 1,
      step: 10000,
    };
  }

  if (level === 3 && isPosting) {
    return {
      rangeStart: Number(`${parentCode.slice(0, 6)}0001`),
      rangeEnd: Number(`${parentCode.slice(0, 6)}9999`) + 1,
      step: 1,
    };
  }

  return null;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function badRequest(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

function notFound(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 404 });
  return error;
}

function accountToTreeNode(account: AccountRow): AccountTreeNode {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    accountType: account.accountType,
    isPosting: account.isPosting,
    children: [],
  };
}

export class AccountListService {
  async list(companyId: string, query: AccountListQuery) {
    const where: Prisma.AccountWhereInput = {
      companyId,
      isDeleted: false,
    };

    if (query.is_active !== undefined) where.isActive = query.is_active;
    if (query.is_posting !== undefined) where.isPosting = query.is_posting;
    if (query.type) where.accountType = query.type;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.account.findMany({
        where,
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.account.count({ where }),
    ]);
    const currentBalances = await this.currentBalancesForAccounts(companyId, rows);

    return {
      data: rows.map(account => accountToResponse(account, currentBalances.get(account.id))),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async topLevel(companyId: string) {
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isDeleted: false,
        isActive: true,
      },
      orderBy: { code: 'asc' },
    });

    return accounts
      .filter(account => isTopLevelAccountCode(account.code))
      .map(account => accountToResponse(account));
  }

  async children(companyId: string, parentCode: string) {
    const prefix = parentCode.slice(0, getAccountLevel(parentCode) * 2);
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isDeleted: false,
        isActive: true,
        code: { startsWith: prefix },
        NOT: { code: parentCode },
      },
      orderBy: { code: 'asc' },
    });

    return accounts
      .filter(account => getParentAccountCode(account.code) === parentCode)
      .map(account => accountToResponse(account));
  }

  async nextCode(companyId: string, parentCode: string, isPosting: boolean) {
    return { code: await this.getNextAvailableCode(companyId, parentCode, isPosting) };
  }

  async validateCode(companyId: string, code: string) {
    if (!isValidAccountCode(code)) {
      return { valid: false, error: 'Account Code must be exactly 10 digits.' };
    }

    const existing = await prisma.account.findFirst({
      where: { companyId, code, isDeleted: false },
      select: { id: true },
    });

    if (existing) return { valid: false, error: 'This Account Code already exists.' };
    return { valid: true };
  }

  async create(companyId: string, input: CreateAccountInput) {
    const account = await this.createAccount(companyId, input);
    return {
      success: true,
      account,
      message: `Account ${account.code} created successfully.`,
    };
  }

  async getById(companyId: string, id: string) {
    const account = await prisma.account.findFirst({
      where: {
        id,
        companyId,
        isDeleted: false,
      },
    });

    if (!account) {
      throw notFound('Account was not found.');
    }

    return accountToResponse(account);
  }

  async hierarchy(companyId: string) {
    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        isDeleted: false,
        isActive: true,
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });

    const tree: AccountTreeNode[] = [];
    const nodeByCode = new Map<string, AccountTreeNode>();

    for (const account of accounts) {
      nodeByCode.set(account.code, accountToTreeNode(account));
    }

    for (const account of accounts) {
      const node = nodeByCode.get(account.code);
      if (!node) continue;

      const parentCode = getParentAccountCode(account.code);
      const parent = parentCode ? nodeByCode.get(parentCode) : null;

      if (parent) {
        parent.children.push(node);
      } else if (!parentCode || isTopLevelAccountCode(account.code)) {
        tree.push(node);
      }
    }

    return tree;
  }

  async history(companyId: string, accountId: string) {
    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        companyId,
        isDeleted: false,
      },
      select: { id: true },
    });

    if (!account) {
      throw notFound('Account was not found.');
    }

    const logs = await prisma.accountAuditLog.findMany({
      where: {
        accountId,
        companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map(auditLogToResponse);
  }

  async update(companyId: string, id: string, input: UpdateAccountInput) {
    const existing = await prisma.account.findFirst({
      where: { id, companyId, isDeleted: false },
    });

    if (!existing) throw notFound('Account was not found.');

    if (existing.isSystem && input.is_active === false) {
      throw badRequest('System accounts cannot be deactivated.');
    }

    if (input.is_active === false && existing.isActive) {
      const childCount = await this.countActiveChildren(companyId, existing.code);
      if (childCount > 0) {
        throw badRequest(`Cannot deactivate account with ${childCount} active child account(s).`);
      }
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    const data: Prisma.AccountUpdateInput = {};

    if (input.name !== undefined && input.name !== existing.name) {
      changes.name = { from: existing.name, to: input.name };
      data.name = input.name;
    }

    if (input.description !== undefined) {
      const description = cleanText(input.description);
      if (description !== existing.description) {
        changes.description = { from: existing.description, to: description };
        data.description = description;
      }
    }

    if (input.is_active !== undefined && input.is_active !== existing.isActive) {
      changes.is_active = { from: existing.isActive, to: input.is_active };
      data.isActive = input.is_active;
    }

    if (input.sort_order !== undefined && input.sort_order !== existing.sortOrder) {
      changes.sort_order = { from: existing.sortOrder, to: input.sort_order };
      data.sortOrder = input.sort_order;
    }

    if (input.opening_balance !== undefined) {
      const openingBalance = input.opening_balance;
      const currentOpeningBalance = existing.openingBalance ? Number(existing.openingBalance) : null;
      if (openingBalance !== currentOpeningBalance) {
        changes.opening_balance = { from: currentOpeningBalance, to: openingBalance };
        data.openingBalance = openingBalance === null ? null : new Prisma.Decimal(openingBalance);
      }
    }

    if (input.opening_balance_date !== undefined) {
      const openingBalanceDate = input.opening_balance_date ? new Date(input.opening_balance_date) : null;
      const currentDate = existing.openingBalanceDate ? existing.openingBalanceDate.toISOString().slice(0, 10) : null;
      const nextDate = openingBalanceDate ? openingBalanceDate.toISOString().slice(0, 10) : null;
      if (nextDate !== currentDate) {
        changes.opening_balance_date = { from: currentDate, to: nextDate };
        data.openingBalanceDate = openingBalanceDate;
      }
    }

    if (Object.keys(data).length === 0) return accountToResponse(existing);

    const updated = await prisma.$transaction(async transaction => {
      const account = await transaction.account.update({
        where: { id },
        data,
      });

      const action = changes.is_active !== undefined
        ? (account.isActive ? 'activated' : 'deactivated')
        : 'updated';

      await transaction.accountAuditLog.create({
        data: {
          accountId: account.id,
          companyId,
          action,
          changes: changes as Prisma.InputJsonObject,
        },
      });

      return account;
    });

    return accountToResponse(updated);
  }

  async setActive(companyId: string, id: string, isActive: boolean) {
    return this.update(companyId, id, { is_active: isActive });
  }

  async bulkSetActive(companyId: string, ids: string[], isActive: boolean) {
    let updated = 0;

    for (const id of ids) {
      const account = await prisma.account.findFirst({
        where: { id, companyId, isDeleted: false },
        select: { id: true, isSystem: true, isActive: true, code: true },
      });
      if (!account || account.isSystem || account.isActive === isActive) continue;
      if (!isActive && await this.countActiveChildren(companyId, account.code) > 0) continue;

      await this.update(companyId, id, { is_active: isActive });
      updated++;
    }

    return {
      success: true,
      updated,
      message: `${updated} account(s) ${isActive ? 'activated' : 'deactivated'}.`,
    };
  }

  async clone(companyId: string, sourceId: string, newName: string) {
    const source = await prisma.account.findFirst({
      where: { id: sourceId, companyId, isDeleted: false },
    });

    if (!source) throw notFound('Source account was not found.');

    const parentCode = getParentAccountCode(source.code);
    if (!parentCode) throw badRequest('Main Category accounts cannot be cloned.');

    const nextCode = await this.getNextAvailableCode(companyId, parentCode, source.isPosting);
    if (!nextCode) throw badRequest('No available account code was found under the same parent.');

    const cloned = await prisma.$transaction(async transaction => {
      const account = await transaction.account.create({
        data: {
          companyId,
          code: nextCode,
          name: newName,
          description: source.description,
          accountType: source.accountType,
          normalBalance: source.normalBalance,
          isPosting: source.isPosting,
          isSystem: false,
          isActive: true,
          sortOrder: source.sortOrder,
          categoryId: source.categoryId,
          ...(source.taxCodes === null ? {} : { taxCodes: source.taxCodes as Prisma.InputJsonValue }),
          ...(source.attributes === null ? {} : { attributes: source.attributes as Prisma.InputJsonValue }),
          openingBalance: source.openingBalance,
          openingBalanceDate: source.openingBalanceDate,
        },
      });

      await transaction.accountAuditLog.create({
        data: {
          accountId: account.id,
          companyId,
          action: 'cloned',
          changes: { cloned_from: { from: null, to: source.code } },
        },
      });

      return account;
    });

    return {
      success: true,
      account: accountToResponse(cloned),
      message: `Cloned as ${cloned.code}.`,
    };
  }

  async bulkCreate(companyId: string, rows: CreateAccountInput[]) {
    const sorted = [...rows].sort((a, b) => getAccountLevel(a.code) - getAccountLevel(b.code) || a.code.localeCompare(b.code));
    const results: Array<{ code: string; success: boolean; message: string }> = [];

    for (const row of sorted) {
      try {
        const existing = await prisma.account.findFirst({
          where: { companyId, code: row.code, isDeleted: false },
          select: { id: true },
        });

        if (existing) {
          results.push({ code: row.code, success: true, message: 'Already exists - skipped' });
          continue;
        }

        await this.createAccount(companyId, row);
        results.push({ code: row.code, success: true, message: 'Created' });
      } catch (error) {
        results.push({ code: row.code, success: false, message: error instanceof Error ? error.message : 'Unable to create account.' });
      }
    }

    return {
      results,
      created: results.filter(result => result.success && result.message === 'Created').length,
      skipped: results.filter(result => result.success && result.message !== 'Created').length,
      failed: results.filter(result => !result.success).length,
    };
  }

  async templates() {
    const templates = await prisma.chartOfAccountsTemplate.findMany({
      where: { isActive: true },
      orderBy: { templateName: 'asc' },
    });

    return templates.map(template => ({
      id: template.id,
      code: template.templateCode,
      name: template.templateName,
      description: template.description,
      accountCount: template.accountCount,
    }));
  }

  private async currentBalancesForAccounts(companyId: string, accounts: AccountRow[]) {
    if (accounts.length === 0) return new Map<string, Prisma.Decimal>();

    const movementRows = await prisma.voucherLine.groupBy({
      by: ['accountId'],
      where: {
        companyId,
        accountId: { in: accounts.map(account => account.id) },
        voucher: {
          companyId,
          status: 'Posted',
        },
      },
      _sum: {
        debitAmount: true,
        creditAmount: true,
      },
    });

    const movementByAccount = new Map(
      movementRows.map(row => [
        row.accountId,
        (row._sum.debitAmount ?? new Prisma.Decimal(0)).minus(row._sum.creditAmount ?? new Prisma.Decimal(0)),
      ]),
    );

    return new Map(
      accounts.map(account => {
        const openingBalance = account.openingBalance ?? new Prisma.Decimal(0);
        const movementAmount = movementByAccount.get(account.id) ?? new Prisma.Decimal(0);
        return [account.id, openingBalance.plus(movementAmount)];
      }),
    );
  }

  async importTemplate(companyId: string, templateCode: string) {
    const template = await prisma.chartOfAccountsTemplate.findFirst({
      where: { templateCode, isActive: true },
    });

    if (!template) throw notFound(`Template ${templateCode} was not found.`);
    if (!Array.isArray(template.accounts)) throw badRequest('Template accounts are not in a valid format.');

    const rows = template.accounts.map((entry: any) => ({
      code: toCurrentAccountCode(String(entry.code ?? ''), Boolean(entry.is_posting)),
      name: String(entry.name ?? '').trim(),
      description: cleanText(entry.description),
      account_type: entry.account_type,
      normal_balance: entry.normal_balance,
      is_posting: Boolean(entry.is_posting),
      is_system: Boolean(entry.is_system),
      sort_order: Number(entry.sort_order ?? 0),
    })) as CreateAccountInput[];

    const result = await this.bulkCreate(companyId, rows);
    return {
      success: result.failed === 0,
      imported: result.created,
      skipped: result.skipped,
      failed: result.failed,
      message: `Imported ${result.created} account(s) from template.`,
      results: result.results,
    };
  }

  private async createAccount(companyId: string, input: CreateAccountInput) {
    if (!isValidAccountCode(input.code)) throw badRequest('Account Code must be exactly 10 digits.');

    const existing = await prisma.account.findFirst({
      where: { companyId, code: input.code, isDeleted: false },
      select: { id: true },
    });

    if (existing) throw badRequest(`Account Code ${input.code} already exists.`);

    const parentCode = getParentAccountCode(input.code);
    if (parentCode) {
      const parent = await prisma.account.findFirst({
        where: { companyId, code: parentCode, isDeleted: false },
        select: { id: true },
      });
      if (!parent) throw badRequest(`Parent Account ${parentCode} does not exist.`);
    }

    if (!input.is_posting && !isHeaderAccountCode(input.code)) {
      throw badRequest('Header Account Code must end with 0000.');
    }

    const created = await prisma.$transaction(async transaction => {
      const account = await transaction.account.create({
        data: {
          companyId,
          code: input.code,
          name: input.name,
          description: cleanText(input.description),
          accountType: input.account_type,
          normalBalance: input.normal_balance,
          isPosting: input.is_posting,
          isSystem: input.is_system,
          isActive: true,
          sortOrder: input.sort_order ?? 0,
          categoryId: input.category_id ?? null,
          openingBalance: input.opening_balance === undefined || input.opening_balance === null ? null : new Prisma.Decimal(input.opening_balance),
          openingBalanceDate: input.opening_balance_date ? new Date(input.opening_balance_date) : null,
        },
      });

      await transaction.accountAuditLog.create({
        data: {
          accountId: account.id,
          companyId,
          action: 'created',
        },
      });

      return account;
    });

    return accountToResponse(created);
  }

  private async countActiveChildren(companyId: string, parentCode: string) {
    const prefix = parentCode.slice(0, getAccountLevel(parentCode) * 2);
    const candidates = await prisma.account.findMany({
      where: {
        companyId,
        isDeleted: false,
        isActive: true,
        code: { startsWith: prefix },
        NOT: { code: parentCode },
      },
      select: { code: true },
    });

    return candidates.filter(account => getParentAccountCode(account.code) === parentCode).length;
  }

  private async getNextAvailableCode(companyId: string, parentCode: string, isPosting: boolean) {
    const range = getChildCodeRange(parentCode, isPosting);
    if (!range) return null;

    const prefix = parentCode.slice(0, getAccountLevel(parentCode) * 2);
    const children = await prisma.account.findMany({
      where: {
        companyId,
        isDeleted: false,
        code: { startsWith: prefix },
      },
      select: { code: true },
    });
    const taken = new Set(children.map(child => Number(child.code)));

    for (let code = range.rangeStart; code < range.rangeEnd; code += range.step) {
      if (!taken.has(code)) return String(code).padStart(10, '0');
    }

    return null;
  }
}
