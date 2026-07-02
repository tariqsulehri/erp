import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

export const ListPurchaseReturnsQuery = z.object({
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

export type ListPurchaseReturnsQuery = z.infer<typeof ListPurchaseReturnsQuery>;

interface CountRow {
  total: number;
}

export class PurchaseReturnListService {
  constructor(private readonly companyId: string) {}

  async list(query: ListPurchaseReturnsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['pr.company_id = CAST($1 AS uuid)'];

    if (query.status) {
      params.push(query.status);
      where.push(`pr.status = $${params.length}`);
    }
    if (query.supplier_id) {
      params.push(query.supplier_id);
      where.push(`pr.supplier_id = CAST($${params.length} AS uuid)`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`pr.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`pr.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`pr.purchase_return_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`pr.purchase_return_date <= CAST($${params.length} AS date)`);
    }
    if (query.amount_from !== undefined) {
      params.push(query.amount_from);
      where.push(`pr.net_amount >= CAST($${params.length} AS numeric)`);
    }
    if (query.amount_to !== undefined) {
      params.push(query.amount_to);
      where.push(`pr.net_amount <= CAST($${params.length} AS numeric)`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(
        pr.purchase_return_number ILIKE $${params.length}
        OR COALESCE(pr.supplier_return_number, '') ILIKE $${params.length}
        OR COALESCE(pr.reference_number, '') ILIKE $${params.length}
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
        FROM purchase_returns pr
        JOIN suppliers s ON s.id = pr.supplier_id
        JOIN inventory_warehouses w ON w.id = pr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pr.location_id
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
          pr.id,
          pr.purchase_return_number,
          pr.purchase_return_date,
          pr.supplier_return_date,
          pr.payment_type,
          pr.status,
          pr.gross_amount::text,
          pr.discount_amount::text,
          pr.tax_amount::text,
          pr.freight_amount::text,
          pr.net_amount::text,
          pr.reference_number,
          pr.posted_at,
          pr.created_at,
          pr.warehouse_id,
          pr.location_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          wl.code AS location_code,
          wl.name AS location_name,
          s.id AS supplier_id,
          s.code AS supplier_code,
          s.name AS supplier_name,
          pr.supplier_return_number,
          COALESCE(line_counts.line_count, 0)::int AS line_count
        FROM purchase_returns pr
        JOIN suppliers s ON s.id = pr.supplier_id
        JOIN inventory_warehouses w ON w.id = pr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = pr.location_id
        LEFT JOIN (
          SELECT purchase_return_id, COUNT(*) AS line_count
          FROM purchase_return_lines
          WHERE company_id = CAST($1 AS uuid)
          GROUP BY purchase_return_id
        ) line_counts ON line_counts.purchase_return_id = pr.id
        WHERE ${whereSql}
        ORDER BY pr.purchase_return_date DESC, pr.purchase_return_number DESC
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
