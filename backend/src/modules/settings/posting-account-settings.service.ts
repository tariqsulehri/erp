import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

type TransactionClient = Prisma.TransactionClient;
type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';

interface AccountSpec {
  code: string;
  name: string;
  description: string;
  account_type: AccountType;
  normal_balance: 'Debit' | 'Credit';
  sort_order: number;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
  account_type: AccountType;
}

interface PurchaseSettingsRow {
  id: string;
  default_cash_account_id: string;
  default_inventory_account_id: string;
  purchase_tax_account_id: string | null;
  freight_account_id: string | null;
  purchase_discount_account_id: string | null;
}

interface SaleSettingsRow {
  id: string;
  default_cash_account_id: string;
  default_inventory_account_id: string;
  sales_revenue_account_id: string;
  sales_tax_account_id: string | null;
  sales_discount_account_id: string | null;
  freight_income_account_id: string | null;
  cost_of_goods_sold_account_id: string;
}

interface StockAdjustmentSettingsRow {
  id: string;
  default_inventory_account_id: string;
  adjustment_gain_account_id: string;
  adjustment_loss_account_id: string;
}

export interface UpdatePostingAccountSettingsInput {
  purchase?: Partial<{
    default_cash_account_id: string;
    default_inventory_account_id: string;
    purchase_tax_account_id: string | null;
    freight_account_id: string | null;
    purchase_discount_account_id: string | null;
  }>;
  sale?: Partial<{
    default_cash_account_id: string;
    default_inventory_account_id: string;
    sales_revenue_account_id: string;
    sales_tax_account_id: string | null;
    sales_discount_account_id: string | null;
    freight_income_account_id: string | null;
    cost_of_goods_sold_account_id: string;
  }>;
  stock_adjustment?: Partial<{
    default_inventory_account_id: string;
    adjustment_gain_account_id: string;
    adjustment_loss_account_id: string;
  }>;
}

const defaultAccounts = {
  cash: {
    code: '0101100101',
    name: 'Cash In Hand',
    description: 'Default cash account used for cash purchase and sale posting.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 110101,
  },
  inventory: {
    code: '0101300301',
    name: 'Inventory Finished Goods',
    description: 'Default inventory account used for stock value posting.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 113003,
  },
  purchaseTax: {
    code: '0101400301',
    name: 'VAT Recoverable',
    description: 'Default recoverable tax account used for purchases.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 114003,
  },
  salesTax: {
    code: '0201300101',
    name: 'Sales Tax Payable',
    description: 'Default payable tax account used for sales.',
    account_type: 'Liability',
    normal_balance: 'Credit',
    sort_order: 213001,
  },
  salesRevenue: {
    code: '0401100101',
    name: 'Sales Revenue',
    description: 'Default sales revenue account.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 411001,
  },
  freightIncome: {
    code: '0401200101',
    name: 'Freight Income',
    description: 'Default income account for freight charged to customers.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 412001,
  },
  adjustmentGain: {
    code: '0401300101',
    name: 'Stock Adjustment Gain',
    description: 'Default income account used when stock adjustment increases inventory value.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 413001,
  },
  costOfGoodsSold: {
    code: '0501100101',
    name: 'Cost Of Goods Sold',
    description: 'Default cost account used when stock is sold.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 511001,
  },
  freightExpense: {
    code: '0502100401',
    name: 'Freight And Delivery',
    description: 'Default freight account used on purchase invoices.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 521004,
  },
  purchaseDiscount: {
    code: '0502100501',
    name: 'Purchase Discount Received',
    description: 'Default account reserved for purchase discounts.',
    account_type: 'Expense',
    normal_balance: 'Credit',
    sort_order: 521005,
  },
  salesDiscount: {
    code: '0502200101',
    name: 'Sales Discount Allowed',
    description: 'Default account for discounts allowed on sales.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 522001,
  },
  adjustmentLoss: {
    code: '0502300101',
    name: 'Stock Adjustment Loss',
    description: 'Default expense account used when stock adjustment decreases inventory value.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 523001,
  },
} as const satisfies Record<string, AccountSpec>;

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function accountIdOrNull(value: string | null | undefined) {
  return value?.trim() || null;
}

