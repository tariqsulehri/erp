import { Decimal } from 'decimal.js';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { visibleStockCondition } from '../inventory/stock-holder-access.js';
import type { StockLedgerQuery, StockValuationQuery } from './business-report.schema.js';

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

// Stock value moves by total_cost: added for quantity in, removed for quantity out.
const signedValue = Prisma.sql`CASE WHEN m.quantity_in > 0 THEN m.total_cost ELSE -m.total_cost END`;

/**
 * Stock reports read inventory_stock_movements, the stock history source of truth, so they can show any
 * past date. Branch and Warehouse users only see their own place.
 */
export class StockReportService {
  constructor(private readonly companyId: string, private readonly scope: AccessScope) {}

  private holderFilter(branchId?: string, warehouseId?: string) {
    if (branchId && warehouseId) throw businessError('Select a Branch or a Warehouse, not both.');
    if (this.scope.accessLevel === 'BRANCH' && warehouseId) throw businessError('You can only see stock of your own Branch.', 403);
    if (this.scope.accessLevel === 'BRANCH' && branchId && branchId !== this.scope.branchId) throw businessError('You can only see stock of your own Branch.', 403);
    if (this.scope.accessLevel === 'WAREHOUSE' && branchId) throw businessError('You can only see stock of your own Warehouse.', 403);
    if (this.scope.accessLevel === 'WAREHOUSE' && warehouseId && warehouseId !== this.scope.warehouseId) throw businessError('You can only see stock of your own Warehouse.', 403);

    const parts = [visibleStockCondition(this.scope, 'm')];
    if (branchId) parts.push(Prisma.sql`m.branch_id = ${branchId}::uuid`);
    if (warehouseId) parts.push(Prisma.sql`m.warehouse_id = ${warehouseId}::uuid`);
    return Prisma.join(parts, ' AND ');
  }

  /** Movements of one item in a date range with opening, running and closing quantity and value. */
  async getStockLedger(query: StockLedgerQuery) {
    if (query.date_to < query.date_from) throw businessError('Date To cannot be before Date From.');
    const holder = this.holderFilter(query.branch_id, query.warehouse_id);

    const items = await prisma.$queryRaw<Array<{ id: string; item_code: string; item_name: string }>>`
      SELECT id::text, COALESCE(sku, item_code) AS item_code, item_name
      FROM inventory_items
      WHERE company_id = CAST(${this.companyId} AS uuid) AND id = CAST(${query.item_id} AS uuid)
    `;
    if (!items[0]) throw businessError('Item was not found.', 404);

    const [openingRows, movements] = await Promise.all([
      prisma.$queryRaw<Array<{ quantity: string; value: string }>>`
        SELECT COALESCE(SUM(m.quantity_in - m.quantity_out), 0)::text AS quantity,
               COALESCE(SUM(${signedValue}), 0)::text AS value
        FROM inventory_stock_movements m
        WHERE m.company_id = CAST(${this.companyId} AS uuid)
          AND m.item_id = CAST(${query.item_id} AS uuid)
          AND m.is_active = true
          AND m.movement_date < CAST(${query.date_from} AS date)
          AND ${holder}
      `,
      prisma.$queryRaw<Array<{
        id: string; movement_date: Date; movement_kind: string; source_document_number: string | null;
        quantity_in: string; quantity_out: string; unit_cost: string; total_cost: string;
        branch_name: string | null; warehouse_name: string | null; remarks: string | null;
      }>>`
        SELECT m.id::text, m.movement_date, m.movement_kind::text, m.source_document_number,
               m.quantity_in::text, m.quantity_out::text, m.unit_cost::text, m.total_cost::text,
               b.name AS branch_name, w.name AS warehouse_name, m.remarks
        FROM inventory_stock_movements m
        LEFT JOIN branches b ON b.id = m.branch_id
        LEFT JOIN inventory_warehouses w ON w.id = m.warehouse_id
        WHERE m.company_id = CAST(${this.companyId} AS uuid)
          AND m.item_id = CAST(${query.item_id} AS uuid)
          AND m.is_active = true
          AND m.movement_date BETWEEN CAST(${query.date_from} AS date) AND CAST(${query.date_to} AS date)
          AND ${holder}
        ORDER BY m.movement_date, m.created_at, m.id
      `,
    ]);

    const openingQuantity = new Decimal(openingRows[0]?.quantity ?? 0);
    const openingValue = new Decimal(openingRows[0]?.value ?? 0);
    let runningQuantity = openingQuantity;
    let runningValue = openingValue;
    let totalIn = new Decimal(0);
    let totalOut = new Decimal(0);

    const lines = movements.map(row => {
      const quantityIn = new Decimal(row.quantity_in);
      const quantityOut = new Decimal(row.quantity_out);
      const value = new Decimal(row.total_cost);
      totalIn = totalIn.plus(quantityIn);
      totalOut = totalOut.plus(quantityOut);
      runningQuantity = runningQuantity.plus(quantityIn).minus(quantityOut);
      runningValue = quantityIn.gt(0) ? runningValue.plus(value) : runningValue.minus(value);
      return {
        id: row.id,
        movement_date: row.movement_date.toISOString().slice(0, 10),
        movement_kind: row.movement_kind,
        document_number: row.source_document_number,
        place: row.branch_name ?? row.warehouse_name ?? '',
        quantity_in: quantityIn.toFixed(4),
        quantity_out: quantityOut.toFixed(4),
        unit_cost: new Decimal(row.unit_cost).toFixed(4),
        value: value.toFixed(2),
        balance_quantity: runningQuantity.toFixed(4),
        balance_value: runningValue.toFixed(2),
        remarks: row.remarks,
      };
    });

    return {
      item: items[0],
      date_from: query.date_from,
      date_to: query.date_to,
      opening_quantity: openingQuantity.toFixed(4),
      opening_value: openingValue.toFixed(2),
      total_quantity_in: totalIn.toFixed(4),
      total_quantity_out: totalOut.toFixed(4),
      closing_quantity: runningQuantity.toFixed(4),
      closing_value: runningValue.toFixed(2),
      lines,
    };
  }

