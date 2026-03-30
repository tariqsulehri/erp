import { AppDataSource } from '@/db/data-source';
import { Account, AccountCategory } from './account.entity';
import { AccountAuditLog } from './account-audit.entity';
import { AccountRepository, AccountTreeNode } from './account.repository';
import { CreateAccountInput, UpdateAccountInput } from './account.schema';

/**
 * Account Service
 * Core business logic for Chart of Accounts management
 * Handles validation, hierarchy, and multi-company scoping
 */
export class AccountService {
  private accountRepo: AccountRepository;
  private categoryRepo: ReturnType<typeof AppDataSource.getRepository<AccountCategory>>;
  private auditRepo:    ReturnType<typeof AppDataSource.getRepository<AccountAuditLog>>;
  private companyId:    string;

  constructor(companyId: string) {
    this.companyId    = companyId;
    this.accountRepo  = new AccountRepository(AppDataSource.getRepository(Account));
    this.accountRepo.setCompanyId(companyId);
    this.categoryRepo = AppDataSource.getRepository(AccountCategory);
    this.auditRepo    = AppDataSource.getRepository(AccountAuditLog);
  }

  /** Write an immutable audit log entry. Fire-and-forget; never throws. */
  private async audit(
    accountId: string,
    action:    string,
    changes?:  Record<string, { from: unknown; to: unknown }>,
    userEmail?: string,
  ): Promise<void> {
    try {
      await this.auditRepo.save({
        account_id: accountId,
        company_id: this.companyId,
        changed_by: userEmail,
        action,
        changes,
      });
    } catch {
      // Audit failure must never break the main operation
    }
  }

  /**
   * Create a new account
   * Validates code format, uniqueness, hierarchy, and deactivation rules
   */
  async createAccount(data: CreateAccountInput): Promise<Account> {
    // Validate code format (exactly 4 digits)
    if (!/^\d{4}$/.test(data.code)) {
      throw new Error('Account code must be exactly 4 digits');
    }

    // Check code uniqueness in company
    const exists = await this.accountRepo.findByCode(data.code);
    if (exists) {
      throw new Error(`Account code ${data.code} already exists in this company`);
    }

    // Validate parent account exists (if not a category level)
    if (data.code.length > 1) {
      const parentCode = this.accountRepo.getParentCode(data.code);
      if (parentCode) {
        const parent = await this.accountRepo.findByCode(parentCode);
        if (!parent) {
          throw new Error(`Parent account ${parentCode} does not exist`);
        }
      }
    }

    // Create account
    const account = await this.accountRepo.createEntity({
      ...data,
      is_active:            true,
      opening_balance:      data.opening_balance,
      opening_balance_date: data.opening_balance_date
        ? new Date(data.opening_balance_date)
        : undefined,
    });

    await this.audit(account.id, 'created');
    return account;
  }

  /**
   * Update an existing account
   * Cannot change code, type, or balance after creation
   * Cannot deactivate system accounts
   */
  async updateAccount(id: string, data: UpdateAccountInput): Promise<Account> {
    const account = await this.accountRepo.findOneById(id);
    if (!account) {
      throw new Error('Account not found');
    }

    // System accounts cannot be modified
    if (account.is_system && data.is_active === false) {
      throw new Error('System accounts cannot be deactivated');
    }

    // Check if can deactivate
    if (data.is_active === false && account.is_active) {
      const { canDeactivate, reason } = await this.accountRepo.canDeactivate(id);
      if (!canDeactivate) {
        throw new Error(reason || 'Cannot deactivate this account');
      }
    }

    // Update only allowed fields — track field-level diff for audit
    const updates: Partial<Account> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (data.name !== undefined && data.name !== account.name) {
      changes.name = { from: account.name, to: data.name };
      updates.name = data.name;
    }
    if (data.description !== undefined && data.description !== account.description) {
      changes.description = { from: account.description, to: data.description };
      updates.description = data.description;
    }
    if (data.is_active !== undefined && data.is_active !== account.is_active) {
      changes.is_active = { from: account.is_active, to: data.is_active };
      updates.is_active = data.is_active;
    }
    if (data.sort_order !== undefined) updates.sort_order = data.sort_order;
    if (data.opening_balance !== undefined) {
      changes.opening_balance = { from: account.opening_balance, to: data.opening_balance };
      updates.opening_balance = data.opening_balance;
    }
    if (data.opening_balance_date !== undefined) {
      const dateVal = data.opening_balance_date ? new Date(data.opening_balance_date) : undefined;
      updates.opening_balance_date = dateVal;
    }

    await this.accountRepo.update({ id } as any, updates as any);

    const updated = await this.accountRepo.findOneById(id);
    if (!updated) throw new Error('Failed to update account');

    const action = changes.is_active !== undefined
      ? (data.is_active ? 'activated' : 'deactivated')
      : 'updated';
    if (Object.keys(changes).length > 0) {
      await this.audit(id, action, changes);
    }

    return updated;
  }

