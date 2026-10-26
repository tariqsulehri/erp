import { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { AccessScope } from '../auth/access-rules.js';
import { type StockHolder, branchHolder, warehouseHolder } from './stock-holder.js';

type QueryClient = Prisma.TransactionClient | typeof prisma;

function accessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 403 });
  return error;
}

function requestError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

/** Branch users may only act for their Branch; Warehouse users only for their Warehouse. */
export function canUseHolder(scope: AccessScope, holder: StockHolder) {
  if (scope.accessLevel === 'ALL_BRANCHES') return true;
  if (scope.accessLevel === 'BRANCH') return holder.kind === 'BRANCH' && holder.branchId === scope.branchId;
  return holder.kind === 'WAREHOUSE' && holder.warehouseId === scope.warehouseId;
}

export function assertCanUseHolder(scope: AccessScope, holder: StockHolder, action: string) {
  if (canUseHolder(scope, holder)) return;
  throw accessError(scope.accessLevel === 'BRANCH'
    ? `You can only ${action} for your own Branch.`
    : `You can only ${action} for your own Warehouse.`);
}

/**
 * SQL condition limiting stock rows to what the user may see:
 * All Branches sees everything, a Branch user sees only that Branch, a Warehouse user only that Warehouse.
 */
export function visibleStockCondition(scope: AccessScope, tableAlias: string) {
  if (scope.accessLevel === 'BRANCH') return Prisma.sql`${Prisma.raw(`${tableAlias}.branch_id`)} = ${scope.branchId}::uuid`;
  if (scope.accessLevel === 'WAREHOUSE') return Prisma.sql`${Prisma.raw(`${tableAlias}.warehouse_id`)} = ${scope.warehouseId}::uuid`;
  return Prisma.sql`TRUE`;
}

/**
 * Sales and Sale Returns happen only at a Branch. A Branch user always uses their own Branch;
 * All Branches users must choose one; Warehouse users cannot sell.
 */
export function resolveSellingBranchId(scope: AccessScope, requestedBranchId: string | null | undefined, documentName: string) {
  if (scope.accessLevel === 'WAREHOUSE') throw accessError(`Warehouse users cannot create a ${documentName}. ${documentName}s are made at a Branch.`);
  if (scope.accessLevel === 'BRANCH') {
    if (requestedBranchId && requestedBranchId !== scope.branchId) throw accessError(`You can only create a ${documentName} for your own Branch.`);
    return scope.branchId as string;
  }
  if (!requestedBranchId) throw requestError('Please select a Branch.');
  return requestedBranchId;
}

/**
 * Purchases and Purchase Returns happen only at a Warehouse. A Warehouse user always uses their own Warehouse;
 * All Branches users choose one; Branch users cannot buy (for now).
 */
export function resolvePurchasingWarehouseId(scope: AccessScope, requestedWarehouseId: string, documentName: string) {
  if (scope.accessLevel === 'BRANCH') throw accessError(`Branch users cannot create a ${documentName}. Purchases are received at a Warehouse.`);
  if (scope.accessLevel === 'WAREHOUSE' && requestedWarehouseId !== scope.warehouseId) {
    throw accessError(`You can only create a ${documentName} for your own Warehouse.`);
  }
  return requestedWarehouseId;
}

interface HolderRow {
  id: string;
  use_locations: boolean;
}

/**
 * Checks that the Branch or Warehouse is active in this company and that the Location (shelf / rack)
 * belongs to it. Location-controlled Warehouses must use a Location; Branch Locations are optional.
 * Adds user-facing problems to `errors` and returns the holder to use (or null when it is not valid).
 */
