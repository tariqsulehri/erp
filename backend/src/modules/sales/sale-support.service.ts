import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const defaultSaleAccounts = {
  cash: {
    code: '0101100101',
    name: 'Cash In Hand',
    description: 'Default cash account used for cash sales.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 110101,
  },
  inventory: {
    code: '0101300301',
    name: 'Inventory Finished Goods',
    description: 'Default inventory account used for sold stock.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 113003,
  },
  revenue: {
    code: '0401100101',
    name: 'Sales Revenue',
    description: 'Default sales revenue account.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 411001,
  },
  salesTax: {
    code: '0201300101',
    name: 'Sales Tax Payable',
    description: 'Default payable sales tax account.',
    account_type: 'Liability',
    normal_balance: 'Credit',
    sort_order: 213001,
  },
  salesDiscount: {
    code: '0502200101',
    name: 'Sales Discount Allowed',
    description: 'Default account for discounts allowed on sales.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 522001,
  },
  freightIncome: {
    code: '0401200101',
    name: 'Freight Income',
    description: 'Default income account for freight or delivery charges on sales.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 412001,
  },
  costOfGoodsSold: {
    code: '0501100101',
    name: 'Cost Of Goods Sold',
    description: 'Default cost account used when stock is sold.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 511001,
  },
} as const;

type TransactionClient = Prisma.TransactionClient;

type AccountRow = {
  id: string;
  code: string;
  name: string;
};

type SaleSettingsRow = {
  id: string;
  default_cash_account_id: string;
  default_inventory_account_id: string;
  sales_revenue_account_id: string;
  sales_tax_account_id: string | null;
  sales_discount_account_id: string | null;
  freight_income_account_id: string | null;
  cost_of_goods_sold_account_id: string;
};

export class SaleSupportService {
  constructor(private readonly companyId: string) {}

  private async ensureAccount(
    transaction: TransactionClient,
    account: typeof defaultSaleAccounts[keyof typeof defaultSaleAccounts],
  ): Promise<AccountRow> {
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
      RETURNING id, code, name
    `;

    return rows[0];
  }

  private async ensureDefaultWarehouse(transaction: TransactionClient) {
    const existing = await transaction.$queryRaw<{ id: string; code: string; name: string }[]>`
      SELECT id, code, name
      FROM inventory_warehouses
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND is_active = true
      ORDER BY is_default DESC, code ASC
      LIMIT 1
    `;
    return existing[0];
  }

  private async ensureSaleSettings(transaction: TransactionClient): Promise<SaleSettingsRow> {
    const existing = await transaction.$queryRaw<SaleSettingsRow[]>`
      SELECT *
      FROM sale_settings
      WHERE company_id = CAST(${this.companyId} AS uuid)
      LIMIT 1
    `;
    if (existing[0]) return existing[0];

    const cash = await this.ensureAccount(transaction, defaultSaleAccounts.cash);
    const inventory = await this.ensureAccount(transaction, defaultSaleAccounts.inventory);
    const revenue = await this.ensureAccount(transaction, defaultSaleAccounts.revenue);
    const salesTax = await this.ensureAccount(transaction, defaultSaleAccounts.salesTax);
    const salesDiscount = await this.ensureAccount(transaction, defaultSaleAccounts.salesDiscount);
    const freightIncome = await this.ensureAccount(transaction, defaultSaleAccounts.freightIncome);
    const costOfGoodsSold = await this.ensureAccount(transaction, defaultSaleAccounts.costOfGoodsSold);

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

  async getSupportData() {
    return prisma.$transaction(async transaction => {
      const settings = await this.ensureSaleSettings(transaction);
      await this.ensureDefaultWarehouse(transaction);

      const customers = await transaction.$queryRaw`
        SELECT
          c.id,
          c.code,
          c.name,
          c.payment_terms_days,
          c.currency_code,
          c.credit_limit::text,
          c.ar_account_id,
          a.code AS account_code,
          a.name AS account_name,
          COALESCE(balance.balance_amount, 0)::text AS current_balance
        FROM customers c
        LEFT JOIN accounts a ON a.id = c.ar_account_id AND a.company_id = c.company_id
        LEFT JOIN LATERAL (
          SELECT SUM(vl.dr_amount - vl.cr_amount) AS balance_amount
          FROM voucher_lines vl
          JOIN vouchers v ON v.id = vl.voucher_id
          WHERE vl.company_id = c.company_id
            AND vl.account_id = c.ar_account_id
            AND v.status = 'Posted'
        ) balance ON true
        WHERE c.company_id = CAST(${this.companyId} AS uuid)
          AND c.is_active = true
        ORDER BY c.name ASC
        LIMIT 300
      `;

      const items = await transaction.$queryRaw`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.default_sales_price, i.wholesale_price, i.standard_cost, 0)::text AS sale_price,
          COALESCE(i.import_tax_percent, 0)::text AS tax_rate,
          i.default_warehouse_id,
          COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(ss.stock_on_hand, 0)::text AS stock_on_hand
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id)
        LEFT JOIN LATERAL (
          SELECT SUM(stock_on_hand) AS stock_on_hand
          FROM inventory_stock_balances
          WHERE company_id = i.company_id
            AND item_id = i.id
            AND is_active = true
        ) ss ON true
        WHERE i.company_id = CAST(${this.companyId} AS uuid)
          AND i.is_active = true
          AND i.is_blocked = false
          AND i.is_sales_item = true
        ORDER BY i.item_name ASC
        LIMIT 500
      `;

      const warehouses = await transaction.$queryRaw`
        SELECT id, code, name, is_default, use_locations
        FROM inventory_warehouses
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY is_default DESC, code ASC
        LIMIT 100
      `;

      const locations = await transaction.$queryRaw`
        SELECT id, warehouse_id, code, name, is_default
        FROM inventory_warehouse_locations
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY warehouse_id ASC, is_default DESC, code ASC
        LIMIT 500
      `;

      const settingsAccounts = await transaction.$queryRaw`
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
      `;

      return {
        customers,
        items,
        warehouses,
        locations,
        settings: Array.isArray(settingsAccounts) ? settingsAccounts[0] ?? settings : settings,
      };
    });
  }
}
