import { describe, expect, it } from "vitest";
import { reconcilePayments } from "@/server/domain/payments/reconcile";

// Feature 019 US2 (FR-008): reconcile actual disbursements against booked obligations. The delta is
// informational (surfaces a gap), never an error. All integer cents.
describe("reconcilePayments", () => {
  it("computes expected, actual, and delta", () => {
    expect(reconcilePayments([12500, 12500], [25000])).toEqual({
      expectedCents: 25000,
      actualCents: 25000,
      deltaCents: 0,
    });
  });

  it("surfaces a negative delta when actual is under expected", () => {
    expect(reconcilePayments([12500, 12500], [23000])).toEqual({
      expectedCents: 25000,
      actualCents: 23000,
      deltaCents: -2000,
    });
  });

  it("surfaces a positive delta when actual exceeds expected", () => {
    expect(reconcilePayments([10000], [12000])).toEqual({
      expectedCents: 10000,
      actualCents: 12000,
      deltaCents: 2000,
    });
  });

  it("handles empty payment and obligation lists", () => {
    expect(reconcilePayments([], [])).toEqual({
      expectedCents: 0,
      actualCents: 0,
      deltaCents: 0,
    });
  });
});