function typeText(types: AccountType[]) {
  return types.length === 1 ? types[0] : types.join(' or ');
}

function categoryText(prefixes: readonly string[]) {
  return prefixes.length === 1 ? prefixes[0] : prefixes.join(', ');
}

const postingAccountCodeCategories = {
  cash: ['010110'],
  inventory: ['010130'],
  purchaseTax: ['010140'],
  salesTax: ['020130'],
  salesRevenue: ['040110'],
  freightIncome: ['040120'],
  adjustmentGain: ['040130'],
  costOfGoodsSold: ['050110'],
  purchaseExpense: ['050210'],
  salesDiscount: ['050220'],
  adjustmentLoss: ['050230'],
} as const;

export class PostingAccountSettingsService {
  constructor(private readonly companyId: string) {}

  async get() {
    return prisma.$transaction(async transaction => {
      await this.ensurePurchaseSettings(transaction);
      await this.ensureSaleSettings(transaction);
      await this.ensureStockAdjustmentSettings(transaction);
      return this.getSettingsSnapshot(transaction);
    });
  }

  async update(input: UpdatePostingAccountSettingsInput) {
    return prisma.$transaction(async transaction => {
      const [purchase, sale, stockAdjustment] = await Promise.all([
        this.ensurePurchaseSettings(transaction),
        this.ensureSaleSettings(transaction),
        this.ensureStockAdjustmentSettings(transaction),
      ]);

      if (input.purchase) await this.updatePurchaseSettings(transaction, purchase, input.purchase);
      if (input.sale) await this.updateSaleSettings(transaction, sale, input.sale);
      if (input.stock_adjustment) await this.updateStockAdjustmentSettings(transaction, stockAdjustment, input.stock_adjustment);

      return this.getSettingsSnapshot(transaction);
    });
  }

  private async ensureAccount(transaction: TransactionClient, account: AccountSpec) {
    const rows = await transaction.$queryRaw<AccountRow[]>`
      INSERT INTO accounts (
        company_id, code, name, description, account_type, normal_balance,
        is_posting, is_system, is_active, sort_order, is_deleted, updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        ${account.code},
        ${account.name},
        ${account.description},
        ${account.account_type},
        ${account.normal_balance},
        true,
        true,
        true,
        ${account.sort_order},
        false,
        now()
      )
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        description = COALESCE(accounts.description, EXCLUDED.description),
        account_type = EXCLUDED.account_type,
        normal_balance = EXCLUDED.normal_balance,
        is_posting = true,
        is_active = true,
        is_deleted = false,
        deleted_at = null,
        deleted_by_user_id = null,
        updated_at = now()
      RETURNING id, code, name, account_type
    `;
    return rows[0];
  }

  private async ensurePurchaseSettings(transaction: TransactionClient): Promise<PurchaseSettingsRow> {
    const existing = await transaction.$queryRaw<PurchaseSettingsRow[]>`
      SELECT *
      FROM purchase_settings
      WHERE company_id = CAST(${this.companyId} AS uuid)
      LIMIT 1
    `;
    if (existing[0]) return existing[0];

    const cash = await this.ensureAccount(transaction, defaultAccounts.cash);
    const inventory = await this.ensureAccount(transaction, defaultAccounts.inventory);
    const tax = await this.ensureAccount(transaction, defaultAccounts.purchaseTax);
    const freight = await this.ensureAccount(transaction, defaultAccounts.freightExpense);
    const discount = await this.ensureAccount(transaction, defaultAccounts.purchaseDiscount);

    const rows = await transaction.$queryRaw<PurchaseSettingsRow[]>`
      INSERT INTO purchase_settings (
        company_id,
        default_cash_account_id,
        default_inventory_account_id,
        purchase_tax_account_id,
        freight_account_id,
        purchase_discount_account_id,
        is_active,
        updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        CAST(${cash.id} AS uuid),
        CAST(${inventory.id} AS uuid),
        CAST(${tax.id} AS uuid),
        CAST(${freight.id} AS uuid),
        CAST(${discount.id} AS uuid),
        true,
        now()
      )
      ON CONFLICT (company_id) DO UPDATE SET
        default_cash_account_id = EXCLUDED.default_cash_account_id,
        default_inventory_account_id = EXCLUDED.default_inventory_account_id,
        purchase_tax_account_id = EXCLUDED.purchase_tax_account_id,
        freight_account_id = EXCLUDED.freight_account_id,
        purchase_discount_account_id = EXCLUDED.purchase_discount_account_id,
        is_active = true,
        updated_at = now()
      RETURNING *
    `;
    return rows[0];
  }

