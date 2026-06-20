/**
 * Pure door-money calculators, all in integer cents (exact). Used by the door
 * record service; unit-tested independently.
 */

/** Door POS fee = $0.09 per transaction + 2.29% of gross. */
export function posFeeCents(transactionCount: number, posGrossCents: number): number {
  const perTxn = Math.round(transactionCount * 9); // 9 cents each
  const pct = Math.round(posGrossCents * 0.0229);
  return perTxn + pct;
}

/** Deposit = gross cash − seed float − cash paid out. */
export function depositCents(
  grossCashCents: number,
  seedFloatCents: number,
  cashPaidOutCents: number,
): number {
  return grossCashCents - seedFloatCents - cashPaidOutCents;
}
