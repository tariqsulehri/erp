import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { type StockHolder, holderCondition, holderFromColumns } from '../inventory/stock-holder.js';
import { assertCanUseHolder, canUseHolder, validateHolder, visibleStockCondition } from '../inventory/stock-holder-access.js';
import type { ListStockTransfersQuery, ReverseStockDocumentInput, SupportDataQuery, ValidateStockTransferInput } from './stock-transfer.schema.js';
import { applyExactStockChange } from '../inventory/stock-reversal.js';
import { nextDocumentNumber } from '../numbering/document-number.js';

type TransactionClient = Prisma.TransactionClient;

const POSTING_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

interface TransferHeaderRow {
  id: string;
  transfer_number: string;
  transfer_date: string | Date;
  from_branch_id: string | null;
  from_warehouse_id: string | null;
  from_location_id: string | null;
  to_branch_id: string | null;
  to_warehouse_id: string | null;
  to_location_id: string | null;
  status: 'Draft' | 'Posted' | 'Voided';
  reference_number: string | null;
  description: string | null;
}

interface TransferLineRow {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  quantity: string;
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
  return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
}

function fromHolder(transfer: TransferHeaderRow) {
  return holderFromColumns(transfer.from_branch_id, transfer.from_warehouse_id, transfer.from_location_id);
}

function toHolder(transfer: TransferHeaderRow) {
  return holderFromColumns(transfer.to_branch_id, transfer.to_warehouse_id, transfer.to_location_id);
}

export class StockTransferService {
  /** `scope` limits Branch / Warehouse users to transfers in or out of their own place. */
  constructor(private readonly companyId: string, private readonly scope?: AccessScope) {}

