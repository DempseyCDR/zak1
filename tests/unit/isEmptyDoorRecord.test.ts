import { describe, expect, it } from "vitest";
import { isEmptyDoorRecord, type DoorRecordMoney } from "@/server/domain/door/calc";

// Feature 019 US4 (FR-017): a door record is "empty" — not real event history — when it has no gate sales
// and every money field and count is zero. The SEED FLOAT is excluded: it is a pre-filled default, not
// takings (and after US5 a configured value), so it proves nothing about whether the night happened.
const ZERO: DoorRecordMoney = {
  posTransactionCount: 0,
  pcGrossCents: 0,
  posFeeCents: 0,
  grossCashCents: 0,
  seedFloatCents: 1500,
  cashPaidOutCents: 0,
  depositCents: 0,
  giftCardRedemptionCount: 0,
  compCount: 0,
  openBandCount: 0,
};

describe("isEmptyDoorRecord", () => {
  it("is empty when all money/counts are zero and there are no gate sales", () => {
    expect(isEmptyDoorRecord(ZERO, 0)).toBe(true);
  });

  it("a non-default seed float ALONE does not make it non-empty", () => {
    expect(isEmptyDoorRecord({ ...ZERO, seedFloatCents: 2500 }, 0)).toBe(true);
    expect(isEmptyDoorRecord({ ...ZERO, seedFloatCents: 0 }, 0)).toBe(true);
  });

  it("one gate sale makes it non-empty", () => {
    expect(isEmptyDoorRecord(ZERO, 1)).toBe(false);
  });

  it("any non-zero money field or count makes it non-empty", () => {
    expect(isEmptyDoorRecord({ ...ZERO, grossCashCents: 100 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, pcGrossCents: 100 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, posFeeCents: 5 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, posTransactionCount: 1 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, cashPaidOutCents: 100 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, depositCents: 100 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, giftCardRedemptionCount: 1 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, compCount: 1 }, 0)).toBe(false);
    expect(isEmptyDoorRecord({ ...ZERO, openBandCount: 1 }, 0)).toBe(false);
  });
});