export async function validateHolder(
  client: QueryClient,
  companyId: string,
  input: { branchId?: string | null; warehouseId?: string | null; locationId?: string | null },
  errors: string[],
  label = '',
): Promise<StockHolder | null> {
  const prefix = label ? `${label} ` : '';
  const locationId = input.locationId || null;

  if (input.branchId) {
    const rows = await client.$queryRaw<HolderRow[]>`
      SELECT id, false AS use_locations
      FROM branches
      WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${input.branchId} AS uuid) AND is_active = true
      LIMIT 1
    `;
    if (!rows[0]) {
      errors.push(`${prefix}Branch was not found or is Inactive.`);
      return null;
    }
    if (locationId && !(await locationBelongs(client, companyId, locationId, { branchId: input.branchId }))) {
      errors.push(`${prefix}Location was not found, Inactive, or does not belong to the selected Branch.`);
      return null;
    }
    return branchHolder(input.branchId, locationId);
  }

  if (input.warehouseId) {
    const rows = await client.$queryRaw<HolderRow[]>`
      SELECT id, use_locations
      FROM inventory_warehouses
      WHERE company_id = CAST(${companyId} AS uuid) AND id = CAST(${input.warehouseId} AS uuid) AND is_active = true
      LIMIT 1
    `;
    const warehouse = rows[0];
    if (!warehouse) {
      errors.push(`${prefix}Warehouse was not found or is Inactive.`);
      return null;
    }
    if (warehouse.use_locations && !locationId) {
      errors.push(`${prefix}Location is required because the Warehouse uses Locations.`);
      return null;
    }
    if (!warehouse.use_locations && locationId) {
      errors.push(`${prefix}Location can only be selected when the Warehouse uses Locations.`);
      return null;
    }
    if (locationId && !(await locationBelongs(client, companyId, locationId, { warehouseId: input.warehouseId }))) {
      errors.push(`${prefix}Location was not found, Inactive, or does not belong to the selected Warehouse.`);
      return null;
    }
    return warehouseHolder(input.warehouseId, locationId);
  }

  errors.push(`Please select a ${prefix}Branch or Warehouse.`);
  return null;
}

async function locationBelongs(client: QueryClient, companyId: string, locationId: string, owner: { branchId?: string; warehouseId?: string }) {
  const rows = await client.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM inventory_warehouse_locations
    WHERE company_id = CAST(${companyId} AS uuid)
      AND id = CAST(${locationId} AS uuid)
      AND branch_id IS NOT DISTINCT FROM ${owner.branchId ?? null}::uuid
      AND warehouse_id IS NOT DISTINCT FROM ${owner.warehouseId ?? null}::uuid
      AND is_active = true
    LIMIT 1
  `;
  return Boolean(rows[0]);
}

/** Purchases are warehouse documents: Branch users cannot open them; Warehouse users see only their Warehouse. */
export function purchaseWarehouseFilter(scope: AccessScope, documentName: string) {
  if (scope.accessLevel === 'BRANCH') throw accessError(`Branch users cannot open ${documentName}s. Purchases are received at a Warehouse.`);
  return scope.accessLevel === 'WAREHOUSE' ? scope.warehouseId : null;
}

const WAREHOUSE_DOCUMENT_TABLES = {
  purchase_invoices: 'Purchase Voucher',
  purchase_returns: 'Purchase Return',
} as const;

/** Reports another Warehouse's purchase document as not found for Warehouse users, and blocks Branch users. */
export async function assertWarehouseDocumentAccess(scope: AccessScope, table: keyof typeof WAREHOUSE_DOCUMENT_TABLES, id: string) {
  const documentName = WAREHOUSE_DOCUMENT_TABLES[table];
  const warehouseId = purchaseWarehouseFilter(scope, documentName);
  if (!warehouseId) return;
  const rows = await prisma.$queryRaw<{ warehouse_id: string | null }[]>`
    SELECT warehouse_id FROM ${Prisma.raw(table)}
    WHERE company_id = CAST(${scope.companyId} AS uuid) AND id = CAST(${id} AS uuid)
    LIMIT 1
  `;
  if (rows[0]?.warehouse_id !== warehouseId) {
    const error = new Error(`${documentName} was not found.`);
    Object.assign(error, { statusCode: 404 });
    throw error;
  }
}

/** Company-wide views (such as analytics) are for All Branches users only. */
export function requireAllBranchAccess(scope: AccessScope, featureName: string) {
  if (scope.accessLevel !== 'ALL_BRANCHES') throw accessError(`${featureName} is available to Admin and Top Management users only.`);
}
