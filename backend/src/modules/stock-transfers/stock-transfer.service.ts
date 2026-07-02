import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { ListStockTransfersQuery, ValidateStockTransferInput } from './stock-transfer.schema.js';

type TransactionClient = Prisma.TransactionClient;

interface TransferHeaderRow {
  id: string;
  transfer_number: string;
  transfer_date: string | Date;
  from_warehouse_id: string;
  from_location_id: string | null;
  to_warehouse_id: string;
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
  return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
}

export class StockTransferService {
  constructor(private readonly companyId: string) {}

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
    if (!rows[0]?.can_post) throw businessError(`Invalid Transfer Date: ${rows[0]?.reason ?? 'Date cannot be posted.'}`);
  }

  async supportData() {
    const [branches, warehouses, locations, items] = await Promise.all([
      prisma.$queryRaw`
        SELECT id, code, name
        FROM branches
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY code ASC
        LIMIT 200
      `,
      prisma.$queryRaw`
        SELECT w.id, w.code, w.name, w.branch_id, b.code AS branch_code, b.name AS branch_name, w.is_default, w.use_locations
        FROM inventory_warehouses w
        LEFT JOIN branches b ON b.id = w.branch_id
        WHERE w.company_id = CAST(${this.companyId} AS uuid)
          AND w.is_active = true
        ORDER BY w.is_default DESC, w.code ASC
        LIMIT 300
      `,
      prisma.$queryRaw`
        SELECT id, warehouse_id, code, name, is_default
        FROM inventory_warehouse_locations
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND is_active = true
        ORDER BY warehouse_id, is_default DESC, code ASC
        LIMIT 500
      `,
      prisma.$queryRaw`
        SELECT
          i.id,
          COALESCE(i.sku, i.item_code) AS item_code,
          i.item_name,
          COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id) AS uom_id,
          u.short_name AS uom_name,
          COALESCE(ss.stock_on_hand, 0)::text AS stock_on_hand
        FROM inventory_items i
        LEFT JOIN inventory_units_of_measure u
          ON u.id = COALESCE(i.stock_uom_id, i.base_uom_id, i.sales_uom_id)
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
          AND i.is_inventory_item = true
        ORDER BY i.item_code ASC
        LIMIT 500
      `,
    ]);

    return { branches, warehouses, locations, items };
  }

  async list(query: ListStockTransfersQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['st.company_id = CAST($1 AS uuid)', 'st.is_active = true'];

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
          fw.code AS from_warehouse_code,
          fw.name AS from_warehouse_name,
          tw.code AS to_warehouse_code,
          tw.name AS to_warehouse_name,
          COUNT(stl.id)::int AS line_count
        FROM stock_transfers st
        JOIN inventory_warehouses fw ON fw.id = st.from_warehouse_id
        JOIN inventory_warehouses tw ON tw.id = st.to_warehouse_id
        LEFT JOIN stock_transfer_lines stl ON stl.stock_transfer_id = st.id AND stl.is_active = true
        WHERE ${whereSql}
        GROUP BY st.id, fw.code, fw.name, tw.code, tw.name
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
        st.from_warehouse_id,
        st.from_location_id,
        st.to_warehouse_id,
        st.to_location_id,
        st.reference_number,
        st.description,
        st.status,
        st.total_quantity::text,
        st.total_cost::text,
        st.posted_at,
        fw.code AS from_warehouse_code,
        fw.name AS from_warehouse_name,
        fl.code AS from_location_code,
        fl.name AS from_location_name,
        tw.code AS to_warehouse_code,
        tw.name AS to_warehouse_name,
        tl.code AS to_location_code,
        tl.name AS to_location_name
      FROM stock_transfers st
      JOIN inventory_warehouses fw ON fw.id = st.from_warehouse_id
      JOIN inventory_warehouses tw ON tw.id = st.to_warehouse_id
      LEFT JOIN inventory_warehouse_locations fl ON fl.id = st.from_location_id
      LEFT JOIN inventory_warehouse_locations tl ON tl.id = st.to_location_id
      WHERE st.company_id = CAST(${this.companyId} AS uuid)
        AND st.id = CAST(${id} AS uuid)
      LIMIT 1
    `;
    const transfer = rows[0];
    if (!transfer) throw businessError('Stock Transfer was not found.', 404);

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
    return prisma.$transaction(async transaction => {
      const errors: string[] = [];
      await this.validateInput(input, errors, [], transaction);
      if (errors.length) throw businessError(errors[0]);

      const transferNumber = await this.nextTransferNumber(input.transfer_date.slice(0, 4), transaction);
      const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
      const itemMap = new Map(itemRows.map(item => [item.id, item]));
      const postedBy = userIdOrNull(userId);
      const totalQuantity = input.lines.reduce((sum, line) => sum.plus(line.quantity), new Decimal(0));

      const headerRows = await transaction.$queryRaw<{ id: string }[]>`
        INSERT INTO stock_transfers (
          company_id, transfer_number, transfer_date, from_warehouse_id, from_location_id,
          to_warehouse_id, to_location_id, reference_number, description, status,
          total_quantity, total_cost, created_by_id, updated_by_id, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          ${transferNumber},
          CAST(${input.transfer_date} AS date),
          CAST(${input.from_warehouse_id} AS uuid),
          ${textOrNull(input.from_location_id)}::uuid,
          CAST(${input.to_warehouse_id} AS uuid),
          ${textOrNull(input.to_location_id)}::uuid,
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

      for (const [index, line] of input.lines.entries()) {
        const item = itemMap.get(line.item_id)!;
        await transaction.$queryRaw`
          INSERT INTO stock_transfer_lines (
            company_id, stock_transfer_id, line_number, item_id, item_code, item_name,
            uom_name, quantity, unit_cost, total_cost, description, updated_at
          )
          VALUES (
            CAST(${this.companyId} AS uuid),
            CAST(${headerRows[0].id} AS uuid),
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

      return { id: headerRows[0].id, transfer_number: transferNumber, status: 'Draft' };
    });
  }

  async createAndPost(input: ValidateStockTransferInput, userId?: string | null) {
    const draft = await this.createDraft(input, userId);
    return this.post(draft.id, userId);
  }

  async post(id: string, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const headerRows = await transaction.$queryRaw<TransferHeaderRow[]>`
        SELECT *
        FROM stock_transfers
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const transfer = headerRows[0];
      if (!transfer) throw businessError('Stock Transfer was not found.', 404);
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
    });
  }

  private async validateInput(input: ValidateStockTransferInput, errors: string[], warnings: string[], transaction: TransactionClient | typeof prisma = prisma) {
    if (input.from_warehouse_id === input.to_warehouse_id && (input.from_location_id || '') === (input.to_location_id || '')) {
      errors.push('From Warehouse and To Warehouse cannot be the same.');
    }
    await this.assertDateInOpenPeriod(transaction as TransactionClient, input.transfer_date).catch(error => errors.push(error.message.replace('Invalid Transfer Date: ', 'Transfer Date: ')));

    const warehouses = await transaction.$queryRaw<{ id: string; use_locations: boolean }[]>`
      SELECT id, use_locations
      FROM inventory_warehouses
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = ANY(${[input.from_warehouse_id, input.to_warehouse_id]}::uuid[])
        AND is_active = true
    `;
    if (warehouses.length !== 2) errors.push('From Warehouse or To Warehouse was not found or is inactive.');

    const fromWarehouse = warehouses.find(warehouse => warehouse.id === input.from_warehouse_id);
    const toWarehouse = warehouses.find(warehouse => warehouse.id === input.to_warehouse_id);
    if (fromWarehouse?.use_locations && !input.from_location_id) errors.push('From Location is required because From Warehouse uses Locations.');
    if (toWarehouse?.use_locations && !input.to_location_id) errors.push('To Location is required because To Warehouse uses Locations.');
    if (fromWarehouse && !fromWarehouse.use_locations && input.from_location_id) errors.push('From Location can only be selected when From Warehouse uses Locations.');
    if (toWarehouse && !toWarehouse.use_locations && input.to_location_id) errors.push('To Location can only be selected when To Warehouse uses Locations.');

    if (input.from_location_id) await this.assertLocationBelongsToWarehouse(transaction, input.from_location_id, input.from_warehouse_id, errors, 'From Location');
    if (input.to_location_id) await this.assertLocationBelongsToWarehouse(transaction, input.to_location_id, input.to_warehouse_id, errors, 'To Location');

    const itemRows = await this.getItemsForLines(input.lines.map(line => line.item_id), transaction);
    if (itemRows.length !== new Set(input.lines.map(line => line.item_id)).size) errors.push('One or more transfer items were not found, inactive, or not stock items.');

    for (const [index, line] of input.lines.entries()) {
      const quantity = this.quantity(line.quantity);
      if (quantity.lte(0)) errors.push(`Quantity must be greater than zero on line ${index + 1}.`);
      const available = await this.getSourceBalance(transaction, line.item_id, input.from_warehouse_id, textOrNull(input.from_location_id));
      if (available.stockOnHand.lt(quantity)) {
        errors.push(`Not enough stock for line ${index + 1}. Available Stock is ${available.stockOnHand.toFixed(4)}.`);
      }
    }

    if (!warnings.length && input.lines.length > 20) warnings.push('This Stock Transfer has many items. Please review before posting.');
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

  private async assertLocationBelongsToWarehouse(transaction: TransactionClient | typeof prisma, locationId: string, warehouseId: string, errors: string[], label: string) {
    const rows = await transaction.$queryRaw<{ id: string }[]>`
      SELECT id
      FROM inventory_warehouse_locations
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${locationId} AS uuid)
        AND warehouse_id = CAST(${warehouseId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    if (!rows[0]) errors.push(`${label} does not belong to the selected Warehouse or is inactive.`);
  }

  private async nextTransferNumber(year: string, transaction: TransactionClient) {
    const rows = await transaction.$queryRaw<{ transfer_number: string }[]>`
      SELECT transfer_number
      FROM stock_transfers
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND transfer_number LIKE ${`ST-${year}-%`}
      ORDER BY transfer_number DESC
      LIMIT 1
      FOR UPDATE
    `;
    const lastSegment = rows[0]?.transfer_number?.split('-').pop() ?? '0000';
    const next = Number.parseInt(lastSegment, 10) + 1;
    return `ST-${year}-${String(next).padStart(4, '0')}`;
  }

  private async getSourceBalance(transaction: TransactionClient | typeof prisma, itemId: string, warehouseId: string, locationId: string | null) {
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

  private async postLine(transaction: TransactionClient, transfer: TransferHeaderRow, line: TransferLineRow, userId: string | null) {
    const quantity = this.quantity(line.quantity);
    const source = await this.getSourceBalanceForUpdate(transaction, line.item_id, transfer.from_warehouse_id, transfer.from_location_id);
    if (!source.row) throw businessError(`No stock balance found for ${line.item_code}.`);
    if (source.stockOnHand.lt(quantity)) throw businessError(`Not enough stock for ${line.item_code}.`);

    const unitCost = source.averageCost;
    const transferCost = this.money(unitCost.times(quantity));
    const newSourceQuantity = this.quantity(source.stockOnHand.minus(quantity));
    const newSourceValue = Decimal.max(0, source.totalValue.minus(transferCost)).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    await transaction.$queryRaw`
      UPDATE inventory_stock_balances
      SET stock_on_hand = CAST(${newSourceQuantity.toFixed(4)} AS numeric),
          available_stock = CAST(${newSourceQuantity.toFixed(4)} AS numeric) - reserved_stock,
          total_stock_value = CAST(${newSourceValue.toFixed(4)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${source.row.id} AS uuid)
    `;

    await this.insertMovement(transaction, transfer, line, transfer.from_warehouse_id, transfer.from_location_id, 'TRANSFER_OUT', quantity, new Decimal(0), quantity, unitCost, transferCost, newSourceQuantity, userId);

    const destination = await this.getDestinationBalanceForUpdate(transaction, line.item_id, transfer.to_warehouse_id, transfer.to_location_id);
    const oldDestinationQuantity = this.quantity(destination?.stock_on_hand ?? 0);
    const oldDestinationValue = this.money(destination?.total_stock_value ?? 0);
    const newDestinationQuantity = this.quantity(oldDestinationQuantity.plus(quantity));
    const newDestinationValue = this.money(oldDestinationValue.plus(transferCost));
    const newAverageCost = newDestinationQuantity.gt(0) ? newDestinationValue.div(newDestinationQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);

    if (destination) {
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
    } else {
      await transaction.$queryRaw`
        INSERT INTO inventory_stock_balances (
          company_id, item_id, warehouse_id, location_id, stock_on_hand, reserved_stock,
          available_stock, average_cost, total_stock_value, is_active, updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${line.item_id} AS uuid),
          CAST(${transfer.to_warehouse_id} AS uuid),
          ${transfer.to_location_id}::uuid,
          CAST(${newDestinationQuantity.toFixed(4)} AS numeric),
          0,
          CAST(${newDestinationQuantity.toFixed(4)} AS numeric),
          CAST(${newAverageCost.toFixed(4)} AS numeric),
          CAST(${newDestinationValue.toFixed(4)} AS numeric),
          true,
          now()
        )
      `;
    }

    await this.insertMovement(transaction, transfer, line, transfer.to_warehouse_id, transfer.to_location_id, 'TRANSFER_IN', quantity, quantity, new Decimal(0), unitCost, transferCost, newDestinationQuantity, userId);

    await transaction.$queryRaw`
      UPDATE stock_transfer_lines
      SET unit_cost = CAST(${unitCost.toFixed(4)} AS numeric),
          total_cost = CAST(${transferCost.toFixed(4)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${line.id} AS uuid)
    `;

    return transferCost;
  }

  private async getDestinationBalanceForUpdate(transaction: TransactionClient, itemId: string, warehouseId: string, locationId: string | null) {
    const rows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${itemId} AS uuid)
        AND warehouse_id = CAST(${warehouseId} AS uuid)
        AND (${locationId}::uuid IS NULL AND location_id IS NULL OR location_id = ${locationId}::uuid)
      FOR UPDATE
    `;
    return rows[0];
  }

  private async getSourceBalanceForUpdate(transaction: TransactionClient, itemId: string, warehouseId: string, locationId: string | null) {
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
    };
  }

  private async insertMovement(
    transaction: TransactionClient,
    transfer: TransferHeaderRow,
    line: TransferLineRow,
    warehouseId: string,
    locationId: string | null,
    movementKind: 'TRANSFER_IN' | 'TRANSFER_OUT',
    signedQuantity: Decimal,
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
        CAST(${warehouseId} AS uuid),
        ${locationId}::uuid,
        CAST(${this.databaseDateText(transfer.transfer_date)} AS date),
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
        ${`${movementKind === 'TRANSFER_OUT' ? 'Transfer Out' : 'Transfer In'} ${transfer.transfer_number} Qty ${signedQuantity.toFixed(4)}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;
  }
}
