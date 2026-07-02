import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const defaultPurchaseAccounts = {
  cash: {
    code: '0101100101',
    name: 'Cash In Hand',
    description: 'Default cash account used for cash purchases and cash sales.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 110101,
  },
  inventory: {
    code: '0101300301',
    name: 'Inventory Finished Goods',
    description: 'Default inventory account used for purchased stock.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 113003,
  },
  tax: {
    code: '0101400301',
    name: 'VAT Recoverable',
    description: 'Default recoverable purchase tax account.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 114003,
  },
  freight: {
    code: '0502100401',
    name: 'Freight And Delivery',
    description: 'Default freight account used on purchase invoices.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 521004,
  },
  discount: {
    code: '0502100501',
    name: 'Purchase Discount Received',
    description: 'Default account reserved for purchase discounts.',
    account_type: 'Expense',
    normal_balance: 'Credit',
    sort_order: 521005,
  },
} as const;

type TransactionClient = Prisma.TransactionClient;

type AccountRow = {
  id: string;
  code: string;
  name: string;
};

type PurchaseSettingsRow = {
  id: string;
  default_cash_account_id: string;
  default_inventory_account_id: string;
  purchase_tax_account_id: string | null;
  freight_account_id: string | null;
  purchase_discount_account_id: string | null;
};

export class PurchaseSupportService {
  constructor(private readonly companyId: string) {}

  private async ensureAccount(
    transaction: TransactionClient,
    account: typeof defaultPurchaseAccounts[keyof typeof defaultPurchaseAccounts],
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

    if (existing[0]) return existing[0];

    const rows = await transaction.$queryRaw<{ id: string; code: string; name: string }[]>`
      INSERT INTO inventory_warehouses (
        company_id, code, name, description, is_default, is_active, updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        'MAIN',
        'Main Warehouse',
        'Default warehouse for purchase receipts.',
        true,
        true,
        now()
      )
      ON CONFLICT (company_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        is_default = true,
        is_active = true,
        updated_at = now()
      RETURNING id, code, name
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

    const cash = await this.ensureAccount(transaction, defaultPurchaseAccounts.cash);
    const inventory = await this.ensureAccount(transaction, defaultPurchaseAccounts.inventory);
    const tax = await this.ensureAccount(transaction, defaultPurchaseAccounts.tax);
    const freight = await this.ensureAccount(transaction, defaultPurchaseAccounts.freight);
    const discount = await this.ensureAccount(transaction, defaultPurchaseAccounts.discount);

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

  async getSupportData() {
    return prisma.$transaction(async transaction => {
      const settings = await this.ensurePurchaseSettings(transaction);
      await this.ensureDefaultWarehouse(transaction);

      const suppliers = await transaction.$queryRaw`
        SELECT
          s.id,
          s.code,
          s.name,
          s.payment_terms_days,
          s.currency_code,
          s.ap_account_id,
          a.code AS account_code,
          a.name AS account_name
        FROM suppliers s
        LEFT JOIN accounts a ON a.id = s.ap_account_id AND a.company_id = s.company_id
        WHERE s.company_id = CAST(${this.companyId} AS uuid)
          AND s.is_active = true
        ORDER BY s.name ASC
        LIMIT 300
      `;

      const items = await transaction.$queryRaw`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.default_purchase_price, i.standard_cost, 0)::text AS purchase_price,
          COALESCE(i.import_tax_percent, 0)::text AS tax_rate,
          i.default_warehouse_id,
          COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(ss.stock_on_hand, 0)::text AS stock_on_hand
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id)
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
          AND i.is_purchase_item = true
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
          ps.*,
          cash.code AS default_cash_account_code,
          cash.name AS default_cash_account_name,
          inventory.code AS default_inventory_account_code,
          inventory.name AS default_inventory_account_name,
          tax.code AS purchase_tax_account_code,
          tax.name AS purchase_tax_account_name,
          freight.code AS freight_account_code,
          freight.name AS freight_account_name
        FROM purchase_settings ps
        JOIN accounts cash ON cash.id = ps.default_cash_account_id
        JOIN accounts inventory ON inventory.id = ps.default_inventory_account_id
        LEFT JOIN accounts tax ON tax.id = ps.purchase_tax_account_id
        LEFT JOIN accounts freight ON freight.id = ps.freight_account_id
        WHERE ps.company_id = CAST(${this.companyId} AS uuid)
        LIMIT 1
      `;

      return {
        suppliers,
        items,
        warehouses,
        locations,
        settings: Array.isArray(settingsAccounts) ? settingsAccounts[0] ?? settings : settings,
      };
    });
  }
}
