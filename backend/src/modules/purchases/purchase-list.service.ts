import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { withPaymentStatus } from '../parties/invoice-balances.js';

export const ListPurchaseInvoicesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  supplier_id: z.string().uuid().optional(),
  payment_type: z.enum(['Cash', 'Credit']).optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_from: z.coerce.number().min(0).optional(),
  amount_to: z.coerce.number().min(0).optional(),
});

export type ListPurchaseInvoicesQuery = z.infer<typeof ListPurchaseInvoicesQuery>;

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

export class PurchaseListService {
  constructor(private readonly companyId: string) {}

  async list(query: ListPurchaseInvoicesQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['pi.company_id = CAST($1 AS uuid)'];

    if (query.status) {
      params.push(query.status);
      where.push(`pi.status = $${params.length}`);
    }
    if (query.supplier_id) {
      params.push(query.supplier_id);
      where.push(`pi.supplier_id = CAST($${params.length} AS uuid)`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`pi.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`pi.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`pi.purchase_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`pi.purchase_date <= CAST($${params.length} AS date)`);
    }
    if (query.amount_from !== undefined) {
      params.push(query.amount_from);
      where.push(`pi.net_amount >= CAST($${params.length} AS numeric)`);
    }
    if (query.amount_to !== undefined) {
      params.push(query.amount_to);
      where.push(`pi.net_amount <= CAST($${params.length} AS numeric)`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(
        pi.purchase_number ILIKE $${params.length}
        OR COALESCE(pi.supplier_invoice_number, '') ILIKE $${params.length}
        OR COALESCE(pi.reference_number, '') ILIKE $${params.length}
        OR s.name ILIKE $${params.length}
        OR s.code ILIKE $${params.length}
        OR COALESCE(w.name, '') ILIKE $${params.length}
        OR COALESCE(wl.name, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<Array<CountRow & DocumentTotalsRow>>(
      `
        SELECT COUNT(*)::int AS total,
          COALESCE(SUM(pi.gross_amount), 0)::text AS gross_amount,
          COALESCE(SUM(pi.discount_amount), 0)::text AS discount_amount,
          COALESCE(SUM(pi.tax_amount), 0)::text AS tax_amount,
          COALESCE(SUM(pi.freight_amount), 0)::text AS freight_amount,
          COALESCE(SUM(pi.net_amount), 0)::text AS net_amount
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pi.location_id
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
          pi.id,
          pi.purchase_number,
          pi.purchase_date,
          pi.supplier_invoice_date,
          pi.due_date,
          pi.payment_type,
          pi.status,
          pi.gross_amount::text,
          pi.discount_amount::text,
          pi.tax_amount::text,
          pi.freight_amount::text,
          pi.net_amount::text,
          pi.accounting_voucher_id::text,
          pi.supplier_account_id::text,
          pi.reference_number,
          pi.posted_at,
          pi.created_at,
          pi.warehouse_id,
          pi.location_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          wl.code AS location_code,
          wl.name AS location_name,
          s.id AS supplier_id,
          s.code AS supplier_code,
          s.name AS supplier_name,
          pi.supplier_invoice_number,
          (
            SELECT COUNT(*)::int
            FROM purchase_invoice_lines pil
            WHERE pil.purchase_invoice_id = pi.id
          ) AS line_count
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pi.location_id
        WHERE ${whereSql}
        ORDER BY pi.purchase_date DESC, pi.purchase_number DESC
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
    const rowsWithPayments = await withPaymentStatus(this.companyId, 'payables', data as Array<{ status: string; payment_type: string; net_amount: string; accounting_voucher_id: string | null; supplier_account_id: string }>, row => row.supplier_account_id);

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
