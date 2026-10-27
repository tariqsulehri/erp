import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { insertPostedVoucher, type PostingLine } from '../vouchers/voucher-posting.js';
import { PurchaseSupportService } from './purchase-support.service.js';

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

interface PurchaseSettingsRow {
  default_cash_account_id: string;
  default_inventory_account_id: string;
  purchase_tax_account_id: string | null;
  freight_account_id: string | null;
  purchase_discount_account_id: string | null;
}

interface PurchaseInvoiceForPost {
  id: string;
  purchase_number: string;
  purchase_date: string | Date;
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
  location_id: string | null;
}

interface PurchaseLineForPost {
  id: string;
  item_id: string;
  warehouse_id: string;
  quantity: string;
  purchase_price: string;
  discount_amount: string;
}

export class PurchasePostService {
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
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

    const result = rows[0];
    if (!result?.can_post) {
      const error = new Error(`Purchase Date cannot be used. ${result?.reason ?? 'You cannot post on this date.'}`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
  }

  private async getPurchaseSettings(transaction: TransactionClient) {
    await new PurchaseSupportService(this.companyId).getSupportData();
    const rows = await transaction.$queryRaw<PurchaseSettingsRow[]>`
      SELECT
        default_cash_account_id,
        default_inventory_account_id,
        purchase_tax_account_id,
        freight_account_id,
        purchase_discount_account_id
      FROM purchase_settings
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
      const error = new Error(`${label} is not set up or is Inactive.`);
      Object.assign(error, { statusCode: 400 });
      throw error;
    }
    return rows[0];
  }

  async post(id: string, userId?: string | null) {
    return prisma.$transaction(async transaction => {
      const invoiceRows = await transaction.$queryRaw<PurchaseInvoiceForPost[]>`
        SELECT *
        FROM purchase_invoices
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
        FOR UPDATE
      `;
      const invoice = invoiceRows[0];
      if (!invoice) {
        const error = new Error('Purchase Voucher was not found.');
        Object.assign(error, { statusCode: 404 });
        throw error;
      }
      if (invoice.status !== 'Draft') {
        const error = new Error('Only Draft purchase vouchers can be posted.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const purchaseDateText = this.databaseDateText(invoice.purchase_date);
      await this.assertDateInOpenPeriod(transaction, purchaseDateText);

      const settings = await this.getPurchaseSettings(transaction);
      const inventoryAccount = await this.getAccount(transaction, settings.default_inventory_account_id, 'Default Inventory Account');
      const cashAccount = await this.getAccount(transaction, settings.default_cash_account_id, 'Default Cash Account');
      const supplierAccount = await this.getAccount(transaction, invoice.supplier_account_id, 'Supplier Linked Account');
      const taxAccount = settings.purchase_tax_account_id
        ? await this.getAccount(transaction, settings.purchase_tax_account_id, 'Purchase Tax Account')
        : null;
      const freightAccount = settings.freight_account_id
        ? await this.getAccount(transaction, settings.freight_account_id, 'Freight Account')
        : null;
      const discountAccount = settings.purchase_discount_account_id
        ? await this.getAccount(transaction, settings.purchase_discount_account_id, 'Purchase Discount Received Account')
        : null;

      const lines = await transaction.$queryRaw<PurchaseLineForPost[]>`
        SELECT *
        FROM purchase_invoice_lines
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND purchase_invoice_id = CAST(${id} AS uuid)
          AND is_active = true
        ORDER BY line_number ASC
      `;
      if (lines.length === 0) {
        const error = new Error('Purchase Voucher has no items.');
        Object.assign(error, { statusCode: 400 });
        throw error;
      }

      const netAmount = this.money(invoice.net_amount);
      const discountAmount = this.money(invoice.discount_amount);
      const taxAmount = this.money(invoice.tax_amount);
      const freightAmount = this.money(invoice.freight_amount);
      if (taxAmount.gt(0) && !taxAccount) throw businessError('Purchase Tax Account is not set.');
      if (freightAmount.gt(0) && !freightAccount) throw businessError('Freight Account is not set.');
      if (discountAmount.gt(0) && !discountAccount) throw businessError('Purchase Discount Received Account is not set.');

      const postedBy = this.userIdOrNull(userId);
      // Inventory is debited with the same before-discount line cost written to stock, so the
      // Inventory account always equals stock value; the discount is credited to its own account.
      let inventoryAmount = new Decimal(0);
      for (const line of [...lines].sort((a, b) => a.item_id.localeCompare(b.item_id))) {
        inventoryAmount = inventoryAmount.plus(await this.postStockLine(transaction, invoice, line, postedBy));
      }

      const voucherLines: PostingLine[] = [
        {
          account: inventoryAccount,
          debit: inventoryAmount,
          credit: new Decimal(0),
          narration: `Inventory purchase ${invoice.purchase_number}`,
        },
        ...(taxAmount.gt(0) && taxAccount ? [{
          account: taxAccount,
          debit: taxAmount,
          credit: new Decimal(0),
          narration: `Purchase tax ${invoice.purchase_number}`,
        }] : []),
        ...(freightAmount.gt(0) && freightAccount ? [{
          account: freightAccount,
          debit: freightAmount,
          credit: new Decimal(0),
          narration: `Purchase freight ${invoice.purchase_number}`,
        }] : []),
        ...(discountAmount.gt(0) && discountAccount ? [{
          account: discountAccount,
          debit: new Decimal(0),
          credit: discountAmount,
          narration: `Purchase discount received ${invoice.purchase_number}`,
        }] : []),
        {
          account: invoice.payment_type === 'Cash' ? cashAccount : supplierAccount,
          debit: new Decimal(0),
          credit: netAmount,
          narration: invoice.payment_type === 'Cash'
            ? `Cash paid for ${invoice.purchase_number}`
            : `Supplier payable for ${invoice.purchase_number}`,
        },
      ];

      const voucherId = await insertPostedVoucher(transaction, {
        companyId: this.companyId,
        voucherNumber: invoice.purchase_number,
        voucherType: 'PI',
        voucherDate: purchaseDateText,
        reference: invoice.reference_number,
        narration: invoice.description || 'Purchase Voucher',
        userId: postedBy,
        lines: voucherLines,
      });

      await transaction.$queryRaw`
        UPDATE purchase_invoices
        SET status = 'Posted',
            accounting_voucher_id = CAST(${voucherId} AS uuid),
            posted_by_id = ${postedBy}::uuid,
            posted_at = now(),
            updated_by_id = ${postedBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;

      return { id, purchase_number: invoice.purchase_number, accounting_voucher_id: voucherId, status: 'Posted' };
    });
  }

