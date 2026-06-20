import Decimal from 'decimal.js';
import { EntityManager } from 'typeorm';
import { AppDataSource } from '@/db/data-source';
import { FiscalYearService } from '@/modules/fiscal-year/fiscal-year.service';
import { CreatePurchaseInvoiceInput, ListPurchaseInvoicesQuery, PurchaseAnalyticsQuery } from './purchase.schema';

const PURCHASE_PREFIX = 'PI';

const DEFAULT_PURCHASE_ACCOUNTS = {
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

type SupplierRow = {
  id: string;
  code: string;
  name: string;
  payment_terms_days: number;
  ap_account_id: string | null;
  account_code: string | null;
  account_name: string | null;
};

type PurchaseLineForPost = {
  id: string;
  line_number: number;
  item_id: string;
  item_code: string;
  item_name: string;
  warehouse_id: string;
  quantity: string;
  purchase_price: string;
  discount_amount: string;
  tax_amount: string;
  line_total: string;
};

type PurchaseInvoiceForPost = {
  id: string;
  purchase_number: string;
  purchase_date: string | Date;
  supplier_id: string;
  supplier_account_id: string;
  payment_type: 'Cash' | 'Credit';
  status: 'Draft' | 'Posted' | 'Voided';
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  description: string | null;
  reference_number: string | null;
};

export class PurchaseService {
  constructor(private companyId: string) {}

  private safeUuid(id: string | undefined): string | undefined {
    if (!id) return undefined;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  }

  private toDate(value: string, label: string) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${label} is not valid.`);
    }
    return date;
  }

  private databaseDate(value: string | Date, label: string) {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    }

    const dateText = value.includes('T') ? value.slice(0, 10) : value;
    return this.toDate(dateText, label);
  }

  private databaseDateText(value: string | Date) {
    const date = this.databaseDate(value, 'Date');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private quantity(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private async assertDateInOpenPeriod(date: Date): Promise<void> {
    const fiscalYear = new FiscalYearService(this.companyId);
    const result = await fiscalYear.validatePostingDate(date);
    if (!result.canPost) {
      throw new Error(`Invalid Purchase Date: ${result.reason}`);
    }
  }

  private async ensureAccount(
    manager: EntityManager,
    account: typeof DEFAULT_PURCHASE_ACCOUNTS[keyof typeof DEFAULT_PURCHASE_ACCOUNTS],
  ): Promise<AccountRow> {
    const rows = await manager.query<AccountRow[]>(
      `
        INSERT INTO accounts (
          company_id, code, name, description, account_type, normal_balance,
          is_posting, is_system, is_active, sort_order, is_deleted, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, true, true, $7, false, now())
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
      `,
      [
        this.companyId,
        account.code,
        account.name,
        account.description,
        account.account_type,
        account.normal_balance,
        account.sort_order,
      ],
    );
    return rows[0];
  }

  private async ensureDefaultWarehouse(manager: EntityManager) {
    const existing = await manager.query<{ id: string; code: string; name: string }[]>(
      `
        SELECT id, code, name
        FROM inventory_warehouses
        WHERE company_id = $1
          AND is_active = true
        ORDER BY is_default DESC, code ASC
        LIMIT 1
      `,
      [this.companyId],
    );
    if (existing[0]) return existing[0];

    const rows = await manager.query<{ id: string; code: string; name: string }[]>(
      `
        INSERT INTO inventory_warehouses (
          company_id, code, name, description, is_default, is_active, updated_at
        )
        VALUES ($1, 'MAIN', 'Main Warehouse', 'Default warehouse for purchase receipts.', true, true, now())
        ON CONFLICT (company_id, code) DO UPDATE SET
          name = EXCLUDED.name,
          is_default = true,
          is_active = true,
          updated_at = now()
        RETURNING id, code, name
      `,
      [this.companyId],
    );
    return rows[0];
  }

  private async ensurePurchaseSettings(manager: EntityManager = AppDataSource.manager): Promise<PurchaseSettingsRow> {
    const existing = await manager.query<PurchaseSettingsRow[]>(
      `
        SELECT *
        FROM purchase_settings
        WHERE company_id = $1
        LIMIT 1
      `,
      [this.companyId],
    );
    if (existing[0]) return existing[0];

    const cash = await this.ensureAccount(manager, DEFAULT_PURCHASE_ACCOUNTS.cash);
    const inventory = await this.ensureAccount(manager, DEFAULT_PURCHASE_ACCOUNTS.inventory);
    const tax = await this.ensureAccount(manager, DEFAULT_PURCHASE_ACCOUNTS.tax);
    const freight = await this.ensureAccount(manager, DEFAULT_PURCHASE_ACCOUNTS.freight);
    const discount = await this.ensureAccount(manager, DEFAULT_PURCHASE_ACCOUNTS.discount);

    const rows = await manager.query<PurchaseSettingsRow[]>(
      `
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
        VALUES ($1, $2, $3, $4, $5, $6, true, now())
        ON CONFLICT (company_id) DO UPDATE SET
          default_cash_account_id = EXCLUDED.default_cash_account_id,
          default_inventory_account_id = EXCLUDED.default_inventory_account_id,
          purchase_tax_account_id = EXCLUDED.purchase_tax_account_id,
          freight_account_id = EXCLUDED.freight_account_id,
          purchase_discount_account_id = EXCLUDED.purchase_discount_account_id,
          is_active = true,
          updated_at = now()
        RETURNING *
      `,
      [this.companyId, cash.id, inventory.id, tax.id, freight.id, discount.id],
    );
    return rows[0];
  }

  private async nextPurchaseNumber(year: number, manager: EntityManager): Promise<string> {
    const prefix = `${PURCHASE_PREFIX}-${year}-`;
    const rows = await manager.query<{ purchase_number: string }[]>(
      `
        SELECT purchase_number
        FROM purchase_invoices
        WHERE company_id = $1
          AND purchase_number LIKE $2
        ORDER BY purchase_number DESC
        LIMIT 1
      `,
      [this.companyId, `${prefix}%`],
    );

    const last = rows[0]?.purchase_number;
    const next = last ? Number.parseInt(last.split('-').pop() ?? '0', 10) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private async getSupplier(manager: EntityManager, id: string): Promise<SupplierRow> {
    const rows = await manager.query<SupplierRow[]>(
      `
        SELECT
          s.id,
          s.code,
          s.name,
          s.payment_terms_days,
          s.ap_account_id,
          a.code AS account_code,
          a.name AS account_name
        FROM suppliers s
        LEFT JOIN accounts a ON a.id = s.ap_account_id AND a.company_id = s.company_id
        WHERE s.company_id = $1
          AND s.id = $2
          AND s.is_active = true
        LIMIT 1
      `,
      [this.companyId, id],
    );
    const supplier = rows[0];
    if (!supplier) throw new Error('Supplier was not found or is inactive.');
    if (!supplier.ap_account_id || !supplier.account_code) {
      throw new Error('Supplier Linked Account is missing. Please update the supplier before posting purchase.');
    }
    return supplier;
  }

  private async getAccount(manager: EntityManager, id: string, label: string): Promise<AccountRow> {
    const rows = await manager.query<AccountRow[]>(
      `
        SELECT id, code, name
        FROM accounts
        WHERE company_id = $1
          AND id = $2
          AND is_active = true
          AND is_posting = true
          AND is_deleted = false
        LIMIT 1
      `,
      [this.companyId, id],
    );
    if (!rows[0]) throw new Error(`${label} is not set or is inactive.`);
    return rows[0];
  }

  async getSupportData() {
    return AppDataSource.transaction(async manager => {
      const settings = await this.ensurePurchaseSettings(manager);
      await this.ensureDefaultWarehouse(manager);

      const suppliers = await manager.query(
        `
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
          WHERE s.company_id = $1
            AND s.is_active = true
          ORDER BY s.name ASC
          LIMIT 300
        `,
        [this.companyId],
      );

      const items = await manager.query(
        `
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
          WHERE i.company_id = $1
            AND i.is_active = true
            AND i.is_blocked = false
            AND i.is_purchase_item = true
          ORDER BY i.item_name ASC
          LIMIT 500
        `,
        [this.companyId],
      );

      const warehouses = await manager.query(
        `
          SELECT id, code, name, is_default
          FROM inventory_warehouses
          WHERE company_id = $1
            AND is_active = true
          ORDER BY is_default DESC, code ASC
          LIMIT 100
        `,
        [this.companyId],
      );

      const settingsAccounts = await manager.query(
        `
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
          WHERE ps.company_id = $1
          LIMIT 1
        `,
        [this.companyId],
      );

      return {
        suppliers,
        items,
        warehouses,
        settings: settingsAccounts[0] ?? settings,
      };
    });
  }

  async list(query: ListPurchaseInvoicesQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['pi.company_id = $1'];

    if (query.status) {
      params.push(query.status);
      where.push(`pi.status = $${params.length}`);
    }
    if (query.supplier_id) {
      params.push(query.supplier_id);
      where.push(`pi.supplier_id = $${params.length}`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`pi.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`pi.warehouse_id = $${params.length}`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`pi.purchase_date >= $${params.length}`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`pi.purchase_date <= $${params.length}`);
    }
    if (query.amount_from !== undefined) {
      params.push(query.amount_from);
      where.push(`pi.net_amount >= $${params.length}`);
    }
    if (query.amount_to !== undefined) {
      params.push(query.amount_to);
      where.push(`pi.net_amount <= $${params.length}`);
    }
    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      where.push(`(
        pi.purchase_number ILIKE $${params.length}
        OR COALESCE(pi.supplier_invoice_number, '') ILIKE $${params.length}
        OR COALESCE(pi.reference_number, '') ILIKE $${params.length}
        OR s.name ILIKE $${params.length}
        OR s.code ILIKE $${params.length}
        OR COALESCE(w.name, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await AppDataSource.query(
      `
        SELECT COUNT(*)::int AS total
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        WHERE ${whereSql}
      `,
      params,
    );

    params.push(query.limit);
    const limitParam = `$${params.length}`;
    params.push((query.page - 1) * query.limit);
    const offsetParam = `$${params.length}`;

    const data = await AppDataSource.query(
      `
        SELECT
          pi.id,
          pi.purchase_number,
          pi.purchase_date,
          pi.supplier_invoice_date,
          pi.due_date,
          pi.payment_type,
          pi.status,
          pi.gross_amount::text,
          pi.discount_amount::text,
          pi.tax_amount::text,
          pi.freight_amount::text,
          pi.net_amount::text,
          pi.reference_number,
          pi.posted_at,
          pi.created_at,
          pi.warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          s.id AS supplier_id,
          s.code AS supplier_code,
          s.name AS supplier_name,
          pi.supplier_invoice_number,
          COALESCE(line_counts.line_count, 0)::int AS line_count
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        LEFT JOIN (
          SELECT purchase_invoice_id, COUNT(*) AS line_count
          FROM purchase_invoice_lines
          WHERE company_id = $1
          GROUP BY purchase_invoice_id
        ) line_counts ON line_counts.purchase_invoice_id = pi.id
        WHERE ${whereSql}
        ORDER BY pi.purchase_date DESC, pi.purchase_number DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      params,
    );

    return {
      data,
      total: Number(countRows[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(Number(countRows[0]?.total ?? 0) / query.limit)),
    };
  }

  async analytics(query: PurchaseAnalyticsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['pi.company_id = $1', "pi.status = 'Posted'"];

    if (query.supplier_id) {
      params.push(query.supplier_id);
      where.push(`pi.supplier_id = $${params.length}`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`pi.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`pi.warehouse_id = $${params.length}`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`pi.purchase_date >= $${params.length}`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`pi.purchase_date <= $${params.length}`);
    }

    const whereSql = where.join(' AND ');

    const summaryRows = await AppDataSource.query(
      `
        SELECT
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(pi.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(pi.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(pi.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount,
          COALESCE(AVG(pi.net_amount), 0)::text AS average_invoice_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
      `,
      params,
    );

    const monthlyPurchases = await AppDataSource.query(
      `
        SELECT
          TO_CHAR(DATE_TRUNC('month', pi.purchase_date), 'YYYY-MM') AS month_key,
          TO_CHAR(DATE_TRUNC('month', pi.purchase_date), 'Mon YYYY') AS month_label,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(pi.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(pi.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(pi.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount,
          COALESCE(SUM(CASE WHEN pi.payment_type = 'Cash' THEN pi.net_amount ELSE 0 END), 0)::text AS cash_amount,
          COALESCE(SUM(CASE WHEN pi.payment_type = 'Credit' THEN pi.net_amount ELSE 0 END), 0)::text AS credit_amount,
          COALESCE(AVG(pi.net_amount), 0)::text AS average_invoice_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
        GROUP BY DATE_TRUNC('month', pi.purchase_date)
        ORDER BY DATE_TRUNC('month', pi.purchase_date)
      `,
      params,
    );

    const supplierSummary = await AppDataSource.query(
      `
        SELECT
          s.id AS supplier_id,
          s.code AS supplier_code,
          s.name AS supplier_name,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        WHERE ${whereSql}
        GROUP BY s.id, s.code, s.name
        ORDER BY COALESCE(SUM(pi.net_amount), 0) DESC, s.name ASC
        LIMIT 10
      `,
      params,
    );

    const warehouseSummary = await AppDataSource.query(
      `
        SELECT
          w.id AS warehouse_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        WHERE ${whereSql}
        GROUP BY w.id, w.code, w.name
        ORDER BY COALESCE(SUM(pi.net_amount), 0) DESC, w.code ASC
      `,
      params,
    );

    const paymentTypeSummary = await AppDataSource.query(
      `
        SELECT
          pi.payment_type,
          COUNT(*)::int AS purchase_count,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        WHERE ${whereSql}
        GROUP BY pi.payment_type
        ORDER BY pi.payment_type ASC
      `,
      params,
    );

    return {
      summary: summaryRows[0] ?? {
        purchase_count: 0,
        gross_amount: '0',
        discount_amount: '0',
        tax_amount: '0',
        freight_amount: '0',
        net_amount: '0',
        average_invoice_amount: '0',
      },
      monthlyPurchases,
      supplierSummary,
      warehouseSummary,
      paymentTypeSummary,
    };
  }

  async createDraft(input: CreatePurchaseInvoiceInput, userId: string) {
    return this.create(input, userId, false);
  }

  async createAndPost(input: CreatePurchaseInvoiceInput, userId: string) {
    return this.create(input, userId, true);
  }

  private async create(input: CreatePurchaseInvoiceInput, userId: string, postNow: boolean) {
    const purchaseDate = this.toDate(input.purchase_date, 'Purchase Date');
    const supplierInvoiceDate = input.supplier_invoice_date
      ? this.toDate(input.supplier_invoice_date, 'Supplier Invoice Date')
      : null;
    const dueDate = input.due_date ? this.toDate(input.due_date, 'Due Date') : null;

    if (supplierInvoiceDate && supplierInvoiceDate > purchaseDate) {
      throw new Error('Supplier Invoice Date cannot be after Purchase Date.');
    }
    if (input.payment_type === 'Credit' && !dueDate) {
      throw new Error('Due Date is required for Credit purchase.');
    }
    if (input.payment_type === 'Credit' && dueDate && dueDate < purchaseDate) {
      throw new Error('Due Date cannot be before Purchase Date.');
    }

    await this.assertDateInOpenPeriod(purchaseDate);

    return AppDataSource.transaction(async manager => {
      await this.ensurePurchaseSettings(manager);
      const supplier = await this.getSupplier(manager, input.supplier_id);

      const warehouseRows = await manager.query<{ id: string }[]>(
        `
          SELECT id
          FROM inventory_warehouses
          WHERE company_id = $1
            AND id = $2
            AND is_active = true
          LIMIT 1
        `,
        [this.companyId, input.warehouse_id],
      );
      if (!warehouseRows[0]) throw new Error('Warehouse was not found or is inactive.');

      if (input.supplier_invoice_number?.trim()) {
        const duplicateRows = await manager.query<{ id: string; purchase_number: string }[]>(
          `
            SELECT id, purchase_number
            FROM purchase_invoices
            WHERE company_id = $1
              AND supplier_id = $2
              AND LOWER(supplier_invoice_number) = LOWER($3)
              AND status <> 'Voided'
            LIMIT 1
          `,
          [this.companyId, supplier.id, input.supplier_invoice_number.trim()],
        );
        if (duplicateRows[0]) {
          throw new Error(`Supplier Bill No. is already used on ${duplicateRows[0].purchase_number}.`);
        }
      }

      const itemIds = [...new Set(input.lines.map(line => line.item_id))];
      const itemRows = await manager.query<any[]>(
        `
          SELECT
            i.id,
            COALESCE(i.sku, i.item_code) AS item_code,
            i.item_name,
            i.is_inventory_item,
            i.valuation_method::text AS valuation_method,
            COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
            u.short_name AS uom_name
          FROM inventory_items i
          LEFT JOIN inventory_units_of_measure u
            ON u.id = COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id)
          WHERE i.company_id = $1
            AND i.id = ANY($2::uuid[])
            AND i.is_active = true
            AND i.is_blocked = false
            AND i.is_purchase_item = true
        `,
        [this.companyId, itemIds],
      );
      const itemMap = new Map(itemRows.map(item => [item.id, item]));
      if (itemMap.size !== itemIds.length) {
        throw new Error('One or more purchase items were not found, inactive, or not purchasable.');
      }

      const calculatedLines = input.lines.map((line, index) => {
        const item = itemMap.get(line.item_id);
        const quantity = this.quantity(line.quantity);
        const purchasePrice = this.money(line.purchase_price);
        const gross = this.money(quantity.times(purchasePrice));
        const discount = this.money(line.discount_amount);
        const tax = this.money(line.tax_amount);
        if (discount.gt(gross)) {
          throw new Error(`Discount cannot be greater than item amount on line ${index + 1}.`);
        }
        const lineTotal = this.money(gross.minus(discount).plus(tax));
        if (lineTotal.lte(0)) {
          throw new Error(`Line Total must be greater than zero on line ${index + 1}.`);
        }
        return {
          line,
          item,
          lineNumber: index + 1,
          quantity,
          purchasePrice,
          gross,
          discount,
          tax,
          lineTotal,
          inventoryCost: this.money(gross.minus(discount)),
        };
      });

      const grossAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.gross), new Decimal(0)));
      const discountAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.discount), new Decimal(0)));
      const taxAmount = this.money(calculatedLines.reduce((sum, line) => sum.plus(line.tax), new Decimal(0)));
      const freightAmount = this.money(input.freight_amount);
      const netAmount = this.money(grossAmount.minus(discountAmount).plus(taxAmount).plus(freightAmount));
      if (netAmount.lte(0)) throw new Error('Net Amount must be greater than zero.');

      const purchaseNumber = await this.nextPurchaseNumber(purchaseDate.getFullYear(), manager);
      const invoiceRows = await manager.query<{ id: string; purchase_number: string }[]>(
        `
          INSERT INTO purchase_invoices (
            company_id,
            purchase_number,
            purchase_date,
            supplier_id,
            supplier_account_id,
            supplier_invoice_number,
            supplier_invoice_date,
            payment_type,
            due_date,
            warehouse_id,
            reference_number,
            description,
            status,
            gross_amount,
            discount_amount,
            tax_amount,
            freight_amount,
            net_amount,
            created_by_id,
            updated_by_id,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, 'Draft', $13, $14, $15, $16, $17, $18, $18, now()
          )
          RETURNING id, purchase_number
        `,
        [
          this.companyId,
          purchaseNumber,
          input.purchase_date,
          supplier.id,
          supplier.ap_account_id,
          input.supplier_invoice_number?.trim() || null,
          input.supplier_invoice_date || null,
          input.payment_type,
          input.payment_type === 'Credit' ? input.due_date : null,
          input.warehouse_id,
          input.reference_number || null,
          input.description || null,
          grossAmount.toFixed(2),
          discountAmount.toFixed(2),
          taxAmount.toFixed(2),
          freightAmount.toFixed(2),
          netAmount.toFixed(2),
          this.safeUuid(userId) ?? null,
        ],
      );
      const invoice = invoiceRows[0];

      for (const line of calculatedLines) {
        await manager.query(
          `
            INSERT INTO purchase_invoice_lines (
              company_id,
              purchase_invoice_id,
              line_number,
              item_id,
              item_code,
              item_name,
              uom_id,
              uom_name,
              warehouse_id,
              quantity,
              purchase_price,
              discount_amount,
              tax_amount,
              line_total,
              description,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
          `,
          [
            this.companyId,
            invoice.id,
            line.lineNumber,
            line.item.id,
            line.item.item_code,
            line.item.item_name,
            line.item.uom_id ?? null,
            line.item.uom_name ?? null,
            line.line.warehouse_id || input.warehouse_id,
            line.quantity.toFixed(4),
            line.purchasePrice.toFixed(4),
            line.discount.toFixed(2),
            line.tax.toFixed(2),
            line.lineTotal.toFixed(2),
            line.line.description || null,
          ],
        );
      }

      if (postNow) {
        await this.postPurchaseInvoice(invoice.id, userId, manager);
      }

      return this.getById(invoice.id, manager);
    });
  }

  async post(id: string, userId: string) {
    return AppDataSource.transaction(async manager => {
      await this.postPurchaseInvoice(id, userId, manager);
      return this.getById(id, manager);
    });
  }

  private async postPurchaseInvoice(id: string, userId: string, manager: EntityManager) {
    const invoiceRows = await manager.query<PurchaseInvoiceForPost[]>(
      `
        SELECT *
        FROM purchase_invoices
        WHERE company_id = $1
          AND id = $2
        FOR UPDATE
      `,
      [this.companyId, id],
    );
    const invoice = invoiceRows[0];
    if (!invoice) throw new Error('Purchase Voucher was not found.');
    if (invoice.status !== 'Draft') throw new Error('Only Draft purchase vouchers can be posted.');

    await this.assertDateInOpenPeriod(this.databaseDate(invoice.purchase_date, 'Purchase Date'));
    const purchaseDateText = this.databaseDateText(invoice.purchase_date);
    const settings = await this.ensurePurchaseSettings(manager);
    const inventoryAccount = await this.getAccount(manager, settings.default_inventory_account_id, 'Default Inventory Account');
    const cashAccount = await this.getAccount(manager, settings.default_cash_account_id, 'Default Cash Account');
    const supplierAccount = await this.getAccount(manager, invoice.supplier_account_id, 'Supplier Linked Account');
    const taxAccount = settings.purchase_tax_account_id
      ? await this.getAccount(manager, settings.purchase_tax_account_id, 'Purchase Tax Account')
      : null;
    const freightAccount = settings.freight_account_id
      ? await this.getAccount(manager, settings.freight_account_id, 'Freight Account')
      : null;

    const lines = await manager.query<PurchaseLineForPost[]>(
      `
        SELECT *
        FROM purchase_invoice_lines
        WHERE company_id = $1
          AND purchase_invoice_id = $2
          AND is_active = true
        ORDER BY line_number ASC
      `,
      [this.companyId, id],
    );
    if (lines.length === 0) throw new Error('Purchase Voucher has no items.');

    const netAmount = this.money(invoice.net_amount);
    const inventoryAmount = this.money(this.money(invoice.gross_amount).minus(invoice.discount_amount));
    const taxAmount = this.money(invoice.tax_amount);
    const freightAmount = this.money(invoice.freight_amount);

    if (taxAmount.gt(0) && !taxAccount) throw new Error('Purchase Tax Account is not set.');
    if (freightAmount.gt(0) && !freightAccount) throw new Error('Freight Account is not set.');

    const voucherRows = await manager.query<{ id: string }[]>(
      `
        INSERT INTO vouchers (
          company_id,
          voucher_number,
          voucher_type,
          voucher_date,
          reference,
          narration,
          status,
          approval_status,
          total_debit,
          total_credit,
          created_by,
          posted_by,
          posted_at,
          updated_at
        )
        VALUES ($1, $2, 'PI', $3, $4, $5, 'Posted', 'Not Required', $6, $6, $7, $7, now(), now())
        RETURNING id
      `,
      [
        this.companyId,
        invoice.purchase_number,
        purchaseDateText,
        invoice.reference_number,
        invoice.description || 'Purchase Voucher',
        netAmount.toFixed(2),
        this.safeUuid(userId) ?? null,
      ],
    );
    const voucherId = voucherRows[0].id;

    const voucherLines: Array<{ account: AccountRow; debit: Decimal; credit: Decimal; narration: string }> = [
      {
        account: inventoryAccount,
        debit: inventoryAmount,
        credit: new Decimal(0),
        narration: `Inventory purchase ${invoice.purchase_number}`,
      },
    ];
    if (taxAmount.gt(0) && taxAccount) {
      voucherLines.push({
        account: taxAccount,
        debit: taxAmount,
        credit: new Decimal(0),
        narration: `Purchase tax ${invoice.purchase_number}`,
      });
    }
    if (freightAmount.gt(0) && freightAccount) {
      voucherLines.push({
        account: freightAccount,
        debit: freightAmount,
        credit: new Decimal(0),
        narration: `Purchase freight ${invoice.purchase_number}`,
      });
    }

    voucherLines.push({
      account: invoice.payment_type === 'Cash' ? cashAccount : supplierAccount,
      debit: new Decimal(0),
      credit: netAmount,
      narration: invoice.payment_type === 'Cash'
        ? `Cash paid for ${invoice.purchase_number}`
        : `Supplier payable for ${invoice.purchase_number}`,
    });

    for (const [index, line] of voucherLines.entries()) {
      await manager.query(
        `
          INSERT INTO voucher_lines (
            voucher_id,
            company_id,
            account_id,
            account_code,
            account_name,
            dr_amount,
            cr_amount,
            narration,
            line_no
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          voucherId,
          this.companyId,
          line.account.id,
          line.account.code,
          line.account.name,
          line.debit.toFixed(2),
          line.credit.toFixed(2),
          line.narration,
          index + 1,
        ],
      );
    }

    for (const line of lines) {
      await this.postStockLine(manager, invoice, line, userId);
    }

    await manager.query(
      `
        UPDATE purchase_invoices
        SET status = 'Posted',
            accounting_voucher_id = $3,
            posted_by_id = $4,
            posted_at = now(),
            updated_by_id = $4,
            updated_at = now()
        WHERE company_id = $1
          AND id = $2
      `,
      [this.companyId, id, voucherId, this.safeUuid(userId) ?? null],
    );
  }

  private async postStockLine(
    manager: EntityManager,
    invoice: PurchaseInvoiceForPost,
    line: PurchaseLineForPost,
    userId: string,
  ) {
    const quantity = this.quantity(line.quantity);
    const lineCost = this.money(new Decimal(line.quantity).times(line.purchase_price).minus(line.discount_amount));
    const unitCost = quantity.gt(0) ? lineCost.div(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);

    const balanceRows = await manager.query<any[]>(
      `
        SELECT *
        FROM inventory_stock_balances
        WHERE company_id = $1
          AND item_id = $2
          AND warehouse_id = $3
          AND location_id IS NULL
        FOR UPDATE
      `,
      [this.companyId, line.item_id, line.warehouse_id],
    );
    const existing = balanceRows[0];
    const oldQuantity = this.quantity(existing?.stock_on_hand ?? 0);
    const oldValue = this.money(existing?.total_stock_value ?? 0);
    const newQuantity = this.quantity(oldQuantity.plus(quantity));
    const newValue = this.money(oldValue.plus(lineCost));
    const averageCost = newQuantity.gt(0)
      ? newValue.div(newQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    if (existing) {
      await manager.query(
        `
          UPDATE inventory_stock_balances
          SET stock_on_hand = $1,
              available_stock = $1 - reserved_stock,
              average_cost = $2,
              total_stock_value = $3,
              is_active = true,
              updated_at = now()
          WHERE id = $4
        `,
        [
          newQuantity.toFixed(4),
          averageCost.toFixed(4),
          newValue.toFixed(2),
          existing.id,
        ],
      );
    } else {
      await manager.query(
        `
          INSERT INTO inventory_stock_balances (
            company_id,
            item_id,
            warehouse_id,
            location_id,
            stock_on_hand,
            reserved_stock,
            available_stock,
            average_cost,
            total_stock_value,
            is_active,
            updated_at
          )
          VALUES ($1, $2, $3, NULL, $4, 0, $4, $5, $6, true, now())
        `,
        [
          this.companyId,
          line.item_id,
          line.warehouse_id,
          newQuantity.toFixed(4),
          averageCost.toFixed(4),
          newValue.toFixed(2),
        ],
      );
    }

    await manager.query(
      `
        INSERT INTO inventory_stock_movements (
          company_id,
          item_id,
          warehouse_id,
          location_id,
          movement_date,
          movement_kind,
          source_kind,
          source_document_id,
          source_document_number,
          quantity_in,
          quantity_out,
          unit_cost,
          total_cost,
          stock_after_movement,
          valuation_method,
          remarks,
          is_active,
          created_by_id,
          updated_at
        )
        VALUES (
          $1, $2, $3, NULL, $4, 'PURCHASE_RECEIPT', 'PURCHASE_INVOICE',
          $5, $6, $7, 0, $8, $9, $10, 'WEIGHTED_AVERAGE', $11, true, $12, now()
        )
      `,
      [
        this.companyId,
        line.item_id,
        line.warehouse_id,
        this.databaseDateText(invoice.purchase_date),
        invoice.id,
        invoice.purchase_number,
        quantity.toFixed(4),
        unitCost.toFixed(4),
        lineCost.toFixed(2),
        newQuantity.toFixed(4),
        `Purchase Voucher ${invoice.purchase_number}`,
        this.safeUuid(userId) ?? null,
      ],
    );

    await manager.query(
      `
        UPDATE inventory_items
        SET default_purchase_price = $3,
            updated_at = now()
        WHERE company_id = $1
          AND id = $2
      `,
      [this.companyId, line.item_id, line.purchase_price],
    );
  }

  async getById(id: string, manager: EntityManager = AppDataSource.manager) {
    const rows = await manager.query(
      `
        SELECT
          pi.*,
          s.name AS supplier_name,
          s.code AS supplier_code,
          w.name AS warehouse_name,
          w.code AS warehouse_code,
          v.voucher_number AS accounting_voucher_number
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        LEFT JOIN vouchers v ON v.id = pi.accounting_voucher_id
        WHERE pi.company_id = $1
          AND pi.id = $2
        LIMIT 1
      `,
      [this.companyId, id],
    );
    if (!rows[0]) throw new Error('Purchase Voucher was not found.');

    const lines = await manager.query(
      `
        SELECT *
        FROM purchase_invoice_lines
        WHERE company_id = $1
          AND purchase_invoice_id = $2
        ORDER BY line_number ASC
      `,
      [this.companyId, id],
    );

    return { ...rows[0], lines };
  }
}