  /**
   * Deactivate (soft delete) an account
   */
  async deactivateAccount(id: string): Promise<void> {
    const account = await this.accountRepo.findOneById(id);
    if (!account) {
      throw new Error('Account not found');
    }

    if (account.is_system) {
      throw new Error('System accounts cannot be deactivated');
    }

    const { canDeactivate, reason } = await this.accountRepo.canDeactivate(id);
    if (!canDeactivate) {
      throw new Error(reason);
    }

    await this.accountRepo.markAsDeleted(id);
    await this.audit(id, 'deactivated', { is_active: { from: true, to: false } });
  }

  /**
   * Get account by ID
   */
  async getAccountById(id: string): Promise<Account | null> {
    return this.accountRepo.findOneById(id);
  }

  /**
   * Get account by code
   */
  async getAccountByCode(code: string): Promise<Account | null> {
    return this.accountRepo.findByCode(code);
  }

  /**
   * Get all accounts with pagination
   */
  async getAccounts(
    page: number = 1,
    limit: number = 20,
    filter?: { type?: string; is_active?: boolean; is_posting?: boolean; search?: string },
  ): Promise<{ data: Account[]; total: number; page: number; limit: number }> {
    let query = this.accountRepo.createQueryBuilder('account')
      .where('account.company_id = :companyId', { companyId: (this.accountRepo as any).companyId })
      .andWhere('account.is_deleted = false');

    if (filter?.search) {
      query = query.andWhere(
        '(account.code ILIKE :search OR account.name ILIKE :search)',
        { search: `%${filter.search}%` },
      );
    }

    if (filter?.type) {
      query = query.andWhere('account.account_type = :type', { type: filter.type });
    }

    if (filter?.is_active !== undefined) {
      query = query.andWhere('account.is_active = :is_active', { is_active: filter.is_active });
    }

    if (filter?.is_posting !== undefined) {
      query = query.andWhere('account.is_posting = :is_posting', { is_posting: filter.is_posting });
    }

    query = query.orderBy('account.code', 'ASC');

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Bulk toggle active status for multiple accounts.
   * Skips system accounts silently.
   * Returns count of accounts actually updated.
   */
  async bulkSetActive(ids: string[], isActive: boolean): Promise<number> {
    let updated = 0;
    for (const id of ids) {
      const account = await this.accountRepo.findOneById(id);
      if (!account || account.is_system) continue;
      if (account.is_active === isActive) continue;

      if (!isActive) {
        const { canDeactivate } = await this.accountRepo.canDeactivate(id);
        if (!canDeactivate) continue;
      }

      await this.accountRepo.update({ id } as any, { is_active: isActive } as any);
      updated++;
    }
    return updated;
  }

  /**
   * Get all posting accounts (for voucher entry)
   */
  async getPostingAccounts(): Promise<Account[]> {
    return this.accountRepo.findPostingAccounts();
  }

  /**
   * Get account hierarchy (full tree)
   */
  async getHierarchy(): Promise<AccountTreeNode[]> {
    return this.accountRepo.buildAccountTree();
  }

  /**
   * Get parent and all ancestors of an account
   */
  async getAccountHierarchy(code: string): Promise<Account[]> {
    return this.accountRepo.findHierarchy(code);
  }

  /**
   * Create a header (non-posting) account at any hierarchy level: 1, 2, or 4 digits.
   *
   * Used internally by COATemplateService to auto-create parent accounts before
   * 8-digit posting accounts are inserted. Skips the 8-digit format check that
   * createAccount enforces for user-facing input.
   *
   * @param code           1, 2, or 4 digit account code
   * @param name           Display name for the header account
   * @param accountType    Inherited from the first child account
   * @param normalBalance  Inherited from the first child account
   */
  async createHeaderAccount(
    code: string,
    name: string,
    accountType: string,
    normalBalance: 'Debit' | 'Credit',
  ): Promise<Account> {
    // All codes in the 4-digit system are exactly 4 digits; headers end in 0
    if (!/^\d{4}$/.test(code)) {
      throw new Error(`Header account code must be exactly 4 digits — got "${code}"`);
    }
    const num = parseInt(code, 10);
    if (num % 10 !== 0) {
      throw new Error(`Header account code must end in 0 (category/group/sub-group) — got "${code}"`);
    }

    // Idempotent: skip if already exists
    const existing = await this.accountRepo.findByCode(code);
    if (existing) return existing;

    // Validate parent exists (except for 1-digit category codes)
    if (code.length > 1) {
      const parentCode = this.accountRepo.getParentCode(code);
      if (parentCode) {
        const parent = await this.accountRepo.findByCode(parentCode);
        if (!parent) {
          throw new Error(`Parent account ${parentCode} does not exist`);
        }
      }
    }

    return this.accountRepo.createEntity({
      code,
      name,
      account_type: accountType as any,
      normal_balance: normalBalance,
      is_posting: false,   // Header accounts are never posting
      is_system: false,
      is_active: true,
      sort_order: 0,
    });
  }

  /**
   * Get all top-level category accounts (X000)
   * Used by the account creation wizard Step 1
   */
  async getTopLevelAccounts(): Promise<Account[]> {
    return this.accountRepo.findTopLevel();
  }

  /**
   * Get direct children of a parent account
   * Used by the account creation wizard Steps 2 and 3
   */
  async getChildAccounts(parentCode: string): Promise<Account[]> {
    return this.accountRepo.findChildren(parentCode);
  }

  /**
   * Get the next available code under a parent account.
   * Scans existing children and returns the first unused slot:
   *   Category (X000) → next Group (XX00)
   *   Group    (XX00) → next Sub-Group (XXX0)
   *   Sub-Group(XXX0) → next Posting Account (XXXX)
   * Returns null when the parent is full or is itself a posting account.
   */
  async getNextAvailableCode(parentCode: string): Promise<string | null> {
    const parentNum = parseInt(parentCode, 10);
    if (isNaN(parentNum)) return null;

    let rangeStart: number;
    let rangeEnd: number;
    let step: number;

    if (parentNum % 1000 === 0) {
      rangeStart = parentNum + 100;
      rangeEnd   = parentNum + 1000;
      step       = 100;
    } else if (parentNum % 100 === 0) {
      rangeStart = parentNum + 10;
      rangeEnd   = parentNum + 100;
      step       = 10;
    } else if (parentNum % 10 === 0) {
      rangeStart = parentNum + 1;
      rangeEnd   = parentNum + 10;
      step       = 1;
    } else {
      return null; // Posting accounts have no children
    }

    const children = await this.accountRepo.findChildren(parentCode);
    const taken = new Set(children.map(c => parseInt(c.code, 10)));

    for (let code = rangeStart; code < rangeEnd; code += step) {
      if (!taken.has(code)) {
        return String(code).padStart(4, '0');
      }
    }

    return null; // All slots taken
  }

  /**
   * Validate account code format
   */
  validateAccountCode(code: string): { valid: boolean; error?: string } {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Code must be a string' };
    }

    if (!/^\d{4}$/.test(code)) {
      return { valid: false, error: 'Code must be exactly 4 digits' };
    }

    return { valid: true };
  }

