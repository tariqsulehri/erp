import { z } from 'zod';
import type { AccessScope } from '../auth/access-rules.js';
import { prisma } from '../../db/prisma.js';
import { withPaymentStatus } from '../parties/invoice-balances.js';

export const ListSaleInvoicesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  customer_id: z.string().uuid().optional(),
  payment_type: z.enum(['Cash', 'Credit']).optional(),
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_from: z.coerce.number().min(0).optional(),
  amount_to: z.coerce.number().min(0).optional(),
});

export type ListSaleInvoicesQuery = z.infer<typeof ListSaleInvoicesQuery>;

interface CountRow {
  total: number;
}

interface DocumentTotalsRow {
  gross_amount: string;
  discount_amount: string;
  tax_amount: string;
  freight_amount: string;
  net_amount: string;
}

export class SaleListService {
  constructor(private readonly companyId: string, private readonly scope?: AccessScope) {}

  async list(query: ListSaleInvoicesQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['si.company_id = CAST($1 AS uuid)'];

    // Branch users see only their Branch's sales; Warehouse users only their Warehouse's (older) sales.
    if (this.scope?.accessLevel === 'BRANCH') {
      params.push(this.scope.branchId);
      where.push(`si.branch_id = CAST($${params.length} AS uuid)`);
    } else if (this.scope?.accessLevel === 'WAREHOUSE') {
      params.push(this.scope.warehouseId);
      where.push(`si.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.branch_id) {
      params.push(query.branch_id);
      where.push(`si.branch_id = CAST($${params.length} AS uuid)`);
    }

    if (query.status) {
      params.push(query.status);
      where.push(`si.status = $${params.length}`);
    }
    if (query.customer_id) {
      params.push(query.customer_id);
      where.push(`si.customer_id = CAST($${params.length} AS uuid)`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`si.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`si.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`si.sale_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`si.sale_date <= CAST($${params.length} AS date)`);
    }
    if (query.amount_from !== undefined) {
      params.push(query.amount_from);
      where.push(`si.net_amount >= CAST($${params.length} AS numeric)`);
    }
    if (query.amount_to !== undefined) {
      params.push(query.amount_to);
      where.push(`si.net_amount <= CAST($${params.length} AS numeric)`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(
        si.sale_number ILIKE $${params.length}
        OR COALESCE(si.customer_reference_number, '') ILIKE $${params.length}
        OR COALESCE(si.delivery_note_number, '') ILIKE $${params.length}
        OR c.name ILIKE $${params.length}
        OR c.code ILIKE $${params.length}
        OR COALESCE(b.name, '') ILIKE $${params.length}
        OR COALESCE(w.name, '') ILIKE $${params.length}
        OR COALESCE(wl.name, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<CountRow & DocumentTotalsRow>>(
      `
        SELECT COUNT(*)::int AS total,
          COALESCE(SUM(si.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(si.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(si.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(si.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(si.net_amount), 0)::text AS net_amount
        FROM sale_invoices si
        JOIN customers c ON c.id = si.customer_id
        LEFT JOIN branches b ON b.id = si.branch_id
        LEFT JOIN inventory_warehouses w ON w.id = si.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = si.location_id
        WHERE ${whereSql}
      `,
      ...params,
    );

    const limit = query.limit;
    const offset = (query.page - 1) * query.limit;
    params.push(limit);
    const limitParam = `$${params.length}`;
    params.push(offset);
    const offsetParam = `$${params.length}`;

    const data = await prisma.$queryRawUnsafe(
      `
        SELECT
          si.id,
          si.sale_number,
          si.sale_date,
          si.delivery_date,
          si.due_date,
          si.payment_type,
          si.status,
          si.gross_amount::text,
          si.discount_amount::text,
          si.tax_amount::text,
          si.freight_amount::text,
          si.net_amount::text,
          si.accounting_voucher_id::text,
          si.customer_account_id::text,
          si.cost_amount::text,
          si.customer_reference_number,
          si.delivery_note_number,
          si.posted_at,
          si.created_at,
          si.branch_id,
          b.code AS branch_code,
          b.name AS branch_name,
          si.warehouse_id,
          si.location_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          wl.code AS location_code,
          wl.name AS location_name,
          c.id AS customer_id,
          c.code AS customer_code,
          c.name AS customer_name,
          (
            SELECT COUNT(*)::int
            FROM sale_invoice_lines sil
            WHERE sil.sale_invoice_id = si.id
          ) AS line_count
        FROM sale_invoices si
        JOIN customers c ON c.id = si.customer_id
        LEFT JOIN branches b ON b.id = si.branch_id
        LEFT JOIN inventory_warehouses w ON w.id = si.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = si.location_id
        WHERE ${whereSql}
        ORDER BY si.sale_date DESC, si.sale_number DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);

    const totalsRow = countRows[0];
    // Totals cover every document that matches the filters, not only the current page.
    const totals = {
      gross_amount: totalsRow?.gross_amount ?? '0',
      discount_amount: totalsRow?.discount_amount ?? '0',
      tax_amount: totalsRow?.tax_amount ?? '0',
      freight_amount: totalsRow?.freight_amount ?? '0',
      net_amount: totalsRow?.net_amount ?? '0',
    };

    // Paid and Balance Due come from the party's linked account, payments applied to the oldest amounts first.
    const rowsWithPayments = await withPaymentStatus(this.companyId, 'receivables', data as Array<{ status: string; payment_type: string; net_amount: string; accounting_voucher_id: string | null; customer_account_id: string }>, row => row.customer_account_id);

    return {
      data: rowsWithPayments,
      totals,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }
}
