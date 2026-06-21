import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { SaleSupportService } from './sale-support.service.js';

type TransactionClient = Prisma.TransactionClient;

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

interface SaleInvoiceForPost {
  id: string;
  sale_number: string;
  sale_date: string | Date;
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
  customer_reference_number: string | null;
  location_id: string | null;
}

interface SaleLineForPost {
  id: string;
  item_id: string;
  warehouse_id: string;
  quantity: string;
  sale_price: string;
  unit_cost: string;
  cost_amount: string;
}

export class SalePostService {
  constructor(private readonly companyId: string) {}

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
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
      LIMIT 1
    `;

    const result = rows[0];
    if (!result?.can_post) {
      const error = new Error(`Invalid Sale Date: ${result?.reason ?? 'Date cannot be posted.'}`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }

  private async getSaleSettings(transaction: TransactionClient) {
    await new SaleSupportService(this.companyId).getSupportData();
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

  async post(id: string, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const invoiceRows = await transaction.$queryRaw<SaleInvoiceForPost[]>`
        SELECT *
        FROM sale_invoices
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const invoice = invoiceRows[0];
      if (!invoice) {
        const error = new Error('Sale Voucher was not found.');
        Object.assign(error, { statusCode: 404 });
        throw error;
      }
      if (invoice.status !== 'Draft') {
        const error = new Error('Only Draft sale vouchers can be posted.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const saleDateText = this.databaseDateText(invoice.sale_date);
      await this.assertDateInOpenPeriod(transaction, saleDateText);

      const settings = await this.getSaleSettings(transaction);
      const cashAccount = await this.getAccount(transaction, settings.default_cash_account_id, 'Default Cash Account');
      const customerAccount = await this.getAccount(transaction, invoice.customer_account_id, 'Customer Linked Account');
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

      const lines = await transaction.$queryRaw<SaleLineForPost[]>`
        SELECT *
        FROM sale_invoice_lines
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND sale_invoice_id = CAST(${id} AS uuid)
          AND is_active = true
        ORDER BY line_number ASC
      `;
      if (lines.length === 0) {
        const error = new Error('Sale Voucher has no items.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const netAmount = this.money(invoice.net_amount);
      const revenueAmount = this.money(invoice.gross_amount);
      const discountAmount = this.money(invoice.discount_amount);
      const taxAmount = this.money(invoice.tax_amount);
      const freightAmount = this.money(invoice.freight_amount);
      const costAmount = this.money(invoice.cost_amount);
      if (taxAmount.gt(0) && !taxAccount) throw new Error('Sales Tax Account is not set.');
      if (discountAmount.gt(0) && !discountAccount) throw new Error('Sales Discount Account is not set.');
      if (freightAmount.gt(0) && !freightAccount) throw new Error('Freight Income Account is not set.');
      const voucherTotal = netAmount.plus(discountAmount).plus(costAmount);

      const postedBy = this.userIdOrNull(userId);
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
          ${invoice.sale_number},
          'SI',
          CAST(${saleDateText} AS date),
          ${invoice.customer_reference_number},
          ${invoice.description || 'Sale Voucher'},
          'Posted',
          'Not Required',
          CAST(${voucherTotal.toFixed(2)} AS numeric),
          CAST(${voucherTotal.toFixed(2)} AS numeric),
          ${postedBy}::uuid,
          ${postedBy}::uuid,
          now(),
          now()
        )
        RETURNING id
      `;
      const voucherId = voucherRows[0].id;

      const voucherLines = [
        {
          account: invoice.payment_type === 'Cash' ? cashAccount : customerAccount,
          debit: netAmount,
          credit: new Decimal(0),
          narration: invoice.payment_type === 'Cash'
            ? `Cash received for ${invoice.sale_number}`
            : `Customer receivable for ${invoice.sale_number}`,
        },
        ...(discountAmount.gt(0) && discountAccount ? [{
          account: discountAccount,
          debit: discountAmount,
          credit: new Decimal(0),
          narration: `Sales discount allowed ${invoice.sale_number}`,
        }] : []),
        {
          account: revenueAccount,
          debit: new Decimal(0),
          credit: revenueAmount,
          narration: `Sales revenue ${invoice.sale_number}`,
        },
        ...(taxAmount.gt(0) && taxAccount ? [{
          account: taxAccount,
          debit: new Decimal(0),
          credit: taxAmount,
          narration: `Sales tax ${invoice.sale_number}`,
        }] : []),
        ...(freightAmount.gt(0) && freightAccount ? [{
          account: freightAccount,
          debit: new Decimal(0),
          credit: freightAmount,
          narration: `Sale freight ${invoice.sale_number}`,
        }] : []),
        {
          account: cogsAccount,
          debit: costAmount,
          credit: new Decimal(0),
          narration: `Cost of goods sold ${invoice.sale_number}`,
        },
        {
          account: inventoryAccount,
          debit: new Decimal(0),
          credit: costAmount,
          narration: `Inventory issued for ${invoice.sale_number}`,
        },
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

      for (const line of lines) {
        await this.postStockLine(transaction, invoice, line, postedBy);
      }

      await transaction.$queryRaw`
        UPDATE sale_invoices
        SET status = 'Posted',
            accounting_voucher_id = CAST(${voucherId} AS uuid),
            posted_by_id = ${postedBy}::uuid,
            posted_at = now(),
            updated_by_id = ${postedBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;

      return { id, sale_number: invoice.sale_number, accounting_voucher_id: voucherId, status: 'Posted' };
    });
  }

  private async postStockLine(
    transaction: TransactionClient,
    invoice: SaleInvoiceForPost,
    line: SaleLineForPost,
    userId: string | null,
  ) {
    const quantity = this.quantity(line.quantity);
    const lineCost = this.money(line.cost_amount);
    const unitCost = this.quantity(line.unit_cost);

    const balanceRows = await transaction.$queryRaw<any[]>`
      SELECT *
      FROM inventory_stock_balances
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND item_id = CAST(${line.item_id} AS uuid)
        AND warehouse_id = CAST(${line.warehouse_id} AS uuid)
        AND (${invoice.location_id}::uuid IS NULL AND location_id IS NULL OR location_id = ${invoice.location_id}::uuid)
      FOR UPDATE
    `;
    const existing = balanceRows[0];
    if (!existing) {
      const error = new Error('Stock balance was not found for one or more sale items.');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }

    const oldQuantity = this.quantity(existing.stock_on_hand ?? 0);
    if (oldQuantity.lt(quantity)) {
      const error = new Error('Stock is not enough for one or more sale items.');
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    const oldValue = this.money(existing.total_stock_value ?? 0);
    const newQuantity = this.quantity(oldQuantity.minus(quantity));
    const newValue = Decimal.max(0, oldValue.minus(lineCost)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const averageCost = newQuantity.gt(0)
      ? newValue.div(newQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP)
      : new Decimal(0);

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

    await transaction.$queryRaw`
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
        CAST(${this.companyId} AS uuid),
        CAST(${line.item_id} AS uuid),
        CAST(${line.warehouse_id} AS uuid),
        ${invoice.location_id}::uuid,
        CAST(${this.databaseDateText(invoice.sale_date)} AS date),
        'SALES_DELIVERY',
        'SALES_INVOICE',
        CAST(${invoice.id} AS uuid),
        ${invoice.sale_number},
        0,
        CAST(${quantity.toFixed(4)} AS numeric),
        CAST(${unitCost.toFixed(4)} AS numeric),
        CAST(${lineCost.toFixed(2)} AS numeric),
        CAST(${newQuantity.toFixed(4)} AS numeric),
        'WEIGHTED_AVERAGE',
        ${`Sale Voucher ${invoice.sale_number}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;

    await transaction.$queryRaw`
      UPDATE inventory_items
      SET default_sales_price = CAST(${line.sale_price} AS numeric),
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${line.item_id} AS uuid)
    `;
  }
}