  /**
   * Clone an existing account into the next available slot under the same parent.
   * Copies account_type, normal_balance, is_posting, and description.
   * The caller provides a new name.
   */
  async cloneAccount(sourceId: string, newName: string): Promise<Account> {
    const source = await this.accountRepo.findOneById(sourceId);
    if (!source) throw new Error('Source account not found');

    const parentCode = this.accountRepo.getParentCode(source.code);
    if (!parentCode) throw new Error('Cannot clone a top-level category account');

    const nextCode = await this.getNextAvailableCode(parentCode);
    if (!nextCode) throw new Error('No available code slots under the same parent');

    const cloned = await this.createAccount({
      code:           nextCode,
      name:           newName,
      account_type:   source.account_type as any,
      normal_balance: source.normal_balance,
      is_posting:     source.is_posting,
      is_system:      false,
      description:    source.description,
    });

    await this.audit(cloned.id, 'cloned', { cloned_from: { from: null, to: source.code } });
    return cloned;
  }

  /**
   * Get audit history for an account (most recent first, max 100 entries).
   */
  async getAccountHistory(accountId: string): Promise<AccountAuditLog[]> {
    return this.auditRepo.find({
      where: { account_id: accountId, company_id: this.companyId },
      order: { created_at: 'DESC' },
      take:  100,
    });
  }

