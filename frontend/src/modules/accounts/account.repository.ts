import { Repository, FindOptionsWhere, In } from 'typeorm';
import { Account } from './account.entity';
import { BaseRepository } from '@/db/base.repository';
import {
  getDescendantCodeRange,
  getParentAccountCode,
  isTopLevelAccountCode,
} from './account-code';

/**
 * Account Repository
 * Handles all account data access with company scoping
 * Implements hierarchical code-based lookups (no JOINs)
 */
export class AccountRepository extends BaseRepository<Account> {
  constructor(repository: Repository<Account>) {
    super(repository);
  }

  /**
   * Return all MM00000000 top-level category accounts for the company.
   * Used by the account creation wizard Step 1.
   */
  async findTopLevel(): Promise<Account[]> {
    if (!this.companyId) throw new Error('Company ID not set on repository');
    return this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('CAST(account.code AS BIGINT) % 100000000 = 0')
      .andWhere('account.is_deleted = false')
      .andWhere('account.is_active = true')
      .orderBy('account.code', 'ASC')
      .getMany();
  }

  /**
   * Find account by exact 10-digit code, scoped to current company.
   */
  async findByCode(code: string): Promise<Account | null> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.findOne({
      where: {
        company_id: this.companyId as any,
        code,
        is_deleted: false as any,
      } as FindOptionsWhere<Account>,
    });
  }

  /**
   * Find all accounts matching a code prefix
   * Example: "10" returns all accounts in current assets group
   * Useful for hierarchical navigation
   */
  async findByCodePrefix(prefix: string): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const query = this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('account.code LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('account.is_deleted = false');

    return query.getMany();
  }

  /**
   * Get all direct children of a parent account.
   *
   * In the 10-digit system every code is the same length, so children are
   * identified by their parent code matching what getParentCode() returns for them.
   * We fetch all accounts in the numeric range of the parent and filter in JS.
   */
  async findChildren(parentCode: string): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const range = getDescendantCodeRange(parentCode);
    if (!range) return [];

    const allInRange = await this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('CAST(account.code AS BIGINT) > :min', { min: Number(parentCode) })
      .andWhere('CAST(account.code AS BIGINT) < :max', { max: range.rangeEnd })
      .andWhere('account.is_deleted = false')
      .orderBy('account.code', 'ASC')
      .getMany();

    // Keep only direct children (those whose getParentCode === parentCode)
    return allInRange.filter(a => this.getParentCode(a.code) === parentCode);
  }

  /**
   * Get parent account code using the 10-digit numeric hierarchy.
   *
   * All codes are exactly 10 digits and use MM GG SS PPPP blocks.
   *
   * No database lookup — pure arithmetic.
   */
  getParentCode(code: string): string | null {
    return getParentAccountCode(code);
  }

  /**
   * Get account hierarchy (parent and all ancestors)
   * Returns accounts from parent level up to category
   */
  async findHierarchy(code: string): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const codes: string[] = [];
    let current = code;

    while (current) {
      codes.push(current);
      current = this.getParentCode(current) || '';
      if (!current) break;
    }

    const query = this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('account.code IN (:...codes)', { codes })
      .andWhere('account.is_deleted = false')
      .orderBy('account.code', 'ASC')
      .addOrderBy('account.code', 'ASC');

    return query.getMany();
  }

  /**
   * Get all posting accounts (where is_posting = true)
   * These are the only accounts that can receive journal entries
   */
  async findPostingAccounts(): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const query = this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('account.is_posting = true')
      .andWhere('account.is_active = true')
      .andWhere('account.is_deleted = false')
      .orderBy('account.code', 'ASC');

    return query.getMany();
  }

  /**
   * Get all active accounts (is_active = true)
   */
  async findActiveAccounts(): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const query = this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('account.is_active = true')
      .andWhere('account.is_deleted = false')
      .orderBy('account.code', 'ASC');

    return query.getMany();
  }

  /**
   * Find accounts by type (Asset, Liability, etc.)
   */
  async findByType(accountType: string): Promise<Account[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const query = this.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: this.companyId })
      .andWhere('account.account_type = :accountType', { accountType })
      .andWhere('account.is_deleted = false')
      .orderBy('account.code', 'ASC');

    return query.getMany();
  }

  /**
   * Build full account tree for UI rendering
   */
  async buildAccountTree(): Promise<AccountTreeNode[]> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const allAccounts = await this.findActiveAccounts();

    // Build tree structure
    const tree: AccountTreeNode[] = [];
    const nodeMap = new Map<string, AccountTreeNode>();

    // Create nodes for all accounts
    for (const account of allAccounts) {
      const node: AccountTreeNode = {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.account_type,
        isPosting: account.is_posting,
        children: [],
      };
      nodeMap.set(account.code, node);
    }

    // Link parent-child relationships
    for (const account of allAccounts) {
      const parentCode = this.getParentCode(account.code);
      if (parentCode && nodeMap.has(parentCode)) {
        nodeMap.get(parentCode)!.children.push(nodeMap.get(account.code)!);
      } else if (!parentCode || isTopLevelAccountCode(account.code)) {
        tree.push(nodeMap.get(account.code)!);
      }
    }

    return tree;
  }

  /**
   * Check if account can be deactivated
   * System accounts cannot be deactivated
   * Accounts with active children cannot be deactivated
   */
  async canDeactivate(id: string): Promise<{ canDeactivate: boolean; reason?: string }> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    const account = await this.findOneById(id);
    if (!account) {
      return { canDeactivate: false, reason: 'Account not found' };
    }

    if (account.is_system) {
      return { canDeactivate: false, reason: 'System accounts cannot be deactivated' };
    }

    const children = await this.findChildren(account.code);
    const activeChildren = children.filter(c => c.is_active && !c.is_deleted);

    if (activeChildren.length > 0) {
      return {
        canDeactivate: false,
        reason: `Cannot deactivate account with ${activeChildren.length} active child account(s)`,
      };
    }

    return { canDeactivate: true };
  }

  /**
   * Count accounts by type
   */
  async countByType(accountType: string): Promise<number> {
    if (!this.companyId) {
      throw new Error('Company ID not set on repository');
    }

    return this.count({
      where: {
        company_id: this.companyId as any,
        account_type: accountType as any,
        is_deleted: false as any,
      } as FindOptionsWhere<Account>,
    });
  }
}

/**
 * Account Tree Node for UI rendering
 */
export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isPosting: boolean;
  children: AccountTreeNode[];
}
