import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { holderCondition, holderFromColumns } from '../inventory/stock-holder.js';
import { assertCanUseHolder } from '../inventory/stock-holder-access.js';
import { averageUnitCost } from '../inventory/stock-cost.js';
import { SaleSupportService } from '../sales/sale-support.service.js';
import { insertPostedVoucher, type PostingLine } from '../vouchers/voucher-posting.js';

type TransactionClient = Prisma.TransactionClient;

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

interface AccountRow {
  id: string;
  code: string;
  name: string;
}

interface SaleSettingsRow {
  default_cash_account_id: string;
  default_inventory_account_id: string;
  sales_revenue_account_id: string;
  sales_tax_account_id: string | null;
  sales_discount_account_id: string | null;
  freight_income_account_id: string | null;
  cost_of_goods_sold_account_id: string;
}

interface SaleReturnForPost {
  id: string;
  sale_return_number: string;
  sale_return_date: string | Date;
  customer_account_id: string;
  payment_type: 'Cash' | 'Credit';
  status: 'Draft' | 'Posted' | 'Voided';
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
  cost_amount: string;
  description: string | null;
  reference_number: string | null;
  branch_id: string | null;
  warehouse_id: string | null;
  location_id: string | null;
}

interface SaleReturnLineForPost {
  id: string;
  item_id: string;
  branch_id: string | null;
  warehouse_id: string | null;
  quantity: string;
  sale_price: string;
  unit_cost: string;
  cost_amount: string;
}

export class SaleReturnPostService {
  constructor(private readonly companyId: string) {}

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private quantity(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  }

