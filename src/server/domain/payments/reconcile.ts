/**
 * Feature 019 US2 (FR-008): reconcile what was ACTUALLY disbursed against what was booked (expected).
 * Pure, integer cents. `deltaCents = actual − expected` is INFORMATIONAL — a non-zero delta surfaces a
 * gap for the treasurer to notice, never an error (over- or under-payment both happen legitimately).
 */
export type Reconciliation = {
  expectedCents: number;
  actualCents: number;
  deltaCents: number;
};

export function reconcilePayments(expectedCents: number[], actualCents: number[]): Reconciliation {
  const expected = expectedCents.reduce((a, c) => a + c, 0);
  const actual = actualCents.reduce((a, c) => a + c, 0);
  return { expectedCents: expected, actualCents: actual, deltaCents: actual - expected };
}