  private quantity(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
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
          WHEN fy.id IS NULL THEN 'This date is not in any active Fiscal Year.'
          WHEN fy.is_locked THEN 'This Fiscal Year is locked. You cannot post new entries in it.'
          WHEN fp.id IS NULL THEN 'There is no open Period for this date.'
          WHEN fp.is_open = false THEN CONCAT('Period "', fp.period_name, '" is closed. You cannot post in a closed Period.')
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
      ORDER BY (fp.end_date >= d.posting_date) DESC NULLS LAST
      LIMIT 1
    `;
    if (!rows[0]?.can_post) throw businessError(`Transfer Date cannot be used. ${rows[0]?.reason ?? 'You cannot post on this date.'}`);
  }

  /**
   * Branches, Warehouses, Locations and items for the transfer screen. Item stock is the stock at the
   * selected source (From). Branch and Warehouse users always send from their own place.
   */
  async supportData(query: SupportDataQuery) {
    const scope = this.scope;
    const sourceBranchId = scope?.accessLevel === 'BRANCH' ? scope.branchId : textOrNull(query.from_branch_id);
    const sourceWarehouseId = scope?.accessLevel === 'WAREHOUSE' ? scope.warehouseId : (sourceBranchId ? null : textOrNull(query.from_warehouse_id));
    const sourceHolder = sourceBranchId || sourceWarehouseId
      ? holderFromColumns(sourceBranchId, sourceWarehouseId, textOrNull(query.from_location_id))
      : null;
    const sourceCondition = sourceHolder ? holderCondition(sourceHolder) : Prisma.sql`FALSE`;
    const totalCondition = scope ? visibleStockCondition(scope, 'balance') : Prisma.sql`TRUE`;

    const [branches, warehouses, locations, items] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, code, name, city, is_default
        FROM branches
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY is_default DESC, code ASC
        LIMIT 200
      `,
      prisma.$queryRaw`
        SELECT id, code, name, is_default, use_locations
        FROM inventory_warehouses
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY is_default DESC, code ASC
        LIMIT 300
      `,
      prisma.$queryRaw`
        SELECT id, branch_id, warehouse_id, code, name, is_default
        FROM inventory_warehouse_locations
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY branch_id, warehouse_id, is_default DESC, code ASC
        LIMIT 500
      `,
      prisma.$queryRaw`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(sb.stock_on_hand, 0)::text AS stock_on_hand,
          COALESCE(sb.available_stock, 0)::text AS available_stock,
          COALESCE(ss.stock_on_hand, 0)::text AS total_stock_on_hand
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
        LEFT JOIN LATERAL (
          SELECT
            SUM(stock_on_hand) AS stock_on_hand,
            SUM(available_stock) AS available_stock
          FROM inventory_stock_balances
          WHERE company_id = i.company_id
            AND item_id = i.id
            AND is_active = true
            AND ${sourceCondition}
        ) sb ON true
        LEFT JOIN LATERAL (
          SELECT SUM(balance.stock_on_hand) AS stock_on_hand
          FROM inventory_stock_balances balance
          WHERE balance.company_id = i.company_id
            AND balance.item_id = i.id
            AND balance.is_active = true
            AND ${totalCondition}
        ) ss ON true
        WHERE i.company_id = CAST(${this.companyId} AS uuid)
          AND i.is_active = true
          AND i.is_blocked = false
          AND i.is_inventory_item = true
        ORDER BY i.item_code ASC
        LIMIT 500
      `,
    ]);

    return {
      branches,
      warehouses,
      locations,
      items,
      source: sourceHolder ? { branch_id: sourceHolder.branchId, warehouse_id: sourceHolder.warehouseId, location_id: sourceHolder.locationId } : null,
    };
  }

  async getSourceStock(holder: StockHolder) {
    if (this.scope) assertCanUseHolder(this.scope, holder, 'view stock');
    const rows = await prisma.$queryRaw<Array<{
      item_id: string;
      stock_on_hand: string;
      available_stock: string;
      reserved_stock: string;
    }>>`
      SELECT
        sb.item_id,
        COALESCE(SUM(sb.stock_on_hand), 0)::text AS stock_on_hand,
        COALESCE(SUM(sb.available_stock), 0)::text AS available_stock,
        COALESCE(SUM(sb.reserved_stock), 0)::text AS reserved_stock
      FROM inventory_stock_balances sb
      WHERE sb.company_id = CAST(${this.companyId} AS uuid)
        AND ${holderCondition(holder, 'sb')}
        AND sb.is_active = true
      GROUP BY sb.item_id
    `;
    return rows;
  }

  async list(query: ListStockTransfersQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['st.company_id = CAST($1 AS uuid)', 'st.is_active = true'];

    // Branch and Warehouse users see transfers that send from or deliver to their own place.
    if (this.scope?.accessLevel === 'BRANCH') {
      params.push(this.scope.branchId);
      where.push(`(st.from_branch_id = CAST($${params.length} AS uuid) OR st.to_branch_id = CAST($${params.length} AS uuid))`);
    } else if (this.scope?.accessLevel === 'WAREHOUSE') {
      params.push(this.scope.warehouseId);
      where.push(`(st.from_warehouse_id = CAST($${params.length} AS uuid) OR st.to_warehouse_id = CAST($${params.length} AS uuid))`);
    }
    if (query.from_branch_id) {
      params.push(query.from_branch_id);
      where.push(`st.from_branch_id = CAST($${params.length} AS uuid)`);
    }
    if (query.to_branch_id) {
      params.push(query.to_branch_id);
      where.push(`st.to_branch_id = CAST($${params.length} AS uuid)`);
    }

    if (query.status) {
      params.push(query.status);
      where.push(`st.status = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      const p = `$${params.length}`;
      where.push(`(st.transfer_number ILIKE ${p} OR COALESCE(st.reference_number, '') ILIKE ${p} OR COALESCE(st.description, '') ILIKE ${p})`);
    }
    if (query.from_warehouse_id) {
      params.push(query.from_warehouse_id);
      where.push(`st.from_warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.to_warehouse_id) {
      params.push(query.to_warehouse_id);
      where.push(`st.to_warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.direction) {
      const [from, to] = query.direction.split('_TO_');
      where.push(from === 'BRANCH' ? 'st.from_branch_id IS NOT NULL' : 'st.from_warehouse_id IS NOT NULL');
      where.push(to === 'BRANCH' ? 'st.to_branch_id IS NOT NULL' : 'st.to_warehouse_id IS NOT NULL');
    }
    // Stock Received: a Branch or Warehouse user sees only what was delivered to their own place.
    if (query.incoming && this.scope?.accessLevel === 'BRANCH') {
      params.push(this.scope.branchId);
      where.push(`st.to_branch_id = CAST($${params.length} AS uuid)`);
    } else if (query.incoming && this.scope?.accessLevel === 'WAREHOUSE') {
      params.push(this.scope.warehouseId);
      where.push(`st.to_warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`st.transfer_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`st.transfer_date <= CAST($${params.length} AS date)`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM stock_transfers st WHERE ${whereSql}`,
      ...params,
    );

    params.push(query.limit, (query.page - 1) * query.limit);
    const data = await prisma.$queryRawUnsafe<any[]>(
      `
        SELECT
          st.id,
          st.transfer_number,
          st.transfer_date,
          st.reference_number,
          st.description,
          st.status,
          st.total_quantity::text,
          st.total_cost::text,
          st.posted_at,
          CASE WHEN st.from_branch_id IS NOT NULL THEN 'BRANCH' ELSE 'WAREHOUSE' END AS from_kind,
          COALESCE(fb.code, fw.code) AS from_code,
          COALESCE(fb.name, fw.name) AS from_name,
          CASE WHEN st.to_branch_id IS NOT NULL THEN 'BRANCH' ELSE 'WAREHOUSE' END AS to_kind,
          COALESCE(tb.code, tw.code) AS to_code,
          COALESCE(tb.name, tw.name) AS to_name,
          fw.code AS from_warehouse_code,
          fw.name AS from_warehouse_name,
          tw.code AS to_warehouse_code,
          tw.name AS to_warehouse_name,
          COUNT(stl.id)::int AS line_count
        FROM stock_transfers st
        LEFT JOIN branches fb ON fb.id = st.from_branch_id
        LEFT JOIN inventory_warehouses fw ON fw.id = st.from_warehouse_id
        LEFT JOIN branches tb ON tb.id = st.to_branch_id
        LEFT JOIN inventory_warehouses tw ON tw.id = st.to_warehouse_id
        LEFT JOIN stock_transfer_lines stl ON stl.stock_transfer_id = st.id AND stl.is_active = true
        WHERE ${whereSql}
        GROUP BY st.id, fb.code, fb.name, fw.code, fw.name, tb.code, tb.name, tw.code, tw.name
        ORDER BY st.transfer_date DESC, st.transfer_number DESC
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
        st.id,
        st.transfer_number,
        st.transfer_date,
        st.from_branch_id,
        st.from_warehouse_id,
        st.from_location_id,
        st.to_branch_id,
        st.to_warehouse_id,
        st.to_location_id,
        st.reference_number,
        st.description,
        st.status,
        st.total_quantity::text,
        st.total_cost::text,
        st.posted_at,
        st.void_reason,
        st.voided_at,
        CASE WHEN st.from_branch_id IS NOT NULL THEN 'BRANCH' ELSE 'WAREHOUSE' END AS from_kind,
        COALESCE(fb.code, fw.code) AS from_code,
        COALESCE(fb.name, fw.name) AS from_name,
        CASE WHEN st.to_branch_id IS NOT NULL THEN 'BRANCH' ELSE 'WAREHOUSE' END AS to_kind,
        COALESCE(tb.code, tw.code) AS to_code,
        COALESCE(tb.name, tw.name) AS to_name,
        fw.code AS from_warehouse_code,
        fw.name AS from_warehouse_name,
        fl.code AS from_location_code,
        fl.name AS from_location_name,
        tw.code AS to_warehouse_code,
        tw.name AS to_warehouse_name,
        tl.code AS to_location_code,
        tl.name AS to_location_name
      FROM stock_transfers st
      LEFT JOIN branches fb ON fb.id = st.from_branch_id
      LEFT JOIN inventory_warehouses fw ON fw.id = st.from_warehouse_id
      LEFT JOIN branches tb ON tb.id = st.to_branch_id
      LEFT JOIN inventory_warehouses tw ON tw.id = st.to_warehouse_id
      LEFT JOIN inventory_warehouse_locations fl ON fl.id = st.from_location_id
      LEFT JOIN inventory_warehouse_locations tl ON tl.id = st.to_location_id
      WHERE st.company_id = CAST(${this.companyId} AS uuid)
        AND st.id = CAST(${id} AS uuid)
      LIMIT 1
    `;
    const transfer = rows[0];
    // Transfers that do not touch the user's own Branch / Warehouse are reported as not found.
    if (!transfer || (this.scope && !canUseHolder(this.scope, fromHolder(transfer)) && !canUseHolder(this.scope, toHolder(transfer)))) {
      throw businessError('Stock Transfer was not found.', 404);
    }

    const lines = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        line_number,
        item_id,
        item_code,
        item_name,
        uom_name,
        quantity::text,
        unit_cost::text,
        total_cost::text,
        description
      FROM stock_transfer_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND stock_transfer_id = CAST(${id} AS uuid)
        AND is_active = true
      ORDER BY line_number ASC
    `;

    return { ...transfer, lines };
  }

  async validate(input: ValidateStockTransferInput) {
    const errors: string[] = [];
    const warnings: string[] = [];
    await this.validateInput(input, errors, warnings);
    return { valid: errors.length === 0, errors, warnings };
  }

  async createDraft(input: ValidateStockTransferInput, userId?: string | null) {
    return prisma.$transaction(transaction => this.insertDraft(transaction, input, userId));
  }

  async createAndPost(input: ValidateStockTransferInput, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const draft = await this.insertDraft(transaction, input, userId);
      return this.postInTransaction(transaction, draft.id, userId);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  async post(id: string, userId?: string | null) {
    return prisma.$transaction(transaction => this.postInTransaction(transaction, id, userId), POSTING_TRANSACTION_OPTIONS);
  }

  /**
   * Replaces the header and lines of a Draft transfer. The transfer number never changes, even when the
   * date moves to another year, because document numbers are permanent once given.
   */
  async updateDraft(id: string, input: ValidateStockTransferInput, userId?: string | null) {
    return prisma.$transaction(transaction => this.replaceDraft(transaction, id, input, userId));
  }

  /** Saves the changes to a Draft and posts it in one transaction; if posting is refused, the changes are not saved either. */
  async updateAndPost(id: string, input: ValidateStockTransferInput, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      await this.replaceDraft(transaction, id, input, userId);
      return this.postInTransaction(transaction, id, userId);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /**
   * Reverses a posted transfer on the Reversal Date: each item goes back from the receiving place to the
   * sending place at the exact cost it moved at, so company stock value does not change. The transfer stays
   * on file as Voided with who, when and why; its movements are never edited, only offset.
   */
  async reverse(id: string, input: ReverseStockDocumentInput, userId?: string | null) {
    const reversedBy = userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const rows = await transaction.$queryRaw<TransferHeaderRow[]>`
        SELECT *
        FROM stock_transfers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const transfer = rows[0];
      if (!transfer) throw businessError('Stock Transfer was not found.', 404);
      if (this.scope) assertCanUseHolder(this.scope, fromHolder(transfer), 'reverse Stock Transfers');
      if (transfer.status === 'Draft') throw businessError('Only posted Stock Transfers can be reversed. Cancel a Draft instead.');
      if (transfer.status !== 'Posted') throw businessError('This Stock Transfer is already reversed or cancelled.');
      const transferDate = this.databaseDateText(transfer.transfer_date);
      if (input.reversal_date < transferDate) throw businessError(`Reversal Date cannot be before the Transfer Date ${transferDate}.`);
      await this.assertDateInOpenPeriod(transaction, input.reversal_date);

      const lines = await transaction.$queryRaw<Array<TransferLineRow & { total_cost: string }>>`
        SELECT id, item_id, item_code, item_name, quantity::text, total_cost::text, description
        FROM stock_transfer_lines
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND stock_transfer_id = CAST(${id} AS uuid)
          AND is_active = true
        ORDER BY item_id, line_number
      `;
      const from = fromHolder(transfer);
      const to = toHolder(transfer);
      // Lock both places' balance rows in one fixed order, as posting does.
      await this.lockBalancesForTransfer(transaction, transfer, lines.map(line => line.item_id));
      const remarks = `Reversal of ${transfer.transfer_number}`;
      for (const line of lines) {
        const quantity = this.quantity(line.quantity);
        const cost = new Decimal(line.total_cost);
        const unitCost = quantity.gt(0) ? cost.div(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);
        const afterOut = await applyExactStockChange(transaction, this.companyId, to, line, quantity.neg(), cost.neg());
        await this.insertMovement(transaction, transfer, line, to, 'TRANSFER_OUT', quantity, new Decimal(0), quantity, unitCost, cost, afterOut, reversedBy, { date: input.reversal_date, remarks });
        const afterIn = await applyExactStockChange(transaction, this.companyId, from, line, quantity, cost);
        await this.insertMovement(transaction, transfer, line, from, 'TRANSFER_IN', quantity, quantity, new Decimal(0), unitCost, cost, afterIn, reversedBy, { date: input.reversal_date, remarks });
      }

      await transaction.$queryRaw`
        UPDATE stock_transfers
        SET status = 'Voided',
            voided_by_id = ${reversedBy}::uuid,
            voided_at = now(),
            void_reason = ${`Reversed on ${input.reversal_date}: ${input.reason}`},
            updated_by_id = ${reversedBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;
      return { id, transfer_number: transfer.transfer_number, status: 'Voided' };
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /** Cancels a Draft: it stays on file as Voided with who, when and why, so its number is never reused. */
  async cancelDraft(id: string, input: { reason: string }, userId?: string | null) {
    const cancelledBy = userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const rows = await transaction.$queryRaw<TransferHeaderRow[]>`
        SELECT *
        FROM stock_transfers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const document = rows[0];
      if (!document) throw businessError('Stock Transfer was not found.', 404);
      if (this.scope) assertCanUseHolder(this.scope, fromHolder(document), 'cancel Stock Transfers');
      if (document.status !== 'Draft') throw businessError('Only Draft Stock Transfers can be cancelled.');
      await transaction.$queryRaw`
        UPDATE stock_transfers
        SET status = 'Voided',
            voided_by_id = ${cancelledBy}::uuid,
            voided_at = now(),
            void_reason = ${input.reason},
            updated_by_id = ${cancelledBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;
      return { id, transfer_number: document.transfer_number, status: 'Voided' };
    });
  }

  /** Locks a Draft so two users cannot change or post it at the same time, then replaces its header and lines. */
  private async replaceDraft(transaction: TransactionClient, id: string, input: ValidateStockTransferInput, userId?: string | null) {
    const rows = await transaction.$queryRaw<TransferHeaderRow[]>`
      SELECT *
      FROM stock_transfers
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
      FOR UPDATE
    `;
    const transfer = rows[0];
    if (!transfer) throw businessError('Stock Transfer was not found.', 404);
    // Only the sending place may change its transfer, as only the sender may post it.
    if (this.scope) assertCanUseHolder(this.scope, fromHolder(transfer), 'change Stock Transfers');
    if (transfer.status !== 'Draft') throw businessError('Only Draft Stock Transfers can be changed. A posted transfer cannot be changed.');

    const errors: string[] = [];
    const holders = await this.validateInput(input, errors, [], transaction);
    if (errors.length || !holders) throw businessError(errors[0] ?? 'Check the Stock Transfer details and try again.');
    const { from, to } = holders;
    const updatedBy = userIdOrNull(userId);
    const totalQuantity = input.lines.reduce((sum, line) => sum.plus(line.quantity), new Decimal(0));

    await transaction.$queryRaw`
      UPDATE stock_transfers
      SET transfer_date = CAST(${input.transfer_date} AS date),
          from_branch_id = ${from.branchId}::uuid,
          from_warehouse_id = ${from.warehouseId}::uuid,
          from_location_id = ${from.locationId}::uuid,
          to_branch_id = ${to.branchId}::uuid,
          to_warehouse_id = ${to.warehouseId}::uuid,
          to_location_id = ${to.locationId}::uuid,
          reference_number = ${textOrNull(input.reference_number)},
          description = ${textOrNull(input.description)},
          total_quantity = CAST(${totalQuantity.toFixed(4)} AS numeric),
          updated_by_id = ${updatedBy}::uuid,
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
    `;
    await transaction.$queryRaw`
      DELETE FROM stock_transfer_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND stock_transfer_id = CAST(${id} AS uuid)
    `;
    await this.insertLines(transaction, id, input);
    return { id, transfer_number: transfer.transfer_number, status: 'Draft' };
  }

  private async insertLines(transaction: TransactionClient, transferId: string, input: ValidateStockTransferInput) {
    const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
    const itemMap = new Map(itemRows.map(item => [item.id, item]));
    for (const [index, line] of input.lines.entries()) {
      const item = itemMap.get(line.item_id)!;
      await transaction.$queryRaw`
        INSERT INTO stock_transfer_lines (
          company_id, stock_transfer_id, line_number, item_id, item_code, item_name,
          uom_name, quantity, unit_cost, total_cost, description, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${transferId} AS uuid),
          ${index + 1},
          CAST(${line.item_id} AS uuid),
          ${item.item_code},
          ${item.item_name},
          ${item.uom_name},
          CAST(${this.quantity(line.quantity).toFixed(4)} AS numeric),
          0,
          0,
          ${textOrNull(line.description)},
          now()
        )
      `;
    }
  }

  private async insertDraft(transaction: TransactionClient, input: ValidateStockTransferInput, userId?: string | null) {
    const errors: string[] = [];
    const holders = await this.validateInput(input, errors, [], transaction);
    if (errors.length || !holders) throw businessError(errors[0] ?? 'Check the Stock Transfer details and try again.');
    const { from, to } = holders;

    const transferNumber = await this.nextTransferNumber(input.transfer_date.slice(0, 4), transaction);
    const postedBy = userIdOrNull(userId);
    const totalQuantity = input.lines.reduce((sum, line) => sum.plus(line.quantity), new Decimal(0));

    const headerRows = await transaction.$queryRaw<{ id: string }[]>`
      INSERT INTO stock_transfers (
        company_id, transfer_number, transfer_date, from_branch_id, from_warehouse_id, from_location_id,
        to_branch_id, to_warehouse_id, to_location_id, reference_number, description, status,
        total_quantity, total_cost, created_by_id, updated_by_id, updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        ${transferNumber},
        CAST(${input.transfer_date} AS date),
        ${from.branchId}::uuid,
        ${from.warehouseId}::uuid,
        ${from.locationId}::uuid,
        ${to.branchId}::uuid,
        ${to.warehouseId}::uuid,
        ${to.locationId}::uuid,
        ${textOrNull(input.reference_number)},
        ${textOrNull(input.description)},
        'Draft',
        CAST(${totalQuantity.toFixed(4)} AS numeric),
        0,
        ${postedBy}::uuid,
        ${postedBy}::uuid,
        now()
      )
      RETURNING id
    `;

    await this.insertLines(transaction, headerRows[0].id, input);
    return { id: headerRows[0].id, transfer_number: transferNumber, status: 'Draft' };
  }

  private async postInTransaction(transaction: TransactionClient, id: string, userId?: string | null) {
    const headerRows = await transaction.$queryRaw<TransferHeaderRow[]>`
      SELECT *
      FROM stock_transfers
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
      FOR UPDATE
    `;
    const transfer = headerRows[0];
    if (!transfer) throw businessError('Stock Transfer was not found.', 404);
    // The sender posts: Branch and Warehouse users can only send stock out of their own place.
    if (this.scope) assertCanUseHolder(this.scope, fromHolder(transfer), 'send stock');
    if (transfer.status !== 'Draft') throw businessError('Only Draft Stock Transfers can be posted.');

    const dateText = this.databaseDateText(transfer.transfer_date);
    await this.assertDateInOpenPeriod(transaction, dateText);
    const lines = await transaction.$queryRaw<TransferLineRow[]>`
      SELECT *
      FROM stock_transfer_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND stock_transfer_id = CAST(${id} AS uuid)
        AND is_active = true
      ORDER BY line_number ASC
    `;
    if (!lines.length) throw businessError('Stock Transfer has no items.');

    await this.lockBalancesForTransfer(transaction, transfer, lines.map(line => line.item_id));

    let totalCost = new Decimal(0);
    for (const line of lines) {
      totalCost = totalCost.plus(await this.postLine(transaction, transfer, line, userIdOrNull(userId)));
    }

    await transaction.$queryRaw`
      UPDATE stock_transfers
      SET status = 'Posted',
          total_cost = CAST(${totalCost.toFixed(4)} AS numeric),
          posted_by_id = ${userIdOrNull(userId)}::uuid,
          posted_at = now(),
          updated_by_id = ${userIdOrNull(userId)}::uuid,
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
    `;

    return { id, transfer_number: transfer.transfer_number, status: 'Posted' };
  }

  // Creates missing destination rows, then locks every affected balance row in id order so
  // opposite-direction transfers running at the same time cannot deadlock each other.
  private async lockBalancesForTransfer(transaction: TransactionClient, transfer: TransferHeaderRow, itemIds: string[]) {
    const uniqueIds = [...new Set(itemIds)];
    const from = fromHolder(transfer);
    const to = toHolder(transfer);
    await transaction.$queryRaw`
      INSERT INTO inventory_stock_balances (
        company_id, item_id, branch_id, warehouse_id, location_id, stock_on_hand, reserved_stock,
        available_stock, average_cost, total_stock_value, is_active, updated_at
      )
      SELECT
        CAST(${this.companyId} AS uuid),
        item_id,
        ${to.branchId}::uuid,
        ${to.warehouseId}::uuid,
        ${to.locationId}::uuid,
        0, 0, 0, 0, 0, true, now()
      FROM unnest(${uniqueIds}::uuid[]) AS item_id
      ON CONFLICT DO NOTHING
    `;
    await transaction.$queryRaw`
      SELECT id
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = ANY(${uniqueIds}::uuid[])
        AND ((${holderCondition(from)}) OR (${holderCondition(to)}))
      ORDER BY id
      FOR UPDATE
    `;
  }

  /** Checks the transfer and returns the From and To holders, or null when either side is not valid. */
  private async validateInput(input: ValidateStockTransferInput, errors: string[], warnings: string[], transaction: TransactionClient | typeof prisma = prisma) {
    if (input.from_branch_id && input.from_warehouse_id) errors.push('From must be a Branch or a Warehouse, not both.');
    if (input.to_branch_id && input.to_warehouse_id) errors.push('To must be a Branch or a Warehouse, not both.');
    await this.assertDateInOpenPeriod(transaction as TransactionClient, input.transfer_date).catch(error => errors.push(error.message.replace('Transfer Date cannot be used. ', 'Transfer Date: ')));

    const from = await validateHolder(transaction, this.companyId, {
      branchId: textOrNull(input.from_branch_id), warehouseId: textOrNull(input.from_warehouse_id), locationId: textOrNull(input.from_location_id),
    }, errors, 'From');
    const to = await validateHolder(transaction, this.companyId, {
      branchId: textOrNull(input.to_branch_id), warehouseId: textOrNull(input.to_warehouse_id), locationId: textOrNull(input.to_location_id),
    }, errors, 'To');

    if (from && to && from.branchId === to.branchId && from.warehouseId === to.warehouseId && from.locationId === to.locationId) {
      errors.push('From and To cannot be the same place.');
    }
    if (from && this.scope && !canUseHolder(this.scope, from)) {
      errors.push(this.scope.accessLevel === 'BRANCH' ? 'You can only send stock from your own Branch.' : 'You can only send stock from your own Warehouse.');
    }

    const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
    if (itemRows.length !== new Set(input.lines.map(line => line.item_id)).size) errors.push('One or more transfer items were not found, are Inactive, or are not stock items.');

    for (const [index, line] of input.lines.entries()) {
      const quantity = this.quantity(line.quantity);
      if (quantity.lte(0)) errors.push(`Quantity must be greater than zero on line ${index + 1}.`);
      if (!from) continue;
      const available = await this.getSourceBalance(transaction, line.item_id, from);
      if (available.stockOnHand.lt(quantity)) {
        errors.push(`Not enough stock for line ${index + 1}. Available Stock is ${available.stockOnHand.toFixed(4)}.`);
      }
    }

    if (!warnings.length && input.lines.length > 20) warnings.push('This Stock Transfer has many items. Please review before posting.');
    return from && to ? { from, to } : null;
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
      LEFT JOIN inventory_units_of_measure u ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
      WHERE i.company_id = CAST(${this.companyId} AS uuid)
        AND i.id = ANY(${uniqueIds}::uuid[])
        AND i.is_active = true
        AND i.is_blocked = false
        AND i.is_inventory_item = true
    `;
  }

  private async nextTransferNumber(year: string, transaction: TransactionClient) {
    return nextDocumentNumber(transaction, { companyId: this.companyId, table: 'stock_transfers', prefix: 'ST', year });
  }

  private async getSourceBalance(transaction: TransactionClient | typeof prisma, itemId: string, holder: StockHolder) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND ${holderCondition(holder)}
      LIMIT 1
    `;
    return {
      row: rows[0],
      stockOnHand: this.quantity(rows[0]?.stock_on_hand ?? 0),
      averageCost: this.money(rows[0]?.average_cost ?? 0),
      totalValue: this.money(rows[0]?.total_stock_value ?? 0),
    };
  }

  private async postLine(transaction: TransactionClient, transfer: TransferHeaderRow, line: TransferLineRow, userId: string | null) {
    const quantity = this.quantity(line.quantity);
    const from = fromHolder(transfer);
    const to = toHolder(transfer);
    const source = await this.getSourceBalanceForUpdate(transaction, line.item_id, from);
    if (!source.row) throw businessError(`There is no stock for ${line.item_code}.`);
    if (source.stockOnHand.lt(quantity)) throw businessError(`Not enough stock for ${line.item_code}.`);

    const unitCost = source.averageCost;
    // Moving all remaining stock takes the full source value so no rounding residue stays behind,
    // and a rounded-up average cost can never move more value than the source holds.
    const sourceValue = Decimal.max(0, source.totalValue);
    const transferCost = quantity.eq(source.stockOnHand)
      ? sourceValue
      : Decimal.min(this.money(unitCost.times(quantity)), sourceValue);
    const newSourceQuantity = this.quantity(source.stockOnHand.minus(quantity));
    const newSourceValue = this.money(sourceValue.minus(transferCost));

    await transaction.$queryRaw`
      UPDATE inventory_stock_balances
      SET stock_on_hand = CAST(${newSourceQuantity.toFixed(4)} AS numeric),
          available_stock = CAST(${newSourceQuantity.toFixed(4)} AS numeric) - reserved_stock,
          total_stock_value = CAST(${newSourceValue.toFixed(4)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${source.row.id} AS uuid)
    `;

    await this.insertMovement(transaction, transfer, line, from, 'TRANSFER_OUT', quantity, new Decimal(0), quantity, unitCost, transferCost, newSourceQuantity, userId);

    // lockBalancesForTransfer has already created the destination row when it was missing.
    const destination = await this.getDestinationBalanceForUpdate(transaction, line.item_id, to);
    if (!destination) throw businessError(`Could not add ${line.item_code} to stock at the receiving place. Please try again.`, 500);
    const oldDestinationQuantity = this.quantity(destination.stock_on_hand ?? 0);
    const oldDestinationValue = this.money(destination.total_stock_value ?? 0);
    const newDestinationQuantity = this.quantity(oldDestinationQuantity.plus(quantity));
    const newDestinationValue = this.money(oldDestinationValue.plus(transferCost));
    const newAverageCost = newDestinationQuantity.gt(0) ? newDestinationValue.div(newDestinationQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);

    await transaction.$queryRaw`
      UPDATE inventory_stock_balances
      SET stock_on_hand = CAST(${newDestinationQuantity.toFixed(4)} AS numeric),
          available_stock = CAST(${newDestinationQuantity.toFixed(4)} AS numeric) - reserved_stock,
          average_cost = CAST(${newAverageCost.toFixed(4)} AS numeric),
          total_stock_value = CAST(${newDestinationValue.toFixed(4)} AS numeric),
          is_active = true,
          updated_at = now()
      WHERE id = CAST(${destination.id} AS uuid)
    `;

    await this.insertMovement(transaction, transfer, line, to, 'TRANSFER_IN', quantity, quantity, new Decimal(0), unitCost, transferCost, newDestinationQuantity, userId);

    await transaction.$queryRaw`
      UPDATE stock_transfer_lines
      SET unit_cost = CAST(${unitCost.toFixed(4)} AS numeric),
          total_cost = CAST(${transferCost.toFixed(4)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${line.id} AS uuid)
    `;

    return transferCost;
  }

  private async getDestinationBalanceForUpdate(transaction: TransactionClient, itemId: string, holder: StockHolder) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND ${holderCondition(holder)}
      FOR UPDATE
    `;
    return rows[0];
  }

  private async getSourceBalanceForUpdate(transaction: TransactionClient, itemId: string, holder: StockHolder) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND ${holderCondition(holder)}
      FOR UPDATE
    `;
    return {
      row: rows[0],
      stockOnHand: this.quantity(rows[0]?.stock_on_hand ?? 0),
      averageCost: this.money(rows[0]?.average_cost ?? 0),
      totalValue: this.money(rows[0]?.total_stock_value ?? 0),
    };
  }

  private async insertMovement(
    transaction: TransactionClient,
    transfer: TransferHeaderRow,
    line: TransferLineRow,
    holder: StockHolder,
    movementKind: 'TRANSFER_IN' | 'TRANSFER_OUT',
    signedQuantity: Decimal,
    quantityIn: Decimal,
    quantityOut: Decimal,
    unitCost: Decimal,
    totalCost: Decimal,
    stockAfterMovement: Decimal,
    userId: string | null,
    reversal?: { date: string; remarks: string },
  ) {
    await transaction.$queryRaw`
      INSERT INTO inventory_stock_movements (
        company_id, item_id, branch_id, warehouse_id, location_id, movement_date, movement_kind,
        source_kind, source_document_id, source_document_number, quantity_in, quantity_out,
        unit_cost, total_cost, stock_after_movement, valuation_method, remarks, is_active,
        created_by_id, updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        CAST(${line.item_id} AS uuid),
        ${holder.branchId}::uuid,
        ${holder.warehouseId}::uuid,
        ${holder.locationId}::uuid,
        CAST(${reversal?.date ?? this.databaseDateText(transfer.transfer_date)} AS date),
        ${movementKind}::"StockMovementKind",
        'STOCK_TRANSFER',
        CAST(${transfer.id} AS uuid),
        ${transfer.transfer_number},
        CAST(${quantityIn.toFixed(4)} AS numeric),
        CAST(${quantityOut.toFixed(4)} AS numeric),
        CAST(${unitCost.toFixed(4)} AS numeric),
        CAST(${totalCost.toFixed(4)} AS numeric),
        CAST(${stockAfterMovement.toFixed(4)} AS numeric),
        'WEIGHTED_AVERAGE',
        ${reversal?.remarks ?? `${movementKind === 'TRANSFER_OUT' ? 'Transfer Out' : 'Transfer In'} ${transfer.transfer_number} Qty ${signedQuantity.toFixed(4)}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;
  }
}
