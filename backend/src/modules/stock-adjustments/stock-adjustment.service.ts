import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { ListStockAdjustmentsQuery, ValidateStockAdjustmentInput } from './stock-adjustment.schema.js';

type TransactionClient = Prisma.TransactionClient;
type AdjustmentType = 'Increase' | 'Decrease';

const defaultStockAdjustmentAccounts = {
  inventory: {
    code: '0101300301',
    name: 'Inventory Finished Goods',
    description: 'Default inventory account used for stock adjustments.',
    account_type: 'Asset',
    normal_balance: 'Debit',
    sort_order: 113003,
  },
  gain: {
    code: '0401300101',
    name: 'Stock Adjustment Gain',
    description: 'Default income account used when stock adjustment increases inventory value.',
    account_type: 'Revenue',
    normal_balance: 'Credit',
    sort_order: 413001,
  },
  loss: {
    code: '0502300101',
    name: 'Stock Adjustment Loss',
    description: 'Default expense account used when stock adjustment decreases inventory value.',
    account_type: 'Expense',
    normal_balance: 'Debit',
    sort_order: 523001,
  },
} as const;

interface AccountRow {
  id: string;
  code: string;
  name: string;
}

interface StockAdjustmentSettingsRow {
  id: string;
  default_inventory_account_id: string;
  adjustment_gain_account_id: string;
  adjustment_loss_account_id: string;
}

interface AdjustmentHeaderRow {
  id: string;
  accounting_voucher_id: string | null;
  adjustment_number: string;
  adjustment_date: string | Date;
  warehouse_id: string;
  location_id: string | null;
  status: 'Draft' | 'Posted' | 'Voided';
  reference_number: string | null;
  reason: string | null;
  description: string | null;
}

interface AdjustmentLineRow {
  id: string;
  adjustment_type: AdjustmentType;
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: string;
  unit_cost: string;
  description: string | null;
}

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

function textOrNull(value?: string | null) {
  const clean = value?.trim();
  return clean ? clean : null;
}

function userIdOrNull(userId?: string | null) {
  return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
}

export class StockAdjustmentService {
  constructor(private readonly companyId: string) {}