  private async ensureSaleSettings(transaction: TransactionClient): Promise<SaleSettingsRow> {
    const existing = await transaction.$queryRaw<SaleSettingsRow[]>`
      SELECT *
      FROM sale_settings
      WHERE company_id = CAST(${this.companyId} AS uuid)
      LIMIT 1
    `;
    if (existing[0]) return existing[0];

    const cash = await this.ensureAccount(transaction, defaultAccounts.cash);
    const inventory = await this.ensureAccount(transaction, defaultAccounts.inventory);
    const revenue = await this.ensureAccount(transaction, defaultAccounts.salesRevenue);
    const salesTax = await this.ensureAccount(transaction, defaultAccounts.salesTax);
    const salesDiscount = await this.ensureAccount(transaction, defaultAccounts.salesDiscount);
    const freightIncome = await this.ensureAccount(transaction, defaultAccounts.freightIncome);
    const costOfGoodsSold = await this.ensureAccount(transaction, defaultAccounts.costOfGoodsSold);

    const rows = await transaction.$queryRaw<SaleSettingsRow[]>`
      INSERT INTO sale_settings (
        company_id,
        default_cash_account_id,
        default_inventory_account_id,
        sales_revenue_account_id,
        sales_tax_account_id,
        sales_discount_account_id,
        freight_income_account_id,
        cost_of_goods_sold_account_id,
        is_active,
        updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        CAST(${cash.id} AS uuid),
        CAST(${inventory.id} AS uuid),
        CAST(${revenue.id} AS uuid),
        CAST(${salesTax.id} AS uuid),
        CAST(${salesDiscount.id} AS uuid),
        CAST(${freightIncome.id} AS uuid),
        CAST(${costOfGoodsSold.id} AS uuid),
        true,
        now()
      )
      ON CONFLICT (company_id) DO UPDATE SET
        default_cash_account_id = EXCLUDED.default_cash_account_id,
        default_inventory_account_id = EXCLUDED.default_inventory_account_id,
        sales_revenue_account_id = EXCLUDED.sales_revenue_account_id,
        sales_tax_account_id = EXCLUDED.sales_tax_account_id,
        sales_discount_account_id = EXCLUDED.sales_discount_account_id,
        freight_income_account_id = EXCLUDED.freight_income_account_id,
        cost_of_goods_sold_account_id = EXCLUDED.cost_of_goods_sold_account_id,
        is_active = true,
        updated_at = now()
      RETURNING *
    `;
    return rows[0];
  }

  private async ensureStockAdjustmentSettings(transaction: TransactionClient): Promise<StockAdjustmentSettingsRow> {
    const existing = await transaction.$queryRaw<StockAdjustmentSettingsRow[]>`
      SELECT *
      FROM stock_adjustment_settings
      WHERE company_id = CAST(${this.companyId} AS uuid)
      LIMIT 1
    `;
    if (existing[0]) return existing[0];

    const inventory = await this.ensureAccount(transaction, defaultAccounts.inventory);
    const gain = await this.ensureAccount(transaction, defaultAccounts.adjustmentGain);
    const loss = await this.ensureAccount(transaction, defaultAccounts.adjustmentLoss);

    const rows = await transaction.$queryRaw<StockAdjustmentSettingsRow[]>`
      INSERT INTO stock_adjustment_settings (
        company_id,
        default_inventory_account_id,
        adjustment_gain_account_id,
        adjustment_loss_account_id,
        is_active,
        updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        CAST(${inventory.id} AS uuid),
        CAST(${gain.id} AS uuid),
        CAST(${loss.id} AS uuid),
        true,
        now()
      )
      ON CONFLICT (company_id) DO UPDATE SET
        default_inventory_account_id = EXCLUDED.default_inventory_account_id,
        adjustment_gain_account_id = EXCLUDED.adjustment_gain_account_id,
        adjustment_loss_account_id = EXCLUDED.adjustment_loss_account_id,
        is_active = true,
        updated_at = now()
      RETURNING *
    `;
    return rows[0];
  }

