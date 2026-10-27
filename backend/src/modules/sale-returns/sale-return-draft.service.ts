import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { branchHolder, holderCondition, holderFromColumns, type StockHolder } from '../inventory/stock-holder.js';
import { assertCanUseHolder } from '../inventory/stock-holder-access.js';
import {
  SaleReturnValidationService,
  type ValidateSaleReturnInput,
} from './sale-return-validation.service.js';
import { POSTING_TRANSACTION_OPTIONS, SaleReturnPostService } from './sale-return-post.service.js';
import { nextDocumentNumber } from '../numbering/document-number.js';

type TransactionClient = Prisma.TransactionClient;
type SaleReturnValidationResult = Awaited<ReturnType<SaleReturnValidationService['validate']>>;

const saleReturnNumberPrefix = 'SR';

export const CancelSaleReturnDraftInput = z.object({
  reason: z.string().trim().min(3, 'Enter a reason of at least 3 characters.').max(500, 'Use 500 characters or fewer for the reason.'),
});

export type CancelSaleReturnDraftInput = z.infer<typeof CancelSaleReturnDraftInput>;

interface CustomerForDraft {
  id: string;
  ar_account_id: string;
}

interface ItemForDraft {
  id: string;
  item_code: string;
  item_name: string;
  uom_id: string | null;
  uom_name: string | null;
  average_cost: string;
}

function businessError(message: string, statusCode = 400) {
  const error = new Error(message);
  Object.assign(error, { statusCode });
  return error;
}

export class SaleReturnDraftService {
  constructor(private readonly companyId: string) {}

  private async nextSaleReturnNumber(year: number, transaction: typeof prisma) {
    return nextDocumentNumber(transaction, { companyId: this.companyId, table: 'sale_returns', prefix: saleReturnNumberPrefix, year });
  }

  private userIdOrNull(userId?: string | null) {
    return userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      ? userId
      : null;
  }

