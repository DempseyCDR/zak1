import { describe, expect, it } from "vitest";
import { onlineFeeCents } from "@/server/domain/treasurer/fees";

// FR-008, SC-002 — online fee = $0.49/txn + 1.99% of amount, exact cents.
describe("onlineFeeCents", () => {
  it("computes the fixed online formula", () => {
    // 5 txns = 245c; 1.99% of $100 (10000c) = 199c → 444c
    expect(onlineFeeCents(5, 10000)).toBe(444);
  });
  it("is zero with no activity", () => {
    expect(onlineFeeCents(0, 0)).toBe(0);
  });
});