  private quantity(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private accountingAmount(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private databaseDateText(value: string | Date) {
    const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private async assertDateInOpenPeriod(transaction: TransactionClient, dateText: string) {
    const rows = await transaction.$queryRaw<{ can_post: boolean; reason: string | null }[]>`
      SELECT
        CASE
          WHEN fy.id IS NULL THEN false
          WHEN fy.is_locked THEN false
          WHEN fp.id IS NULL THEN false
          WHEN fp.is_open = false THEN false
          ELSE true
        END AS can_post,
        CASE
          WHEN fy.id IS NULL THEN 'Date does not fall within any active fiscal year'
          WHEN fy.is_locked THEN 'Fiscal year is locked. No new transactions allowed.'
          WHEN fp.id IS NULL THEN 'No open period found for this date'
          WHEN fp.is_open = false THEN CONCAT('Period "', fp.period_name, '" is closed. Cannot post transactions.')
          ELSE NULL
        END AS reason
      FROM (SELECT CAST(${dateText} AS date) AS posting_date) d
      LEFT JOIN fiscal_years fy
        ON fy.company_id = CAST(${this.companyId} AS uuid)
        AND fy.is_deleted = false
        AND fy.start_date <= d.posting_date
        AND fy.end_date >= d.posting_date
      LEFT JOIN fiscal_periods fp
        ON fp.fiscal_year_id = fy.id
        AND fp.start_date <= d.posting_date
        AND (fp.end_date + (fp.posting_cutoff_days * INTERVAL '1 day')) >= d.posting_date
      LIMIT 1
    `;
    if (!rows[0]?.can_post) throw businessError(`Invalid Adjustment Date: ${rows[0]?.reason ?? 'Date cannot be posted.'}`);
  }

  async supportData() {
    return prisma.$transaction(async transaction => {
      const settings = await this.ensureStockAdjustmentSettings(transaction);
      const [warehouses, locations, items, settingsAccounts] = await Promise.all([
        transaction.$queryRaw`
        SELECT w.id, w.code, w.name, w.branch_id, b.code AS branch_code, b.name AS branch_name, w.is_default, w.use_locations
        FROM inventory_warehouses w
        LEFT JOIN branches b ON b.id = w.branch_id
        WHERE w.company_id = CAST(${this.companyId} AS uuid)
          AND w.is_active = true
        ORDER BY w.is_default DESC, w.code ASC
        LIMIT 300
      `,
        transaction.$queryRaw`
        SELECT id, warehouse_id, code, name, is_default
        FROM inventory_warehouse_locations
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY warehouse_id, is_default DESC, code ASC
        LIMIT 500
      `,
        transaction.$queryRaw`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.stock_uom_id, i.base_uom_id, i.purchase_uom_id, i.sales_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(ss.stock_on_hand, 0)::text AS stock_on_hand,
          COALESCE(ss.average_cost, 0)::text AS average_cost
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.purchase_uom_id, i.sales_uom_id)
        LEFT JOIN LATERAL (
          SELECT SUM(stock_on_hand) AS stock_on_hand, AVG(NULLIF(average_cost, 0)) AS average_cost
          FROM inventory_stock_balances
          WHERE company_id = i.company_id
            AND item_id = i.id
            AND is_active = true
        ) ss ON true
        WHERE i.company_id = CAST(${this.companyId} AS uuid)
          AND i.is_active = true
          AND i.is_blocked = false
          AND i.is_inventory_item = true
        ORDER BY i.item_code ASC
        LIMIT 500
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
        warehouses,
        locations,
        items,
        settings: Array.isArray(settingsAccounts) ? settingsAccounts[0] ?? settings : settings,
      };
    });
  }

  async list(query: ListStockAdjustmentsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['sa.company_id = CAST($1 AS uuid)', 'sa.is_active = true'];

    if (query.status) {
      params.push(query.status);
      where.push(`sa.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(sa.adjustment_number ILIKE ${p} OR COALESCE(sa.reference_number, '') ILIKE ${p} OR COALESCE(sa.reason, '') ILIKE ${p} OR COALESCE(sa.description, '') ILIKE ${p})`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`sa.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`sa.adjustment_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`sa.adjustment_date <= CAST($${params.length} AS date)`);
    }
    if (query.adjustment_type) {
      params.push(query.adjustment_type);
      where.push(`EXISTS (
        SELECT 1
        FROM stock_adjustment_lines sal
        WHERE sal.stock_adjustment_id = sa.id
          AND sal.is_active = true
          AND sal.adjustment_type = $${params.length}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM stock_adjustments sa WHERE ${whereSql}`,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const data = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          sa.id,
          sa.adjustment_number,
          sa.adjustment_date,
          sa.reference_number,
          sa.reason,
          sa.description,
          sa.status,
          sa.total_quantity_in::text,
          sa.total_quantity_out::text,
          sa.total_cost_in::text,
          sa.total_cost_out::text,
          sa.posted_at,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          l.code AS location_code,
          l.name AS location_name,
          COUNT(sal.id)::int AS line_count
        FROM stock_adjustments sa
        JOIN inventory_warehouses w ON w.id = sa.warehouse_id
        LEFT JOIN inventory_warehouse_locations l ON l.id = sa.location_id
        LEFT JOIN stock_adjustment_lines sal ON sal.stock_adjustment_id = sa.id AND sal.is_active = true
        WHERE ${whereSql}
        GROUP BY sa.id, w.code, w.name, l.code, l.name
        ORDER BY sa.adjustment_date DESC, sa.adjustment_number DESC, sa.id DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);
    return { data, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async getById(id: string) {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        sa.id,
        sa.adjustment_number,
        sa.adjustment_date,
        sa.warehouse_id,
        sa.location_id,
        sa.reference_number,
        sa.reason,
        sa.description,
        sa.status,
        sa.total_quantity_in::text,
        sa.total_quantity_out::text,
        sa.total_cost_in::text,
        sa.total_cost_out::text,
        sa.posted_at,
        w.code AS warehouse_code,
        w.name AS warehouse_name,
        l.code AS location_code,
        l.name AS location_name
      FROM stock_adjustments sa
      JOIN inventory_warehouses w ON w.id = sa.warehouse_id
      LEFT JOIN inventory_warehouse_locations l ON l.id = sa.location_id
      WHERE sa.company_id = CAST(${this.companyId} AS uuid)
        AND sa.id = CAST(${id} AS uuid)
      LIMIT 1
    `;
    const adjustment = rows[0];
    if (!adjustment) throw businessError('Stock Adjustment was not found.', 404);

    const lines = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        line_number,
        adjustment_type,
        item_id,
        item_code,
        item_name,
        uom_name,
        quantity::text,
        unit_cost::text,
        total_cost::text,
        description
      FROM stock_adjustment_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND stock_adjustment_id = CAST(${id} AS uuid)
        AND is_active = true
      ORDER BY line_number ASC
    `;

    return { ...adjustment, lines };
  }

  async validate(input: ValidateStockAdjustmentInput) {
    const errors: string[] = [];
    const warnings: string[] = [];
    await this.validateInput(input, errors, warnings);
    return { valid: errors.length === 0, errors, warnings };
  }

  async createDraft(input: ValidateStockAdjustmentInput, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const errors: string[] = [];
      await this.validateInput(input, errors, [], transaction);
      if (errors.length) throw businessError(errors[0]);

      const adjustmentNumber = await this.nextAdjustmentNumber(input.adjustment_date.slice(0, 4), transaction);
      const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
      const itemMap = new Map(itemRows.map(item => [item.id, item]));
      const userIdValue = userIdOrNull(userId);
      const totals = await this.calculateDraftTotals(input, transaction);

      const headerRows = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO stock_adjustments (
          company_id, adjustment_number, adjustment_date, warehouse_id, location_id,
          reference_number, reason, description, status, total_quantity_in, total_quantity_out,
          total_cost_in, total_cost_out, created_by_id, updated_by_id, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          ${adjustmentNumber},
          CAST(${input.adjustment_date} AS date),
          CAST(${input.warehouse_id} AS uuid),
          ${textOrNull(input.location_id)}::uuid,
          ${textOrNull(input.reference_number)},
          ${textOrNull(input.reason)},
          ${textOrNull(input.description)},
          'Draft',
          CAST(${totals.totalQuantityIn.toFixed(4)} AS numeric),
          CAST(${totals.totalQuantityOut.toFixed(4)} AS numeric),
          CAST(${totals.totalCostIn.toFixed(4)} AS numeric),
          CAST(${totals.totalCostOut.toFixed(4)} AS numeric),
          ${userIdValue}::uuid,
          ${userIdValue}::uuid,
          now()
        )
        RETURNING id
      `;

      for (const [index, line] of input.lines.entries()) {
        const item = itemMap.get(line.item_id)!;
        const unitCost = line.adjustment_type === 'Increase'
          ? this.money(line.unit_cost)
          : (await this.getBalance(transaction, line.item_id, input.warehouse_id, textOrNull(input.location_id))).averageCost;
        const quantity = this.quantity(line.quantity);

        await transaction.$queryRaw`
          INSERT INTO stock_adjustment_lines (
            company_id, stock_adjustment_id, line_number, adjustment_type, item_id,
            item_code, item_name, uom_name, quantity, unit_cost, total_cost, description, updated_at
          )
          VALUES (
            CAST(${this.companyId} AS uuid),
            CAST(${headerRows[0].id} AS uuid),
            ${index + 1},
            ${line.adjustment_type},
            CAST(${line.item_id} AS uuid),
            ${item.item_code},
            ${item.item_name},
            ${item.uom_name},
            CAST(${quantity.toFixed(4)} AS numeric),
            CAST(${unitCost.toFixed(4)} AS numeric),
            CAST(${unitCost.times(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toFixed(4)} AS numeric),
            ${textOrNull(line.description)},
            now()
          )
        `;
      }

      return { id: headerRows[0].id, adjustment_number: adjustmentNumber, status: 'Draft' };
    });
  }

  async createAndPost(input: ValidateStockAdjustmentInput, userId?: string | null) {
    const draft = await this.createDraft(input, userId);
    return this.post(draft.id, userId);
  }

  async post(id: string, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const headerRows = await transaction.$queryRaw<AdjustmentHeaderRow[]>`
        SELECT *
        FROM stock_adjustments
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const adjustment = headerRows[0];
      if (!adjustment) throw businessError('Stock Adjustment was not found.', 404);
      if (adjustment.status !== 'Draft') throw businessError('Only Draft Stock Adjustments can be posted.');

      const dateText = this.databaseDateText(adjustment.adjustment_date);
      await this.assertDateInOpenPeriod(transaction, dateText);
      const settings = await this.ensureStockAdjustmentSettings(transaction);
      const inventoryAccount = await this.getAccount(transaction, settings.default_inventory_account_id, 'Default Inventory Account');
      const gainAccount = await this.getAccount(transaction, settings.adjustment_gain_account_id, 'Stock Adjustment Gain Account');
      const lossAccount = await this.getAccount(transaction, settings.adjustment_loss_account_id, 'Stock Adjustment Loss Account');
      const lines = await transaction.$queryRaw<AdjustmentLineRow[]>`
        SELECT *
        FROM stock_adjustment_lines
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND stock_adjustment_id = CAST(${id} AS uuid)
          AND is_active = true
        ORDER BY line_number ASC
      `;
      if (!lines.length) throw businessError('Stock Adjustment has no items.');

      let totalQuantityIn = new Decimal(0);
      let totalQuantityOut = new Decimal(0);
      let totalCostIn = new Decimal(0);
      let totalCostOut = new Decimal(0);
      const userIdValue = userIdOrNull(userId);

      for (const line of lines) {
        const result = await this.postLine(transaction, adjustment, line, userIdValue);
        totalQuantityIn = totalQuantityIn.plus(result.quantityIn);
        totalQuantityOut = totalQuantityOut.plus(result.quantityOut);
        totalCostIn = totalCostIn.plus(result.costIn);
        totalCostOut = totalCostOut.plus(result.costOut);
      }

      const accountingVoucherId = await this.createAccountingVoucher(
        transaction,
        adjustment,
        {
          inventoryAccount,
          gainAccount,
          lossAccount,
          totalCostIn,
          totalCostOut,
        },
        userIdValue,
      );

      await transaction.$queryRaw`
        UPDATE stock_adjustments
        SET status = 'Posted',
            accounting_voucher_id = ${accountingVoucherId}::uuid,
            total_quantity_in = CAST(${totalQuantityIn.toFixed(4)} AS numeric),
            total_quantity_out = CAST(${totalQuantityOut.toFixed(4)} AS numeric),
            total_cost_in = CAST(${totalCostIn.toFixed(4)} AS numeric),
            total_cost_out = CAST(${totalCostOut.toFixed(4)} AS numeric),
            posted_by_id = ${userIdValue}::uuid,
            posted_at = now(),
            updated_by_id = ${userIdValue}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;

      return { id, adjustment_number: adjustment.adjustment_number, status: 'Posted' };
    });
  }

  private async ensureAccount(
    transaction: TransactionClient,
    account: typeof defaultStockAdjustmentAccounts[keyof typeof defaultStockAdjustmentAccounts],
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

  private async ensureStockAdjustmentSettings(transaction: TransactionClient): Promise<StockAdjustmentSettingsRow> {
    const inventory = await this.ensureAccount(transaction, defaultStockAdjustmentAccounts.inventory);
    const gain = await this.ensureAccount(transaction, defaultStockAdjustmentAccounts.gain);
    const loss = await this.ensureAccount(transaction, defaultStockAdjustmentAccounts.loss);

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

  private async getAccount(transaction: TransactionClient, id: string, label: string) {
    const rows = await transaction.$queryRaw<AccountRow[]>`
      SELECT id, code, name
      FROM accounts
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
        AND is_active = true
        AND is_posting = true
        AND is_deleted = false
      LIMIT 1
    `;
    if (!rows[0]) throw businessError(`${label} is not set or is inactive.`);
    return rows[0];
  }

  private async createAccountingVoucher(
    transaction: TransactionClient,
    adjustment: AdjustmentHeaderRow,
    input: {
      inventoryAccount: AccountRow;
      gainAccount: AccountRow;
      lossAccount: AccountRow;
      totalCostIn: Decimal;
      totalCostOut: Decimal;
    },
    userId: string | null,
  ) {
    const debitInventory = this.accountingAmount(input.totalCostIn);
    const creditGain = this.accountingAmount(input.totalCostIn);
    const debitLoss = this.accountingAmount(input.totalCostOut);
    const creditInventory = this.accountingAmount(input.totalCostOut);
    const voucherTotal = debitInventory.plus(debitLoss).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (voucherTotal.lte(0)) return null;

    const voucherRows = await transaction.$queryRaw<{ id: string }[]>`
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
      VALUES (
        CAST(${this.companyId} AS uuid),
        ${adjustment.adjustment_number},
        'SA',
        CAST(${this.databaseDateText(adjustment.adjustment_date)} AS date),
        ${adjustment.reference_number},
        ${adjustment.description || `Stock Adjustment ${adjustment.adjustment_number}`},
        'Posted',
        'Not Required',
        CAST(${voucherTotal.toFixed(2)} AS numeric),
        CAST(${voucherTotal.toFixed(2)} AS numeric),
        ${userId}::uuid,
        ${userId}::uuid,
        now(),
        now()
      )
      RETURNING id
    `;
    const voucherId = voucherRows[0].id;

    const voucherLines = [
      ...(debitInventory.gt(0) ? [{
        account: input.inventoryAccount,
        debit: debitInventory,
        credit: new Decimal(0),
        narration: `Stock adjustment increase ${adjustment.adjustment_number}`,
      }] : []),
      ...(creditGain.gt(0) ? [{
        account: input.gainAccount,
        debit: new Decimal(0),
        credit: creditGain,
        narration: `Stock adjustment gain ${adjustment.adjustment_number}`,
      }] : []),
      ...(debitLoss.gt(0) ? [{
        account: input.lossAccount,
        debit: debitLoss,
        credit: new Decimal(0),
        narration: `Stock adjustment loss ${adjustment.adjustment_number}`,
      }] : []),
      ...(creditInventory.gt(0) ? [{
        account: input.inventoryAccount,
        debit: new Decimal(0),
        credit: creditInventory,
        narration: `Stock adjustment decrease ${adjustment.adjustment_number}`,
      }] : []),
    ];

    for (const [index, line] of voucherLines.entries()) {
      await transaction.$queryRaw`
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
        VALUES (
          CAST(${voucherId} AS uuid),
          CAST(${this.companyId} AS uuid),
          CAST(${line.account.id} AS uuid),
          ${line.account.code},
          ${line.account.name},
          CAST(${line.debit.toFixed(2)} AS numeric),
          CAST(${line.credit.toFixed(2)} AS numeric),
          ${line.narration},
          ${index + 1}
        )
      `;
    }

    return voucherId;
  }

  private async validateInput(
    input: ValidateStockAdjustmentInput,
    errors: string[],
    warnings: string[],
    transaction: TransactionClient | typeof prisma = prisma,
  ) {
    await this.assertDateInOpenPeriod(transaction as TransactionClient, input.adjustment_date)
      .catch(error => errors.push(error.message.replace('Invalid Adjustment Date: ', 'Adjustment Date: ')));

    const warehouseRows = await transaction.$queryRaw<{ id: string; use_locations: boolean }[]>`
      SELECT id, use_locations
      FROM inventory_warehouses
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${input.warehouse_id} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    const warehouse = warehouseRows[0];
    if (!warehouse) errors.push('Warehouse was not found or is inactive.');
    if (warehouse?.use_locations && !input.location_id) errors.push('Location is required because Warehouse uses Locations.');
    if (warehouse && !warehouse.use_locations && input.location_id) errors.push('Location can only be selected when the Warehouse uses Locations.');
    if (input.location_id) await this.assertLocationBelongsToWarehouse(transaction, input.location_id, input.warehouse_id, errors);

    const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
    if (itemRows.length !== new Set(input.lines.map(line => line.item_id)).size) {
      errors.push('One or more adjustment items were not found, inactive, or not stock items.');
    }

    for (const [index, line] of input.lines.entries()) {
      const quantity = this.quantity(line.quantity);
      if (quantity.lte(0)) errors.push(`Quantity must be greater than zero on line ${index + 1}.`);
      if (line.adjustment_type === 'Increase' && this.money(line.unit_cost).lt(0)) {
        errors.push(`Unit Cost cannot be negative on line ${index + 1}.`);
      }
      if (line.adjustment_type === 'Decrease') {
        const balance = await this.getBalance(transaction, line.item_id, input.warehouse_id, textOrNull(input.location_id));
        if (balance.stockOnHand.lt(quantity)) {
          errors.push(`Not enough stock for line ${index + 1}. Available Stock is ${balance.stockOnHand.toFixed(4)}.`);
        }
      }
    }

    if (!warnings.length && input.lines.length > 20) warnings.push('This Stock Adjustment has many items. Please review before posting.');
  }

  private async calculateDraftTotals(input: ValidateStockAdjustmentInput, transaction: TransactionClient) {
    let totalQuantityIn = new Decimal(0);
    let totalQuantityOut = new Decimal(0);
    let totalCostIn = new Decimal(0);
    let totalCostOut = new Decimal(0);

    for (const line of input.lines) {
      const quantity = this.quantity(line.quantity);
      if (line.adjustment_type === 'Increase') {
        const cost = this.money(line.unit_cost).times(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        totalQuantityIn = totalQuantityIn.plus(quantity);
        totalCostIn = totalCostIn.plus(cost);
      } else {
        const balance = await this.getBalance(transaction, line.item_id, input.warehouse_id, textOrNull(input.location_id));
        const cost = balance.averageCost.times(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        totalQuantityOut = totalQuantityOut.plus(quantity);
        totalCostOut = totalCostOut.plus(cost);
      }
    }

    return { totalQuantityIn, totalQuantityOut, totalCostIn, totalCostOut };
  }

  private async getItemsForLines(itemIds: string[], transaction: TransactionClient | typeof prisma) {
    const uniqueIds = [...new Set(itemIds)];
    if (!uniqueIds.length) return [];
    return transaction.$queryRaw<Array<{ id: string; item_code: string; item_name: string; uom_name: string | null }>>`
      SELECT
        i.id,
        COALESCE(i.sku, i.item_code) AS item_code,
        i.item_name,
        u.short_name AS uom_name
      FROM inventory_items i
      LEFT JOIN inventory_units_of_measure u ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.purchase_uom_id, i.sales_uom_id)
      WHERE i.company_id = CAST(${this.companyId} AS uuid)
        AND i.id = ANY(${uniqueIds}::uuid[])
        AND i.is_active = true
        AND i.is_blocked = false
        AND i.is_inventory_item = true
    `;
  }

  private async assertLocationBelongsToWarehouse(
    transaction: TransactionClient | typeof prisma,
    locationId: string,
    warehouseId: string,
    errors: string[],
  ) {
    const rows = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM inventory_warehouse_locations
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${locationId} AS uuid)
        AND warehouse_id = CAST(${warehouseId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    if (!rows[0]) errors.push('Location does not belong to the selected Warehouse or is inactive.');
  }

  private async nextAdjustmentNumber(year: string, transaction: TransactionClient) {
    const rows = await transaction.$queryRaw<{ adjustment_number: string }[]>`
      SELECT adjustment_number
      FROM stock_adjustments
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND adjustment_number LIKE ${`SA-${year}-%`}
      ORDER BY adjustment_number DESC
      LIMIT 1
      FOR UPDATE
    `;
    const lastSegment = rows[0]?.adjustment_number?.split('-').pop() ?? '0000';
    const next = Number.parseInt(lastSegment, 10) + 1;
    return `SA-${year}-${String(next).padStart(4, '0')}`;
  }

  private async getBalance(transaction: TransactionClient | typeof prisma, itemId: string, warehouseId: string, locationId: string | null) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND warehouse_id = CAST(${warehouseId} AS uuid)
        AND (${locationId}::uuid IS NULL AND location_id IS NULL OR location_id = ${locationId}::uuid)
      LIMIT 1
    `;
    return {
      row: rows[0],
      stockOnHand: this.quantity(rows[0]?.stock_on_hand ?? 0),
      averageCost: this.money(rows[0]?.average_cost ?? 0),
      totalValue: this.money(rows[0]?.total_stock_value ?? 0),
    };
  }

  private async getBalanceForUpdate(transaction: TransactionClient, itemId: string, warehouseId: string, locationId: string | null) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND warehouse_id = CAST(${warehouseId} AS uuid)
        AND (${locationId}::uuid IS NULL AND location_id IS NULL OR location_id = ${locationId}::uuid)
      FOR UPDATE
    `;
    return {
      row: rows[0],
      stockOnHand: this.quantity(rows[0]?.stock_on_hand ?? 0),
      averageCost: this.money(rows[0]?.average_cost ?? 0),
      totalValue: this.money(rows[0]?.total_stock_value ?? 0),
      reservedStock: this.quantity(rows[0]?.reserved_stock ?? 0),
    };
  }

  private async postLine(
    transaction: TransactionClient,
    adjustment: AdjustmentHeaderRow,
    line: AdjustmentLineRow,
    userId: string | null,
  ) {
    const quantity = this.quantity(line.quantity);
    const balance = await this.getBalanceForUpdate(transaction, line.item_id, adjustment.warehouse_id, adjustment.location_id);
    if (line.adjustment_type === 'Decrease' && balance.stockOnHand.lt(quantity)) {
      throw businessError(`Not enough stock for ${line.item_code}.`);
    }

    const unitCost = line.adjustment_type === 'Increase' ? this.money(line.unit_cost) : balance.averageCost;
    const totalCost = unitCost.times(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const newQuantity = line.adjustment_type === 'Increase'
      ? this.quantity(balance.stockOnHand.plus(quantity))
      : this.quantity(balance.stockOnHand.minus(quantity));
    const newValue = line.adjustment_type === 'Increase'
      ? this.money(balance.totalValue.plus(totalCost))
      : Decimal.max(0, balance.totalValue.minus(totalCost)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    const newAverageCost = newQuantity.gt(0)
      ? newValue.div(newQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    if (balance.row) {
      await transaction.$queryRaw`
        UPDATE inventory_stock_balances
        SET stock_on_hand = CAST(${newQuantity.toFixed(4)} AS numeric),
            available_stock = CAST(${newQuantity.toFixed(4)} AS numeric) - reserved_stock,
            average_cost = CAST(${newAverageCost.toFixed(4)} AS numeric),
            total_stock_value = CAST(${newValue.toFixed(4)} AS numeric),
            is_active = true,
            updated_at = now()
        WHERE id = CAST(${balance.row.id} AS uuid)
      `;
    } else {
      await transaction.$queryRaw`
        INSERT INTO inventory_stock_balances (
          company_id, item_id, warehouse_id, location_id, stock_on_hand, reserved_stock,
          available_stock, average_cost, total_stock_value, is_active, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${line.item_id} AS uuid),
          CAST(${adjustment.warehouse_id} AS uuid),
          ${adjustment.location_id}::uuid,
          CAST(${newQuantity.toFixed(4)} AS numeric),
          0,
          CAST(${newQuantity.toFixed(4)} AS numeric),
          CAST(${newAverageCost.toFixed(4)} AS numeric),
          CAST(${newValue.toFixed(4)} AS numeric),
          true,
          now()
        )
      `;
    }

    const movementKind = line.adjustment_type === 'Increase' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    await this.insertMovement(
      transaction,
      adjustment,
      line,
      movementKind,
      line.adjustment_type === 'Increase' ? quantity : new Decimal(0),
      line.adjustment_type === 'Decrease' ? quantity : new Decimal(0),
      unitCost,
      totalCost,
      newQuantity,
      userId,
    );

    await transaction.$queryRaw`
      UPDATE stock_adjustment_lines
      SET unit_cost = CAST(${unitCost.toFixed(4)} AS numeric),
          total_cost = CAST(${totalCost.toFixed(4)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${line.id} AS uuid)
    `;

    return {
      quantityIn: line.adjustment_type === 'Increase' ? quantity : new Decimal(0),
      quantityOut: line.adjustment_type === 'Decrease' ? quantity : new Decimal(0),
      costIn: line.adjustment_type === 'Increase' ? totalCost : new Decimal(0),
      costOut: line.adjustment_type === 'Decrease' ? totalCost : new Decimal(0),
    };
  }

  private async insertMovement(
    transaction: TransactionClient,
    adjustment: AdjustmentHeaderRow,
    line: AdjustmentLineRow,
    movementKind: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT',
    quantityIn: Decimal,
    quantityOut: Decimal,
    unitCost: Decimal,
    totalCost: Decimal,
    stockAfterMovement: Decimal,
    userId: string | null,
  ) {
    await transaction.$queryRaw`
      INSERT INTO inventory_stock_movements (
        company_id, item_id, warehouse_id, location_id, movement_date, movement_kind,
        source_kind, source_document_id, source_document_number, quantity_in, quantity_out,
        unit_cost, total_cost, stock_after_movement, valuation_method, remarks, is_active,
        created_by_id, updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        CAST(${line.item_id} AS uuid),
        CAST(${adjustment.warehouse_id} AS uuid),
        ${adjustment.location_id}::uuid,
        CAST(${this.databaseDateText(adjustment.adjustment_date)} AS date),
        ${movementKind}::"StockMovementKind",
        'STOCK_ADJUSTMENT',
        CAST(${adjustment.id} AS uuid),
        ${adjustment.adjustment_number},
        CAST(${quantityIn.toFixed(4)} AS numeric),
        CAST(${quantityOut.toFixed(4)} AS numeric),
        CAST(${unitCost.toFixed(4)} AS numeric),
        CAST(${totalCost.toFixed(4)} AS numeric),
        CAST(${stockAfterMovement.toFixed(4)} AS numeric),
        'WEIGHTED_AVERAGE',
        ${`${movementKind === 'ADJUSTMENT_IN' ? 'Adjustment In' : 'Adjustment Out'} ${adjustment.adjustment_number}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;
  }
}
