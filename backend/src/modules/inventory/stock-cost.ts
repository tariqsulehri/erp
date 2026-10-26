import { Decimal } from 'decimal.js';

function money(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Weighted-average cost of stock leaving a holder, worked out from the locked balance row.
 * Issuing the whole quantity takes the whole remaining value so no value is left on zero stock.
 */
export function issueCost(stockOnHand: Decimal, stockValue: Decimal, quantity: Decimal) {
  if (stockOnHand.lte(0) || quantity.lte(0)) return new Decimal(0);
  if (quantity.gte(stockOnHand)) return money(stockValue);
  return money(stockValue.times(quantity).div(stockOnHand));
}

/** Current weighted-average unit cost of a holder balance, or null when the holder has no stock. */
export function averageUnitCost(stockOnHand: Decimal, stockValue: Decimal) {
  if (stockOnHand.lte(0)) return null;
  return stockValue.div(stockOnHand).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}
