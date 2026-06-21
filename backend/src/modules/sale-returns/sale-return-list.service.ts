import { z } from 'zod';
import { prisma } from '../../db/prisma.js';

export const ListSaleReturnsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.enum(['Draft', 'Posted', 'Voided']).optional(),
  customer_id: z.string().uuid().optional(),
  payment_type: z.enum(['Cash', 'Credit']).optional(),
  warehouse_id: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  amount_from: z.coerce.number().min(0).optional(),
  amount_to: z.coerce.number().min(0).optional(),
});

export type ListSaleReturnsQuery = z.infer<typeof ListSaleReturnsQuery>;

interface CountRow {
  total: number;
}

export class SaleReturnListService {
  constructor(private readonly companyId: string) {}

  async list(query: ListSaleReturnsQuery) {
    const params: unknown[] = [this.companyId];
    const where = ['sr.company_id = CAST($1 AS uuid)'];

    if (query.status) {
      params.push(query.status);
      where.push(`sr.status = $${params.length}`);
    }
    if (query.customer_id) {
      params.push(query.customer_id);
      where.push(`sr.customer_id = CAST($${params.length} AS uuid)`);
    }
    if (query.payment_type) {
      params.push(query.payment_type);
      where.push(`sr.payment_type = $${params.length}`);
    }
    if (query.warehouse_id) {
      params.push(query.warehouse_id);
      where.push(`sr.warehouse_id = CAST($${params.length} AS uuid)`);
    }
    if (query.date_from) {
      params.push(query.date_from);
      where.push(`sr.sale_return_date >= CAST($${params.length} AS date)`);
    }
    if (query.date_to) {
      params.push(query.date_to);
      where.push(`sr.sale_return_date <= CAST($${params.length} AS date)`);
    }
    if (query.amount_from !== undefined) {
      params.push(query.amount_from);
      where.push(`sr.net_amount >= CAST($${params.length} AS numeric)`);
    }
    if (query.amount_to !== undefined) {
      params.push(query.amount_to);
      where.push(`sr.net_amount <= CAST($${params.length} AS numeric)`);
    }
    if (query.search) {
      params.push(`%${query.search}%`);
      where.push(`(
        sr.sale_return_number ILIKE $${params.length}
        OR COALESCE(sr.customer_return_number, '') ILIKE $${params.length}
        OR COALESCE(sr.reference_number, '') ILIKE $${params.length}
        OR c.name ILIKE $${params.length}
        OR c.code ILIKE $${params.length}
        OR COALESCE(w.name, '') ILIKE $${params.length}
        OR COALESCE(wl.name, '') ILIKE $${params.length}
      )`);
    }

    const whereSql = where.join(' AND ');
    const countRows = await prisma.$queryRawUnsafe<CountRow[]>(
      `
        SELECT COUNT(*)::int AS total
        FROM sale_returns sr
        JOIN customers c ON c.id = sr.customer_id
        JOIN inventory_warehouses w ON w.id = sr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sr.location_id
        WHERE ${whereSql}
      `,
      ...params,
    );

    params.push(query.limit);
    const limitParam = `$${params.length}`;
    params.push((query.page - 1) * query.limit);
    const offsetParam = `$${params.length}`;

    const data = await prisma.$queryRawUnsafe(
      `
        SELECT
          sr.id,
          sr.sale_return_number,
          sr.sale_return_date,
          sr.customer_return_date,
          sr.payment_type,
          sr.status,
          sr.gross_amount::text,
          sr.discount_amount::text,
          sr.tax_amount::text,
          sr.freight_amount::text,
          sr.net_amount::text,
          sr.cost_amount::text,
          sr.reference_number,
          sr.posted_at,
          sr.created_at,
          sr.warehouse_id,
          sr.location_id,
          w.code AS warehouse_code,
          w.name AS warehouse_name,
          wl.code AS location_code,
          wl.name AS location_name,
          c.id AS customer_id,
          c.code AS customer_code,
          c.name AS customer_name,
          sr.customer_return_number,
          COALESCE(line_counts.line_count, 0)::int AS line_count
        FROM sale_returns sr
        JOIN customers c ON c.id = sr.customer_id
        JOIN inventory_warehouses w ON w.id = sr.warehouse_id
        LEFT JOIN inventory_warehouse_locations wl ON wl.id = sr.location_id
        LEFT JOIN (
          SELECT sale_return_id, COUNT(*) AS line_count
          FROM sale_return_lines
          WHERE company_id = CAST($1 AS uuid)
          GROUP BY sale_return_id
        ) line_counts ON line_counts.sale_return_id = sr.id
        WHERE ${whereSql}
        ORDER BY sr.sale_return_date DESC, sr.sale_return_number DESC
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