  private async updatePurchaseSettings(
    transaction: TransactionClient,
    current: PurchaseSettingsRow,
    input: NonNullable<UpdatePostingAccountSettingsInput['purchase']>,
  ) {
    const cashAccountId = await this.resolveRequiredAccount(transaction, input.default_cash_account_id, current.default_cash_account_id, 'Purchase Cash Account', ['Asset'], postingAccountCodeCategories.cash);
    const inventoryAccountId = await this.resolveRequiredAccount(transaction, input.default_inventory_account_id, current.default_inventory_account_id, 'Purchase Inventory Account', ['Asset'], postingAccountCodeCategories.inventory);
    const taxAccountId = await this.resolveOptionalAccount(transaction, input.purchase_tax_account_id, current.purchase_tax_account_id, 'Purchase Tax Account', ['Asset'], postingAccountCodeCategories.purchaseTax);
    const freightAccountId = await this.resolveOptionalAccount(transaction, input.freight_account_id, current.freight_account_id, 'Purchase Freight Account', ['Expense'], postingAccountCodeCategories.purchaseExpense);
    const discountAccountId = await this.resolveOptionalAccount(transaction, input.purchase_discount_account_id, current.purchase_discount_account_id, 'Purchase Discount Account', ['Expense'], postingAccountCodeCategories.purchaseExpense);

    await transaction.$executeRaw`
      UPDATE purchase_settings
      SET
        default_cash_account_id = CAST(${cashAccountId} AS uuid),
        default_inventory_account_id = CAST(${inventoryAccountId} AS uuid),
        purchase_tax_account_id = ${taxAccountId ? Prisma.sql`CAST(${taxAccountId} AS uuid)` : Prisma.sql`NULL`},
        freight_account_id = ${freightAccountId ? Prisma.sql`CAST(${freightAccountId} AS uuid)` : Prisma.sql`NULL`},
        purchase_discount_account_id = ${discountAccountId ? Prisma.sql`CAST(${discountAccountId} AS uuid)` : Prisma.sql`NULL`},
        is_active = true,
        updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
    `;
  }

  private async updateSaleSettings(
    transaction: TransactionClient,
    current: SaleSettingsRow,
    input: NonNullable<UpdatePostingAccountSettingsInput['sale']>,
  ) {
    const cashAccountId = await this.resolveRequiredAccount(transaction, input.default_cash_account_id, current.default_cash_account_id, 'Sales Cash Account', ['Asset'], postingAccountCodeCategories.cash);
    const inventoryAccountId = await this.resolveRequiredAccount(transaction, input.default_inventory_account_id, current.default_inventory_account_id, 'Sales Inventory Account', ['Asset'], postingAccountCodeCategories.inventory);
    const revenueAccountId = await this.resolveRequiredAccount(transaction, input.sales_revenue_account_id, current.sales_revenue_account_id, 'Sales Revenue Account', ['Revenue'], postingAccountCodeCategories.salesRevenue);
    const taxAccountId = await this.resolveOptionalAccount(transaction, input.sales_tax_account_id, current.sales_tax_account_id, 'Sales Tax Account', ['Liability'], postingAccountCodeCategories.salesTax);
    const discountAccountId = await this.resolveOptionalAccount(transaction, input.sales_discount_account_id, current.sales_discount_account_id, 'Sales Discount Account', ['Expense'], postingAccountCodeCategories.salesDiscount);
    const freightAccountId = await this.resolveOptionalAccount(transaction, input.freight_income_account_id, current.freight_income_account_id, 'Freight Income Account', ['Revenue'], postingAccountCodeCategories.freightIncome);
    const costOfGoodsSoldAccountId = await this.resolveRequiredAccount(transaction, input.cost_of_goods_sold_account_id, current.cost_of_goods_sold_account_id, 'Cost Of Goods Sold Account', ['Expense'], postingAccountCodeCategories.costOfGoodsSold);

    await transaction.$executeRaw`
      UPDATE sale_settings
      SET
        default_cash_account_id = CAST(${cashAccountId} AS uuid),
        default_inventory_account_id = CAST(${inventoryAccountId} AS uuid),
        sales_revenue_account_id = CAST(${revenueAccountId} AS uuid),
        sales_tax_account_id = ${taxAccountId ? Prisma.sql`CAST(${taxAccountId} AS uuid)` : Prisma.sql`NULL`},
        sales_discount_account_id = ${discountAccountId ? Prisma.sql`CAST(${discountAccountId} AS uuid)` : Prisma.sql`NULL`},
        freight_income_account_id = ${freightAccountId ? Prisma.sql`CAST(${freightAccountId} AS uuid)` : Prisma.sql`NULL`},
        cost_of_goods_sold_account_id = CAST(${costOfGoodsSoldAccountId} AS uuid),
        is_active = true,
        updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
    `;
  }

