import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import {
  PurchaseValidationService,
  type ValidatePurchaseInvoiceInput,
} from './purchase-validation.service.js';
import { POSTING_TRANSACTION_OPTIONS, PurchasePostService } from './purchase-post.service.js';
import { nextDocumentNumber } from '../numbering/document-number.js';

type TransactionClient = Prisma.TransactionClient;
type PurchaseValidationResult = Awaited<ReturnType<PurchaseValidationService['validate']>>;

const purchaseNumberPrefix = 'PI';

export const CancelPurchaseDraftInput = z.object({
  reason: z.string().trim().min(3, 'Enter a reason of at least 3 characters.').max(500, 'Use 500 characters or fewer for the reason.'),
});

export type CancelPurchaseDraftInput = z.infer<typeof CancelPurchaseDraftInput>;

interface SupplierForDraft {
  id: string;
  ap_account_id: string;
}

interface ItemForDraft {
  id: string;
  item_code: string;
  item_name: string;
  uom_id: string | null;
  uom_name: string | null;
}

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

export class PurchaseDraftService {
  constructor(private readonly companyId: string) {}

  private async nextPurchaseNumber(year: number, transaction: typeof prisma) {
    return nextDocumentNumber(transaction, { companyId: this.companyId, table: 'purchase_invoices', prefix: purchaseNumberPrefix, year });
  }

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  }

  private async validateOrThrow(input: ValidatePurchaseInvoiceInput, excludeId?: string) {
    const validation = await new PurchaseValidationService(this.companyId).validate(input, { excludeId });
    if (!validation.valid) throw businessError(validation.errors.join(' '));
    return validation;
  }

  async createDraft(input: ValidatePurchaseInvoiceInput, userId?: string | null) {
    const validation = await this.validateOrThrow(input);
    return prisma.$transaction(transaction => this.insertDraft(transaction, input, validation, userId));
  }

  /** Saves and posts in one transaction: if posting is refused, no draft is left behind. */
  async createAndPost(input: ValidatePurchaseInvoiceInput, userId?: string | null) {
    const validation = await this.validateOrThrow(input);
    return prisma.$transaction(async transaction => {
      const draft = await this.insertDraft(transaction, input, validation, userId);
      return new PurchasePostService(this.companyId).postInTransaction(transaction, draft.id, userId);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /**
   * Replaces the header and lines of a Draft purchase. The purchase number never changes, even when the
   * date moves to another year, because document numbers are permanent once given.
   */
  async updateDraft(id: string, input: ValidatePurchaseInvoiceInput, userId?: string | null) {
    const validation = await this.validateOrThrow(input, id);
    return prisma.$transaction(transaction => this.replaceDraft(transaction, id, input, validation, userId));
  }

  /** Saves the changes to a Draft and posts it in one transaction; if posting is refused, the changes are not saved either. */
  async updateAndPost(id: string, input: ValidatePurchaseInvoiceInput, userId?: string | null) {
    const validation = await this.validateOrThrow(input, id);
    return prisma.$transaction(async transaction => {
      await this.replaceDraft(transaction, id, input, validation, userId);
      return new PurchasePostService(this.companyId).postInTransaction(transaction, id, userId);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /** Cancels a Draft: it stays on file as Voided with who, when and why, so its number is never reused. */
  async cancelDraft(id: string, input: CancelPurchaseDraftInput, userId?: string | null) {
    const cancelledBy = this.userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const invoice = await this.lockInvoice(transaction, id);
      if (invoice.status !== 'Draft') throw businessError('Only Draft purchase vouchers can be cancelled.');
      await transaction.$queryRaw`
        UPDATE purchase_invoices
        SET status = 'Voided',
            voided_by_id = ${cancelledBy}::uuid,
            voided_at = now(),
            void_reason = ${input.reason},
            updated_by_id = ${cancelledBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;
      return { id, purchase_number: invoice.purchase_number, status: 'Voided' };
    });
  }

  /** Locks the purchase row so two users cannot change, cancel, or post the same draft at the same time. */
  private async lockInvoice(transaction: TransactionClient, id: string) {
    const rows = await transaction.$queryRaw<{ id: string; status: string; purchase_number: string }[]>`
      SELECT id, status, purchase_number
      FROM purchase_invoices
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
      FOR UPDATE
    `;
    if (!rows[0]) throw businessError('Purchase Voucher was not found.', 404);
    return rows[0];
  }

  private async insertDraft(
    transaction: TransactionClient,
    input: ValidatePurchaseInvoiceInput,
    validation: PurchaseValidationResult,
    userId?: string | null,
  ) {
    const supplier = await this.getSupplier(transaction, input.supplier_id);
    const itemMap = await this.getItems(transaction, input);

    const year = Number(input.purchase_date.slice(0, 4));
    const purchaseNumber = await this.nextPurchaseNumber(year, transaction as unknown as typeof prisma);
    const createdBy = this.userIdOrNull(userId);

    const invoiceRows = await transaction.$queryRaw<{ id: string; purchase_number: string }[]>`
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
        location_id,
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
        CAST(${this.companyId} AS uuid),
        ${purchaseNumber},
        CAST(${input.purchase_date} AS date),
        CAST(${supplier.id} AS uuid),
        CAST(${supplier.ap_account_id} AS uuid),
        ${input.supplier_invoice_number?.trim() || null},
        ${input.supplier_invoice_date ? input.supplier_invoice_date : null}::date,
        ${input.payment_type},
        ${input.payment_type === 'Credit' && input.due_date ? input.due_date : null}::date,
        CAST(${input.warehouse_id} AS uuid),
        ${validation.location_id}::uuid,
        ${input.reference_number || null},
        ${input.description || null},
        'Draft',
        CAST(${validation.totals.gross_amount} AS numeric),
        CAST(${validation.totals.discount_amount} AS numeric),
        CAST(${validation.totals.tax_amount} AS numeric),
        CAST(${validation.totals.freight_amount} AS numeric),
        CAST(${validation.totals.net_amount} AS numeric),
        ${createdBy}::uuid,
        ${createdBy}::uuid,
        now()
      )
      RETURNING id, purchase_number
    `;
    const invoice = invoiceRows[0];
    await this.insertLines(transaction, invoice.id, input, validation, itemMap);
    return { id: invoice.id, purchase_number: invoice.purchase_number };
  }

  private async replaceDraft(
    transaction: TransactionClient,
    id: string,
    input: ValidatePurchaseInvoiceInput,
    validation: PurchaseValidationResult,
    userId?: string | null,
  ) {
    const invoice = await this.lockInvoice(transaction, id);
    if (invoice.status !== 'Draft') {
      throw businessError('Only Draft purchase vouchers can be changed. Use a Purchase Return to correct a posted purchase.');
    }
    const supplier = await this.getSupplier(transaction, input.supplier_id);
    const itemMap = await this.getItems(transaction, input);
    const updatedBy = this.userIdOrNull(userId);

    await transaction.$queryRaw`
      UPDATE purchase_invoices
      SET purchase_date = CAST(${input.purchase_date} AS date),
          supplier_id = CAST(${supplier.id} AS uuid),
          supplier_account_id = CAST(${supplier.ap_account_id} AS uuid),
          supplier_invoice_number = ${input.supplier_invoice_number?.trim() || null},
          supplier_invoice_date = ${input.supplier_invoice_date ? input.supplier_invoice_date : null}::date,
          payment_type = ${input.payment_type},
          due_date = ${input.payment_type === 'Credit' && input.due_date ? input.due_date : null}::date,
          warehouse_id = CAST(${input.warehouse_id} AS uuid),
          location_id = ${validation.location_id}::uuid,
          reference_number = ${input.reference_number || null},
          description = ${input.description || null},
          gross_amount = CAST(${validation.totals.gross_amount} AS numeric),
          discount_amount = CAST(${validation.totals.discount_amount} AS numeric),
          tax_amount = CAST(${validation.totals.tax_amount} AS numeric),
          freight_amount = CAST(${validation.totals.freight_amount} AS numeric),
          net_amount = CAST(${validation.totals.net_amount} AS numeric),
          updated_by_id = ${updatedBy}::uuid,
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
    `;
    await transaction.$queryRaw`
      DELETE FROM purchase_invoice_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND purchase_invoice_id = CAST(${id} AS uuid)
    `;
    await this.insertLines(transaction, id, input, validation, itemMap);
    return { id, purchase_number: invoice.purchase_number };
  }

  private async getSupplier(transaction: TransactionClient, supplierId: string) {
    const supplierRows = await transaction.$queryRaw<SupplierForDraft[]>`
      SELECT id, ap_account_id
      FROM suppliers
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${supplierId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    const supplier = supplierRows[0];
    if (!supplier?.ap_account_id) {
      throw businessError('Supplier Linked Account is missing. Please update the supplier before saving purchase.');
    }
    return supplier;
  }

  private async getItems(transaction: TransactionClient, input: ValidatePurchaseInvoiceInput) {
    const itemIds = [...new Set(input.lines.map(line => line.item_id))];
    const itemRows = await transaction.$queryRaw<ItemForDraft[]>`
      SELECT
        i.id,
        COALESCE(i.sku, i.item_code) AS item_code,
        i.item_name,
        COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
        u.short_name AS uom_name
      FROM inventory_items i
      LEFT JOIN inventory_units_of_measure u
        ON u.id = COALESCE(i.purchase_uom_id, i.stock_uom_id, i.base_uom_id)
      WHERE i.company_id = CAST(${this.companyId} AS uuid)
        AND i.id = ANY(${itemIds}::uuid[])
        AND i.is_active = true
        AND i.is_blocked = false
        AND i.is_purchase_item = true
    `;
    return new Map(itemRows.map(item => [item.id, item]));
  }

  private async insertLines(
    transaction: TransactionClient,
    invoiceId: string,
    input: ValidatePurchaseInvoiceInput,
    validation: PurchaseValidationResult,
    itemMap: Map<string, ItemForDraft>,
  ) {
    for (const [index, line] of input.lines.entries()) {
      const item = itemMap.get(line.item_id);
      const calculatedLine = validation.lines[index];
      if (!item || !calculatedLine) throw businessError(`Purchase item on line ${index + 1} was not found.`);

      await transaction.$queryRaw`
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
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${invoiceId} AS uuid),
          ${index + 1},
          CAST(${item.id} AS uuid),
          ${item.item_code},
          ${item.item_name},
          ${item.uom_id}::uuid,
          ${item.uom_name},
          CAST(${line.warehouse_id || input.warehouse_id} AS uuid),
          CAST(${calculatedLine.quantity} AS numeric),
          CAST(${calculatedLine.purchase_price} AS numeric),
          CAST(${calculatedLine.discount_amount} AS numeric),
          CAST(${calculatedLine.tax_amount} AS numeric),
          CAST(${calculatedLine.line_total} AS numeric),
          ${line.description || null},
          now()
        )
      `;
    }
  }
}