  /**
   * Quantity and value of every item at each Branch or Warehouse on a date, and a check against the
   * Inventory accounts in the ledger. Opening stock loaded without a ledger entry is shown separately,
   * because it is the usual reason the two differ.
   */
  async getStockValuation(query: StockValuationQuery) {
    const holder = this.holderFilter(query.branch_id, query.warehouse_id);

    const rows = await prisma.$queryRaw<Array<{
      item_id: string; item_code: string; item_name: string; place_kind: string; place_name: string;
      quantity: string; value: string;
    }>>`
      SELECT i.id::text AS item_id, COALESCE(i.sku, i.item_code) AS item_code, i.item_name,
             CASE WHEN m.branch_id IS NOT NULL THEN 'Branch' ELSE 'Warehouse' END AS place_kind,
             COALESCE(b.name, w.name, '') AS place_name,
             SUM(m.quantity_in - m.quantity_out)::text AS quantity,
             SUM(${signedValue})::text AS value
      FROM inventory_stock_movements m
      JOIN inventory_items i ON i.id = m.item_id
      LEFT JOIN branches b ON b.id = m.branch_id
      LEFT JOIN inventory_warehouses w ON w.id = m.warehouse_id
      WHERE m.company_id = CAST(${this.companyId} AS uuid)
        AND m.is_active = true
        AND m.movement_date <= CAST(${query.as_of_date} AS date)
        AND ${holder}
      GROUP BY i.id, i.sku, i.item_code, i.item_name, m.branch_id, m.warehouse_id, b.name, w.name
      HAVING SUM(m.quantity_in - m.quantity_out) <> 0 OR SUM(${signedValue}) <> 0
      ORDER BY i.item_name, place_name
    `;

    let totalQuantity = new Decimal(0);
    let totalValue = new Decimal(0);
    const lines = rows.map(row => {
      const quantity = new Decimal(row.quantity);
      const value = new Decimal(row.value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalQuantity = totalQuantity.plus(quantity);
      totalValue = totalValue.plus(value);
      return {
        ...row,
        quantity: quantity.toFixed(4),
        average_cost: quantity.gt(0) ? value.div(quantity).toFixed(4) : '0.0000',
        value: value.toFixed(2),
      };
    });

    // The ledger check compares the whole company, so it is only shown to All Branches users without a place filter.
    const showLedgerCheck = this.scope.accessLevel === 'ALL_BRANCHES' && !query.branch_id && !query.warehouse_id;
    let ledgerCheck = null;
    if (showLedgerCheck) {
      const [ledgerRows, openingStockRows] = await Promise.all([
        prisma.$queryRaw<Array<{ value: string }>>`
          SELECT COALESCE(SUM(vl.dr_amount - vl.cr_amount), 0)::text AS value
          FROM voucher_lines vl
          JOIN vouchers v ON v.id = vl.voucher_id AND v.company_id = vl.company_id
          WHERE vl.company_id = CAST(${this.companyId} AS uuid)
            AND v.status = 'Posted'
            AND v.voucher_date <= CAST(${query.as_of_date} AS date)
            AND vl.account_id IN (
              SELECT default_inventory_account_id FROM purchase_settings WHERE company_id = CAST(${this.companyId} AS uuid)
              UNION SELECT default_inventory_account_id FROM sale_settings WHERE company_id = CAST(${this.companyId} AS uuid)
              UNION SELECT default_inventory_account_id FROM stock_adjustment_settings WHERE company_id = CAST(${this.companyId} AS uuid)
            )
        `,
        prisma.$queryRaw<Array<{ value: string }>>`
          SELECT COALESCE(SUM(m.total_cost), 0)::text AS value
          FROM inventory_stock_movements m
          WHERE m.company_id = CAST(${this.companyId} AS uuid)
            AND m.is_active = true
            AND m.movement_kind::text = 'OPENING_BALANCE'
            AND m.movement_date <= CAST(${query.as_of_date} AS date)
        `,
      ]);
      const ledgerValue = new Decimal(ledgerRows[0]?.value ?? 0);
      const difference = totalValue.minus(ledgerValue);
      ledgerCheck = {
        stock_value: totalValue.toFixed(2),
        inventory_account_balance: ledgerValue.toFixed(2),
        difference: difference.toFixed(2),
        is_matched: difference.isZero(),
        opening_stock_value: new Decimal(openingStockRows[0]?.value ?? 0).toFixed(2),
      };
    }

    return {
      as_of_date: query.as_of_date,
      totals: { quantity: totalQuantity.toFixed(4), value: totalValue.toFixed(2), line_count: lines.length },
      ledger_check: ledgerCheck,
      lines,
    };
  }
}