  private async updateStockAdjustmentSettings(
    transaction: TransactionClient,
    current: StockAdjustmentSettingsRow,
    input: NonNullable<UpdatePostingAccountSettingsInput['stock_adjustment']>,
  ) {
    const inventoryAccountId = await this.resolveRequiredAccount(transaction, input.default_inventory_account_id, current.default_inventory_account_id, 'Stock Adjustment Inventory Account', ['Asset'], postingAccountCodeCategories.inventory);
    const gainAccountId = await this.resolveRequiredAccount(transaction, input.adjustment_gain_account_id, current.adjustment_gain_account_id, 'Stock Adjustment Gain Account', ['Revenue'], postingAccountCodeCategories.adjustmentGain);
    const lossAccountId = await this.resolveRequiredAccount(transaction, input.adjustment_loss_account_id, current.adjustment_loss_account_id, 'Stock Adjustment Loss Account', ['Expense'], postingAccountCodeCategories.adjustmentLoss);

    await transaction.$executeRaw`
      UPDATE stock_adjustment_settings
      SET
        default_inventory_account_id = CAST(${inventoryAccountId} AS uuid),
        adjustment_gain_account_id = CAST(${gainAccountId} AS uuid),
        adjustment_loss_account_id = CAST(${lossAccountId} AS uuid),
        is_active = true,
        updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
    `;
  }

  private async resolveRequiredAccount(
    transaction: TransactionClient,
    inputAccountId: string | undefined,
    currentAccountId: string,
    label: string,
    expectedTypes: AccountType[],
    accountCodePrefixes: readonly string[],
  ) {
    const accountId = accountIdOrNull(inputAccountId) ?? currentAccountId;
    await this.validateAccount(transaction, accountId, label, expectedTypes, accountCodePrefixes);
    return accountId;
  }

  private async resolveOptionalAccount(
    transaction: TransactionClient,
    inputAccountId: string | null | undefined,
    currentAccountId: string | null,
    label: string,
    expectedTypes: AccountType[],
    accountCodePrefixes: readonly string[],
  ) {
    const accountId = inputAccountId === undefined ? currentAccountId : accountIdOrNull(inputAccountId);
    if (!accountId) return null;
    await this.validateAccount(transaction, accountId, label, expectedTypes, accountCodePrefixes);
    return accountId;
  }

  private async validateAccount(transaction: TransactionClient, accountId: string, label: string, expectedTypes: AccountType[], accountCodePrefixes: readonly string[]) {
    const rows = await transaction.$queryRaw<AccountRow[]>`
      SELECT id, code, name, account_type
      FROM accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${accountId} AS uuid)
        AND is_active = true
        AND is_posting = true
        AND is_deleted = false
      LIMIT 1
    `;
    const account = rows[0];
    if (!account) throw businessError(`${label} must be an active posting account.`);
    if (!expectedTypes.includes(account.account_type)) {
      throw businessError(`${label} must be an ${typeText(expectedTypes)} account. Selected account is ${account.account_type}.`);
    }
    if (!accountCodePrefixes.some(prefix => account.code.startsWith(prefix))) {
      throw businessError(`${label} must use account code category ${categoryText(accountCodePrefixes)}. Selected account code is ${account.code}.`);
    }
    return account;
  }

