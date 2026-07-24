import { describe, expect, it } from "vitest";
import { nextMembershipYearEnd } from "@/server/domain/membership/membershipTerm";

// FR-003/FR-003a — a dues payment resolves expiry to the NEXT occurrence of the club's membership-year-end
// boundary on/after the payment date. Pure; year-agnostic MM-DD boundary.
describe("nextMembershipYearEnd", () => {
  it("returns this year's boundary when the payment is before it", () => {
    expect(nextMembershipYearEnd("2026-03-10", "08-31")).toBe("2026-08-31");
  });

  it("rolls to next year when the payment is after the boundary", () => {
    expect(nextMembershipYearEnd("2026-09-01", "08-31")).toBe("2027-08-31");
  });

  it("a payment ON the boundary returns that same date (inclusive)", () => {
    expect(nextMembershipYearEnd("2026-08-31", "08-31")).toBe("2026-08-31");
  });

  it("handles a December→January rollover boundary", () => {
    expect(nextMembershipYearEnd("2026-12-15", "01-01")).toBe("2027-01-01");
    expect(nextMembershipYearEnd("2026-01-01", "01-01")).toBe("2026-01-01");
  });

  it("clamps a 02-29 boundary to Feb 28 in a non-leap year", () => {
    // 2027 is not a leap year → the last valid February day.
    expect(nextMembershipYearEnd("2027-01-10", "02-29")).toBe("2027-02-28");
  });

  it("keeps 02-29 in a leap year", () => {
    // 2028 is a leap year.
    expect(nextMembershipYearEnd("2028-01-10", "02-29")).toBe("2028-02-29");
  });
});