  private money(value: string | number | Decimal) {
    return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  private async validateOrThrow(input: ValidateSaleReturnInput, excludeId?: string) {
    const validation = await new SaleReturnValidationService(this.companyId).validate(input, { excludeId });
    if (!validation.valid) throw businessError(validation.errors.join(' '));
    return validation;
  }

  async createDraft(input: ValidateSaleReturnInput, userId?: string | null) {
    const validation = await this.validateOrThrow(input);
    return prisma.$transaction(transaction => this.insertDraft(transaction, input, validation, userId));
  }

  /** Saves and posts in one transaction: if posting is refused, no draft is left behind. */
  async createAndPost(input: ValidateSaleReturnInput, userId?: string | null, scope?: AccessScope) {
    const validation = await this.validateOrThrow(input);
    return prisma.$transaction(async transaction => {
      const draft = await this.insertDraft(transaction, input, validation, userId);
      return new SaleReturnPostService(this.companyId).postInTransaction(transaction, draft.id, userId, scope);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /**
   * Replaces the header and lines of a Draft sale return. The return number never changes, even when the
   * date moves to another year, because document numbers are permanent once given.
   */
  async updateDraft(id: string, input: ValidateSaleReturnInput, userId?: string | null, scope?: AccessScope) {
    const validation = await this.validateOrThrow(input, id);
    return prisma.$transaction(transaction => this.replaceDraft(transaction, id, input, validation, userId, scope));
  }

  /** Saves the changes to a Draft and posts it in one transaction; if posting is refused, the changes are not saved either. */
  async updateAndPost(id: string, input: ValidateSaleReturnInput, userId?: string | null, scope?: AccessScope) {
    const validation = await this.validateOrThrow(input, id);
    return prisma.$transaction(async transaction => {
      await this.replaceDraft(transaction, id, input, validation, userId, scope);
      return new SaleReturnPostService(this.companyId).postInTransaction(transaction, id, userId, scope);
    }, POSTING_TRANSACTION_OPTIONS);
  }

  /** Cancels a Draft: it stays on file as Voided with who, when and why, so its number is never reused. */
  async cancelDraft(id: string, input: CancelSaleReturnDraftInput, userId?: string | null, scope?: AccessScope) {
    const cancelledBy = this.userIdOrNull(userId);
    return prisma.$transaction(async transaction => {
      const saleReturn = await this.lockReturn(transaction, id, scope, 'cancel Sale Returns');
      if (saleReturn.status !== 'Draft') throw businessError('Only Draft sale returns can be cancelled.');
      await transaction.$queryRaw`
        UPDATE sale_returns
        SET status = 'Voided',
            voided_by_id = ${cancelledBy}::uuid,
            voided_at = now(),
            void_reason = ${input.reason},
            updated_by_id = ${cancelledBy}::uuid,
            updated_at = now()
        WHERE company_id = CAST(${this.companyId} AS uuid)
          AND id = CAST(${id} AS uuid)
      `;
      return { id, sale_return_number: saleReturn.sale_return_number, status: 'Voided' };
    });
  }

  /**
   * Locks the return row so two users cannot change, cancel, or post the same draft at the same time,
   * and checks a Branch user is working on a return of their own Branch.
   */
  private async lockReturn(transaction: TransactionClient, id: string, scope: AccessScope | undefined, action: string) {
    const rows = await transaction.$queryRaw<{ id: string; status: string; sale_return_number: string; branch_id: string | null; warehouse_id: string | null }[]>`
      SELECT id, status, sale_return_number, branch_id, warehouse_id
      FROM sale_returns
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
      FOR UPDATE
    `;
    const saleReturn = rows[0];
    if (!saleReturn) throw businessError('Sale Return was not found.', 404);
    if (scope) assertCanUseHolder(scope, holderFromColumns(saleReturn.branch_id, saleReturn.warehouse_id), action);
    return saleReturn;
  }

  private async insertDraft(
    transaction: TransactionClient,
    input: ValidateSaleReturnInput,
    validation: SaleReturnValidationResult,
    userId?: string | null,
  ) {
    // Validation has confirmed the Branch is active, so the holder is the Branch (and optional shelf).
    const branchId = validation.branch_id as string;
    const holder = branchHolder(branchId, validation.location_id);
    const customer = await this.getCustomer(transaction, input.customer_id);
    const itemMap = await this.getItems(transaction, input, holder);

    const year = Number(input.sale_return_date.slice(0, 4));
    const saleReturnNumber = await this.nextSaleReturnNumber(year, transaction as unknown as typeof prisma);
    const createdBy = this.userIdOrNull(userId);
    const costAmount = this.costAmount(input, itemMap);

    const returnRows = await transaction.$queryRaw<{ id: string; sale_return_number: string }[]>`
      INSERT INTO sale_returns (
        company_id,
        sale_return_number,
        sale_return_date,
        customer_id,
        customer_account_id,
        customer_return_number,
        customer_return_date,
        payment_type,
        branch_id,
        location_id,
        reference_number,
        description,
        status,
        gross_amount,
        discount_amount,
        tax_amount,
        freight_amount,
        net_amount,
        cost_amount,
        created_by_id,
        updated_by_id,
        updated_at
      )
      VALUES (
        CAST(${this.companyId} AS uuid),
        ${saleReturnNumber},
        CAST(${input.sale_return_date} AS date),
        CAST(${customer.id} AS uuid),
        CAST(${customer.ar_account_id} AS uuid),
        ${input.customer_return_number?.trim() || null},
        ${input.customer_return_date ? input.customer_return_date : null}::date,
        ${input.payment_type},
        CAST(${branchId} AS uuid),
        ${validation.location_id}::uuid,
        ${input.reference_number || null},
        ${input.description || null},
        'Draft',
        CAST(${validation.totals.gross_amount} AS numeric),
        CAST(${validation.totals.discount_amount} AS numeric),
        CAST(${validation.totals.tax_amount} AS numeric),
        CAST(${validation.totals.freight_amount} AS numeric),
        CAST(${validation.totals.net_amount} AS numeric),
        CAST(${costAmount.toFixed(2)} AS numeric),
        ${createdBy}::uuid,
        ${createdBy}::uuid,
        now()
      )
      RETURNING id, sale_return_number
    `;
    const saleReturn = returnRows[0];
    await this.insertLines(transaction, saleReturn.id, branchId, input, validation, itemMap);
    return { id: saleReturn.id, sale_return_number: saleReturn.sale_return_number };
  }

  private async replaceDraft(
    transaction: TransactionClient,
    id: string,
    input: ValidateSaleReturnInput,
    validation: SaleReturnValidationResult,
    userId?: string | null,
    scope?: AccessScope,
  ) {
    const saleReturn = await this.lockReturn(transaction, id, scope, 'change Sale Returns');
    if (saleReturn.status !== 'Draft') {
      throw businessError('Only Draft sale returns can be changed. A posted return cannot be changed.');
    }
    const branchId = validation.branch_id as string;
    const holder = branchHolder(branchId, validation.location_id);
    const customer = await this.getCustomer(transaction, input.customer_id);
    const itemMap = await this.getItems(transaction, input, holder);
    const costAmount = this.costAmount(input, itemMap);
    const updatedBy = this.userIdOrNull(userId);

    await transaction.$queryRaw`
      UPDATE sale_returns
      SET sale_return_date = CAST(${input.sale_return_date} AS date),
          customer_id = CAST(${customer.id} AS uuid),
          customer_account_id = CAST(${customer.ar_account_id} AS uuid),
          customer_return_number = ${input.customer_return_number?.trim() || null},
          customer_return_date = ${input.customer_return_date ? input.customer_return_date : null}::date,
          payment_type = ${input.payment_type},
          branch_id = CAST(${branchId} AS uuid),
          location_id = ${validation.location_id}::uuid,
          reference_number = ${input.reference_number || null},
          description = ${input.description || null},
          gross_amount = CAST(${validation.totals.gross_amount} AS numeric),
          discount_amount = CAST(${validation.totals.discount_amount} AS numeric),
          tax_amount = CAST(${validation.totals.tax_amount} AS numeric),
          freight_amount = CAST(${validation.totals.freight_amount} AS numeric),
          net_amount = CAST(${validation.totals.net_amount} AS numeric),
          cost_amount = CAST(${costAmount.toFixed(2)} AS numeric),
          updated_by_id = ${updatedBy}::uuid,
          updated_at = now()
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${id} AS uuid)
    `;
    await transaction.$queryRaw`
      DELETE FROM sale_return_lines
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND sale_return_id = CAST(${id} AS uuid)
    `;
    await this.insertLines(transaction, id, branchId, input, validation, itemMap);
    return { id, sale_return_number: saleReturn.sale_return_number };
  }

  private async getCustomer(transaction: TransactionClient, customerId: string) {
    const customerRows = await transaction.$queryRaw<CustomerForDraft[]>`
      SELECT id, ar_account_id
      FROM customers
      WHERE company_id = CAST(${this.companyId} AS uuid)
        AND id = CAST(${customerId} AS uuid)
        AND is_active = true
      LIMIT 1
    `;
    const customer = customerRows[0];
    if (!customer?.ar_account_id) {
      throw businessError('Customer Linked Account is missing. Please update the customer before saving sale return.');
    }
    return customer;
  }

  private async getItems(transaction: TransactionClient, input: ValidateSaleReturnInput, holder: StockHolder) {
    const itemIds = [...new Set(input.lines.map(line => line.item_id))];
    const itemRows = await transaction.$queryRaw<ItemForDraft[]>`
      SELECT
        i.id,
        COALESCE(i.sku, i.item_code) AS item_code,
        i.item_name,
        COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id) AS uom_id,
        u.short_name AS uom_name,
        COALESCE(sb.average_cost, i.standard_cost, 0)::text AS average_cost
      FROM inventory_items i
      LEFT JOIN inventory_units_of_measure u
        ON u.id = COALESCE(i.sales_uom_id, i.stock_uom_id, i.base_uom_id)
      LEFT JOIN inventory_stock_balances sb
        ON sb.company_id = i.company_id
        AND sb.item_id = i.id
        AND ${holderCondition(holder, 'sb')}
      WHERE i.company_id = CAST(${this.companyId} AS uuid)
        AND i.id = ANY(${itemIds}::uuid[])
        AND i.is_active = true
        AND i.is_blocked = false
        AND i.is_sales_item = true
    `;
    return new Map(itemRows.map(item => [item.id, item]));
  }

  private costAmount(input: ValidateSaleReturnInput, itemMap: Map<string, ItemForDraft>) {
    return this.money(input.lines.reduce((sum, line) => {
      const item = itemMap.get(line.item_id);
      return sum.plus(new Decimal(line.quantity).times(item?.average_cost ?? 0));
    }, new Decimal(0)));
  }

  private async insertLines(
    transaction: TransactionClient,
    saleReturnId: string,
    branchId: string,
    input: ValidateSaleReturnInput,
    validation: SaleReturnValidationResult,
    itemMap: Map<string, ItemForDraft>,
  ) {
    for (const [index, line] of input.lines.entries()) {
      const item = itemMap.get(line.item_id);
      const calculatedLine = validation.lines[index];
      if (!item || !calculatedLine) throw businessError(`Return item on line ${index + 1} was not found.`);

      const unitCost = new Decimal(item.average_cost || 0).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const lineCost = this.money(new Decimal(calculatedLine.quantity).times(unitCost));
      await transaction.$queryRaw`
        INSERT INTO sale_return_lines (
          company_id,
          sale_return_id,
          line_number,
          item_id,
          item_code,
          item_name,
          uom_id,
          uom_name,
          branch_id,
          quantity,
          sale_price,
          discount_amount,
          tax_amount,
          line_total,
          unit_cost,
          cost_amount,
          description,
          updated_at
        )
        VALUES (
          CAST(${this.companyId} AS uuid),
          CAST(${saleReturnId} AS uuid),
          ${index + 1},
          CAST(${item.id} AS uuid),
          ${item.item_code},
          ${item.item_name},
          ${item.uom_id}::uuid,
          ${item.uom_name},
          CAST(${branchId} AS uuid),
          CAST(${calculatedLine.quantity} AS numeric),
          CAST(${calculatedLine.sale_price} AS numeric),
          CAST(${calculatedLine.discount_amount} AS numeric),
          CAST(${calculatedLine.tax_amount} AS numeric),
          CAST(${calculatedLine.line_total} AS numeric),
          CAST(${unitCost.toFixed(4)} AS numeric),
          CAST(${lineCost.toFixed(2)} AS numeric),
          ${line.description || null},
          now()
        )
      `;
    }
  }
}