  private async getSettingsSnapshot(transaction: TransactionClient) {
    const [purchaseRows, saleRows, stockAdjustmentRows] = await Promise.all([
      transaction.$queryRaw`
        SELECT
          ps.*,
          cash.code AS default_cash_account_code,
          cash.name AS default_cash_account_name,
          inventory.code AS default_inventory_account_code,
          inventory.name AS default_inventory_account_name,
          tax.code AS purchase_tax_account_code,
          tax.name AS purchase_tax_account_name,
          freight.code AS freight_account_code,
          freight.name AS freight_account_name,
          discount.code AS purchase_discount_account_code,
          discount.name AS purchase_discount_account_name
        FROM purchase_settings ps
        JOIN accounts cash ON cash.id = ps.default_cash_account_id
        JOIN accounts inventory ON inventory.id = ps.default_inventory_account_id
        LEFT JOIN accounts tax ON tax.id = ps.purchase_tax_account_id
        LEFT JOIN accounts freight ON freight.id = ps.freight_account_id
        LEFT JOIN accounts discount ON discount.id = ps.purchase_discount_account_id
        WHERE ps.company_id = CAST(${this.companyId} AS uuid)
        LIMIT 1
      `,
      transaction.$queryRaw`
        SELECT
          ss.*,
          cash.code AS default_cash_account_code,
          cash.name AS default_cash_account_name,
          inventory.code AS default_inventory_account_code,
          inventory.name AS default_inventory_account_name,
          revenue.code AS sales_revenue_account_code,
          revenue.name AS sales_revenue_account_name,
          tax.code AS sales_tax_account_code,
          tax.name AS sales_tax_account_name,
          discount.code AS sales_discount_account_code,
          discount.name AS sales_discount_account_name,
          freight.code AS freight_income_account_code,
          freight.name AS freight_income_account_name,
          cogs.code AS cost_of_goods_sold_account_code,
          cogs.name AS cost_of_goods_sold_account_name
        FROM sale_settings ss
        JOIN accounts cash ON cash.id = ss.default_cash_account_id
        JOIN accounts inventory ON inventory.id = ss.default_inventory_account_id
        JOIN accounts revenue ON revenue.id = ss.sales_revenue_account_id
        JOIN accounts cogs ON cogs.id = ss.cost_of_goods_sold_account_id
        LEFT JOIN accounts tax ON tax.id = ss.sales_tax_account_id
        LEFT JOIN accounts discount ON discount.id = ss.sales_discount_account_id
        LEFT JOIN accounts freight ON freight.id = ss.freight_income_account_id
        WHERE ss.company_id = CAST(${this.companyId} AS uuid)
        LIMIT 1
      `,
      transaction.$queryRaw`
        SELECT
          sas.*,
          inventory.code AS default_inventory_account_code,
          inventory.name AS default_inventory_account_name,
          gain.code AS adjustment_gain_account_code,
          gain.name AS adjustment_gain_account_name,
          loss.code AS adjustment_loss_account_code,
          loss.name AS adjustment_loss_account_name
        FROM stock_adjustment_settings sas
        JOIN accounts inventory ON inventory.id = sas.default_inventory_account_id
        JOIN accounts gain ON gain.id = sas.adjustment_gain_account_id
        JOIN accounts loss ON loss.id = sas.adjustment_loss_account_id
        WHERE sas.company_id = CAST(${this.companyId} AS uuid)
        LIMIT 1
      `,
    ]);

    return {
      purchase: Array.isArray(purchaseRows) ? purchaseRows[0] ?? null : null,
      sale: Array.isArray(saleRows) ? saleRows[0] ?? null : null,
      stock_adjustment: Array.isArray(stockAdjustmentRows) ? stockAdjustmentRows[0] ?? null : null,
    };
  }
}
