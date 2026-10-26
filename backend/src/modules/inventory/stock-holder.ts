import { Prisma } from '@prisma/client';

/**
 * A stock holder is the place a row of stock belongs to: exactly one Branch or one Warehouse,
 * with an optional shelf / rack Location. Balance and movement rows store it as
 * branch_id / warehouse_id / location_id (one of branch_id and warehouse_id is always null).
 */
export type StockHolder =
  | { kind: 'BRANCH'; branchId: string; warehouseId: null; locationId: string | null }
  | { kind: 'WAREHOUSE'; branchId: null; warehouseId: string; locationId: string | null };

export type StockHolderKind = StockHolder['kind'];

export function branchHolder(branchId: string, locationId: string | null = null): StockHolder {
  return { kind: 'BRANCH', branchId, warehouseId: null, locationId };
}

export function warehouseHolder(warehouseId: string, locationId: string | null = null): StockHolder {
  return { kind: 'WAREHOUSE', branchId: null, warehouseId, locationId };
}

/** Builds a holder from stored columns, e.g. a document header that has either a branch or a warehouse. */
export function holderFromColumns(branchId: string | null | undefined, warehouseId: string | null | undefined, locationId: string | null = null): StockHolder {
  if (branchId) return branchHolder(branchId, locationId);
  if (warehouseId) return warehouseHolder(warehouseId, locationId);
  throw new Error('Stock holder needs a Branch or a Warehouse.');
}

/**
 * SQL condition matching balance or movement rows of this holder, e.g.
 * `WHERE company_id = ... AND item_id = ... AND ${holderCondition(holder, 'sb')}`.
 * IS NOT DISTINCT FROM treats "no location" (NULL) as a value, matching the NULLS NOT DISTINCT unique index.
 */
export function holderCondition(holder: StockHolder, tableAlias?: string) {
  const column = (name: string) => Prisma.raw(tableAlias ? `${tableAlias}.${name}` : name);
  return Prisma.sql`${column('branch_id')} IS NOT DISTINCT FROM ${holder.branchId}::uuid
    AND ${column('warehouse_id')} IS NOT DISTINCT FROM ${holder.warehouseId}::uuid
    AND ${column('location_id')} IS NOT DISTINCT FROM ${holder.locationId}::uuid`;
}

export function holderLabel(holder: StockHolder) {
  return holder.kind === 'BRANCH' ? 'Branch' : 'Warehouse';
}
