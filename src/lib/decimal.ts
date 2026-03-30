import Decimal from 'decimal.js';

/**
 * CRITICAL: All financial calculations use Decimal.js, never JavaScript floats
 * This ensures accuracy for accounting calculations per GAAP/IFRS standards
 */

// Configure Decimal.js for financial precision
Decimal.set({
  precision: 18,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

/**
 * Create a monetary value from a number or string
 * Always use this instead of plain numbers for financial data
 */
export function money(value: number | string | Decimal): Decimal {
  return new Decimal(value);
}

/**
 * Add two monetary values
 */
export function add(a: Decimal | number | string, b: Decimal | number | string): Decimal {
  return money(a).plus(b);
}

/**
 * Subtract b from a
 */
export function subtract(
  a: Decimal | number | string,
  b: Decimal | number | string,
): Decimal {
  return money(a).minus(b);
}

/**
 * Multiply two monetary values
 */
export function multiply(
  a: Decimal | number | string,
  b: Decimal | number | string,
): Decimal {
  return money(a).times(b);
}

/**
 * Divide a by b
 */
export function divide(
  a: Decimal | number | string,
  b: Decimal | number | string,
): Decimal {
  return money(a).dividedBy(b);
}

/**
 * Check if value is zero
 */
export function isZero(value: Decimal | number | string): boolean {
  return money(value).isZero();
}

/**
 * Check if value is positive
 */
export function isPositive(value: Decimal | number | string): boolean {
  return money(value).isPositive();
}

/**
 * Check if value is negative
 */
export function isNegative(value: Decimal | number | string): boolean {
  return money(value).isNegative();
}

/**
 * Compare two monetary values
 * Returns: -1 (a < b), 0 (a = b), 1 (a > b)
 */
export function compare(
  a: Decimal | number | string,
  b: Decimal | number | string,
): number {
  return money(a).comparedTo(b);
}

/**
 * Get absolute value
 */
export function abs(value: Decimal | number | string): Decimal {
  return money(value).abs();
}

/**
 * Round to specified decimal places
 */
export function round(
  value: Decimal | number | string,
  decimalPlaces: number = 2,
): Decimal {
  return money(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_UP);
}

/**
 * Format as currency string (without symbol)
 */
export function formatCurrency(
  value: Decimal | number | string,
  decimalPlaces: number = 2,
  thousandsSeparator: string = ',',
  decimalSeparator: string = '.',
): string {
  const decimal = money(value);
  const isNegative = decimal.isNegative();
  const absValue = decimal.abs().toDecimalPlaces(decimalPlaces);

  const [integerPart, fractionalPart] = absValue.toString().split('.');

  // Add thousands separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

  const padded = fractionalPart ? fractionalPart.padEnd(decimalPlaces, '0') : '0'.repeat(decimalPlaces);

  const result = `${formattedInteger}${decimalSeparator}${padded}`;

  return isNegative ? `-${result}` : result;
}

/**
 * Sum an array of monetary values
 */
export function sum(values: (Decimal | number | string)[]): Decimal {
  return values.reduce((acc: Decimal, val) => acc.plus(val), new Decimal(0));
}

/**
 * Calculate average
 */
export function average(values: (Decimal | number | string)[]): Decimal {
  if (values.length === 0) return new Decimal(0);
  return sum(values).dividedBy(values.length);
}

/**
 * Calculate percentage
 */
export function percentage(
  value: Decimal | number | string,
  percentOf: Decimal | number | string,
): Decimal {
  return money(value).dividedBy(percentOf).times(100);
}

/**
 * Apply percentage to value
 */
export function applyPercentage(
  value: Decimal | number | string,
  percent: Decimal | number | string,
): Decimal {
  return money(value).times(money(percent).dividedBy(100));
}

/**
 * Safely convert to number (for comparisons only, never for calculations)
 */
export function toNumber(value: Decimal | number | string): number {
  return money(value).toNumber();
}

/**
 * Safely convert to string
 */
export function toString(value: Decimal | number | string): string {
  return money(value).toString();
}

/**
 * Validate if string can be converted to decimal
 */
export function isValidDecimal(value: unknown): boolean {
  try {
    new Decimal(value as any);
    return true;
  } catch {
    return false;
  }
}
