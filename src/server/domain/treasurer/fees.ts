/**
 * Online payment-processor fee (fixed formula; card/Venmo/PayPal only): $0.49 per
 * transaction + 1.99% of amount, in integer cents. The door fee is computed and
 * stored by feature 002 (`posFeeCents`) and read from the door record, not here.
 */
export function onlineFeeCents(transactionCount: number, grossCents: number): number {
  return Math.round(transactionCount * 49) + Math.round(grossCents * 0.0199);
}
