/**
 * Money is represented as integer cents everywhere (Constitution: exact math).
 * These helpers convert at the API boundary and do exact arithmetic.
 */

/** Convert a dollar amount (number) to integer cents, rounding half-up. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Format integer cents as a dollar number (for responses). */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Sum integer-cent amounts exactly. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}
