import { Decimal } from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { holderCondition, holderLabel, type StockHolder } from './stock-holder.js';

type TransactionClient = Prisma.TransactionClient;

function businessError(message: string) {
  const error = new Error(message);
  Object.assign(error, { statusCode: 400 });
  return error;
}

/**
 * Changes one stock balance by an exact quantity and value, as a reversal must: the same value goes back
 * that the original document moved, so stock value and the Inventory account stay equal.
 * A negative change is refused when the place no longer holds that much stock or stock value.
 * Call inside the posting transaction; the row is locked here if the caller has not locked it yet.
 * Returns the stock on hand after the change.
 */
export async function applyExactStockChange(
  transaction: TransactionClient,
  companyId: string,
  holder: StockHolder,
  item: { item_id: string; item_code: string },
  quantityChange: Decimal,
  valueChange: Decimal,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string; stock_on_hand: string; total_stock_value: string }>>`
    SELECT id, stock_on_hand::text, total_stock_value::text
    FROM inventory_stock_balances
    WHERE company_id = CAST(${companyId} AS uuid)
      AND item_id = CAST(${item.item_id} AS uuid)
      AND ${holderCondition(holder)}
    FOR UPDATE
  `;
  const row = rows[0];
  const oldQuantity = new Decimal(row?.stock_on_hand ?? 0);
  const oldValue = new Decimal(row?.total_stock_value ?? 0);
  const newQuantity = oldQuantity.plus(quantityChange).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const newValue = oldValue.plus(valueChange).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
  const place = holderLabel(holder);

  if (newQuantity.lt(0)) {
    throw businessError(`Cannot reverse: the ${place} now has only ${oldQuantity.toFixed(4)} of ${item.item_code}, but ${quantityChange.abs().toFixed(4)} must be taken back.`);
  }
  if (newValue.lt(0)) {
    throw businessError(`Cannot reverse: the stock value of ${item.item_code} at the ${place} is now less than the value that must be taken back.`);
  }
  const averageCost = newQuantity.gt(0) ? newValue.div(newQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP) : new Decimal(0);

  if (row) {
    await transaction.$queryRaw`
      UPDATE inventory_stock_balances
      SET stock_on_hand = CAST(${newQuantity.toFixed(4)} AS numeric),
          available_stock = CAST(${newQuantity.toFixed(4)} AS numeric) - reserved_stock,
          average_cost = CAST(${averageCost.toFixed(4)} AS numeric),
          total_stock_value = CAST(${newValue.toFixed(4)} AS numeric),
          is_active = true,
          updated_at = now()
      WHERE id = CAST(${row.id} AS uuid)
    `;
  } else {
    await transaction.$queryRaw`
      INSERT INTO inventory_stock_balances (
        company_id, item_id, branch_id, warehouse_id, location_id, stock_on_hand, reserved_stock,
        available_stock, average_cost, total_stock_value, is_active, updated_at
      )
      VALUES (
        CAST(${companyId} AS uuid),
        CAST(${item.item_id} AS uuid),
        ${holder.branchId}::uuid,
        ${holder.warehouseId}::uuid,
        ${holder.locationId}::uuid,
        CAST(${newQuantity.toFixed(4)} AS numeric),
        0,
        CAST(${newQuantity.toFixed(4)} AS numeric),
        CAST(${averageCost.toFixed(4)} AS numeric),
        CAST(${newValue.toFixed(4)} AS numeric),
        true,
        now()
      )
    `;
  }
  return newQuantity;
}