  private async postStockLine(
    transaction: TransactionClient,
    invoice: PurchaseInvoiceForPost,
    line: PurchaseLineForPost,
    userId: string | null,
  ) {
    const quantity = this.quantity(line.quantity);
    const lineCost = this.money(quantity.times(this.money(line.purchase_price)));
    const unitCost = quantity.gt(0) ? lineCost.div(quantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);

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
    const oldQuantity = this.quantity(existing?.stock_on_hand ?? 0);
    const oldValue = this.money(existing?.total_stock_value ?? 0);
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
          CAST(${line.warehouse_id} AS uuid),
          ${invoice.location_id}::uuid,
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
        CAST(${this.databaseDateText(invoice.purchase_date)} AS date),
        'PURCHASE_RECEIPT',
        'PURCHASE_INVOICE',
        CAST(${invoice.id} AS uuid),
        ${invoice.purchase_number},
        CAST(${quantity.toFixed(4)} AS numeric),
        0,
        CAST(${unitCost.toFixed(4)} AS numeric),
        CAST(${lineCost.toFixed(2)} AS numeric),
        CAST(${newQuantity.toFixed(4)} AS numeric),
        'WEIGHTED_AVERAGE',
        ${`Purchase Voucher ${invoice.purchase_number}`},
        true,
        ${userId}::uuid,
        now()
      )
    `;

    await transaction.$queryRaw`
      UPDATE inventory_items
      SET default_purchase_price = CAST(${line.purchase_price} AS numeric),
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${line.item_id} AS uuid)
    `;

    return lineCost;
  }
}
