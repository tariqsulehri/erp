import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

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
    const countRows = await prisma.$queryRawUnsafe<CountRow[]>(
      `
        SELECT COUNT(*)::int AS total
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
          COALESCE(line_counts.line_count, 0)::int AS line_count
        FROM purchase_invoices pi
        JOIN suppliers s ON s.id = pi.supplier_id
        JOIN inventory_warehouses w ON w.id = pi.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pi.location_id
        LEFT JOIN (
          SELECT purchase_invoice_id, COUNT(*) AS line_count
          FROM purchase_invoice_lines
          WHERE company_id = CAST($1 AS uuid)
          GROUP BY purchase_invoice_id
        ) line_counts ON line_counts.purchase_invoice_id = pi.id
        WHERE ${whereSql}
        ORDER BY pi.purchase_date DESC, pi.purchase_number DESC
        LIMIT ${limitParam}
        OFFSET ${offsetParam}
      `,
      ...params,
    );

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }
}
