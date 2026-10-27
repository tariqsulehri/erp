import type { Prisma } from '@prisma/client';

export interface LockedStockBalance {
  id: string;
  company_id: string;
  item_id: string;
  warehouse_id: string | null;
  branch_id: string | null;
  location_id: string | null;
  stock_on_hand: string;
  available_stock: string;
  version: number;
}

export class ConcurrencyConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'This record was modified by another transaction. Please refresh and try again.') {
    super(message);
    this.name = 'ConcurrencyConflictError';
  }
}

/**
 * Acquires a pessimistic row-level lock (SELECT ... FOR UPDATE) on a stock balance record within a transaction.
 * Blocks concurrent writes until the transaction commits or rolls back, preventing phantom reads and negative stock.
 */
export async function lockStockBalanceForUpdate(
  transaction: Prisma.TransactionClient,
  params: {
    companyId: string;
    itemId: string;
    warehouseId?: string | null;
    branchId?: string | null;
    locationId?: string | null;
  },
): Promise<LockedStockBalance | null> {
  const rows = await transaction.$queryRaw<LockedStockBalance[]>`
    SELECT id, company_id, item_id, warehouse_id, branch_id, location_id, stock_on_hand, available_stock, version
    FROM inventory_stock_balances
    WHERE company_id = CAST(${params.companyId} AS uuid)
      AND item_id = CAST(${params.itemId} AS uuid)
      AND (
        (${params.warehouseId ?? null}::uuid IS NOT NULL AND warehouse_id = ${params.warehouseId ?? null}::uuid)
        OR (${params.warehouseId ?? null}::uuid IS NULL AND warehouse_id IS NULL)
      )
      AND (
        (${params.branchId ?? null}::uuid IS NOT NULL AND branch_id = ${params.branchId ?? null}::uuid)
        OR (${params.branchId ?? null}::uuid IS NULL AND branch_id IS NULL)
      )
      AND (
        (${params.locationId ?? null}::uuid IS NOT NULL AND location_id = ${params.locationId ?? null}::uuid)
        OR (${params.locationId ?? null}::uuid IS NULL AND location_id IS NULL)
      )
    FOR UPDATE
  `;

  return rows[0] ?? null;
}

/**
 * Optimistically updates a stock balance record with version increment.
 * Throws ConcurrencyConflictError if the version does not match expected version.
 */
export async function optimisticUpdateStockBalance(
  transaction: Prisma.TransactionClient,
  id: string,
  expectedVersion: number,
  data: Prisma.StockBalanceUpdateInput,
) {
  const result = await transaction.stockBalance.updateMany({
    where: {
      id,
      version: expectedVersion,
    },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new ConcurrencyConflictError('Stock balance was updated by another user concurrently. Please retry.');
  }

  return result;
}
