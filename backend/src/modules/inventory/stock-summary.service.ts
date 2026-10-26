import { prisma } from '../../db/prisma.js';
import type { ListWarehouseStockQuery } from './warehouse.schema.js';

/** Paged item stock held by one Branch or one Warehouse (one row per item and Location). */
export async function holderStockSummary(companyId: string, holder: { kind: 'BRANCH' | 'WAREHOUSE'; id: string }, query: ListWarehouseStockQuery) {
  const holderColumn = holder.kind === 'BRANCH' ? 'sb.branch_id' : 'sb.warehouse_id';
  const params: unknown[] = [companyId, holder.id];
  const where = [
    'sb.company_id = CAST($1 AS uuid)',
    `${holderColumn} = CAST($2 AS uuid)`,
    'sb.is_active = true',
  ];

  if (query.search) {
    params.push(`%${query.search}%`);
    const p = `$${params.length}`;
    where.push(`(i.item_code ILIKE ${p} OR COALESCE(i.sku, '') ILIKE ${p} OR i.item_name ILIKE ${p} OR COALESCE(wl.name, '') ILIKE ${p})`);
  }

  const whereSql = where.join(' AND ');
  const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
    `
      SELECT COUNT(*)::int AS total
      FROM inventory_stock_balances sb
      JOIN inventory_items i ON i.id = sb.item_id
      LEFT JOIN inventory_warehouse_locations wl ON wl.id = sb.location_id
      WHERE ${whereSql}
    `,
    ...params,
  );

  params.push(query.limit, (query.page - 1) * query.limit);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
      SELECT
        sb.id,
        i.item_code,
        COALESCE(i.sku, i.item_code) AS sku,
        i.item_name,
        wl.code AS location_code,
        wl.name AS location_name,
        sb.stock_on_hand::text,
        sb.reserved_stock::text,
        sb.available_stock::text,
        sb.average_cost::text,
        sb.total_stock_value::text
      FROM inventory_stock_balances sb
      JOIN inventory_items i ON i.id = sb.item_id
      LEFT JOIN inventory_warehouse_locations wl ON wl.id = sb.location_id
      WHERE ${whereSql}
      ORDER BY i.item_code ASC, wl.code ASC NULLS FIRST
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `,
    ...params,
  );

  const total = Number(countRows[0]?.total ?? 0);
  return {
    data: rows,
    pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
  };
}