  private databaseDateText(value: string | Date) {
    const date = value instanceof Date ? value : new Date(value);
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
      ORDER BY (fp.end_date >= d.posting_date) DESC NULLS LAST
      LIMIT 1
    `;

    const result = rows[0];
    if (!result?.can_post) {
      const error = new Error(`Invalid Sale Return Date: ${result?.reason ?? 'Date cannot be posted.'}`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }

  private async getSaleSettings(transaction: TransactionClient) {
    await new SaleSupportService(this.companyId).ensureSettingsReady();
    const rows = await transaction.$queryRaw<SaleSettingsRow[]>`
      SELECT
        default_cash_account_id,
        default_inventory_account_id,
        sales_revenue_account_id,
        sales_tax_account_id,
        sales_discount_account_id,
        freight_income_account_id,
        cost_of_goods_sold_account_id
      FROM sale_settings
      WHERE company_id = CAST(${this.companyId} AS uuid)
      LIMIT 1
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
    if (!rows[0]) {
      const error = new Error(`${label} is not set or is inactive.`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    return rows[0];
  }

  async post(id: string, userId?: string | null, scope?: AccessScope) {
    return prisma.$transaction(async transaction => {
      const returnRows = await transaction.$queryRaw<SaleReturnForPost[]>`
        SELECT *
        FROM sale_returns
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const saleReturn = returnRows[0];
      if (!saleReturn) {
        const error = new Error('Sale Return was not found.');
        Object.assign(error, { statusCode: 404 });
        throw error;
      }
      if (scope) assertCanUseHolder(scope, holderFromColumns(saleReturn.branch_id, saleReturn.warehouse_id), 'post Sale Returns');
      if (saleReturn.status !== 'Draft') {
        const error = new Error('Only Draft sale returns can be posted.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const returnDateText = this.databaseDateText(saleReturn.sale_return_date);
      await this.assertDateInOpenPeriod(transaction, returnDateText);

      const settings = await this.getSaleSettings(transaction);
      const cashAccount = await this.getAccount(transaction, settings.default_cash_account_id, 'Default Cash Account');
      const customerAccount = await this.getAccount(transaction, saleReturn.customer_account_id, 'Customer Linked Account');
      const inventoryAccount = await this.getAccount(transaction, settings.default_inventory_account_id, 'Default Inventory Account');
      const revenueAccount = await this.getAccount(transaction, settings.sales_revenue_account_id, 'Sales Revenue Account');
      const cogsAccount = await this.getAccount(transaction, settings.cost_of_goods_sold_account_id, 'Cost Of Goods Sold Account');
      const taxAccount = settings.sales_tax_account_id
        ? await this.getAccount(transaction, settings.sales_tax_account_id, 'Sales Tax Account')
        : null;
      const discountAccount = settings.sales_discount_account_id
        ? await this.getAccount(transaction, settings.sales_discount_account_id, 'Sales Discount Account')
        : null;
      const freightAccount = settings.freight_income_account_id
        ? await this.getAccount(transaction, settings.freight_income_account_id, 'Freight Income Account')
        : null;

      const lines = await transaction.$queryRaw<SaleReturnLineForPost[]>`
        SELECT *
        FROM sale_return_lines
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND sale_return_id = CAST(${id} AS uuid)
          AND is_active = true
        ORDER BY line_number ASC
      `;
      if (lines.length === 0) {
        const error = new Error('Sale Return has no items.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const netAmount = this.money(saleReturn.net_amount);
      const revenueAmount = this.money(saleReturn.gross_amount);
      const discountAmount = this.money(saleReturn.discount_amount);
      const taxAmount = this.money(saleReturn.tax_amount);
      const freightAmount = this.money(saleReturn.freight_amount);
      if (taxAmount.gt(0) && !taxAccount) throw businessError('Sales Tax Account is not set.');
      if (discountAmount.gt(0) && !discountAccount) throw businessError('Sales Discount Account is not set.');
      if (freightAmount.gt(0) && !freightAccount) throw businessError('Freight Income Account is not set.');

      const postedBy = this.userIdOrNull(userId);
      // Returned stock is valued line by line at posting time; the voucher uses the same total.
      let costAmount = new Decimal(0);
      for (const line of [...lines].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
        costAmount = costAmount.plus(await this.postStockLine(transaction, saleReturn, line, postedBy));
      }

      const voucherLines: PostingLine[] = [
        {
          account: revenueAccount,
          debit: revenueAmount,
          credit: new Decimal(0),
          narration: `Reverse sales revenue ${saleReturn.sale_return_number}`,
        },
        ...(taxAmount.gt(0) && taxAccount ? [{
          account: taxAccount,
          debit: taxAmount,
          credit: new Decimal(0),
          narration: `Reverse sales tax ${saleReturn.sale_return_number}`,
        }] : []),
        ...(freightAmount.gt(0) && freightAccount ? [{
          account: freightAccount,
          debit: freightAmount,
          credit: new Decimal(0),
          narration: `Reverse sale freight ${saleReturn.sale_return_number}`,
        }] : []),
        {
          account: inventoryAccount,
          debit: costAmount,
          credit: new Decimal(0),
          narration: `Inventory returned from customer ${saleReturn.sale_return_number}`,
        },
        {
          account: saleReturn.payment_type === 'Cash' ? cashAccount : customerAccount,
          debit: new Decimal(0),
          credit: netAmount,
          narration: saleReturn.payment_type === 'Cash'
            ? `Cash refund for ${saleReturn.sale_return_number}`
            : `Customer receivable reduced for ${saleReturn.sale_return_number}`,
        },
        ...(discountAmount.gt(0) && discountAccount ? [{
          account: discountAccount,
          debit: new Decimal(0),
          credit: discountAmount,
          narration: `Reverse sales discount ${saleReturn.sale_return_number}`,
        }] : []),
        {
          account: cogsAccount,
          debit: new Decimal(0),
          credit: costAmount,
          narration: `Reverse cost of goods sold ${saleReturn.sale_return_number}`,
        },
      ];

      const voucherId = await insertPostedVoucher(transaction, {
        companyId: this.companyId,
        voucherNumber: saleReturn.sale_return_number,
        voucherType: 'SR',
        voucherDate: returnDateText,
        reference: saleReturn.reference_number,
        narration: saleReturn.description || 'Sale Return',
        userId: postedBy,
        lines: voucherLines,
      });

      await transaction.$queryRaw`
        UPDATE sale_returns
        SET status = 'Posted',
            cost_amount = CAST(${costAmount.toFixed(2)} AS numeric),
            accounting_voucher_id = CAST(${voucherId} AS uuid),
            posted_by_id = ${postedBy}::uuid,
            posted_at = now(),
            updated_by_id = ${postedBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;

      return {
        id,
        sale_return_number: saleReturn.sale_return_number,
        accounting_voucher_id: voucherId,
        status: 'Posted',
      };
    });
  }

  private async postStockLine(
    transaction: TransactionClient,
    saleReturn: SaleReturnForPost,
    line: SaleReturnLineForPost,
    userId: string | null,
  ) {
    const quantity = this.quantity(line.quantity);
    // New returns add Branch stock; drafts saved before Branch stock existed still use their Warehouse.
    const holder = holderFromColumns(line.branch_id, line.warehouse_id, saleReturn.location_id);

    const balanceRows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${line.item_id} AS uuid)
        AND ${holderCondition(holder)}
      FOR UPDATE
    `;
    const existing = balanceRows[0];
    const oldQuantity = this.quantity(existing?.stock_on_hand ?? 0);
    const oldValue = this.money(existing?.total_stock_value ?? 0);
    const unitCost = averageUnitCost(oldQuantity, oldValue) ?? this.quantity(line.unit_cost);
    const lineCost = this.money(quantity.times(unitCost));

    await transaction.$executeRaw`
      UPDATE sale_return_lines
      SET unit_cost = CAST(${unitCost.toFixed(4)} AS numeric),
          cost_amount = CAST(${lineCost.toFixed(2)} AS numeric),
          updated_at = now()
      WHERE id = CAST(${line.id} AS uuid)
    `;
    const newQuantity = this.quantity(oldQuantity.plus(quantity));
    const newValue = this.money(oldValue.plus(lineCost));
    const averageCost = newQuantity.gt(0)
      ? newValue.div(newQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

    if (existing) {
      await transaction.$queryRaw`
        UPDATE inventory_stock_balances
        SET stock_on_hand = CAST(${newQuantity.toFixed(4)} AS numeric),
            available_stock = CAST(${newQuantity.toFixed(4)} AS numeric) - reserved_stock,
            average_cost = CAST(${averageCost.toFixed(4)} AS numeric),
            total_stock_value = CAST(${newValue.toFixed(2)} AS numeric),
            is_active = true,
            updated_at = now()
        WHERE id = CAST(${existing.id} AS uuid)
      `;
    } else {
      await transaction.$queryRaw`
        INSERT INTO inventory_stock_balances (
          company_id,
          item_id,
          branch_id,
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
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${line.item_id} AS uuid),
          ${holder.branchId}::uuid,
          ${holder.warehouseId}::uuid,
          ${holder.locationId}::uuid,
          CAST(${newQuantity.toFixed(4)} AS numeric),
          0,
          CAST(${newQuantity.toFixed(4)} AS numeric),
          CAST(${averageCost.toFixed(4)} AS numeric),
          CAST(${newValue.toFixed(2)} AS numeric),
          true,
          now()
        )
      `;
    }

    await transaction.$queryRaw`
      INSERT INTO inventory_stock_movements (
        company_id,
        item_id,
        branch_id,
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
        CAST(${this.companyId} AS uuid),
        CAST(${line.item_id} AS uuid),
        ${holder.branchId}::uuid,
        ${holder.warehouseId}::uuid,
        ${holder.locationId}::uuid,
        CAST(${this.databaseDateText(saleReturn.sale_return_date)} AS date),
        'SALES_RETURN',
        'SALES_RETURN',
        CAST(${saleReturn.id} AS uuid),
        ${saleReturn.sale_return_number},
        CAST(${quantity.toFixed(4)} AS numeric),
        0,
        CAST(${unitCost.toFixed(4)} AS numeric),
        CAST(${lineCost.toFixed(2)} AS numeric),
        CAST(${newQuantity.toFixed(4)} AS numeric),
        'WEIGHTED_AVERAGE',
        ${`Sale Return ${saleReturn.sale_return_number}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;

    return lineCost;
  }
}
