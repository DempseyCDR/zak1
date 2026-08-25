import { describe, it, expect } from "vitest";
import { pricingFromTiers, pricingSummary } from "@/server/domain/public/publicPricing";
import type { AdmissionTier } from "@/server/domain/pricing/admissionPricingService";

const tier = (label: string, amountCents: number, sortOrder = 0): AdmissionTier => ({
  label,
  amountCents,
  sortOrder,
});

// Feature 054 (P7-R10): the pure pricing derivation + card summary. Configured-free ($0 tiers) must read
// "Free", distinct from unconfigured (null → no price) — the 019 $0-vs-null distinction.
describe("pricingFromTiers", () => {
  it("override amount → flat (in dollars)", () => {
    expect(pricingFromTiers([tier("Dancer", 1200)], 2500)).toEqual({ kind: "flat", amount: 25 });
  });

  it("tiers → {tiers} in dollars", () => {
    const p = pricingFromTiers([tier("Supporter", 1500, 0), tier("Student", 500, 1)], null);
    expect(p).toEqual({
      kind: "tiers",
      tiers: [
        { label: "Supporter", amount: 15 },
        { label: "Student", amount: 5 },
      ],
    });
  });

  it("a non-empty ALL-$0 tier set stays {tiers} (configured-free, not null)", () => {
    expect(pricingFromTiers([tier("Musicians", 0)], null)).toEqual({
      kind: "tiers",
      tiers: [{ label: "Musicians", amount: 0 }],
    });
  });

  it("empty tiers + no override → null (unconfigured)", () => {
    expect(pricingFromTiers([], null)).toBeNull();
  });
});

describe("pricingSummary", () => {
  it("flat → $X, flat $0 → Free", () => {
    expect(pricingSummary({ kind: "flat", amount: 25 })).toBe("$25");
    expect(pricingSummary({ kind: "flat", amount: 0 })).toBe("Free");
  });

  it("tiers → range over distinct non-zero amounts", () => {
    expect(
      pricingSummary({
        kind: "tiers",
        tiers: [
          { label: "Supporter", amount: 15 },
          { label: "Dancer", amount: 12 },
          { label: "Student", amount: 5 },
          { label: "Musicians", amount: 0 },
        ],
      }),
    ).toBe("$5–$15");
  });

  it("single distinct non-zero → $X", () => {
    expect(pricingSummary({ kind: "tiers", tiers: [{ label: "All", amount: 12 }] })).toBe("$12");
  });

  it("all-$0 tier set → Free (never blank)", () => {
    expect(pricingSummary({ kind: "tiers", tiers: [{ label: "Free", amount: 0 }] })).toBe("Free");
  });

  it("null → null", () => {
    expect(pricingSummary(null)).toBeNull();
  });
});