  /**
   * Bulk-create accounts from a user-provided list (e.g. CSV import).
   * Sorts by hierarchy level so parents are created before children.
   * Returns per-row results so the caller can display success/failure.
   */
  async bulkCreateAccounts(
    rows: Array<{
      code:           string;
      name:           string;
      account_type:   string;
      normal_balance: 'Debit' | 'Credit';
      is_posting:     boolean;
      description?:   string;
    }>,
  ): Promise<Array<{ code: string; success: boolean; message: string }>> {
    // Sort by level so parents always exist before children
    const levelOf = (code: string) => {
      const n = parseInt(code, 10);
      if (n % 1000 === 0) return 1;
      if (n % 100  === 0) return 2;
      if (n % 10   === 0) return 3;
      return 4;
    };
    const sorted = [...rows].sort((a, b) => levelOf(a.code) - levelOf(b.code) || a.code.localeCompare(b.code));

    const results: Array<{ code: string; success: boolean; message: string }> = [];

    for (const row of sorted) {
      try {
        const existing = await this.accountRepo.findByCode(row.code);
        if (existing) {
          results.push({ code: row.code, success: true, message: 'Already exists — skipped' });
          continue;
        }
        await this.createAccount({
          code:           row.code,
          name:           row.name,
          account_type:   row.account_type as any,
          normal_balance: row.normal_balance,
          is_posting:     row.is_posting,
          is_system:      false,
          description:    row.description,
        });
        results.push({ code: row.code, success: true, message: 'Created' });
      } catch (err) {
        results.push({ code: row.code, success: false, message: (err as Error).message });
      }
    }

    return results;
  }

  /**
   * Get account balance (calculated from GL)
   * This will be implemented after GL module is created
   * For now, return 0
   */
  async getAccountBalance(id: string, _periodEnd?: Date): Promise<number> {
    const account = await this.accountRepo.findOneById(id);
    if (!account) {
      throw new Error('Account not found');
    }

    // TODO: Calculate from GL when GL module is implemented
    // For now, return 0
    return 0;
  }

  /**
   * Check if a system account code is valid
   * System accounts are predefined and cannot be created by users
   */
  /**
   * Get category by code
   */
  async getCategoryByCode(code: string): Promise<AccountCategory | null> {
    return this.categoryRepo.findOne({ where: { category_code: code } });
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<AccountCategory[]> {
    return this.categoryRepo.find({ order: { sort_order: 'ASC' } });
  }
}
